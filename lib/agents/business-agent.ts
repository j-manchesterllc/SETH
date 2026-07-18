import { ApifyClient } from 'apify-client';
import { PrismaClient } from '@prisma/client';
import { evaluateOpportunity } from '@/lib/aegis/policy-engine';

const prisma = new PrismaClient();

// Apify client with provided token
const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_KEY || '',
});

// Product categories to scan for wholesale margins
const SCAN_CATEGORIES = [
  { category: 'Electronics', keywords: ['phone case', 'usb cable', 'bluetooth headphones', 'portable charger', 'webcam'] },
  { category: 'Home & Kitchen', keywords: ['kitchen organizer', 'storage bins', 'coffee maker', 'air fryer', 'vacuum cleaner'] },
  { category: 'Beauty & Personal Care', keywords: ['vitamin c serum', 'retinol cream', 'electric toothbrush', 'hair dryer', 'facial cleanser'] },
  { category: 'Sports & Outdoors', keywords: ['yoga mat', 'resistance bands', 'camping tent', 'water bottle', 'fitness tracker'] },
  { category: 'Pet Supplies', keywords: ['dog bed', 'cat tree', 'pet feeder', 'dog toys', 'cat litter box'] },
];

// Minimum thresholds for opportunity detection
const THRESHOLDS = {
  WHOLESALE_MARGIN_MIN: 50,      // 50% minimum margin
  WHOLESALE_MARGIN_GOOD: 70,     // 70%+ is strong
  AD_ROI_MIN: 2.0,               // 2x ROAS minimum
  AD_ROI_GOOD: 3.0,              // 3x+ is strong
  MIN_MONTHLY_SEARCH_VOLUME: 1000,
  MAX_COMPETITION: 0.7,          // Google Ads competition 0-1
  MIN_NET_PROFIT_MONTHLY: 500,   // $500/mo minimum
};

interface ScrapedProduct {
  asin: string;
  title: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  bsr: number; // Best Seller Rank
  category: string;
  images: string[];
  description: string;
  brand: string;
  dimensions?: { length: number; width: number; height: number; weight: number };
}

interface WholesaleQuote {
  productId: string;
  supplierPrice: number;
  moq: number; // Minimum Order Quantity
  shippingCostPerUnit: number;
  leadTimeDays: number;
  supplier: string;
}

interface AdMetrics {
  keyword: string;
  monthlySearchVolume: number;
  competition: number; // 0-1
  suggestedBid: number; // CPC
  estimatedCTR: number;
  estimatedConversionRate: number;
}

interface BusinessOpportunity {
  type: 'WHOLESALE_MARGIN' | 'AD_ROI_ARBITRAGE';
  product: ScrapedProduct;
  wholesaleQuote?: WholesaleQuote;
  adMetrics?: AdMetrics;
  marginPercent?: number;
  roiMultiple?: number;
  estimatedMonthlyProfit: number;
  estimatedMonthlyRevenue: number;
  totalInvestment: number;
  paybackMonths: number;
  riskFactors: string[];
}

async function searchAmazonProducts(keyword: string, maxResults: number = 20): Promise<ScrapedProduct[]> {
  console.log(`[BusinessAgent] Searching Amazon for: "${keyword}"`);
  
  try {
    const run = await apifyClient.actor('junglee/amazon-product-scraper').call({
      search: keyword,
      maxResults,
      marketplace: 'US',
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    return items.map((item: any) => ({
      asin: item.asin,
      title: item.title || '',
      price: parseFloat(item.price?.replace(/[$,]/g, '') || '0'),
      originalPrice: item.originalPrice ? parseFloat(item.originalPrice.replace(/[$,]/g, '')) : undefined,
      rating: parseFloat(item.rating || '0'),
      reviewCount: parseInt(item.reviewCount?.replace(/[,,]/g, '') || '0'),
      bsr: parseInt(item.bestSellerRank?.replace(/[#,]/g, '') || '999999'),
      category: item.category || 'Unknown',
      images: item.images || [],
      description: item.description || '',
      brand: item.brand || 'Unknown',
      dimensions: item.dimensions,
    })).filter(p => p.price > 0 && p.bsr < 500000); // Filter reasonable products
  } catch (error) {
    console.error(`[BusinessAgent] Amazon scrape failed for "${keyword}":`, error);
    return [];
  }
}

async function searchGoogleShopping(keyword: string, maxResults: number = 20): Promise<ScrapedProduct[]> {
  console.log(`[BusinessAgent] Searching Google Shopping for: "${keyword}"`);
  
  try {
    const run = await apifyClient.actor('epctex/google-shopping-scraper').call({
      queries: [keyword],
      maxResults,
      country: 'US',
      language: 'en',
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    return items.map((item: any) => ({
      asin: `GS-${item.productId || Math.random().toString(36).substr(2, 9)}`,
      title: item.title || '',
      price: parseFloat(item.price?.replace(/[$,]/g, '') || '0'),
      originalPrice: item.originalPrice ? parseFloat(item.originalPrice.replace(/[$,]/g, '')) : undefined,
      rating: parseFloat(item.rating || '0'),
      reviewCount: parseInt(item.reviews?.replace(/[,,]/g, '') || '0'),
      bsr: 999999, // Google Shopping doesn't have BSR
      category: item.category || 'Unknown',
      images: item.images || [],
      description: item.description || '',
      brand: item.merchant || 'Unknown',
    })).filter(p => p.price > 0);
  } catch (error) {
    console.error(`[BusinessAgent] Google Shopping scrape failed for "${keyword}":`, error);
    return [];
  }
}

// Helper: run Apify actor with error handling
async function runApifyActor<T>(actorId: string, input: any): Promise<T[]> {
  try {
    const run = await apifyClient.actor(actorId).call(input, { waitSecs: 60 });
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    return items as T[];
  } catch (error: any) {
    console.error(`[BusinessAgent] Apify actor ${actorId} failed:`, error.message);
    return [];
  }
}

// Fallback: Generate mock product data for testing when Apify actors unavailable
function generateMockProducts(count: number = 20): ScrapedProduct[] {
  const categories = [
    { name: 'Pet Supplies', items: ['Cat Litter Box', 'Dog Bed', 'Pet Fountain', 'Cat Tree', 'Dog Toys'] },
    { name: 'Home & Kitchen', items: ['Air Fryer', 'Blender', 'Coffee Maker', 'Food Storage', 'Knife Set'] },
    { name: 'Electronics', items: ['Wireless Earbuds', 'Phone Charger', 'Tablet Stand', 'Webcam', 'Bluetooth Speaker'] },
    { name: 'Fitness', items: ['Yoga Mat', 'Resistance Bands', 'Dumbbells', 'Foam Roller', 'Jump Rope'] },
    { name: 'Beauty', items: ['Hair Dryer', 'Facial Cleanser', 'Makeup Mirror', 'Nail Kit', 'Skincare Set'] },
  ];
  
  const products: ScrapedProduct[] = [];
  
  for (let i = 0; i < count; i++) {
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const item = cat.items[Math.floor(Math.random() * cat.items.length)];
    const retailPrice = 15 + Math.random() * 150; // $15-165
    const wholesalePrice = retailPrice * (0.15 + Math.random() * 0.35); // 15-50% of retail
    const rating = 3.5 + Math.random() * 1.5; // 3.5-5.0
    const reviewCount = Math.floor(50 + Math.random() * 5000);
    const monthlySales = Math.floor(10 + Math.random() * 2000);
    const bsr = Math.floor(1000 + Math.random() * 500000); // Mock BSR 1000-500000
    
    products.push({
      asin: `B${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
      title: `${item} - Premium ${['Quality', 'Edition', 'Pro', 'Max', 'Ultra'][Math.floor(Math.random() * 5)]}`,
      price: Math.round(retailPrice * 100) / 100,
      rating: Math.round(rating * 10) / 10,
      reviewCount,
      bsr,
      category: cat.name,
      estimatedWholesalePrice: Math.round(wholesalePrice * 100) / 100,
      source: 'mock',
    });
  }
  
  return products;
}

// Simulated wholesale price lookup (in production, integrate with Alibaba/1688/Wholesale Central APIs)
async function getWholesaleQuote(product: ScrapedProduct): Promise<WholesaleQuote | null> {
  // Simulate wholesale pricing based on category and price
  // Real implementation would call Alibaba API, 1688, or wholesale supplier APIs
  
  const categoryMultipliers: Record<string, number> = {
    'Electronics': 0.15,        // 15% of retail (high volume, low margin)
    'Home & Kitchen': 0.25,     // 25% of retail
    'Beauty & Personal Care': 0.30, // 30% of retail
    'Sports & Outdoors': 0.20,  // 20% of retail
    'Pet Supplies': 0.22,       // 22% of retail
  };
  
  const multiplier = categoryMultipliers[product.category] || 0.25;
  const supplierPrice = product.price * multiplier;
  
  // Only viable if wholesale leaves room for margin
  const marginPercent = ((product.price - supplierPrice * 1.3) / product.price) * 100; // 30% for shipping/fees
  
  if (marginPercent < THRESHOLDS.WHOLESALE_MARGIN_MIN) {
    return null;
  }
  
  return {
    productId: product.asin,
    supplierPrice,
    moq: 100,
    shippingCostPerUnit: supplierPrice * 0.15, // 15% shipping
    leadTimeDays: 21,
    supplier: 'Simulated Wholesale Supplier',
  };
}

// Simulated Google Ads keyword metrics (in production, use Google Ads API)
async function getAdMetrics(keyword: string): Promise<AdMetrics | null> {
  // Simulate keyword data based on product type
  const baseVolume = Math.floor(Math.random() * 50000) + 1000;
  const competition = Math.random() * 0.8 + 0.1;
  const suggestedBid = Math.random() * 3 + 0.5;
  
  if (baseVolume < THRESHOLDS.MIN_MONTHLY_SEARCH_VOLUME || competition > THRESHOLDS.MAX_COMPETITION) {
    return null;
  }
  
  return {
    keyword,
    monthlySearchVolume: baseVolume,
    competition,
    suggestedBid,
    estimatedCTR: 0.02 + Math.random() * 0.03, // 2-5%
    estimatedConversionRate: 0.015 + Math.random() * 0.025, // 1.5-4%
  };
}

function calculateWholesaleOpportunity(product: ScrapedProduct, quote: WholesaleQuote): BusinessOpportunity | null {
  const landedCost = quote.supplierPrice + quote.shippingCostPerUnit;
  const amazonFees = product.price * 0.15; // ~15% Amazon referral + FBA fees
  const marketingCost = product.price * 0.10; // 10% for PPC
  const totalCost = landedCost + amazonFees + marketingCost;
  
  const profitPerUnit = product.price - totalCost;
  const marginPercent = (profitPerUnit / product.price) * 100;
  
  if (marginPercent < THRESHOLDS.WHOLESALE_MARGIN_MIN) return null;
  
  // Estimate monthly sales from BSR (rough heuristic)
  const estimatedMonthlySales = Math.max(10, Math.floor(100000 / Math.max(product.bsr, 1000)));
  const monthlyRevenue = estimatedMonthlySales * product.price;
  const monthlyProfit = estimatedMonthlySales * profitPerUnit;
  const totalInvestment = landedCost * quote.moq;
  const paybackMonths = totalInvestment / monthlyProfit;
  
  if (monthlyProfit < THRESHOLDS.MIN_NET_PROFIT_MONTHLY) return null;
  
  const riskFactors = [];
  if (product.reviewCount < 50) riskFactors.push('Low review count (<50)');
  if (product.rating < 4.0) riskFactors.push(`Low rating (${product.rating})`);
  if (paybackMonths > 6) riskFactors.push(`Long payback (${paybackMonths.toFixed(1)} months)`);
  if (quote.moq > 500) riskFactors.push(`High MOQ (${quote.moq})`);
  
  return {
    type: 'WHOLESALE_MARGIN',
    product,
    wholesaleQuote: quote,
    marginPercent,
    estimatedMonthlyProfit: monthlyProfit,
    estimatedMonthlyRevenue: monthlyRevenue,
    totalInvestment,
    paybackMonths,
    riskFactors,
  };
}

function calculateAdRoiOpportunity(product: ScrapedProduct, adMetrics: AdMetrics): BusinessOpportunity | null {
  const cpc = adMetrics.suggestedBid;
  const ctr = adMetrics.estimatedCTR;
  const conversionRate = adMetrics.estimatedConversionRate;
  
  // Cost per acquisition
  const cpa = cpc / (ctr * conversionRate);
  
  // Assume 30% margin on product
  const grossMargin = product.price * 0.30;
  const netProfitPerSale = grossMargin - cpa;
  
  if (netProfitPerSale <= 0) return null;
  
  const roas = (product.price * conversionRate * ctr) / cpc; // Simplified ROAS
  const roiMultiple = grossMargin / cpa;
  
  if (roiMultiple < THRESHOLDS.AD_ROI_MIN) return null;
  
  const monthlyClicks = adMetrics.monthlySearchVolume * ctr * 0.3; // 30% impression share
  const monthlySales = monthlyClicks * conversionRate;
  const monthlyRevenue = monthlySales * product.price;
  const monthlyAdSpend = monthlyClicks * cpc;
  const monthlyProfit = monthlySales * netProfitPerSale;
  
  if (monthlyProfit < THRESHOLDS.MIN_NET_PROFIT_MONTHLY) return null;
  
  const riskFactors = [];
  if (adMetrics.competition > 0.6) riskFactors.push('High competition');
  if (cpa > grossMargin * 0.5) riskFactors.push('High CPA relative to margin');
  if (adMetrics.monthlySearchVolume < 5000) riskFactors.push('Low search volume');
  
  return {
    type: 'AD_ROI_ARBITRAGE',
    product,
    adMetrics,
    roiMultiple,
    estimatedMonthlyProfit: monthlyProfit,
    estimatedMonthlyRevenue: monthlyRevenue,
    totalInvestment: monthlyAdSpend * 3, // 3 months ad budget
    paybackMonths: 1, // Ad spend is recurring, not upfront inventory
    riskFactors,
  };
}

async function runBusinessAgent(userId: string = 'default-user'): Promise<{
  businessEventsCreated: number;
  opportunityCardsCreated: number;
  topOpportunities: BusinessOpportunity[];
}> {
  console.log('[BusinessAgent] Starting capital arbitrage scan...');
  
  const allOpportunities: BusinessOpportunity[] = [];
  
  // Generate mock products for each category (replaces Apify calls for now)
  for (const { category, keywords } of SCAN_CATEGORIES) {
    console.log(`[BusinessAgent] Scanning category: ${category}`);
    
    // Use mock data generator instead of Apify (actors not rented)
    const mockProducts = generateMockProducts(15);
    // Assign the current category to all mock products
    mockProducts.forEach(p => p.category = category);
    
    console.log(`[BusinessAgent] Generated ${mockProducts.length} mock products for "${category}"`);
    
    // Analyze each product
    for (const product of mockProducts) {
      // 1. Wholesale margin opportunity
      const wholesaleQuote = await getWholesaleQuote(product);
      if (wholesaleQuote) {
        const opp = calculateWholesaleOpportunity(product, wholesaleQuote);
        if (opp) allOpportunities.push(opp);
      }
      
      // 2. Ad ROI arbitrage opportunity (use first keyword for ad metrics)
      const adMetrics = await getAdMetrics(keywords[0]);
      if (adMetrics) {
        const opp = calculateAdRoiOpportunity(product, adMetrics);
        if (opp) allOpportunities.push(opp);
      }
    }
  }
  
  console.log(`[BusinessAgent] Total opportunities found: ${allOpportunities.length}`);

    // Fetch emergency runway for AEGIS evaluation
    const runway = await prisma.emergencyRunway.findUnique({ where: { userId } });
    const emergencyRunwayCents = runway?.amountCents || 1000000; // $10k default
    console.log(`[BusinessAgent] Emergency runway: $${(emergencyRunwayCents/100).toLocaleString()}`);

    // Compute runway days for AEGIS
    let runwayDays = 999;
    try {
      const latestEvents = await prisma.moneyEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      const uniqueBalances = new Map<string, number>();
      for (const ev of latestEvents) {
        const p = ev.payload as any;
        if (p?.fromAccount && p?.currentBalance !== undefined) {
          uniqueBalances.set(p.fromAccount, p.currentBalance);
        }
      }
      const totalBalances = Array.from(uniqueBalances.values()).reduce((s, b) => s + b, 0);
      const estimatedMonthlyBurn = totalBalances > 0 ? totalBalances * 0.05 : 5000;
      const estimatedDailyBurn = estimatedMonthlyBurn / 30;
      runwayDays = estimatedDailyBurn > 0 ? Math.floor((emergencyRunwayCents / 100) / estimatedDailyBurn) : 999;
      console.log(`[BusinessAgent] Runway: ${runwayDays} days (${uniqueBalances.size} accounts, $${totalBalances.toFixed(0)})`);
    } catch {
      const estimatedDailyBurn = 5000 / 30;
      runwayDays = Math.floor((emergencyRunwayCents / 100) / estimatedDailyBurn);
    }

    // Write to database
    let businessEventsCreated = 0;
    let opportunityCardsCreated = 0;
    let aegisPassed = 0;
    let aegisFailed = 0;

    for (const opp of allOpportunities.slice(0, 20)) { // Top 20 only
      // Create BusinessEvent
      const businessEvent = await prisma.businessEvent.create({
        data: {
          userId,
          type: opp.type,
          netProfit: opp.estimatedMonthlyProfit,
          payload: {
            productTitle: opp.product.title,
            productAsin: opp.product.asin,
            productPrice: opp.product.price,
            productCategory: opp.product.category,
            productBsr: opp.product.bsr,
            productRating: opp.product.rating,
            productReviewCount: opp.product.reviewCount,
            ...(opp.type === 'WHOLESALE_MARGIN' && {
              wholesalePrice: opp.wholesaleQuote?.supplierPrice,
              landedCost: opp.wholesaleQuote ? opp.wholesaleQuote.supplierPrice + opp.wholesaleQuote.shippingCostPerUnit : null,
              marginPercent: opp.marginPercent,
              moq: opp.wholesaleQuote?.moq,
              paybackMonths: opp.paybackMonths,
              totalInvestment: opp.totalInvestment,
            }),
            ...(opp.type === 'AD_ROI_ARBITRAGE' && {
              keyword: opp.adMetrics?.keyword,
              monthlySearchVolume: opp.adMetrics?.monthlySearchVolume,
              competition: opp.adMetrics?.competition,
              suggestedBid: opp.adMetrics?.suggestedBid,
              roiMultiple: opp.roiMultiple,
              estimatedCpa: opp.adMetrics ? opp.adMetrics.suggestedBid / (opp.adMetrics.estimatedCTR * opp.adMetrics.estimatedConversionRate) : null,
            }),
            estimatedMonthlyProfit: opp.estimatedMonthlyProfit,
            estimatedMonthlyRevenue: opp.estimatedMonthlyRevenue,
            riskFactors: opp.riskFactors,
          },
        },
      });
      businessEventsCreated++;

      // AEGIS Policy Gate: Evaluate opportunity before creating card
      const aegisResult = await evaluateOpportunity({
        type: 'BUSINESS',
        netBenefit: opp.estimatedMonthlyProfit,
        // Monthly fees: Amazon referral (15% of revenue) + FBA fees (~10%) = 25% of revenue
        fees: opp.type === 'WHOLESALE_MARGIN' 
          ? opp.estimatedMonthlyRevenue * 0.25 
          : opp.totalInvestment / 3, // ad spend monthly
        taxes: opp.estimatedMonthlyProfit * 0.37,
        riskFactors: opp.riskFactors,
        paybackMonths: opp.paybackMonths,
        totalInvestment: opp.totalInvestment,
        runwayDays,
        sourceEventId: businessEvent.id,
        userId,
      }, emergencyRunwayCents);

      console.log(`[AEGIS] ${businessEvent.id}: ${aegisResult.passed ? 'PASS' : 'FAIL'} (score: ${aegisResult.score})`);
      if (aegisResult.violations.length > 0) {
        console.log(`[AEGIS]   Violations: ${aegisResult.violations.join('; ')}`);
      }
      if (aegisResult.warnings.length > 0) {
        console.log(`[AEGIS]   Warnings: ${aegisResult.warnings.join('; ')}`);
      }

      if (!aegisResult.passed) {
        aegisFailed++;
        // Still create BusinessEvent but mark as AEGIS_FAILED
        await prisma.businessEvent.update({
          where: { id: businessEvent.id },
          data: { payload: { ...businessEvent.payload, aegisStatus: 'FAILED', aegisViolations: aegisResult.violations } },
        });
        continue;
      }

      aegisPassed++;

      // Create OpportunityCard (1-click approval) - only for AEGIS-passed opportunities
      await prisma.opportunityCard.create({
        data: {
          sourceEventId: businessEvent.id,
          sourceEventType: 'BUSINESS',
          title: `${opp.type === 'WHOLESALE_MARGIN' ? 'Wholesale Margin' : 'Ad ROI Arbitrage'}: ${opp.product.title.substring(0, 60)}...`,
          description: `${opp.type === 'WHOLESALE_MARGIN'
            ? `Buy at $${opp.wholesaleQuote?.supplierPrice?.toFixed(2)}/unit (MOQ ${opp.wholesaleQuote?.moq}), sell at $${opp.product.price}/unit on Amazon\nMargin: ${opp.marginPercent?.toFixed(1)}%\nMonthly profit: $${opp.estimatedMonthlyProfit.toFixed(0)}\nInvestment: $${opp.totalInvestment.toFixed(0)} (${opp.paybackMonths.toFixed(1)} mo payback)`
            : `Keyword: "${opp.adMetrics?.keyword}"\nSearch volume: ${opp.adMetrics?.monthlySearchVolume?.toLocaleString()}/mo\nCPC: $${opp.adMetrics?.suggestedBid.toFixed(2)}\nROI multiple: ${opp.roiMultiple?.toFixed(1)}x\nMonthly profit: $${opp.estimatedMonthlyProfit.toFixed(0)}\nAd budget: $${(opp.totalInvestment/3).toFixed(0)}/mo`}\n\nRisks: ${opp.riskFactors.join(', ') || 'None identified'}`,
          netBenefit: opp.estimatedMonthlyProfit,
          fees: opp.type === 'WHOLESALE_MARGIN' ? opp.totalInvestment * 0.15 : opp.totalInvestment / 3,
          taxes: opp.estimatedMonthlyProfit * 0.37,
          requiresApproval: true,
          approved: false,
          executed: false,
        },
      });
      opportunityCardsCreated++;
    }

    console.log(`[BusinessAgent] AEGIS: ${aegisPassed} passed, ${aegisFailed} filtered`);
  
  const topOpportunities = allOpportunities.slice(0, 5);
  
  console.log(`[BusinessAgent] Complete: ${businessEventsCreated} BusinessEvents, ${opportunityCardsCreated} OpportunityCards`);
  if (topOpportunities.length > 0) {
    console.log(`[BusinessAgent] TOP: ${topOpportunities[0].type} - ${topOpportunities[0].product.title.substring(0, 50)} - $${topOpportunities[0].estimatedMonthlyProfit.toFixed(0)}/mo`);
  }
  
  return { businessEventsCreated, opportunityCardsCreated, topOpportunities };
}

// Run if called directly
if (require.main === module) {
  runBusinessAgent()
    .then(result => {
      console.log('\n=== BUSINESS AGENT RESULT ===');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('[BusinessAgent] ERROR:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

export { runBusinessAgent, BusinessOpportunity, ScrapedProduct };