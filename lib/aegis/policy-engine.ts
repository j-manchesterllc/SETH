// AEGIS Policy Engine - Governance rules for SETH survival operations
// All opportunity cards must pass AEGIS evaluation before creation

export interface AegisPolicyResult {
  passed: boolean;
  score: number; // 0-100
  violations: string[];
  warnings: string[];
  metadata: Record<string, any>;
}

export interface OpportunityForEvaluation {
  type: 'MONEY' | 'BUSINESS';
  netBenefit: number;        // Annual/monthly net profit after ALL costs
  fees: number;              // Total fees
  taxes: number;             // Total taxes
  totalInvestment?: number;  // Upfront capital required
  paybackMonths?: number;    // Time to recover investment
  riskFactors: string[];     // Identified risks
  runwayDays: number;        // Current emergency runway in days
  sourceEventId: string;
  userId: string;
}

/**
 * AEGIS Core Policy: "Survival First"
 * Every opportunity must:
 * 1. Have positive net benefit after ALL fees and taxes
 * 2. Not consume emergency runway
 * 3. Have fees+taxes < 30% of gross gain
 * 4. Payback within 12 months (for capital-intensive ops)
 * 5. No critical risk factors unmitigated
 */
export async function evaluateOpportunity(
  opp: OpportunityForEvaluation,
  emergencyRunwayCents: number
): Promise<AegisPolicyResult> {
  const violations: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // Policy 1: Positive net benefit (non-negotiable)
  if (opp.netBenefit <= 0) {
    violations.push('NET_BENEFIT_NON_POSITIVE: Opportunity must yield positive net profit after all fees/taxes');
    score -= 50;
  }

  // Policy 2: Fees + Taxes < 50% of gross gain (yield spreads have 37% tax on interest)
  const grossGain = opp.netBenefit + opp.fees + opp.taxes;
  const feeTaxRatio = grossGain > 0 ? (opp.fees + opp.taxes) / grossGain : 1;
  
  // Different thresholds by type
  const maxFeeTaxRatio = opp.type === 'MONEY' ? 0.50 : 0.50; // Both: 50% (tax on profit is 37% alone)
  
  if (feeTaxRatio > maxFeeTaxRatio) {
    violations.push(`FEE_TAX_RATIO_EXCEEDED: Fees+taxes are ${(feeTaxRatio * 100).toFixed(1)}% of gross gain (max ${(maxFeeTaxRatio * 100).toFixed(0)}% for ${opp.type})`);
    score -= 25;
  } else if (feeTaxRatio > maxFeeTaxRatio * 0.8) {
    warnings.push(`Fee+tax ratio is ${(feeTaxRatio * 100).toFixed(1)}% (approaching ${(maxFeeTaxRatio * 100).toFixed(0)}% limit)`);
    score -= 10;
  }

  // Policy 3: Emergency runway protection
    // Use passed runwayDays (calculated by agent based on actual balances)
    if (opp.runwayDays < 30) {
      violations.push(`RUNWAY_CRITICAL: Only ${opp.runwayDays} days of emergency cash remaining (minimum 30)`);
      score -= 30;
    } else if (opp.runwayDays < 60) {
      warnings.push(`Runway is ${opp.runwayDays} days (below 60-day comfort zone)`);
      score -= 10;
    }

  // Policy 4: Capital payback period (for BUSINESS type with investment)
  if (opp.type === 'BUSINESS' && opp.totalInvestment && opp.paybackMonths) {
    if (opp.paybackMonths > 12) {
      violations.push(`PAYBACK_TOO_LONG: ${opp.paybackMonths.toFixed(1)} months to recover $${(opp.totalInvestment/100).toFixed(0)} investment (max 12)`);
      score -= 20;
    } else if (opp.paybackMonths > 6) {
      warnings.push(`Payback period is ${opp.paybackMonths.toFixed(1)} months (above 6-month preference)`);
      score -= 5;
    }
  }

  // Policy 5: Risk factor evaluation
  const criticalRisks = opp.riskFactors.filter(r => 
    r.toLowerCase().includes('critical') || 
    r.toLowerCase().includes('high') ||
    r.toLowerCase().includes('regulatory') ||
    r.toLowerCase().includes('legal')
  );
  if (criticalRisks.length > 0) {
    violations.push(`CRITICAL_RISKS: ${criticalRisks.join('; ')}`);
    score -= 30;
  }

  // Policy 6: Minimum meaningful profit threshold
  const minAnnualProfit = opp.type === 'MONEY' ? 100 : 500; // $100/yr for yield, $500/mo for business
  if (opp.netBenefit < minAnnualProfit) {
    violations.push(`BELOW_THRESHOLD: Net benefit $${opp.netBenefit.toFixed(2)} below minimum $${minAnnualProfit}/${opp.type === 'MONEY' ? 'yr' : 'mo'}`);
    score -= 15;
  }

  // Policy 7: Concentration risk (simplified - would check existing portfolio)
  // For now, just warn if investment > 50% of runway
  if (opp.totalInvestment && emergencyRunwayCents > 0) {
    const investmentRatio = opp.totalInvestment / emergencyRunwayCents;
    if (investmentRatio > 0.5) {
      warnings.push(`Investment ($${(opp.totalInvestment/100).toFixed(0)}) exceeds 50% of emergency runway`);
      score -= 10;
    }
  }

  return {
    passed: violations.length === 0,
    score: Math.max(0, score),
    violations,
    warnings,
    metadata: {
      feeTaxRatio: Math.round(feeTaxRatio * 10000) / 100, // basis points
      runwayDays: Math.round(opp.runwayDays),
      paybackMonths: opp.paybackMonths,
      investmentRatio: opp.totalInvestment && emergencyRunwayCents ? opp.totalInvestment / emergencyRunwayCents : 0,
    },
  };
}

/**
 * Batch evaluate multiple opportunities
 */
export async function evaluateBatch(
  opportunities: OpportunityForEvaluation[],
  emergencyRunwayCents: number
): Promise<Map<string, AegisPolicyResult>> {
  const results = new Map<string, AegisPolicyResult>();
  
  for (const opp of opportunities) {
    const result = await evaluateOpportunity(opp, emergencyRunwayCents);
    results.set(opp.sourceEventId, result);
  }
  
  return results;
}

/**
 * Quick pre-filter: reject obviously bad opportunities before full evaluation
 */
export function quickFilter(opp: OpportunityForEvaluation): boolean {
  if (opp.netBenefit <= 0) return false;
  if (opp.fees + opp.taxes > opp.netBenefit * 0.5) return false; // Fees+taxes > 50% of net
  if (opp.riskFactors.some(r => r.toLowerCase().includes('critical'))) return false;
  return true;
}