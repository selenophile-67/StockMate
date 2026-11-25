import React, { useEffect, useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Copy,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../lib/api';
import {
  INDIA_CHARGE_SCHEDULES,
  SipFrequency,
  calcAveragePrice,
  calcBonusShare,
  calcBreakEven,
  calcBrokerage,
  calcCagr,
  calcDividendIncome,
  calcDividendYield,
  calcEps,
  calcInflationAdjusted,
  calcLumpsum,
  calcMutualFundReturn,
  calcPeRatio,
  calcPortfolioAllocation,
  calcPortfolioRebalancing,
  calcPositionSizing,
  calcProfitLoss,
  calcRightsIssue,
  calcRiskReward,
  calcRoi,
  calcSip,
  calcStockReturn,
  calcStockSplit,
  calcStockValuation,
  calcStopLoss,
  calcTargetPrice,
  calcXirr,
  formatCompactINR,
  formatINR,
  formatPct,
} from '../lib/finance';
import { Exchange, TradeSegment } from '../types/stockmate';
import { BreakdownRow, CalcField, ResultMetric } from './CalculatorModules';

interface CalculatorCatalogItem {
  id: string;
  name: string;
  category: 'core' | 'valuation' | 'risk' | 'corporate' | 'wealth';
  categoryLabel: string;
  formula: string;
  example: string;
}

const CALCULATOR_CATALOG: CalculatorCatalogItem[] = [
  // Core (8)
  {
    id: 'profit-loss',
    name: 'Stock Profit & Loss',
    category: 'core',
    categoryLabel: 'Core',
    formula: 'Net P/L = (Sell Price × Qty) − (Buy Price × Qty) − Total Charges',
    example: 'Buy 50 shares @ ₹1,000, Sell @ ₹1,200 with ₹150 charges → Net P/L = +₹9,850 (+19.70%).',
  },
  {
    id: 'average-price',
    name: 'Average Stock Price',
    category: 'core',
    categoryLabel: 'Core',
    formula: 'Average Price = Sum(Price_i × Qty_i) / Sum(Qty_i)',
    example: '10 shares @ ₹100 + 10 shares @ ₹150 = 20 shares @ ₹125.00 average.',
  },
  {
    id: 'brokerage',
    name: 'Indian Brokerage & Taxes',
    category: 'core',
    categoryLabel: 'Core',
    formula: 'Total Cost = Brokerage + STT + Exchange Txn + SEBI + Stamp Duty + 18% GST + DP',
    example: 'NSE Delivery Buy ₹1,00,000 / Sell ₹1,10,000 → STT ₹210, Stamp ₹15, Brokerage ₹40 + GST.',
  },
  {
    id: 'target-price',
    name: 'Stock Target Price',
    category: 'core',
    categoryLabel: 'Core',
    formula: 'Risk-to-Reward = (Target − Entry) / (Entry − Stop-Loss)',
    example: 'Entry ₹500, Target ₹650, SL ₹450 → Reward ₹150 vs Risk ₹50 (1 : 3.00).',
  },
  {
    id: 'sip',
    name: 'Stock SIP Calculator',
    category: 'core',
    categoryLabel: 'Core',
    formula: 'FV = P × [((1 + r)^n − 1) / r] × (1 + r)',
    example: '₹10,000/mo for 10 years at 12% p.a. → Invested ₹12.00 L, Est. Value ₹23.23 L.',
  },
  {
    id: 'cagr',
    name: 'CAGR Calculator',
    category: 'core',
    categoryLabel: 'Core',
    formula: 'CAGR = [(Final Value / Initial Value)^(1 / Years) − 1] × 100',
    example: '₹1,00,000 growing to ₹2,00,000 in 5 years → 14.87% CAGR.',
  },
  {
    id: 'stock-return',
    name: 'Stock Return (Total)',
    category: 'core',
    categoryLabel: 'Core',
    formula: 'Total Return = (Current Value − Initial Cost) + Dividends Received',
    example: '₹1,00,000 stock now worth ₹1,20,000 + ₹5,000 dividends over 2 yrs → +25% (+11.80% p.a.).',
  },
  {
    id: 'break-even',
    name: 'Break-Even Price',
    category: 'core',
    categoryLabel: 'Core',
    formula: 'Break-Even Price = (Buy Price × Qty + Total Charges) / Qty',
    example: '10 shares @ ₹1,000 + ₹70 charges → Break-even ₹1,007.00 (min profitable ₹1,007.05).',
  },
  // Advanced (18)
  {
    id: 'dividend-yield',
    name: 'Dividend Yield',
    category: 'valuation',
    categoryLabel: 'Valuation & Equity',
    formula: 'Dividend Yield % = (Annual Dividend Per Share / Share Price) × 100',
    example: '₹25 annual dividend on ₹1,000 share → 2.50% yield.',
  },
  {
    id: 'dividend-income',
    name: 'Dividend Income',
    category: 'valuation',
    categoryLabel: 'Valuation & Equity',
    formula: 'Net Annual Dividend = (Shares × Dividend/Share) × (1 − Tax Rate)',
    example: '200 shares paying ₹15/share at 10% TDS → ₹2,700 net/year (₹225/mo).',
  },
  {
    id: 'stock-valuation',
    name: 'Stock Valuation (Graham & P/E)',
    category: 'valuation',
    categoryLabel: 'Valuation & Equity',
    formula: 'Graham Number = √(22.5 × EPS × BVPS); Blended = (Graham + EPS×FairPE)/2',
    example: 'EPS ₹50, BVPS ₹200, Fair P/E 20 → Graham ₹474.34, P/E Fair ₹1,000.',
  },
  {
    id: 'pe-ratio',
    name: 'P/E Ratio & Earnings Yield',
    category: 'valuation',
    categoryLabel: 'Valuation & Equity',
    formula: 'P/E = Market Price / EPS; Earnings Yield = (EPS / Price) × 100',
    example: 'Price ₹1,000, EPS ₹40 → P/E = 25.00x (4.00% earnings yield).',
  },
  {
    id: 'eps',
    name: 'Earnings Per Share (EPS)',
    category: 'valuation',
    categoryLabel: 'Valuation & Equity',
    formula: 'EPS = (Net Income − Preferred Dividends) / Weighted Average Shares',
    example: '₹50,00,000 profit − ₹2,00,000 pref div ÷ 10,00,000 shares → ₹4.80 EPS.',
  },
  {
    id: 'roi',
    name: 'Return on Investment (ROI)',
    category: 'wealth',
    categoryLabel: 'Wealth & XIRR',
    formula: 'ROI % = [(Amount Returned − Amount Invested) / Amount Invested] × 100',
    example: '₹50,000 invested returning ₹75,000 over 2 years → 50.00% ROI (22.47% p.a.).',
  },
  {
    id: 'risk-reward',
    name: 'Risk-to-Reward Ratio',
    category: 'risk',
    categoryLabel: 'Risk & Sizing',
    formula: 'R:R = |Target − Entry| / |Entry − Stop-Loss|; Min Win Rate = 1 / (1 + R:R)',
    example: 'Entry ₹100, SL ₹90, Target ₹130 → 1 : 3.00 ratio (25% win rate to break even).',
  },
  {
    id: 'position-sizing',
    name: 'Position Sizing',
    category: 'risk',
    categoryLabel: 'Risk & Sizing',
    formula: 'Shares = floor((Account Capital × Risk %) / |Entry − Stop-Loss|)',
    example: '₹1,00,000 capital, 2% risk (₹2,000), ₹20 risk/share → Max 100 shares.',
  },
  {
    id: 'stop-loss',
    name: 'Stop-Loss Planner',
    category: 'risk',
    categoryLabel: 'Risk & Sizing',
    formula: 'Long SL = Entry × (1 − SL%); Short SL = Entry × (1 + SL%)',
    example: 'Long 50 shares @ ₹1,000 with 5% SL → Stop @ ₹950.00 (Max loss ₹2,500).',
  },
  {
    id: 'portfolio-allocation',
    name: 'Portfolio Allocation',
    category: 'risk',
    categoryLabel: 'Risk & Sizing',
    formula: 'Asset Weight % = (Asset Market Value / Total Portfolio Value) × 100',
    example: '₹60,000 Large-Cap + ₹40,000 Mid-Cap → 60.00% / 40.00% split.',
  },
  {
    id: 'portfolio-rebalancing',
    name: 'Portfolio Rebalancing',
    category: 'risk',
    categoryLabel: 'Risk & Sizing',
    formula: 'Action = (Total New Value × Target Weight %) − Current Asset Value',
    example: '₹70k Equity / ₹30k Debt targeting 60/40 → Sell ₹10k Equity, Buy ₹10k Debt.',
  },
  {
    id: 'stock-split',
    name: 'Stock Split',
    category: 'corporate',
    categoryLabel: 'Corporate Actions',
    formula: 'Post-Split Shares = Shares × Ratio; Adjusted Price = Avg Price / Ratio',
    example: '100 shares @ ₹1,500 in 5:1 split → 500 shares @ ₹300.00.',
  },
  {
    id: 'bonus-share',
    name: 'Bonus Share',
    category: 'corporate',
    categoryLabel: 'Corporate Actions',
    formula: 'Total Shares = Held + floor(Held × BonusRatio); Adj Price = Cost / Total Shares',
    example: '100 shares @ ₹600 with 1:1 bonus → 200 shares @ ₹300.00 average.',
  },
  {
    id: 'rights-issue',
    name: 'Rights Issue (TERP)',
    category: 'corporate',
    categoryLabel: 'Corporate Actions',
    formula: 'TERP = [(Held × CMP) + (New Shares × Issue Price)] / (Held + New Shares)',
    example: '100 shares @ ₹500, 1:5 rights @ ₹400 → 20 new shares, TERP ₹483.33.',
  },
  {
    id: 'mutual-fund',
    name: 'Mutual Fund Return',
    category: 'wealth',
    categoryLabel: 'Wealth & XIRR',
    formula: 'Net Return = Gross Annual Return − Expense Ratio (applied to SIP or Lumpsum)',
    example: '₹1,00,000 lumpsum for 5 yrs at 12% gross vs 1% expense → ₹1,70,814 net.',
  },
  {
    id: 'lumpsum',
    name: 'Lumpsum Investment',
    category: 'wealth',
    categoryLabel: 'Wealth & XIRR',
    formula: 'FV = Principal × (1 + r)^Years',
    example: '₹1,00,000 invested for 10 years at 12% p.a. → ₹3,10,584.82.',
  },
  {
    id: 'inflation-adjusted',
    name: 'Inflation-Adjusted Return',
    category: 'wealth',
    categoryLabel: 'Wealth & XIRR',
    formula: 'Real Return = [(1 + Nominal) / (1 + Inflation)] − 1',
    example: '12% nominal return with 6% inflation → 5.66% real annual purchasing power growth.',
  },
  {
    id: 'xirr',
    name: 'XIRR Cash Flow Solver',
    category: 'wealth',
    categoryLabel: 'Wealth & XIRR',
    formula: 'Solves Σ [CF_i / (1 + XIRR)^((d_i − d_0)/365)] = 0 via Newton-Raphson',
    example: '-₹50,000 (2024-01-01), -₹25,000 (2024-07-01), +₹88,000 (2025-01-01) → XIRR.',
  },
];

const toNum = (v: string, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function CalculatorsView() {
  const {
    user,
    selectedCalcId,
    setSelectedCalcId,
    reopenCalc,
    setReopenCalc,
    notify,
    refreshUserData,
    setAuthModalOpen,
  } = useApp();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [savingHistory, setSavingHistory] = useState(false);

  // ============================================================================
  // STATE FOR ALL 26 CALCULATORS
  // ============================================================================
  // 1. Profit & Loss
  const [plState, setPlState] = useState({
    ticker: 'RELIANCE',
    buyPrice: 1180,
    sellPrice: 1295,
    quantity: 50,
    brokerageCharges: 40,
    otherCharges: 125,
  });

  // 2. Average Price
  const [avgLots, setAvgLots] = useState([
    { price: 1150, quantity: 40 },
    { price: 1240, quantity: 25 },
  ]);
  const [avgCurrentPrice, setAvgCurrentPrice] = useState(1267.6);

  // 3. Brokerage
  const [brkState, setBrkState] = useState({
    segment: 'delivery' as TradeSegment,
    exchange: (user?.preferences?.defaultExchange || 'NSE') as Exchange,
    buyPrice: 1200,
    sellPrice: 1320,
    quantity: 50,
    brokerageMode: 'hybrid' as 'flat' | 'percent' | 'hybrid',
    brokerageFlatPerOrder: user?.preferences?.brokerageFlat ?? 20,
    brokeragePct: user?.preferences?.brokeragePct ?? 0.03,
    dpChargesOnSell: user?.preferences?.dpCharges ?? 15.93,
    effectiveDate: (user?.preferences?.chargeEffectiveDate || '2024-10-01') as
      | '2024-10-01'
      | '2023-04-01',
    showCustomRates: false,
    customSttBuy: '',
    customSttSell: '',
    customExchangeTxn: '',
    customStampDuty: '',
  });

  // 4. Target Price
  const [targetState, setTargetState] = useState({
    buyPrice: 500,
    quantity: 100,
    targetPrice: 650,
    stopLossPrice: 450,
    estimatedCharges: 100,
  });

  // 5. SIP
  const [sipState, setSipState] = useState({
    amount: 15000,
    years: 10,
    annualReturnPct: 12,
    frequency: 'monthly' as SipFrequency,
  });

  // 6. CAGR
  const [cagrState, setCagrState] = useState({
    initialValue: 100000,
    finalValue: 225000,
    years: 5,
  });

  // 7. Stock Return
  const [stockRetState, setStockRetState] = useState({
    initialInvestment: 100000,
    currentPrice: 1240,
    quantity: 100,
    dividendsReceived: 4800,
    years: 2,
  });

  // 8. Break-Even
  const [breakEvenState, setBreakEvenState] = useState({
    buyPrice: 1000,
    quantity: 40,
    brokeragePerOrder: 20,
    taxesAndFeesAmount: 85,
  });

  // Advanced states
  const [divYieldState, setDivYieldState] = useState({ annualDividend: 28, sharePrice: 1400 });
  const [divIncomeState, setDivIncomeState] = useState({
    sharesOwned: 250,
    annualDividend: 20,
    taxRatePct: 10,
  });
  const [valState, setValState] = useState({
    eps: 54,
    bvps: 310,
    currentPrice: 1267,
    fairPeMultiple: 24,
  });
  const [peState, setPeState] = useState({ marketPrice: 1864, eps: 68, sectorAvgPe: 26 });
  const [epsState, setEpsState] = useState({
    netIncome: 50000000,
    preferredDividends: 2000000,
    weightedShares: 1000000,
  });
  const [roiState, setRoiState] = useState({
    amountInvested: 150000,
    amountReturned: 218000,
    years: 2.5,
  });
  const [rrState, setRrState] = useState({ entryPrice: 800, stopLoss: 760, targetPrice: 920 });
  const [posState, setPosState] = useState({
    accountCapital: 500000,
    riskPerTradePct: 1.5,
    entryPrice: 1250,
    stopLossPrice: 1200,
  });
  const [slState, setSlState] = useState({
    entryPrice: 1250,
    quantity: 80,
    stopLossPct: 4,
    direction: 'long' as 'long' | 'short',
  });
  const [allocItems, setAllocItems] = useState([
    { name: 'Large Cap Equity', currentValue: 350000 },
    { name: 'Mid & Small Cap', currentValue: 150000 },
    { name: 'Debt / Liquid', currentValue: 100000 },
  ]);
  const [rebalItems, setRebalItems] = useState([
    { name: 'Large Cap Equity', currentValue: 420000, targetWeightPct: 60 },
    { name: 'Mid & Small Cap', currentValue: 120000, targetWeightPct: 20 },
    { name: 'Debt / Gold', currentValue: 60000, targetWeightPct: 20 },
  ]);
  const [rebalCash, setRebalCash] = useState(50000);
  const [splitState, setSplitState] = useState({
    currentShares: 100,
    currentAvgPrice: 1500,
    newSharesPerOld: 5,
    oldSharesUnit: 1,
  });
  const [bonusState, setBonusState] = useState({
    heldShares: 100,
    avgBuyPrice: 600,
    bonusIssued: 1,
    forEveryHeld: 1,
  });
  const [rightsState, setRightsState] = useState({
    heldShares: 100,
    currentMarketPrice: 520,
    entitlementNew: 1,
    entitlementForEvery: 5,
    rightsIssuePrice: 410,
  });
  const [mfState, setMfState] = useState({
    mode: 'sip' as 'sip' | 'lumpsum',
    amount: 10000,
    years: 10,
    grossAnnualReturnPct: 13,
    expenseRatioPct: 0.75,
  });
  const [lumpsumState, setLumpsumState] = useState({
    principal: 250000,
    years: 10,
    annualReturnPct: 12,
  });
  const [infState, setInfState] = useState({
    principal: 500000,
    nominalReturnPct: 12,
    inflationRatePct: 6,
    years: 10,
  });
  const [xirrFlows, setXirrFlows] = useState([
    { date: '2024-01-15', amount: -50000 },
    { date: '2024-07-15', amount: -25000 },
    { date: '2025-01-15', amount: -25000 },
    { date: '2026-01-15', amount: 124500 },
  ]);

  // Handle reopening saved calculation from History
  useEffect(() => {
    if (!reopenCalc) return;
    setSelectedCalcId(reopenCalc.calculatorId);
    const inp = reopenCalc.inputs as Record<string, any>;
    switch (reopenCalc.calculatorId) {
      case 'profit-loss':
        setPlState((s) => ({ ...s, ...inp }));
        break;
      case 'average-price':
        if (Array.isArray(inp.lots)) setAvgLots(inp.lots);
        if (typeof inp.currentPrice === 'number') setAvgCurrentPrice(inp.currentPrice);
        break;
      case 'brokerage':
        setBrkState((s) => ({ ...s, ...inp }));
        break;
      case 'target-price':
        setTargetState((s) => ({ ...s, ...inp }));
        break;
      case 'sip':
        setSipState((s) => ({ ...s, ...inp }));
        break;
      case 'cagr':
        setCagrState((s) => ({ ...s, ...inp }));
        break;
      case 'stock-return':
        setStockRetState((s) => ({ ...s, ...inp }));
        break;
      case 'break-even':
        setBreakEvenState((s) => ({ ...s, ...inp }));
        break;
      case 'xirr':
        if (Array.isArray(inp.cashFlows)) setXirrFlows(inp.cashFlows);
        break;
      default:
        break;
    }
    setAiExplanation(null);
    setReopenCalc(null);
  }, [reopenCalc, setReopenCalc, setSelectedCalcId]);

  // Reset AI explanation when switching calculators
  useEffect(() => {
    setAiExplanation(null);
  }, [selectedCalcId]);

  const filteredCatalog = useMemo(() => {
    return CALCULATOR_CATALOG.filter((item) => {
      const matchesCat = categoryFilter === 'all' || item.category === categoryFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [categoryFilter, search]);

  const activeMeta =
    CALCULATOR_CATALOG.find((c) => c.id === selectedCalcId) || CALCULATOR_CATALOG[0];

  // Computed outputs for active calculator + snapshot payload for Save/Copy/Explain
  const activeComputation = useMemo(() => {
    switch (activeMeta.id) {
      case 'profit-loss': {
        const res = calcProfitLoss(plState);
        return {
          inputs: plState,
          results: res,
          summary: `${plState.ticker || 'Stock'} · ${plState.quantity} qty · Net ${
            res.netPnL >= 0 ? '+' : ''
          }${formatINR(res.netPnL)} (${formatPct(res.returnPct)})`,
        };
      }
      case 'average-price': {
        const res = calcAveragePrice(avgLots, avgCurrentPrice);
        return {
          inputs: { lots: avgLots, currentPrice: avgCurrentPrice },
          results: res,
          summary: `${res.totalQuantity} shares @ Avg ${formatINR(res.averagePrice)}`,
        };
      }
      case 'brokerage': {
        const customRates = brkState.showCustomRates
          ? {
              sttBuyPct: brkState.customSttBuy !== '' ? Number(brkState.customSttBuy) : undefined,
              sttSellPct: brkState.customSttSell !== '' ? Number(brkState.customSttSell) : undefined,
              exchangeTxnPct:
                brkState.customExchangeTxn !== ''
                  ? Number(brkState.customExchangeTxn)
                  : undefined,
              stampDutyBuyPct:
                brkState.customStampDuty !== '' ? Number(brkState.customStampDuty) : undefined,
            }
          : undefined;
        const res = calcBrokerage({ ...brkState, customRates });
        return {
          inputs: brkState,
          results: res,
          summary: `${brkState.exchange} ${brkState.segment} · Charges ${formatINR(
            res.totalCharges
          )} · Net ${formatINR(res.netPnL)}`,
        };
      }
      case 'target-price': {
        const res = calcTargetPrice(targetState);
        return {
          inputs: targetState,
          results: res,
          summary: `Target +${formatINR(res.expectedProfitAtTarget)} · R:R ${res.riskRewardLabel}`,
        };
      }
      case 'sip': {
        const res = calcSip(sipState);
        return {
          inputs: sipState,
          results: {
            totalInvested: res.totalInvested,
            estimatedReturns: res.estimatedReturns,
            totalFutureValue: res.totalFutureValue,
          },
          full: res,
          summary: `${formatINR(sipState.amount, 0)}/${sipState.frequency} · ${
            sipState.years
          }Y @ ${sipState.annualReturnPct}% → Est. ${formatCompactINR(res.totalFutureValue)}`,
        };
      }
      case 'cagr': {
        const res = calcCagr(cagrState);
        return {
          inputs: cagrState,
          results: res,
          summary: `${formatCompactINR(cagrState.initialValue)} → ${formatCompactINR(
            cagrState.finalValue
          )} (${cagrState.years}Y) · ${res.cagrPct}% CAGR`,
        };
      }
      case 'stock-return': {
        const res = calcStockReturn(stockRetState);
        return {
          inputs: stockRetState,
          results: res,
          summary: `Total Return ${formatINR(res.totalReturn)} (${formatPct(
            res.totalReturnPct
          )})`,
        };
      }
      case 'break-even': {
        const res = calcBreakEven(breakEvenState);
        return {
          inputs: breakEvenState,
          results: res,
          summary: `Break-even ${formatINR(res.breakEvenSellingPrice)} · Min profit ${formatINR(
            res.minimumProfitableSellingPrice
          )}`,
        };
      }
      case 'dividend-yield': {
        const res = calcDividendYield(divYieldState.annualDividend, divYieldState.sharePrice);
        return {
          inputs: divYieldState,
          results: res,
          summary: `Dividend Yield ${res.dividendYieldPct}%`,
        };
      }
      case 'dividend-income': {
        const res = calcDividendIncome(
          divIncomeState.sharesOwned,
          divIncomeState.annualDividend,
          divIncomeState.taxRatePct
        );
        return {
          inputs: divIncomeState,
          results: res,
          summary: `Net Annual Dividend ${formatINR(res.netAnnualDividend)}`,
        };
      }
      case 'stock-valuation': {
        const res = calcStockValuation(
          valState.eps,
          valState.bvps,
          valState.currentPrice,
          valState.fairPeMultiple
        );
        return {
          inputs: valState,
          results: res,
          summary: `Graham ${formatINR(res.grahamNumber)} · Blended ${formatINR(
            res.blendedFairValue
          )}`,
        };
      }
      case 'pe-ratio': {
        const res = calcPeRatio(peState.marketPrice, peState.eps, peState.sectorAvgPe);
        return {
          inputs: peState,
          results: res,
          summary: `P/E ${res.peRatio}x · Earnings Yield ${res.earningsYieldPct}%`,
        };
      }
      case 'eps': {
        const res = calcEps(
          epsState.netIncome,
          epsState.preferredDividends,
          epsState.weightedShares
        );
        return {
          inputs: epsState,
          results: res,
          summary: `EPS ${formatINR(res.eps)}`,
        };
      }
      case 'roi': {
        const res = calcRoi(roiState.amountInvested, roiState.amountReturned, roiState.years);
        return {
          inputs: roiState,
          results: res,
          summary: `ROI ${formatPct(res.roiPct)} · Net ${formatINR(res.netProfit)}`,
        };
      }
      case 'risk-reward': {
        const res = calcRiskReward(rrState.entryPrice, rrState.stopLoss, rrState.targetPrice);
        return {
          inputs: rrState,
          results: res,
          summary: `R:R ${res.riskRewardText} · Min Win Rate ${res.breakevenWinRatePct}%`,
        };
      }
      case 'position-sizing': {
        const res = calcPositionSizing(
          posState.accountCapital,
          posState.riskPerTradePct,
          posState.entryPrice,
          posState.stopLossPrice
        );
        return {
          inputs: posState,
          results: res,
          summary: `Recommended ${res.recommendedShares} shares (${formatINR(
            res.positionCapitalRequired
          )})`,
        };
      }
      case 'stop-loss': {
        const res = calcStopLoss(
          slState.entryPrice,
          slState.quantity,
          slState.stopLossPct,
          slState.direction
        );
        return {
          inputs: slState,
          results: res,
          summary: `SL @ ${formatINR(res.stopLossPrice)} · Max Loss ${formatINR(
            res.maxCapitalLoss
          )}`,
        };
      }
      case 'portfolio-allocation': {
        const res = calcPortfolioAllocation(allocItems);
        return {
          inputs: { assets: allocItems },
          results: res,
          summary: `Total ${formatCompactINR(res.totalValue)} across ${allocItems.length} buckets`,
        };
      }
      case 'portfolio-rebalancing': {
        const res = calcPortfolioRebalancing(rebalItems, rebalCash);
        return {
          inputs: { assets: rebalItems, additionalCash: rebalCash },
          results: res,
          summary: `Rebalance ${formatCompactINR(res.newTotal)} across ${rebalItems.length} assets`,
        };
      }
      case 'stock-split': {
        const res = calcStockSplit(
          splitState.currentShares,
          splitState.currentAvgPrice,
          splitState.newSharesPerOld,
          splitState.oldSharesUnit
        );
        return {
          inputs: splitState,
          results: res,
          summary: `${res.postSplitShares} shares @ ${formatINR(res.adjustedAvgPrice)}`,
        };
      }
      case 'bonus-share': {
        const res = calcBonusShare(
          bonusState.heldShares,
          bonusState.avgBuyPrice,
          bonusState.bonusIssued,
          bonusState.forEveryHeld
        );
        return {
          inputs: bonusState,
          results: res,
          summary: `+${res.bonusSharesReceived} bonus shares · Adj Avg ${formatINR(
            res.adjustedAvgPrice
          )}`,
        };
      }
      case 'rights-issue': {
        const res = calcRightsIssue(
          rightsState.heldShares,
          rightsState.currentMarketPrice,
          rightsState.entitlementNew,
          rightsState.entitlementForEvery,
          rightsState.rightsIssuePrice
        );
        return {
          inputs: rightsState,
          results: res,
          summary: `${res.eligibleRightsShares} rights shares · TERP ${formatINR(
            res.theoreticalExRightsPrice
          )}`,
        };
      }
      case 'mutual-fund': {
        const res = calcMutualFundReturn(
          mfState.mode,
          mfState.amount,
          mfState.years,
          mfState.grossAnnualReturnPct,
          mfState.expenseRatioPct
        );
        return {
          inputs: mfState,
          results: res,
          summary: `Est. Net ${formatCompactINR(res.netEstimatedValue)} (Drag ${formatINR(
            res.expenseDrag
          )})`,
        };
      }
      case 'lumpsum': {
        const res = calcLumpsum(
          lumpsumState.principal,
          lumpsumState.years,
          lumpsumState.annualReturnPct
        );
        return {
          inputs: lumpsumState,
          results: res,
          summary: `${formatCompactINR(lumpsumState.principal)} → Est. ${formatCompactINR(
            res.futureValue
          )}`,
        };
      }
      case 'inflation-adjusted': {
        const res = calcInflationAdjusted(
          infState.principal,
          infState.nominalReturnPct,
          infState.inflationRatePct,
          infState.years
        );
        return {
          inputs: infState,
          results: res,
          summary: `Real Return ${res.realAnnualReturnPct}% p.a. · Purchasing Power ${formatCompactINR(
            res.realPurchasingPower
          )}`,
        };
      }
      case 'xirr': {
        const res = calcXirr(xirrFlows);
        return {
          inputs: { cashFlows: xirrFlows },
          results: res,
          summary:
            res.xirrPct !== null
              ? `XIRR ${formatPct(res.xirrPct)} · Net Gain ${formatINR(res.netGain)}`
              : 'Provide both negative investments and positive returns',
        };
      }
      default:
        return { inputs: {}, results: {}, summary: '' };
    }
  }, [
    activeMeta.id,
    plState,
    avgLots,
    avgCurrentPrice,
    brkState,
    targetState,
    sipState,
    cagrState,
    stockRetState,
    breakEvenState,
    divYieldState,
    divIncomeState,
    valState,
    peState,
    epsState,
    roiState,
    rrState,
    posState,
    slState,
    allocItems,
    rebalItems,
    rebalCash,
    splitState,
    bonusState,
    rightsState,
    mfState,
    lumpsumState,
    infState,
    xirrFlows,
  ]);

  const handleReset = () => {
    setAiExplanation(null);
    switch (activeMeta.id) {
      case 'profit-loss':
        setPlState({
          ticker: 'RELIANCE',
          buyPrice: 1180,
          sellPrice: 1295,
          quantity: 50,
          brokerageCharges: 40,
          otherCharges: 125,
        });
        break;
      case 'average-price':
        setAvgLots([
          { price: 1150, quantity: 40 },
          { price: 1240, quantity: 25 },
        ]);
        setAvgCurrentPrice(1267.6);
        break;
      case 'brokerage':
        setBrkState({
          segment: 'delivery',
          exchange: 'NSE',
          buyPrice: 1200,
          sellPrice: 1320,
          quantity: 50,
          brokerageMode: 'hybrid',
          brokerageFlatPerOrder: 20,
          brokeragePct: 0.03,
          dpChargesOnSell: 15.93,
          effectiveDate: '2024-10-01',
          showCustomRates: false,
          customSttBuy: '',
          customSttSell: '',
          customExchangeTxn: '',
          customStampDuty: '',
        });
        break;
      case 'target-price':
        setTargetState({
          buyPrice: 500,
          quantity: 100,
          targetPrice: 650,
          stopLossPrice: 450,
          estimatedCharges: 100,
        });
        break;
      case 'sip':
        setSipState({ amount: 15000, years: 10, annualReturnPct: 12, frequency: 'monthly' });
        break;
      case 'cagr':
        setCagrState({ initialValue: 100000, finalValue: 225000, years: 5 });
        break;
      case 'stock-return':
        setStockRetState({
          initialInvestment: 100000,
          currentPrice: 1240,
          quantity: 100,
          dividendsReceived: 4800,
          years: 2,
        });
        break;
      case 'break-even':
        setBreakEvenState({
          buyPrice: 1000,
          quantity: 40,
          brokeragePerOrder: 20,
          taxesAndFeesAmount: 85,
        });
        break;
      default:
        notify('info', `${activeMeta.name} inputs reset to defaults`);
        break;
    }
  };

  const handleCopyResults = async () => {
    const text = [
      `StockMate — ${activeMeta.name}`,
      `Summary: ${activeComputation.summary}`,
      `Results: ${JSON.stringify(activeComputation.results, null, 2)}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      notify('success', 'Calculation results copied to clipboard');
    } catch {
      notify('error', 'Clipboard access denied by browser');
    }
  };

  const handleSaveToHistory = async () => {
    if (!user) {
      setAuthModalOpen(true);
      notify('info', 'Please sign in to save calculation history');
      return;
    }
    setSavingHistory(true);
    try {
      await apiRequest('/api/history', {
        method: 'POST',
        body: JSON.stringify({
          calculatorId: activeMeta.id,
          calculatorName: activeMeta.name,
          category: activeMeta.category === 'core' ? 'core' : 'advanced',
          inputs: activeComputation.inputs,
          results: activeComputation.results,
          summary: activeComputation.summary,
        }),
      });
      await refreshUserData();
      notify('success', 'Calculation saved to History');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to save history');
    } finally {
      setSavingHistory(false);
    }
  };

  const handleExplainAi = async () => {
    setAiLoading(true);
    try {
      const res = await apiRequest<{ explanation: string }>('/api/ai/explain', {
        method: 'POST',
        body: JSON.stringify({
          calculatorName: activeMeta.name,
          inputs: activeComputation.inputs,
          results: activeComputation.results,
        }),
      });
      setAiExplanation(res.explanation);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'AI explanation failed');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Stock & Investment Calculators
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            8 Core Indian Equity Calculators · 18 Advanced Valuation, Sizing, Corporate Action & XIRR Tools
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search 26 calculators..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 overflow-x-auto">
            {[
              { id: 'all', label: 'All (26)' },
              { id: 'core', label: 'Core (8)' },
              { id: 'valuation', label: 'Valuation' },
              { id: 'risk', label: 'Risk & Sizing' },
              { id: 'corporate', label: 'Corporate Actions' },
              { id: 'wealth', label: 'Wealth & XIRR' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === tab.id
                    ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-50 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Split: Selector List + Active Calculator Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Selector Rail */}
        <aside className="lg:col-span-4 xl:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-2 max-h-[680px] overflow-y-auto">
          {filteredCatalog.length > 0 ? (
            <div className="space-y-0.5">
              {filteredCatalog.map((item) => {
                const active = item.id === activeMeta.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedCalcId(item.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{item.name}</div>
                      <div
                        className={`text-[11px] truncate ${
                          active ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.categoryLabel}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              No calculators match &ldquo;{search}&rdquo;
            </div>
          )}
        </aside>

        {/* Active Calculator Panel */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
            {/* Calculator Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {activeMeta.categoryLabel} Calculator
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mt-0.5">
                  {activeMeta.name}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleCopyResults}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Results
                </button>
                <button
                  type="button"
                  onClick={handleSaveToHistory}
                  disabled={savingHistory}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleExplainAi}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiLoading ? 'Analyzing...' : 'Explain Results'}
                </button>
              </div>
            </div>

            {/* CALCULATOR BODY */}
            <div className="pt-6">
              {activeMeta.id === 'profit-loss' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcProfitLoss>;
                const positive = res.netPnL >= 0;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-4">
                      <CalcField
                        label="Stock Ticker / Name"
                        type="text"
                        value={plState.ticker}
                        onChange={(v) => setPlState({ ...plState, ticker: v.toUpperCase() })}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <CalcField
                          label="Buying Price"
                          prefix="₹"
                          value={plState.buyPrice}
                          onChange={(v) => setPlState({ ...plState, buyPrice: Math.max(0, toNum(v)) })}
                        />
                        <CalcField
                          label="Selling Price"
                          prefix="₹"
                          value={plState.sellPrice}
                          onChange={(v) => setPlState({ ...plState, sellPrice: Math.max(0, toNum(v)) })}
                        />
                      </div>
                      <CalcField
                        label="Number of Shares"
                        min={1}
                        step="1"
                        value={plState.quantity}
                        onChange={(v) => setPlState({ ...plState, quantity: Math.max(0, toNum(v)) })}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <CalcField
                          label="Brokerage Charges"
                          prefix="₹"
                          value={plState.brokerageCharges}
                          onChange={(v) =>
                            setPlState({ ...plState, brokerageCharges: Math.max(0, toNum(v)) })
                          }
                        />
                        <CalcField
                          label="Taxes & Other Fees"
                          prefix="₹"
                          value={plState.otherCharges}
                          onChange={(v) =>
                            setPlState({ ...plState, otherCharges: Math.max(0, toNum(v)) })
                          }
                        />
                      </div>
                    </div>
                    <div className="md:col-span-7 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ResultMetric
                          large
                          label="Net Profit / Loss"
                          value={`${positive ? '+' : ''}${formatINR(res.netPnL)}`}
                          tone={positive ? 'positive' : 'negative'}
                          subtext={`${formatPct(res.returnPct)} net return`}
                        />
                        <ResultMetric
                          large
                          label="Break-Even Selling Price"
                          value={formatINR(res.breakEvenSellingPrice)}
                          tone="accent"
                          subtext="Per share minimum exit"
                        />
                      </div>
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-2">
                        <BreakdownRow label="Total Buying Value" value={res.totalBuyingValue} />
                        <BreakdownRow label="Total Selling Value" value={res.totalSellingValue} />
                        <BreakdownRow
                          label="Gross Profit / Loss"
                          value={res.grossPnL}
                          tone={res.grossPnL >= 0 ? 'positive' : 'negative'}
                        />
                        <BreakdownRow label="Total Brokerage & Charges" value={res.totalCharges} />
                        <BreakdownRow
                          bold
                          label="Net Profit / Loss"
                          value={res.netPnL}
                          tone={positive ? 'positive' : 'negative'}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'average-price' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcAveragePrice>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-7 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Purchase Tranches ({avgLots.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setAvgLots([...avgLots, { price: 1000, quantity: 10 }])}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Purchase Row
                        </button>
                      </div>
                      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                        {avgLots.map((lot, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-5">
                              <CalcField
                                label={`Purchase #${idx + 1} Price`}
                                prefix="₹"
                                value={lot.price}
                                onChange={(v) => {
                                  const next = [...avgLots];
                                  next[idx] = { ...lot, price: Math.max(0, toNum(v)) };
                                  setAvgLots(next);
                                }}
                              />
                            </div>
                            <div className="col-span-5">
                              <CalcField
                                label="Quantity"
                                value={lot.quantity}
                                onChange={(v) => {
                                  const next = [...avgLots];
                                  next[idx] = { ...lot, quantity: Math.max(0, toNum(v)) };
                                  setAvgLots(next);
                                }}
                              />
                            </div>
                            <div className="col-span-2 pb-1">
                              <button
                                type="button"
                                disabled={avgLots.length <= 1}
                                onClick={() => setAvgLots(avgLots.filter((_, i) => i !== idx))}
                                className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-red-500 disabled:opacity-30"
                                aria-label="Remove row"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                        <CalcField
                          label="Current Market Price (Optional, for Unrealized P/L)"
                          prefix="₹"
                          value={avgCurrentPrice}
                          onChange={(v) => setAvgCurrentPrice(Math.max(0, toNum(v)))}
                        />
                      </div>
                    </div>

                    <div className="md:col-span-5 space-y-3">
                      <ResultMetric
                        large
                        label="Average Buying Price"
                        value={formatINR(res.averagePrice)}
                        tone="accent"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <ResultMetric label="Total Quantity" value={String(res.totalQuantity)} />
                        <ResultMetric label="Total Invested" value={formatINR(res.totalInvestment)} />
                      </div>
                      {res.currentMarketValue !== null && res.unrealizedPnL !== null && (
                        <ResultMetric
                          label="Current Value & Unrealized P/L"
                          value={formatINR(res.currentMarketValue)}
                          tone={res.unrealizedPnL >= 0 ? 'positive' : 'negative'}
                          subtext={`${res.unrealizedPnL >= 0 ? '+' : ''}${formatINR(
                            res.unrealizedPnL
                          )} (${formatPct(res.unrealizedPnLPct || 0)})`}
                        />
                      )}
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'brokerage' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcBrokerage>;
                const schedule = INDIA_CHARGE_SCHEDULES[brkState.effectiveDate];
                return (
                  <div className="space-y-6">
                    {/* Segment & Exchange Tabs */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800">
                        {(['delivery', 'intraday', 'futures', 'options'] as TradeSegment[]).map(
                          (seg) => (
                            <button
                              key={seg}
                              type="button"
                              onClick={() => setBrkState({ ...brkState, segment: seg })}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                                brkState.segment === seg
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                              }`}
                            >
                              Equity {seg}
                            </button>
                          )
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {(['NSE', 'BSE'] as Exchange[]).map((ex) => (
                          <button
                            key={ex}
                            type="button"
                            onClick={() => setBrkState({ ...brkState, exchange: ex })}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                              brkState.exchange === ex
                                ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <CalcField
                            label="Buy Price"
                            prefix="₹"
                            value={brkState.buyPrice}
                            onChange={(v) =>
                              setBrkState({ ...brkState, buyPrice: Math.max(0, toNum(v)) })
                            }
                          />
                          <CalcField
                            label="Sell Price"
                            prefix="₹"
                            value={brkState.sellPrice}
                            onChange={(v) =>
                              setBrkState({ ...brkState, sellPrice: Math.max(0, toNum(v)) })
                            }
                          />
                        </div>
                        <CalcField
                          label="Quantity"
                          value={brkState.quantity}
                          onChange={(v) =>
                            setBrkState({ ...brkState, quantity: Math.max(0, toNum(v)) })
                          }
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Brokerage Model
                            </label>
                            <select
                              value={brkState.brokerageMode}
                              onChange={(e) =>
                                setBrkState({
                                  ...brkState,
                                  brokerageMode: e.target.value as 'flat' | 'percent' | 'hybrid',
                                })
                              }
                              className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-100"
                            >
                              <option value="hybrid">Min(Flat Cap, %)</option>
                              <option value="flat">Flat per Order (₹)</option>
                              <option value="percent">Percentage (%)</option>
                            </select>
                          </div>
                          <CalcField
                            label="Flat Cap / Order"
                            prefix="₹"
                            value={brkState.brokerageFlatPerOrder}
                            onChange={(v) =>
                              setBrkState({
                                ...brkState,
                                brokerageFlatPerOrder: Math.max(0, toNum(v)),
                              })
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <CalcField
                            label="Brokerage Rate"
                            suffix="%"
                            value={brkState.brokeragePct}
                            onChange={(v) =>
                              setBrkState({ ...brkState, brokeragePct: Math.max(0, toNum(v)) })
                            }
                          />
                          <CalcField
                            label="DP Charges (Delivery Sell)"
                            prefix="₹"
                            value={brkState.dpChargesOnSell}
                            onChange={(v) =>
                              setBrkState({
                                ...brkState,
                                dpChargesOnSell: Math.max(0, toNum(v)),
                              })
                            }
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Statutory Rate Schedule
                          </label>
                          <select
                            value={brkState.effectiveDate}
                            onChange={(e) =>
                              setBrkState({
                                ...brkState,
                                effectiveDate: e.target.value as '2024-10-01' | '2023-04-01',
                              })
                            }
                            className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-100"
                          >
                            <option value="2024-10-01">
                              Oct 1, 2024+ (Current Budget STT & NSE/BSE True-to-Label)
                            </option>
                            <option value="2023-04-01">
                              Apr 2023 – Sep 2024 (Historical Schedule)
                            </option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setBrkState({ ...brkState, showCustomRates: !brkState.showCustomRates })
                          }
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {brkState.showCustomRates
                            ? 'Hide custom statutory overrides'
                            : 'Customize statutory rates (STT / Exchange / Stamp Duty)'}
                        </button>

                        {brkState.showCustomRates && (
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                            <CalcField
                              label={`STT Buy % (def ${schedule.sttBuyPct[brkState.segment]})`}
                              value={brkState.customSttBuy}
                              onChange={(v) => setBrkState({ ...brkState, customSttBuy: v })}
                            />
                            <CalcField
                              label={`STT Sell % (def ${schedule.sttSellPct[brkState.segment]})`}
                              value={brkState.customSttSell}
                              onChange={(v) => setBrkState({ ...brkState, customSttSell: v })}
                            />
                            <CalcField
                              label={`Exch Txn % (def ${
                                schedule.exchangeTxnPct[brkState.exchange][brkState.segment]
                              })`}
                              value={brkState.customExchangeTxn}
                              onChange={(v) => setBrkState({ ...brkState, customExchangeTxn: v })}
                            />
                            <CalcField
                              label={`Stamp Duty % (def ${
                                schedule.stampDutyBuyPct[brkState.segment]
                              })`}
                              value={brkState.customStampDuty}
                              onChange={(v) => setBrkState({ ...brkState, customStampDuty: v })}
                            />
                          </div>
                        )}
                      </div>

                      {/* Itemized Breakdown */}
                      <div className="lg:col-span-7 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <ResultMetric
                            label="Net Profit / Loss"
                            value={`${res.netPnL >= 0 ? '+' : ''}${formatINR(res.netPnL)}`}
                            tone={res.netPnL >= 0 ? 'positive' : 'negative'}
                            subtext={`Gross ${formatINR(res.grossPnL)}`}
                          />
                          <ResultMetric
                            label="Total Taxes & Fees"
                            value={formatINR(res.totalCharges)}
                            subtext={`Buy ${formatINR(res.totalBuySideCharges)} · Sell ${formatINR(
                              res.totalSellSideCharges
                            )}`}
                          />
                          <ResultMetric
                            label="Break-Even Price"
                            value={formatINR(res.breakEvenPrice)}
                            tone="accent"
                            subtext={`+${formatINR(res.pointsToBreakeven)}/sh`}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-2">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 py-1.5 border-b border-slate-200 dark:border-slate-800">
                              Broker-Specific Charges
                            </div>
                            <BreakdownRow label="Buy Brokerage" value={res.buyBrokerage} />
                            <BreakdownRow label="Sell Brokerage" value={res.sellBrokerage} />
                            <BreakdownRow label="DP Charges (Sell)" value={res.dpCharges} />
                            <BreakdownRow
                              bold
                              label="Total Broker Charges"
                              value={res.totalBrokerCharges}
                            />
                          </div>

                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-2">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 py-1.5 border-b border-slate-200 dark:border-slate-800">
                              Statutory & Exchange Taxes
                            </div>
                            <BreakdownRow label="STT (Buy + Sell)" value={res.totalStt} />
                            <BreakdownRow
                              label={`${brkState.exchange} Transaction Charges`}
                              value={res.totalExchangeTxn}
                            />
                            <BreakdownRow
                              label="SEBI + IPFT Charges"
                              value={res.sebiCharges + res.ipftCharges}
                            />
                            <BreakdownRow label="Stamp Duty (Buy)" value={res.stampDuty} />
                            <BreakdownRow label="GST (18%)" value={res.gst} />
                            <BreakdownRow
                              bold
                              label="Total Statutory Charges"
                              value={res.totalStatutoryCharges}
                            />
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Assumptions: {res.effectiveScheduleLabel}. STT & Stamp Duty rounded to nearest ₹ per Indian exchange rules; GST 18% levied on brokerage + exchange + SEBI + IPFT.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'target-price' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcTargetPrice>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Buying Price"
                        prefix="₹"
                        value={targetState.buyPrice}
                        onChange={(v) =>
                          setTargetState({ ...targetState, buyPrice: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Quantity"
                        value={targetState.quantity}
                        onChange={(v) =>
                          setTargetState({ ...targetState, quantity: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Target Price"
                        prefix="₹"
                        value={targetState.targetPrice}
                        onChange={(v) =>
                          setTargetState({ ...targetState, targetPrice: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Stop-Loss Price"
                        prefix="₹"
                        value={targetState.stopLossPrice}
                        onChange={(v) =>
                          setTargetState({ ...targetState, stopLossPrice: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Estimated Transaction Charges"
                        prefix="₹"
                        value={targetState.estimatedCharges}
                        onChange={(v) =>
                          setTargetState({
                            ...targetState,
                            estimatedCharges: Math.max(0, toNum(v)),
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                      <ResultMetric
                        large
                        label="Expected Profit at Target"
                        value={`+${formatINR(res.expectedProfitAtTarget)}`}
                        tone="positive"
                        subtext={`${formatPct(res.targetReturnPct)} gain`}
                      />
                      <ResultMetric
                        large
                        label="Expected Loss at Stop-Loss"
                        value={`-${formatINR(res.expectedLossAtStopLoss)}`}
                        tone="negative"
                        subtext={`-${res.stopLossRiskPct.toFixed(2)}% risk`}
                      />
                      <ResultMetric
                        label="Risk-to-Reward Ratio"
                        value={res.riskRewardLabel}
                        tone="accent"
                      />
                      <ResultMetric
                        label="Break-Even Price"
                        value={formatINR(res.breakEvenPrice)}
                        subtext={`Invested ${formatINR(res.investedAmount)}`}
                      />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'sip' && (() => {
                const res = (activeComputation as any).full as ReturnType<typeof calcSip>;
                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      <div className="md:col-span-4 space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Investment Frequency
                          </label>
                          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800">
                            {(['monthly', 'quarterly', 'yearly'] as SipFrequency[]).map((f) => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => setSipState({ ...sipState, frequency: f })}
                                className={`py-1.5 text-xs font-medium rounded-md capitalize ${
                                  sipState.frequency === f
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>
                        <CalcField
                          label={`${
                            sipState.frequency.charAt(0).toUpperCase() + sipState.frequency.slice(1)
                          } Investment`}
                          prefix="₹"
                          value={sipState.amount}
                          onChange={(v) =>
                            setSipState({ ...sipState, amount: Math.max(0, toNum(v)) })
                          }
                        />
                        <CalcField
                          label="Investment Duration (Years)"
                          min={1}
                          max={50}
                          value={sipState.years}
                          onChange={(v) =>
                            setSipState({
                              ...sipState,
                              years: Math.max(1, Math.min(50, toNum(v, 1))),
                            })
                          }
                        />
                        <CalcField
                          label="Expected Annual Return (Est.)"
                          suffix="%"
                          value={sipState.annualReturnPct}
                          onChange={(v) =>
                            setSipState({ ...sipState, annualReturnPct: Math.max(0, toNum(v)) })
                          }
                        />
                        <p className="text-[11px] text-slate-500">
                          Note: Projected returns are mathematical estimates assuming constant compounding, not guaranteed market outcomes.
                        </p>
                      </div>

                      <div className="md:col-span-8 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <ResultMetric
                            label="Total Invested"
                            value={formatCompactINR(res.totalInvested)}
                            subtext={formatINR(res.totalInvested)}
                          />
                          <ResultMetric
                            label="Estimated Returns"
                            value={`+${formatCompactINR(res.estimatedReturns)}`}
                            tone="positive"
                            subtext={`+${res.wealthGainPct.toFixed(1)}% wealth gain`}
                          />
                          <ResultMetric
                            label="Est. Future Value"
                            value={formatCompactINR(res.totalFutureValue)}
                            tone="accent"
                            subtext={formatINR(res.totalFutureValue)}
                          />
                        </div>
                        <div className="h-60 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={res.schedule}>
                              <XAxis
                                dataKey="year"
                                tickFormatter={(y) => `Yr ${y}`}
                                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                              />
                              <YAxis
                                tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                              />
                              <Tooltip
                                formatter={(val) => formatINR(Number(val ?? 0))}
                                labelFormatter={(y) => `Year ${y}`}
                                contentStyle={{
                                  backgroundColor: '#111827',
                                  borderColor: '#374151',
                                  borderRadius: '8px',
                                  color: '#F9FAFB',
                                  fontSize: '12px',
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="estimatedValue"
                                name="Estimated Value"
                                stroke="#3B82F6"
                                fill="#3B82F6"
                                fillOpacity={0.2}
                              />
                              <Area
                                type="monotone"
                                dataKey="invested"
                                name="Amount Invested"
                                stroke="#22C55E"
                                fill="#22C55E"
                                fillOpacity={0.15}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'cagr' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcCagr>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-4">
                      <CalcField
                        label="Initial Investment"
                        prefix="₹"
                        value={cagrState.initialValue}
                        onChange={(v) =>
                          setCagrState({ ...cagrState, initialValue: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Final Investment Value"
                        prefix="₹"
                        value={cagrState.finalValue}
                        onChange={(v) =>
                          setCagrState({ ...cagrState, finalValue: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Duration (Years)"
                        min={0.1}
                        value={cagrState.years}
                        onChange={(v) =>
                          setCagrState({ ...cagrState, years: Math.max(0.1, toNum(v, 1)) })
                        }
                      />
                    </div>
                    <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3 content-start">
                      <ResultMetric
                        large
                        label="CAGR %"
                        value={formatPct(res.cagrPct)}
                        tone={res.cagrPct >= 0 ? 'positive' : 'negative'}
                      />
                      <ResultMetric
                        label="Total Profit"
                        value={formatINR(res.totalProfit)}
                        tone={res.totalProfit >= 0 ? 'positive' : 'negative'}
                      />
                      <ResultMetric
                        label="Overall Return"
                        value={formatPct(res.overallReturnPct)}
                      />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'stock-return' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcStockReturn>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Initial Investment"
                        prefix="₹"
                        value={stockRetState.initialInvestment}
                        onChange={(v) =>
                          setStockRetState({
                            ...stockRetState,
                            initialInvestment: Math.max(0, toNum(v)),
                          })
                        }
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <CalcField
                          label="Current Stock Price"
                          prefix="₹"
                          value={stockRetState.currentPrice}
                          onChange={(v) =>
                            setStockRetState({
                              ...stockRetState,
                              currentPrice: Math.max(0, toNum(v)),
                            })
                          }
                        />
                        <CalcField
                          label="Quantity"
                          value={stockRetState.quantity}
                          onChange={(v) =>
                            setStockRetState({
                              ...stockRetState,
                              quantity: Math.max(0, toNum(v)),
                            })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <CalcField
                          label="Dividends Received"
                          prefix="₹"
                          value={stockRetState.dividendsReceived}
                          onChange={(v) =>
                            setStockRetState({
                              ...stockRetState,
                              dividendsReceived: Math.max(0, toNum(v)),
                            })
                          }
                        />
                        <CalcField
                          label="Duration (Years)"
                          min={0.1}
                          value={stockRetState.years}
                          onChange={(v) =>
                            setStockRetState({
                              ...stockRetState,
                              years: Math.max(0.1, toNum(v, 1)),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                      <ResultMetric
                        large
                        label="Total Return (Capital + Dividends)"
                        value={`${res.totalReturn >= 0 ? '+' : ''}${formatINR(res.totalReturn)}`}
                        tone={res.totalReturn >= 0 ? 'positive' : 'negative'}
                        subtext={`${formatPct(res.totalReturnPct)} overall`}
                      />
                      <ResultMetric
                        large
                        label="Annualized Return"
                        value={formatPct(res.annualizedReturnPct)}
                        tone={res.annualizedReturnPct >= 0 ? 'positive' : 'negative'}
                        subtext={`Current Value ${formatINR(res.currentValue)}`}
                      />
                      <ResultMetric
                        label="Capital Gain / Loss"
                        value={formatINR(res.capitalGain)}
                        tone={res.capitalGain >= 0 ? 'positive' : 'negative'}
                      />
                      <ResultMetric label="Dividend Income" value={formatINR(res.dividendIncome)} />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'break-even' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcBreakEven>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Buying Price"
                        prefix="₹"
                        value={breakEvenState.buyPrice}
                        onChange={(v) =>
                          setBreakEvenState({ ...breakEvenState, buyPrice: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Quantity"
                        value={breakEvenState.quantity}
                        onChange={(v) =>
                          setBreakEvenState({ ...breakEvenState, quantity: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Brokerage (Per Order)"
                        prefix="₹"
                        value={breakEvenState.brokeragePerOrder}
                        onChange={(v) =>
                          setBreakEvenState({
                            ...breakEvenState,
                            brokeragePerOrder: Math.max(0, toNum(v)),
                          })
                        }
                      />
                      <CalcField
                        label="Applicable Taxes & Fees"
                        prefix="₹"
                        value={breakEvenState.taxesAndFeesAmount}
                        onChange={(v) =>
                          setBreakEvenState({
                            ...breakEvenState,
                            taxesAndFeesAmount: Math.max(0, toNum(v)),
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                      <ResultMetric
                        large
                        label="Break-Even Selling Price"
                        value={formatINR(res.breakEvenSellingPrice)}
                        tone="accent"
                        subtext={`+${res.requiredGainPct.toFixed(2)}% above buy`}
                      />
                      <ResultMetric
                        large
                        label="Min Profitable Price (₹0.05 Tick)"
                        value={formatINR(res.minimumProfitableSellingPrice)}
                        tone="positive"
                      />
                      <ResultMetric label="Total Investment" value={formatINR(res.totalInvestment)} />
                      <ResultMetric
                        label="Total Transaction Costs"
                        value={formatINR(res.totalTransactionCosts)}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* ADVANCED 18 CALCULATORS */}
              {activeMeta.id === 'dividend-yield' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcDividendYield>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <CalcField
                        label="Annual Dividend Per Share"
                        prefix="₹"
                        value={divYieldState.annualDividend}
                        onChange={(v) =>
                          setDivYieldState({ ...divYieldState, annualDividend: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Current Share Price"
                        prefix="₹"
                        value={divYieldState.sharePrice}
                        onChange={(v) =>
                          setDivYieldState({ ...divYieldState, sharePrice: Math.max(0, toNum(v)) })
                        }
                      />
                    </div>
                    <ResultMetric
                      large
                      label="Dividend Yield"
                      value={`${res.dividendYieldPct.toFixed(2)}%`}
                      tone="positive"
                    />
                  </div>
                );
              })()}

              {activeMeta.id === 'dividend-income' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcDividendIncome>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Shares Owned"
                        value={divIncomeState.sharesOwned}
                        onChange={(v) =>
                          setDivIncomeState({ ...divIncomeState, sharesOwned: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Annual Dividend / Share"
                        prefix="₹"
                        value={divIncomeState.annualDividend}
                        onChange={(v) =>
                          setDivIncomeState({
                            ...divIncomeState,
                            annualDividend: Math.max(0, toNum(v)),
                          })
                        }
                      />
                      <CalcField
                        label="Tax / TDS Rate"
                        suffix="%"
                        value={divIncomeState.taxRatePct}
                        onChange={(v) =>
                          setDivIncomeState({ ...divIncomeState, taxRatePct: Math.max(0, toNum(v)) })
                        }
                      />
                    </div>
                    <div className="md:col-span-7 grid grid-cols-2 gap-3 content-start">
                      <ResultMetric
                        large
                        label="Net Annual Dividend"
                        value={formatINR(res.netAnnualDividend)}
                        tone="positive"
                      />
                      <ResultMetric
                        large
                        label="Monthly Equivalent"
                        value={formatINR(res.monthlyAverageIncome)}
                      />
                      <ResultMetric label="Gross Dividend" value={formatINR(res.grossAnnualDividend)} />
                      <ResultMetric label="Estimated Tax" value={formatINR(res.estimatedTax)} />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'stock-valuation' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcStockValuation>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Earnings Per Share (EPS)"
                        prefix="₹"
                        value={valState.eps}
                        onChange={(v) => setValState({ ...valState, eps: toNum(v) })}
                      />
                      <CalcField
                        label="Book Value Per Share (BVPS)"
                        prefix="₹"
                        value={valState.bvps}
                        onChange={(v) => setValState({ ...valState, bvps: toNum(v) })}
                      />
                      <CalcField
                        label="Current Market Price"
                        prefix="₹"
                        value={valState.currentPrice}
                        onChange={(v) =>
                          setValState({ ...valState, currentPrice: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Fair P/E Multiple"
                        value={valState.fairPeMultiple}
                        onChange={(v) =>
                          setValState({ ...valState, fairPeMultiple: Math.max(0, toNum(v)) })
                        }
                      />
                    </div>
                    <div className="md:col-span-7 grid grid-cols-2 gap-3 content-start">
                      <ResultMetric
                        large
                        label="Blended Fair Value"
                        value={formatINR(res.blendedFairValue)}
                        tone="accent"
                        subtext={res.valuationStatus}
                      />
                      <ResultMetric
                        large
                        label="Margin of Safety"
                        value={formatPct(res.marginOfSafetyPct)}
                        tone={res.marginOfSafetyPct >= 0 ? 'positive' : 'negative'}
                      />
                      <ResultMetric label="Graham Number" value={formatINR(res.grahamNumber)} />
                      <ResultMetric label="P/E Multiple Value" value={formatINR(res.peFairValue)} />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'pe-ratio' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcPeRatio>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Market Price"
                        prefix="₹"
                        value={peState.marketPrice}
                        onChange={(v) =>
                          setPeState({ ...peState, marketPrice: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Trailing 12M EPS"
                        prefix="₹"
                        value={peState.eps}
                        onChange={(v) => setPeState({ ...peState, eps: toNum(v) })}
                      />
                      <CalcField
                        label="Sector Average P/E"
                        value={peState.sectorAvgPe}
                        onChange={(v) =>
                          setPeState({ ...peState, sectorAvgPe: Math.max(0, toNum(v)) })
                        }
                      />
                    </div>
                    <div className="md:col-span-7 grid grid-cols-3 gap-3 content-start">
                      <ResultMetric label="P/E Ratio" value={`${res.peRatio}x`} tone="accent" />
                      <ResultMetric
                        label="Earnings Yield"
                        value={`${res.earningsYieldPct}%`}
                        tone="positive"
                      />
                      <ResultMetric
                        label="vs Sector Avg"
                        value={formatPct(res.premiumVsSectorPct)}
                        tone={res.premiumVsSectorPct <= 0 ? 'positive' : 'negative'}
                      />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'eps' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcEps>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Net Income"
                        prefix="₹"
                        value={epsState.netIncome}
                        onChange={(v) => setEpsState({ ...epsState, netIncome: toNum(v) })}
                      />
                      <CalcField
                        label="Preferred Dividends"
                        prefix="₹"
                        value={epsState.preferredDividends}
                        onChange={(v) =>
                          setEpsState({ ...epsState, preferredDividends: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Weighted Average Shares"
                        value={epsState.weightedShares}
                        onChange={(v) =>
                          setEpsState({ ...epsState, weightedShares: Math.max(0, toNum(v)) })
                        }
                      />
                    </div>
                    <div className="md:col-span-7 grid grid-cols-2 gap-3 content-start">
                      <ResultMetric
                        large
                        label="Earnings Per Share (EPS)"
                        value={formatINR(res.eps)}
                        tone="accent"
                      />
                      <ResultMetric
                        label="Common Earnings"
                        value={formatCompactINR(res.earningsAvailableToCommon)}
                      />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'roi' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcRoi>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Amount Invested"
                        prefix="₹"
                        value={roiState.amountInvested}
                        onChange={(v) =>
                          setRoiState({ ...roiState, amountInvested: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Amount Returned"
                        prefix="₹"
                        value={roiState.amountReturned}
                        onChange={(v) =>
                          setRoiState({ ...roiState, amountReturned: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Holding Period (Years)"
                        min={0.1}
                        value={roiState.years}
                        onChange={(v) =>
                          setRoiState({ ...roiState, years: Math.max(0.1, toNum(v, 1)) })
                        }
                      />
                    </div>
                    <div className="md:col-span-7 grid grid-cols-3 gap-3 content-start">
                      <ResultMetric
                        label="ROI %"
                        value={formatPct(res.roiPct)}
                        tone={res.roiPct >= 0 ? 'positive' : 'negative'}
                      />
                      <ResultMetric
                        label="Net Gain"
                        value={formatINR(res.netProfit)}
                        tone={res.netProfit >= 0 ? 'positive' : 'negative'}
                      />
                      <ResultMetric label="Annualized ROI" value={formatPct(res.annualizedRoiPct)} />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'risk-reward' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcRiskReward>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Entry Price"
                        prefix="₹"
                        value={rrState.entryPrice}
                        onChange={(v) =>
                          setRrState({ ...rrState, entryPrice: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Stop-Loss Price"
                        prefix="₹"
                        value={rrState.stopLoss}
                        onChange={(v) => setRrState({ ...rrState, stopLoss: Math.max(0, toNum(v)) })}
                      />
                      <CalcField
                        label="Target Price"
                        prefix="₹"
                        value={rrState.targetPrice}
                        onChange={(v) =>
                          setRrState({ ...rrState, targetPrice: Math.max(0, toNum(v)) })
                        }
                      />
                    </div>
                    <div className="md:col-span-7 grid grid-cols-2 gap-3 content-start">
                      <ResultMetric
                        large
                        label="Risk-to-Reward Ratio"
                        value={res.riskRewardText}
                        tone="accent"
                      />
                      <ResultMetric
                        large
                        label="Break-Even Win Rate"
                        value={`${res.breakevenWinRatePct}%`}
                      />
                      <ResultMetric
                        label="Risk Per Share"
                        value={formatINR(res.riskPerShare)}
                        tone="negative"
                      />
                      <ResultMetric
                        label="Reward Per Share"
                        value={formatINR(res.rewardPerShare)}
                        tone="positive"
                      />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'position-sizing' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcPositionSizing>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Trading Capital"
                        prefix="₹"
                        value={posState.accountCapital}
                        onChange={(v) =>
                          setPosState({ ...posState, accountCapital: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Max Risk Per Trade"
                        suffix="%"
                        value={posState.riskPerTradePct}
                        onChange={(v) =>
                          setPosState({ ...posState, riskPerTradePct: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Entry Price"
                        prefix="₹"
                        value={posState.entryPrice}
                        onChange={(v) =>
                          setPosState({ ...posState, entryPrice: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Stop-Loss Price"
                        prefix="₹"
                        value={posState.stopLossPrice}
                        onChange={(v) =>
                          setPosState({ ...posState, stopLossPrice: Math.max(0, toNum(v)) })
                        }
                      />
                    </div>
                    <div className="md:col-span-7 grid grid-cols-2 gap-3 content-start">
                      <ResultMetric
                        large
                        label="Recommended Shares"
                        value={String(res.recommendedShares)}
                        tone="accent"
                      />
                      <ResultMetric
                        large
                        label="Position Capital Required"
                        value={formatINR(res.positionCapitalRequired)}
                        subtext={`${res.capitalUtilizationPct}% of capital`}
                      />
                      <ResultMetric
                        label="Max Rupee Risk"
                        value={formatINR(res.maxRiskAmount)}
                        tone="negative"
                      />
                      <ResultMetric label="Risk Per Share" value={formatINR(res.riskPerShare)} />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'stop-loss' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcStopLoss>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {(['long', 'short'] as const).map((dir) => (
                          <button
                            key={dir}
                            type="button"
                            onClick={() => setSlState({ ...slState, direction: dir })}
                            className={`py-2 rounded-lg text-xs font-medium capitalize border ${
                              slState.direction === dir
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {dir} Position
                          </button>
                        ))}
                      </div>
                      <CalcField
                        label="Entry Price"
                        prefix="₹"
                        value={slState.entryPrice}
                        onChange={(v) =>
                          setSlState({ ...slState, entryPrice: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Quantity"
                        value={slState.quantity}
                        onChange={(v) =>
                          setSlState({ ...slState, quantity: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Stop-Loss Distance"
                        suffix="%"
                        value={slState.stopLossPct}
                        onChange={(v) =>
                          setSlState({ ...slState, stopLossPct: Math.max(0, toNum(v)) })
                        }
                      />
                    </div>
                    <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3 content-start">
                      <ResultMetric
                        label="Stop-Loss Trigger"
                        value={formatINR(res.stopLossPrice)}
                        tone="accent"
                      />
                      <ResultMetric
                        label="Loss / Share"
                        value={formatINR(res.lossPerShare)}
                        tone="negative"
                      />
                      <ResultMetric
                        label="Max Capital Loss"
                        value={formatINR(res.maxCapitalLoss)}
                        tone="negative"
                      />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'portfolio-allocation' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcPortfolioAllocation>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-6 space-y-3">
                      {allocItems.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-6">
                            <CalcField
                              label="Bucket / Asset"
                              type="text"
                              value={item.name}
                              onChange={(v) => {
                                const next = [...allocItems];
                                next[idx] = { ...item, name: v };
                                setAllocItems(next);
                              }}
                            />
                          </div>
                          <div className="col-span-4">
                            <CalcField
                              label="Value"
                              prefix="₹"
                              value={item.currentValue}
                              onChange={(v) => {
                                const next = [...allocItems];
                                next[idx] = { ...item, currentValue: Math.max(0, toNum(v)) };
                                setAllocItems(next);
                              }}
                            />
                          </div>
                          <div className="col-span-2 pb-1">
                            <button
                              type="button"
                              disabled={allocItems.length <= 1}
                              onClick={() => setAllocItems(allocItems.filter((_, i) => i !== idx))}
                              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-red-500 disabled:opacity-30"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setAllocItems([...allocItems, { name: 'New Asset', currentValue: 50000 }])
                        }
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Asset Class
                      </button>
                    </div>
                    <div className="md:col-span-6 space-y-3">
                      <ResultMetric
                        large
                        label="Total Portfolio Value"
                        value={formatINR(res.totalValue)}
                        tone="accent"
                      />
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-2">
                        {res.items.map((it, i) => (
                          <BreakdownRow
                            key={i}
                            label={`${it.name} (${it.weightPct.toFixed(2)}%)`}
                            value={it.value}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'portfolio-rebalancing' && (() => {
                const res = activeComputation.results as ReturnType<
                  typeof calcPortfolioRebalancing
                >;
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <CalcField
                        label="New Cash Added"
                        prefix="₹"
                        value={rebalCash}
                        onChange={(v) => setRebalCash(Math.max(0, toNum(v)))}
                      />
                      <ResultMetric label="Current Total" value={formatINR(res.currentTotal)} />
                      <ResultMetric
                        label="Post-Rebalance Total"
                        value={formatINR(res.newTotal)}
                        tone="accent"
                      />
                    </div>
                    <div className="space-y-2">
                      {rebalItems.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-5">
                            <CalcField
                              label="Asset"
                              type="text"
                              value={item.name}
                              onChange={(v) => {
                                const next = [...rebalItems];
                                next[idx] = { ...item, name: v };
                                setRebalItems(next);
                              }}
                            />
                          </div>
                          <div className="col-span-4">
                            <CalcField
                              label="Current Value"
                              prefix="₹"
                              value={item.currentValue}
                              onChange={(v) => {
                                const next = [...rebalItems];
                                next[idx] = { ...item, currentValue: Math.max(0, toNum(v)) };
                                setRebalItems(next);
                              }}
                            />
                          </div>
                          <div className="col-span-3">
                            <CalcField
                              label="Target %"
                              suffix="%"
                              value={item.targetWeightPct}
                              onChange={(v) => {
                                const next = [...rebalItems];
                                next[idx] = { ...item, targetWeightPct: Math.max(0, toNum(v)) };
                                setRebalItems(next);
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-[#0B1120] text-slate-500">
                          <tr>
                            <th className="text-left px-3 py-2">Asset</th>
                            <th className="text-right px-3 py-2">Current %</th>
                            <th className="text-right px-3 py-2">Target %</th>
                            <th className="text-right px-3 py-2">Target Value</th>
                            <th className="text-right px-3 py-2">Rebalance Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                          {res.actions.map((a, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 font-sans font-medium text-slate-900 dark:text-slate-100">
                                {a.name}
                              </td>
                              <td className="px-3 py-2 text-right">{a.currentWeightPct}%</td>
                              <td className="px-3 py-2 text-right">{a.targetWeightPct}%</td>
                              <td className="px-3 py-2 text-right">{formatINR(a.targetValue)}</td>
                              <td
                                className={`px-3 py-2 text-right font-semibold ${
                                  a.action === 'BUY'
                                    ? 'text-emerald-600 dark:text-[#22C55E]'
                                    : a.action === 'SELL'
                                      ? 'text-red-600 dark:text-[#EF4444]'
                                      : 'text-slate-500'
                                }`}
                              >
                                {a.action} {formatINR(Math.abs(a.actionAmount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'stock-split' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcStockSplit>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Current Shares Held"
                        value={splitState.currentShares}
                        onChange={(v) =>
                          setSplitState({ ...splitState, currentShares: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Current Average Price"
                        prefix="₹"
                        value={splitState.currentAvgPrice}
                        onChange={(v) =>
                          setSplitState({ ...splitState, currentAvgPrice: Math.max(0, toNum(v)) })
                        }
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <CalcField
                          label="New Shares"
                          min={1}
                          value={splitState.newSharesPerOld}
                          onChange={(v) =>
                            setSplitState({
                              ...splitState,
                              newSharesPerOld: Math.max(1, toNum(v, 1)),
                            })
                          }
                        />
                        <CalcField
                          label="For Every Old Share(s)"
                          min={1}
                          value={splitState.oldSharesUnit}
                          onChange={(v) =>
                            setSplitState({
                              ...splitState,
                              oldSharesUnit: Math.max(1, toNum(v, 1)),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="md:col-span-7 grid grid-cols-3 gap-3 content-start">
                      <ResultMetric
                        label="Post-Split Shares"
                        value={String(res.postSplitShares)}
                        tone="accent"
                      />
                      <ResultMetric
                        label="Adjusted Avg Price"
                        value={formatINR(res.adjustedAvgPrice)}
                      />
                      <ResultMetric
                        label="Total Value Preserved"
                        value={formatINR(res.totalValuePreserved)}
                      />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'bonus-share' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcBonusShare>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Held Shares"
                        value={bonusState.heldShares}
                        onChange={(v) =>
                          setBonusState({ ...bonusState, heldShares: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Average Buy Price"
                        prefix="₹"
                        value={bonusState.avgBuyPrice}
                        onChange={(v) =>
                          setBonusState({ ...bonusState, avgBuyPrice: Math.max(0, toNum(v)) })
                        }
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <CalcField
                          label="Bonus Shares Issued"
                          min={1}
                          value={bonusState.bonusIssued}
                          onChange={(v) =>
                            setBonusState({ ...bonusState, bonusIssued: Math.max(0, toNum(v)) })
                          }
                        />
                        <CalcField
                          label="For Every Held"
                          min={1}
                          value={bonusState.forEveryHeld}
                          onChange={(v) =>
                            setBonusState({
                              ...bonusState,
                              forEveryHeld: Math.max(1, toNum(v, 1)),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="md:col-span-7 grid grid-cols-3 gap-3 content-start">
                      <ResultMetric
                        label="Bonus Shares Credited"
                        value={`+${res.bonusSharesReceived}`}
                        tone="positive"
                      />
                      <ResultMetric
                        label="Total Shares"
                        value={String(res.totalSharesAfterBonus)}
                        tone="accent"
                      />
                      <ResultMetric
                        label="Adjusted Avg Cost"
                        value={formatINR(res.adjustedAvgPrice)}
                      />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'rights-issue' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcRightsIssue>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Held Shares"
                        value={rightsState.heldShares}
                        onChange={(v) =>
                          setRightsState({ ...rightsState, heldShares: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Current Market Price"
                        prefix="₹"
                        value={rightsState.currentMarketPrice}
                        onChange={(v) =>
                          setRightsState({
                            ...rightsState,
                            currentMarketPrice: Math.max(0, toNum(v)),
                          })
                        }
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <CalcField
                          label="Rights Shares"
                          value={rightsState.entitlementNew}
                          onChange={(v) =>
                            setRightsState({
                              ...rightsState,
                              entitlementNew: Math.max(0, toNum(v)),
                            })
                          }
                        />
                        <CalcField
                          label="For Every Held"
                          min={1}
                          value={rightsState.entitlementForEvery}
                          onChange={(v) =>
                            setRightsState({
                              ...rightsState,
                              entitlementForEvery: Math.max(1, toNum(v, 1)),
                            })
                          }
                        />
                      </div>
                      <CalcField
                        label="Rights Issue Price"
                        prefix="₹"
                        value={rightsState.rightsIssuePrice}
                        onChange={(v) =>
                          setRightsState({
                            ...rightsState,
                            rightsIssuePrice: Math.max(0, toNum(v)),
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-7 grid grid-cols-2 gap-3 content-start">
                      <ResultMetric
                        large
                        label="Theoretical Ex-Rights Price (TERP)"
                        value={formatINR(res.theoreticalExRightsPrice)}
                        tone="accent"
                      />
                      <ResultMetric
                        large
                        label="Additional Capital Needed"
                        value={formatINR(res.additionalCapitalRequired)}
                      />
                      <ResultMetric
                        label="Eligible Rights Shares"
                        value={String(res.eligibleRightsShares)}
                        tone="positive"
                      />
                      <ResultMetric
                        label="Issue Discount vs CMP"
                        value={formatPct(res.issueDiscountPct)}
                      />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'mutual-fund' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcMutualFundReturn>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {(['sip', 'lumpsum'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMfState({ ...mfState, mode: m })}
                            className={`py-2 rounded-lg text-xs font-medium uppercase border ${
                              mfState.mode === m
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      <CalcField
                        label={mfState.mode === 'sip' ? 'Monthly SIP' : 'Lumpsum Amount'}
                        prefix="₹"
                        value={mfState.amount}
                        onChange={(v) => setMfState({ ...mfState, amount: Math.max(0, toNum(v)) })}
                      />
                      <CalcField
                        label="Years"
                        min={1}
                        value={mfState.years}
                        onChange={(v) =>
                          setMfState({ ...mfState, years: Math.max(1, toNum(v, 1)) })
                        }
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <CalcField
                          label="Gross Return %"
                          suffix="%"
                          value={mfState.grossAnnualReturnPct}
                          onChange={(v) =>
                            setMfState({ ...mfState, grossAnnualReturnPct: Math.max(0, toNum(v)) })
                          }
                        />
                        <CalcField
                          label="Expense Ratio %"
                          suffix="%"
                          value={mfState.expenseRatioPct}
                          onChange={(v) =>
                            setMfState({ ...mfState, expenseRatioPct: Math.max(0, toNum(v)) })
                          }
                        />
                      </div>
                    </div>
                    <div className="md:col-span-7 grid grid-cols-2 gap-3 content-start">
                      <ResultMetric
                        large
                        label="Net Est. Value (After Expense)"
                        value={formatCompactINR(res.netEstimatedValue)}
                        tone="accent"
                        subtext={`Net CAGR ${res.netAnnualReturnPct}%`}
                      />
                      <ResultMetric
                        large
                        label="Expense Ratio Drag"
                        value={formatINR(res.expenseDrag)}
                        tone="negative"
                      />
                      <ResultMetric label="Total Invested" value={formatINR(res.totalInvested)} />
                      <ResultMetric
                        label="Net Est. Gain"
                        value={formatCompactINR(res.netEstimatedGain)}
                        tone="positive"
                      />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'lumpsum' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcLumpsum>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Lumpsum Principal"
                        prefix="₹"
                        value={lumpsumState.principal}
                        onChange={(v) =>
                          setLumpsumState({ ...lumpsumState, principal: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Duration (Years)"
                        min={1}
                        value={lumpsumState.years}
                        onChange={(v) =>
                          setLumpsumState({ ...lumpsumState, years: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Expected Annual Return"
                        suffix="%"
                        value={lumpsumState.annualReturnPct}
                        onChange={(v) =>
                          setLumpsumState({
                            ...lumpsumState,
                            annualReturnPct: Math.max(0, toNum(v)),
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-7 grid grid-cols-3 gap-3 content-start">
                      <ResultMetric label="Invested" value={formatCompactINR(res.totalInvested)} />
                      <ResultMetric
                        label="Est. Returns"
                        value={formatCompactINR(res.estimatedReturns)}
                        tone="positive"
                      />
                      <ResultMetric
                        label="Est. Future Value"
                        value={formatCompactINR(res.futureValue)}
                        tone="accent"
                      />
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'inflation-adjusted' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcInflationAdjusted>;
                const chartData = [
                  { label: 'Nominal Value', amount: res.nominalFutureValue },
                  { label: 'Real Purchasing Power', amount: res.realPurchasingPower },
                ];
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 space-y-3">
                      <CalcField
                        label="Initial Corpus"
                        prefix="₹"
                        value={infState.principal}
                        onChange={(v) =>
                          setInfState({ ...infState, principal: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Nominal Return %"
                        suffix="%"
                        value={infState.nominalReturnPct}
                        onChange={(v) => setInfState({ ...infState, nominalReturnPct: toNum(v) })}
                      />
                      <CalcField
                        label="Inflation Rate %"
                        suffix="%"
                        value={infState.inflationRatePct}
                        onChange={(v) =>
                          setInfState({ ...infState, inflationRatePct: Math.max(0, toNum(v)) })
                        }
                      />
                      <CalcField
                        label="Years"
                        min={1}
                        value={infState.years}
                        onChange={(v) => setInfState({ ...infState, years: Math.max(0, toNum(v)) })}
                      />
                    </div>
                    <div className="md:col-span-7 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <ResultMetric
                          label="Real Annual Return"
                          value={formatPct(res.realAnnualReturnPct)}
                          tone={res.realAnnualReturnPct >= 0 ? 'positive' : 'negative'}
                        />
                        <ResultMetric
                          label="Real Purchasing Power"
                          value={formatCompactINR(res.realPurchasingPower)}
                          tone="accent"
                          subtext={`Nominal ${formatCompactINR(res.nominalFutureValue)}`}
                        />
                      </div>
                      <div className="h-44 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                            <YAxis
                              tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                              tick={{ fontSize: 11, fill: '#9CA3AF' }}
                            />
                            <Tooltip formatter={(val) => formatINR(Number(val ?? 0))} />
                            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                              <Cell fill="#3B82F6" />
                              <Cell fill="#22C55E" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {activeMeta.id === 'xirr' && (() => {
                const res = activeComputation.results as ReturnType<typeof calcXirr>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-7 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Dated Cash Flows (Negative = Invested, Positive = Returned/Current Value)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setXirrFlows([
                              ...xirrFlows,
                              { date: new Date().toISOString().slice(0, 10), amount: -10000 },
                            ])
                          }
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Row
                        </button>
                      </div>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {xirrFlows.map((cf, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-5">
                              <CalcField
                                label="Date"
                                type="date"
                                value={cf.date}
                                onChange={(v) => {
                                  const next = [...xirrFlows];
                                  next[idx] = { ...cf, date: v };
                                  setXirrFlows(next);
                                }}
                              />
                            </div>
                            <div className="col-span-5">
                              <CalcField
                                label="Cash Flow"
                                prefix="₹"
                                min={-1000000000}
                                value={cf.amount}
                                onChange={(v) => {
                                  const next = [...xirrFlows];
                                  next[idx] = { ...cf, amount: toNum(v) };
                                  setXirrFlows(next);
                                }}
                              />
                            </div>
                            <div className="col-span-2 pb-1">
                              <button
                                type="button"
                                disabled={xirrFlows.length <= 2}
                                onClick={() => setXirrFlows(xirrFlows.filter((_, i) => i !== idx))}
                                className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-red-500 disabled:opacity-30"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-5 space-y-3">
                      <ResultMetric
                        large
                        label="Annualized XIRR"
                        value={res.xirrPct !== null ? formatPct(res.xirrPct) : 'Needs +/- flows'}
                        tone={
                          res.xirrPct === null
                            ? 'neutral'
                            : res.xirrPct >= 0
                              ? 'positive'
                              : 'negative'
                        }
                      />
                      <ResultMetric label="Total Invested" value={formatINR(res.totalInvested)} />
                      <ResultMetric
                        label="Total Returned / Value"
                        value={formatINR(res.totalReturned)}
                      />
                      <ResultMetric
                        label="Net Gain"
                        value={formatINR(res.netGain)}
                        tone={res.netGain >= 0 ? 'positive' : 'negative'}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* AI Explanation Result */}
            {aiExplanation && (
              <div className="mt-6 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  StockMate Educational Analysis
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                  {aiExplanation}
                </div>
              </div>
            )}

            {/* Formula & Worked Example */}
            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 p-3.5">
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Formula Reference
                </div>
                <code className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-words">
                  {activeMeta.formula}
                </code>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 p-3.5">
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Worked Example
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {activeMeta.example}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
