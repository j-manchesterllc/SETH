import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { PrismaClient } from '@prisma/client';
import { evaluateOpportunity } from '@/lib/aegis/policy-engine';

const prisma = new PrismaClient();

// Plaid Sandbox Configuration
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

// Yield benchmarks (annual %) - these are what we compare against
const YIELD_BENCHMARKS = {
  CHECKING: 0.01,      // 0.01% - big bank checking
  SAVINGS: 0.40,       // 0.40% - big bank savings
  HIGH_YIELD_SAVINGS: 4.50,  // 4.50% - HYSA (Marcus, Ally, etc.)
  MONEY_MARKET: 4.25,  // 4.25% - money market
  CD_12M: 5.00,        // 5.00% - 12-month CD
  TREASURY_1M: 5.25,   // 5.25% - 1-month T-bill
  TREASURY_12M: 5.10,  // 5.10% - 12-month T-bill
};

const FEE_ESTIMATES = {
  ACH_TRANSFER: 0,        // usually free
  WIRE_TRANSFER: 25,      // $25 typical outgoing wire
  EARLY_WITHDRAWAL_CD: 0.06, // ~6 months interest penalty
  TAX_RATE: 0.37,         // top marginal rate for interest income
};

interface AccountWithYield {
  accountId: string;
  name: string;
  type: string;
  subtype: string;
  balance: number;
  apy?: number;
  institutionName: string;
}

interface YieldOpportunity {
  fromAccount: AccountWithYield;
  toProduct: string;
  benchmarkYield: number;
  currentYield: number;
  spread: number;
  annualGain: number;
  netAfterFeesTaxes: number;
  fees: number;
  taxes: number;
  actionRequired: string[];
}

async function createSandboxPublicToken(): Promise<string> {
  const response = await plaidClient.sandboxPublicTokenCreate({
    institution_id: 'ins_109508', // First Platypus Bank (sandbox)
    initial_products: ['auth', 'transactions'],
  });
  return response.data.public_token;
}

async function exchangePublicToken(publicToken: string): Promise<string> {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });
  return response.data.access_token;
}

async function getAccounts(accessToken: string): Promise<AccountWithYield[]> {
  const response = await plaidClient.accountsGet({ access_token: accessToken });
  const accounts = response.data.accounts;
  
  const institutionResponse = await plaidClient.itemGet({ access_token: accessToken });
  const institutionId = institutionResponse.data.item.institution_id;
  
  let institutionName = 'Unknown Bank';
  if (institutionId) {
    const instResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    });
    institutionName = instResponse.data.institution.name;
  }

  return accounts
    .filter(acc => ['depository', 'investment'].includes(acc.type))
    .map(acc => ({
      accountId: acc.account_id,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype || '',
      balance: acc.balances.current || 0,
      apy: undefined, // Plaid doesn't provide APY directly in sandbox
      institutionName,
    }));
}

function estimateCurrentYield(account: AccountWithYield): number {
  // In sandbox, we don't get real APY. Use benchmarks based on account subtype
  const subtype = account.subtype?.toLowerCase() || '';
  
  if (subtype.includes('checking')) return YIELD_BENCHMARKS.CHECKING;
  if (subtype.includes('savings')) return YIELD_BENCHMARKS.SAVINGS;
  if (subtype.includes('money market') || subtype.includes('mma')) return YIELD_BENCHMARKS.MONEY_MARKET;
  if (subtype.includes('cd') || subtype.includes('certificate')) return YIELD_BENCHMARKS.CD_12M;
  
  return YIELD_BENCHMARKS.SAVINGS; // default
}

function findYieldOpportunities(accounts: AccountWithYield[]): YieldOpportunity[] {
  const opportunities: YieldOpportunity[] = [];
  
  // Only consider depository accounts with meaningful balances
  const cashAccounts = accounts.filter(
    a => a.type === 'depository' && a.balance > 1000
  );
  
  for (const account of cashAccounts) {
    const currentYield = estimateCurrentYield(account);
    
    // Check each higher-yield alternative
    const alternatives = [
      { product: 'High-Yield Savings (Marcus/Ally)', yield: YIELD_BENCHMARKS.HIGH_YIELD_SAVINGS, fees: FEE_ESTIMATES.ACH_TRANSFER, action: ['Open HYSA', 'Link external account', 'Transfer funds via ACH'] },
      { product: 'Money Market Fund (VUSXX/SPAXX)', yield: YIELD_BENCHMARKS.MONEY_MARKET, fees: FEE_ESTIMATES.ACH_TRANSFER, action: ['Open brokerage account', 'Buy money market fund', 'Set up auto-sweep'] },
      { product: '12-Month CD', yield: YIELD_BENCHMARKS.CD_12M, fees: FEE_ESTIMATES.EARLY_WITHDRAWAL_CD, action: ['Open CD', 'Lock funds for 12 months', 'Set calendar reminder for maturity'] },
      { product: 'Treasury Bills (1-month)', yield: YIELD_BENCHMARKS.TREASURY_1M, fees: FEE_ESTIMATES.ACH_TRANSFER, action: ['Open TreasuryDirect or brokerage', 'Set up auto-roll', 'Link bank account'] },
    ];
    
    for (const alt of alternatives) {
      const spread = alt.yield - currentYield;
      if (spread <= 0.25) continue; // Only meaningful spreads > 0.25%
      
      const annualGain = account.balance * (spread / 100);
      const taxes = annualGain * FEE_ESTIMATES.TAX_RATE;
      const netAfterFeesTaxes = annualGain - alt.fees - taxes;
      
      if (netAfterFeesTaxes > 50) { // Only worthwhile if >$50/year net
        opportunities.push({
          fromAccount: account,
          toProduct: alt.product,
          benchmarkYield: alt.yield,
          currentYield,
          spread,
          annualGain,
          netAfterFeesTaxes,
          fees: alt.fees,
          taxes,
          actionRequired: alt.action,
        });
      }
    }
  }
  
  // Sort by net benefit descending
  return opportunities.sort((a, b) => b.netAfterFeesTaxes - a.netAfterFeesTaxes);
}

async function runMoneyAgent(userId: string = 'default-user'): Promise<{
  moneyEventsCreated: number;
  opportunityCardsCreated: number;
  topOpportunity: YieldOpportunity | null;
}> {
  console.log('[MoneyAgent] Starting yield scan...');
  
  // 1. Get or create Plaid access token
  let accessToken = process.env.PLAID_SANDBOX_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.log('[MoneyAgent] Creating sandbox public token...');
    const publicToken = await createSandboxPublicToken();
    accessToken = await exchangePublicToken(publicToken);
    console.log('[MoneyAgent] Access token obtained');
    // In production, store this encrypted per user
  }
  
  // 2. Fetch accounts
  const accounts = await getAccounts(accessToken);
  console.log(`[MoneyAgent] Found ${accounts.length} accounts`);
  
  // 3. Calculate opportunities
    const opportunities = findYieldOpportunities(accounts);
    console.log(`[MoneyAgent] Found ${opportunities.length} yield opportunities`);

    // 4. Write MoneyEvents and OpportunityCards (with deduplication)
    let moneyEventsCreated = 0;
    let opportunityCardsCreated = 0;

    for (const opp of opportunities) {
      // DEDUP: Skip if MoneyEvent for same account+target already exists in DETECTED status
      const existing = await prisma.moneyEvent.findFirst({
        where: {
          userId,
          type: 'YIELD_SPREAD',
          status: 'DETECTED',
          payload: {
            path: ['fromAccount'],
            equals: opp.fromAccount.accountId,
          },
        },
      });
      if (existing) {
        console.log(`[MoneyAgent] Skipping duplicate: ${opp.fromAccount.name} → ${opp.toProduct}`);
        continue;
      }
    
      // Create MoneyEvent
      const moneyEvent = await prisma.moneyEvent.create({
      data: {
        userId,
        type: 'YIELD_SPREAD',
        netProfit: opp.netAfterFeesTaxes,
        payload: {
          fromAccount: opp.fromAccount.accountId,
          fromInstitution: opp.fromAccount.institutionName,
          currentBalance: opp.fromAccount.balance,
          currentYield: opp.currentYield,
          targetProduct: opp.toProduct,
          targetYield: opp.benchmarkYield,
          spread: opp.spread,
          estimatedAnnualGain: opp.annualGain,
          estimatedFees: opp.fees,
          estimatedTaxes: opp.taxes,
          netAfterFeesTaxes: opp.netAfterFeesTaxes,
          actionsRequired: opp.actionRequired,
        },
      },
    });
    moneyEventsCreated++;

        // AEGIS Policy Gate
        const runway = await prisma.emergencyRunway.findUnique({ where: { userId } });
        const emergencyRunwayCents = runway?.amountCents || 1000000;
        // Runway in days: emergency_cash / (monthly_burn / 30)
        // Estimate monthly burn from total account balances * 0.05 (5% monthly spend rate)
        const totalBalances = accounts.reduce((sum, a) => sum + a.balance, 0);
        const estimatedMonthlyBurn = totalBalances * 0.05; // 5% of balances per month
        const estimatedDailyBurn = estimatedMonthlyBurn / 30;
        const runwayDays = estimatedDailyBurn > 0 ? Math.floor((emergencyRunwayCents / 100) / estimatedDailyBurn) : 999;

        const aegisResult = await evaluateOpportunity({
          type: 'MONEY',
          netBenefit: opp.netAfterFeesTaxes,
          fees: opp.fees,
          taxes: opp.taxes,
          riskFactors: [],
          runwayDays,
          sourceEventId: moneyEvent.id,
          userId,
        }, emergencyRunwayCents);

        console.log(`[AEGIS] ${moneyEvent.id}: ${aegisResult.passed ? 'PASS' : 'FAIL'} (score: ${aegisResult.score})`);
        if (!aegisResult.passed) {
          console.log(`[AEGIS]   Violations: ${aegisResult.violations.join('; ')}`);
          await prisma.moneyEvent.update({
            where: { id: moneyEvent.id },
            data: { payload: { ...moneyEvent.payload, aegisStatus: 'FAILED', aegisViolations: aegisResult.violations } },
          });
          continue;
        }

        // Create OpportunityCard (1-click approval) - only for AEGIS-passed
        await prisma.opportunityCard.create({
      data: {
        sourceEventId: moneyEvent.id,
        sourceEventType: 'MONEY',
        title: `Move ${(opp.fromAccount.balance/1000).toFixed(0)}k from ${opp.fromAccount.institutionName} → ${opp.toProduct}`,
        description: `Current: ${opp.currentYield}% APY → Target: ${opp.benchmarkYield}% APY\nSpread: ${opp.spread.toFixed(2)}%\nGross annual gain: $${opp.annualGain.toFixed(2)}\nFees: $${opp.fees.toFixed(2)}\nTaxes (37%): $${opp.taxes.toFixed(2)}\nNet: $${opp.netAfterFeesTaxes.toFixed(2)}/yr\n\nSteps: ${opp.actionRequired.join(' → ')}`,
        netBenefit: opp.netAfterFeesTaxes,
        fees: opp.fees,
        taxes: opp.taxes,
        requiresApproval: true,
        approved: false,
        executed: false,
      },
    });
    opportunityCardsCreated++;
  }
  
  // 5. Ensure EmergencyRunway exists
  const runway = await prisma.emergencyRunway.findUnique({ where: { userId } });
  if (!runway) {
    await prisma.emergencyRunway.create({
      data: { userId, amountCents: 1000000, currency: 'USD' }, // $10k default
    });
  }
  
  const topOpportunity = opportunities[0] || null;
  
  console.log(`[MoneyAgent] Complete: ${moneyEventsCreated} MoneyEvents, ${opportunityCardsCreated} OpportunityCards`);
  if (topOpportunity) {
    console.log(`[MoneyAgent] TOP: ${topOpportunity.fromAccount.institutionName} ${topOpportunity.fromAccount.name} → ${topOpportunity.toProduct} = $${topOpportunity.netAfterFeesTaxes.toFixed(2)}/yr net`);
  }
  
  return { moneyEventsCreated, opportunityCardsCreated, topOpportunity };
}

// Run if called directly
if (require.main === module) {
  runMoneyAgent()
    .then(result => {
      console.log('\n=== MONEY AGENT RESULT ===');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('[MoneyAgent] ERROR:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

export { runMoneyAgent, findYieldOpportunities, YieldOpportunity };