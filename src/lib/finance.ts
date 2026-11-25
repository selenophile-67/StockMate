import Decimal from 'decimal.js';
import {
  BrokerageRateSchedule,
  CandlePoint,
  Exchange,
  TradeSegment,
} from '../types/stockmate';

// Configure high precision for financial decimal math
Decimal.set({ precision: 24, rounding: Decimal.ROUND_HALF_UP });

export function d(val: number | string | Decimal): Decimal {
  if (val === '' || val === null || val === undefined) return new Decimal(0);
  const num = new Decimal(val);
  if (!num.isFinite()) return new Decimal(0);
  return num;
}

export function round2(val: Decimal | number): number {
  return d(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function round4(val: Decimal | number): number {
  return d(val).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}

export function formatINR(value: number | string, decimals = 2): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '₹0.00';
  const abs = Math.abs(num);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(abs);
  return `${num < 0 ? '-' : ''}₹${formatted}`;
}

export function formatIndianNumber(value: number | string, decimals = 2): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return formatINR(value);
}

export function formatPct(value: number, includeSign = true): string {
  if (!Number.isFinite(value)) return '0.00%';
  const sign = includeSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

// ============================================================================
// DATE-AWARE INDIAN STATUTORY & EXCHANGE RATE SCHEDULES
// ============================================================================
export const INDIA_CHARGE_SCHEDULES: Record<
  '2024-10-01' | '2023-04-01',
  BrokerageRateSchedule
> = {
  '2024-10-01': {
    effectiveLabel: 'Effective Oct 1, 2024 (Union Budget 2024 STT & NSE/BSE Revised Txn)',
    effectiveDate: '2024-10-01',
    // STT rates as % of turnover (for options: % of option premium on sell)
    sttBuyPct: {
      delivery: 0.1,
      intraday: 0,
      futures: 0,
      options: 0,
    },
    sttSellPct: {
      delivery: 0.1,
      intraday: 0.025,
      futures: 0.02, // Raised from 0.0125% to 0.02% on Oct 1, 2024
      options: 0.1, // Raised from 0.0625% to 0.1% on Oct 1, 2024 (on sell premium)
    },
    // NSE & BSE revised true-to-label flat exchange transaction charges (Oct 2024)
    exchangeTxnPct: {
      NSE: {
        delivery: 0.00297,
        intraday: 0.00297,
        futures: 0.00173,
        options: 0.03503,
      },
      BSE: {
        delivery: 0.00375,
        intraday: 0.00375,
        futures: 0,
        options: 0.0325,
      },
    },
    sebiTurnoverPct: 0.0001, // ₹10 per crore
    stampDutyBuyPct: {
      delivery: 0.015,
      intraday: 0.003,
      futures: 0.002,
      options: 0.003,
    },
    gstPct: 18,
    ipftPct: {
      NSE: 0.0001, // ₹10 per crore on NSE equity/futures
      BSE: 0,
    },
  },
  '2023-04-01': {
    effectiveLabel: 'Pre-Oct 2024 Schedule (Apr 2023 – Sep 2024)',
    effectiveDate: '2023-04-01',
    sttBuyPct: {
      delivery: 0.1,
      intraday: 0,
      futures: 0,
      options: 0,
    },
    sttSellPct: {
      delivery: 0.1,
      intraday: 0.025,
      futures: 0.0125,
      options: 0.0625,
    },
    exchangeTxnPct: {
      NSE: {
        delivery: 0.00325,
        intraday: 0.00325,
        futures: 0.0019,
        options: 0.05,
      },
      BSE: {
        delivery: 0.00375,
        intraday: 0.00375,
        futures: 0,
        options: 0.05,
      },
    },
    sebiTurnoverPct: 0.0001,
    stampDutyBuyPct: {
      delivery: 0.015,
      intraday: 0.003,
      futures: 0.002,
      options: 0.003,
    },
    gstPct: 18,
    ipftPct: {
      NSE: 0.0001,
      BSE: 0,
    },
  },
};

// ============================================================================
// CORE CALCULATOR 1: STOCK PROFIT & LOSS
// ============================================================================
export interface ProfitLossInput {
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  brokerageCharges: number;
  otherCharges: number;
}

export interface ProfitLossResult {
  totalBuyingValue: number;
  totalSellingValue: number;
  grossPnL: number;
  totalCharges: number;
  netPnL: number;
  returnPct: number;
  breakEvenSellingPrice: number;
}

export function calcProfitLoss(input: ProfitLossInput): ProfitLossResult {
  const buy = d(Math.max(0, input.buyPrice));
  const sell = d(Math.max(0, input.sellPrice));
  const qty = d(Math.max(0, input.quantity));
  const brokerage = d(Math.max(0, input.brokerageCharges));
  const other = d(Math.max(0, input.otherCharges));

  const totalBuyingValue = buy.mul(qty);
  const totalSellingValue = sell.mul(qty);
  const grossPnL = totalSellingValue.sub(totalBuyingValue);
  const totalCharges = brokerage.add(other);
  const netPnL = grossPnL.sub(totalCharges);
  const returnPct = totalBuyingValue.gt(0)
    ? netPnL.div(totalBuyingValue).mul(100)
    : d(0);
  const breakEvenSellingPrice = qty.gt(0)
    ? totalBuyingValue.add(totalCharges).div(qty)
    : d(0);

  return {
    totalBuyingValue: round2(totalBuyingValue),
    totalSellingValue: round2(totalSellingValue),
    grossPnL: round2(grossPnL),
    totalCharges: round2(totalCharges),
    netPnL: round2(netPnL),
    returnPct: round2(returnPct),
    breakEvenSellingPrice: round2(breakEvenSellingPrice),
  };
}

// ============================================================================
// CORE CALCULATOR 2: AVERAGE STOCK PRICE
// ============================================================================
export interface PurchaseLot {
  price: number;
  quantity: number;
}

export interface AveragePriceResult {
  totalQuantity: number;
  totalInvestment: number;
  averagePrice: number;
  currentMarketValue: number | null;
  unrealizedPnL: number | null;
  unrealizedPnLPct: number | null;
}

export function calcAveragePrice(
  lots: PurchaseLot[],
  currentPrice?: number | null
): AveragePriceResult {
  let totalQty = d(0);
  let totalInv = d(0);
  for (const lot of lots) {
    const q = d(Math.max(0, lot.quantity));
    const p = d(Math.max(0, lot.price));
    totalQty = totalQty.add(q);
    totalInv = totalInv.add(q.mul(p));
  }
  const avgPrice = totalQty.gt(0) ? totalInv.div(totalQty) : d(0);
  const hasCurrent =
    currentPrice !== null &&
    currentPrice !== undefined &&
    Number.isFinite(currentPrice) &&
    currentPrice > 0;
  const cmv = hasCurrent ? d(currentPrice!).mul(totalQty) : null;
  const pnl = cmv ? cmv.sub(totalInv) : null;
  const pnlPct =
    pnl && totalInv.gt(0) ? pnl.div(totalInv).mul(100) : cmv ? d(0) : null;

  return {
    totalQuantity: round4(totalQty),
    totalInvestment: round2(totalInv),
    averagePrice: round2(avgPrice),
    currentMarketValue: cmv ? round2(cmv) : null,
    unrealizedPnL: pnl ? round2(pnl) : null,
    unrealizedPnLPct: pnlPct ? round2(pnlPct) : null,
  };
}

// ============================================================================
// CORE CALCULATOR 3: INDIAN BROKERAGE & STATUTORY CHARGES
// ============================================================================
export interface BrokerageInput {
  segment: TradeSegment;
  exchange: Exchange;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  brokerageMode: 'flat' | 'percent' | 'hybrid'; // hybrid = min(flatCap, pct * turnover)
  brokerageFlatPerOrder: number; // e.g., ₹20 per executed order (Zerodha/Angel/Groww style)
  brokeragePct: number; // e.g., 0.03% or 0.1%
  dpChargesOnSell?: number; // e.g., ₹15.93 inclusive or ₹13.5 + GST for equity delivery sell
  effectiveDate?: '2024-10-01' | '2023-04-01';
  customRates?: {
    sttBuyPct?: number;
    sttSellPct?: number;
    exchangeTxnPct?: number;
    sebiTurnoverPct?: number;
    stampDutyBuyPct?: number;
    gstPct?: number;
  };
}

export interface BrokerageResult {
  buyTurnover: number;
  sellTurnover: number;
  totalTurnover: number;
  grossPnL: number;
  // Broker-specific charges
  buyBrokerage: number;
  sellBrokerage: number;
  totalBrokerage: number;
  dpCharges: number;
  totalBrokerCharges: number;
  // Statutory charges
  sttBuy: number;
  sttSell: number;
  totalStt: number;
  exchangeTxnBuy: number;
  exchangeTxnSell: number;
  totalExchangeTxn: number;
  sebiCharges: number;
  ipftCharges: number;
  stampDuty: number;
  gst: number;
  totalStatutoryCharges: number;
  // Totals
  totalBuySideCharges: number;
  totalSellSideCharges: number;
  totalCharges: number;
  netPnL: number;
  netReturnPct: number;
  breakEvenPrice: number;
  pointsToBreakeven: number;
  effectiveScheduleLabel: string;
}

export function calcBrokerage(input: BrokerageInput): BrokerageResult {
  const schedule = INDIA_CHARGE_SCHEDULES[input.effectiveDate || '2024-10-01'];
  const buy = d(Math.max(0, input.buyPrice));
  const sell = d(Math.max(0, input.sellPrice));
  const qty = d(Math.max(0, input.quantity));

  const buyTurnover = buy.mul(qty);
  const sellTurnover = sell.mul(qty);
  const totalTurnover = buyTurnover.add(sellTurnover);
  const grossPnL = sellTurnover.sub(buyTurnover);

  const computeOrderBrokerage = (turnover: Decimal): Decimal => {
    if (turnover.lte(0)) return d(0);
    const flat = d(Math.max(0, input.brokerageFlatPerOrder));
    const pctAmt = turnover.mul(d(Math.max(0, input.brokeragePct)).div(100));
    if (input.brokerageMode === 'flat') return flat;
    if (input.brokerageMode === 'percent') return pctAmt;
    return Decimal.min(flat, pctAmt);
  };

  const buyBrokerage = computeOrderBrokerage(buyTurnover);
  const sellBrokerage = computeOrderBrokerage(sellTurnover);
  const totalBrokerage = buyBrokerage.add(sellBrokerage);

  const dpCharges =
    input.segment === 'delivery' && sellTurnover.gt(0)
      ? d(Math.max(0, input.dpChargesOnSell ?? 15.93))
      : d(0);

  const sttBuyRate = d(
    input.customRates?.sttBuyPct ?? schedule.sttBuyPct[input.segment]
  ).div(100);
  const sttSellRate = d(
    input.customRates?.sttSellPct ?? schedule.sttSellPct[input.segment]
  ).div(100);
  const exchRate = d(
    input.customRates?.exchangeTxnPct ??
      schedule.exchangeTxnPct[input.exchange][input.segment]
  ).div(100);
  const sebiRate = d(
    input.customRates?.sebiTurnoverPct ?? schedule.sebiTurnoverPct
  ).div(100);
  const stampRate = d(
    input.customRates?.stampDutyBuyPct ??
      schedule.stampDutyBuyPct[input.segment]
  ).div(100);
  const gstRate = d(input.customRates?.gstPct ?? schedule.gstPct).div(100);
  const ipftRate =
    input.segment === 'options'
      ? d(0)
      : d(schedule.ipftPct[input.exchange]).div(100);

  // STT in India is rounded to nearest integer rupee
  const sttBuy = buyTurnover.mul(sttBuyRate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const sttSell = sellTurnover.mul(sttSellRate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const totalStt = sttBuy.add(sttSell);

  const exchangeTxnBuy = buyTurnover.mul(exchRate);
  const exchangeTxnSell = sellTurnover.mul(exchRate);
  const totalExchangeTxn = exchangeTxnBuy.add(exchangeTxnSell);

  const sebiBuy = buyTurnover.mul(sebiRate);
  const sebiSell = sellTurnover.mul(sebiRate);
  const sebiCharges = sebiBuy.add(sebiSell);

  const ipftBuy = buyTurnover.mul(ipftRate);
  const ipftSell = sellTurnover.mul(ipftRate);
  const ipftCharges = ipftBuy.add(ipftSell);

  // Stamp duty applies on buy side only, rounded to nearest rupee
  const stampDuty = buyTurnover
    .mul(stampRate)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  // GST 18% applies on (Brokerage + Exchange Txn + SEBI + IPFT)
  const gstBuy = buyBrokerage.add(exchangeTxnBuy).add(sebiBuy).add(ipftBuy).mul(gstRate);
  const gstSell = sellBrokerage.add(exchangeTxnSell).add(sebiSell).add(ipftSell).mul(gstRate);
  const gst = gstBuy.add(gstSell);

  const totalBuySideCharges = buyBrokerage
    .add(sttBuy)
    .add(exchangeTxnBuy)
    .add(sebiBuy)
    .add(ipftBuy)
    .add(stampDuty)
    .add(gstBuy);

  const totalSellSideCharges = sellBrokerage
    .add(dpCharges)
    .add(sttSell)
    .add(exchangeTxnSell)
    .add(sebiSell)
    .add(ipftSell)
    .add(gstSell);

  const totalBrokerCharges = totalBrokerage.add(dpCharges);
  const totalStatutoryCharges = totalStt
    .add(totalExchangeTxn)
    .add(sebiCharges)
    .add(ipftCharges)
    .add(stampDuty)
    .add(gst);
  const totalCharges = totalBrokerCharges.add(totalStatutoryCharges);
  const netPnL = grossPnL.sub(totalCharges);
  const netReturnPct = buyTurnover.gt(0)
    ? netPnL.div(buyTurnover).mul(100)
    : d(0);
  const pointsToBreakeven = qty.gt(0) ? totalCharges.div(qty) : d(0);
  const breakEvenPrice = buy.add(pointsToBreakeven);

  return {
    buyTurnover: round2(buyTurnover),
    sellTurnover: round2(sellTurnover),
    totalTurnover: round2(totalTurnover),
    grossPnL: round2(grossPnL),
    buyBrokerage: round2(buyBrokerage),
    sellBrokerage: round2(sellBrokerage),
    totalBrokerage: round2(totalBrokerage),
    dpCharges: round2(dpCharges),
    totalBrokerCharges: round2(totalBrokerCharges),
    sttBuy: round2(sttBuy),
    sttSell: round2(sttSell),
    totalStt: round2(totalStt),
    exchangeTxnBuy: round2(exchangeTxnBuy),
    exchangeTxnSell: round2(exchangeTxnSell),
    totalExchangeTxn: round2(totalExchangeTxn),
    sebiCharges: round2(sebiCharges),
    ipftCharges: round2(ipftCharges),
    stampDuty: round2(stampDuty),
    gst: round2(gst),
    totalStatutoryCharges: round2(totalStatutoryCharges),
    totalBuySideCharges: round2(totalBuySideCharges),
    totalSellSideCharges: round2(totalSellSideCharges),
    totalCharges: round2(totalCharges),
    netPnL: round2(netPnL),
    netReturnPct: round2(netReturnPct),
    breakEvenPrice: round2(breakEvenPrice),
    pointsToBreakeven: round2(pointsToBreakeven),
    effectiveScheduleLabel: schedule.effectiveLabel,
  };
}

// ============================================================================
// CORE CALCULATOR 4: STOCK TARGET PRICE & RISK-TO-REWARD
// ============================================================================
export interface TargetPriceInput {
  buyPrice: number;
  quantity: number;
  targetPrice: number;
  stopLossPrice: number;
  estimatedCharges?: number;
}

export interface TargetPriceResult {
  investedAmount: number;
  expectedProfitAtTarget: number;
  expectedLossAtStopLoss: number;
  targetReturnPct: number;
  stopLossRiskPct: number;
  riskToRewardRatio: number;
  riskRewardLabel: string;
  breakEvenPrice: number;
}

export function calcTargetPrice(input: TargetPriceInput): TargetPriceResult {
  const buy = d(Math.max(0, input.buyPrice));
  const qty = d(Math.max(0, input.quantity));
  const target = d(Math.max(0, input.targetPrice));
  const sl = d(Math.max(0, input.stopLossPrice));
  const charges = d(Math.max(0, input.estimatedCharges ?? 0));

  const invested = buy.mul(qty);
  const expectedProfitAtTarget = target.sub(buy).mul(qty).sub(charges);
  const expectedLossAtStopLoss = buy.sub(sl).mul(qty).add(charges);
  const targetReturnPct = invested.gt(0)
    ? expectedProfitAtTarget.div(invested).mul(100)
    : d(0);
  const stopLossRiskPct = invested.gt(0)
    ? expectedLossAtStopLoss.div(invested).mul(100)
    : d(0);

  const rewardPerShare = Decimal.max(0, target.sub(buy));
  const riskPerShare = Decimal.max(0, buy.sub(sl));
  const ratio = riskPerShare.gt(0) ? rewardPerShare.div(riskPerShare) : d(0);

  const breakEvenPrice = qty.gt(0) ? buy.add(charges.div(qty)) : buy;

  return {
    investedAmount: round2(invested),
    expectedProfitAtTarget: round2(expectedProfitAtTarget),
    expectedLossAtStopLoss: round2(expectedLossAtStopLoss),
    targetReturnPct: round2(targetReturnPct),
    stopLossRiskPct: round2(stopLossRiskPct),
    riskToRewardRatio: round2(ratio),
    riskRewardLabel: riskPerShare.gt(0) ? `1 : ${round2(ratio).toFixed(2)}` : 'N/A',
    breakEvenPrice: round2(breakEvenPrice),
  };
}

// ============================================================================
// CORE CALCULATOR 5: STOCK SIP
// ============================================================================
export type SipFrequency = 'monthly' | 'quarterly' | 'yearly';

export interface SipInput {
  amount: number;
  years: number;
  annualReturnPct: number;
  frequency: SipFrequency;
}

export interface SipSchedulePoint {
  year: number;
  invested: number;
  estimatedValue: number;
  estimatedGain: number;
}

export interface SipResult {
  totalInvested: number;
  estimatedReturns: number;
  totalFutureValue: number;
  wealthGainPct: number;
  schedule: SipSchedulePoint[];
}

export function calcSip(input: SipInput): SipResult {
  const pmt = d(Math.max(0, input.amount));
  const years = Math.max(1, Math.min(50, Math.round(input.years)));
  const annualRate = d(Math.max(0, input.annualReturnPct)).div(100);
  const periodsPerYear =
    input.frequency === 'monthly' ? 12 : input.frequency === 'quarterly' ? 4 : 1;

  const periodicRate = annualRate.div(periodsPerYear);
  const schedule: SipSchedulePoint[] = [];

  const futureValueForYears = (yr: number): { inv: Decimal; fv: Decimal } => {
    const n = yr * periodsPerYear;
    const inv = pmt.mul(n);
    if (periodicRate.eq(0)) return { inv, fv: inv };
    const onePlusR = d(1).add(periodicRate);
    const factor = onePlusR.pow(n).sub(1).div(periodicRate).mul(onePlusR);
    return { inv, fv: pmt.mul(factor) };
  };

  for (let y = 1; y <= years; y++) {
    const { inv, fv } = futureValueForYears(y);
    schedule.push({
      year: y,
      invested: round2(inv),
      estimatedValue: round2(fv),
      estimatedGain: round2(fv.sub(inv)),
    });
  }

  const final = futureValueForYears(years);
  const estReturns = final.fv.sub(final.inv);
  const wealthGainPct = final.inv.gt(0) ? estReturns.div(final.inv).mul(100) : d(0);

  return {
    totalInvested: round2(final.inv),
    estimatedReturns: round2(estReturns),
    totalFutureValue: round2(final.fv),
    wealthGainPct: round2(wealthGainPct),
    schedule,
  };
}

// ============================================================================
// CORE CALCULATOR 6: CAGR
// ============================================================================
export interface CagrInput {
  initialValue: number;
  finalValue: number;
  years: number;
}

export interface CagrResult {
  cagrPct: number;
  totalProfit: number;
  overallReturnPct: number;
}

export function calcCagr(input: CagrInput): CagrResult {
  const init = d(Math.max(0, input.initialValue));
  const fin = d(Math.max(0, input.finalValue));
  const yrs = Math.max(0.01, input.years);

  const totalProfit = fin.sub(init);
  const overallReturnPct = init.gt(0) ? totalProfit.div(init).mul(100) : d(0);

  let cagrPct = d(0);
  if (init.gt(0) && fin.gt(0)) {
    const ratio = fin.div(init).toNumber();
    cagrPct = d((Math.pow(ratio, 1 / yrs) - 1) * 100);
  }

  return {
    cagrPct: round2(cagrPct),
    totalProfit: round2(totalProfit),
    overallReturnPct: round2(overallReturnPct),
  };
}

// ============================================================================
// CORE CALCULATOR 7: STOCK RETURN (WITH DIVIDENDS)
// ============================================================================
export interface StockReturnInput {
  initialInvestment: number;
  currentPrice: number;
  quantity: number;
  dividendsReceived: number;
  years: number;
}

export interface StockReturnResult {
  currentValue: number;
  capitalGain: number;
  dividendIncome: number;
  totalReturn: number;
  totalReturnPct: number;
  annualizedReturnPct: number;
}

export function calcStockReturn(input: StockReturnInput): StockReturnResult {
  const init = d(Math.max(0, input.initialInvestment));
  const currPrice = d(Math.max(0, input.currentPrice));
  const qty = d(Math.max(0, input.quantity));
  const divs = d(Math.max(0, input.dividendsReceived));
  const yrs = Math.max(0.01, input.years);

  const currentValue = currPrice.mul(qty);
  const capitalGain = currentValue.sub(init);
  const totalReturn = capitalGain.add(divs);
  const totalReturnPct = init.gt(0) ? totalReturn.div(init).mul(100) : d(0);

  const endWealth = currentValue.add(divs);
  let annualized = d(0);
  if (init.gt(0) && endWealth.gt(0)) {
    const ratio = endWealth.div(init).toNumber();
    annualized = d((Math.pow(ratio, 1 / yrs) - 1) * 100);
  }

  return {
    currentValue: round2(currentValue),
    capitalGain: round2(capitalGain),
    dividendIncome: round2(divs),
    totalReturn: round2(totalReturn),
    totalReturnPct: round2(totalReturnPct),
    annualizedReturnPct: round2(annualized),
  };
}

// ============================================================================
// CORE CALCULATOR 8: BREAK-EVEN PRICE
// ============================================================================
export interface BreakEvenInput {
  buyPrice: number;
  quantity: number;
  brokeragePerOrder: number;
  taxesAndFeesAmount: number;
}

export interface BreakEvenResult {
  totalInvestment: number;
  totalTransactionCosts: number;
  breakEvenSellingPrice: number;
  minimumProfitableSellingPrice: number;
  requiredGainPct: number;
}

export function calcBreakEven(input: BreakEvenInput): BreakEvenResult {
  const buy = d(Math.max(0, input.buyPrice));
  const qty = d(Math.max(0, input.quantity));
  const brokerage = d(Math.max(0, input.brokeragePerOrder)).mul(2); // buy + sell order
  const taxes = d(Math.max(0, input.taxesAndFeesAmount));

  const totalInvestment = buy.mul(qty);
  const totalTransactionCosts = brokerage.add(taxes);
  const breakEvenSellingPrice = qty.gt(0)
    ? totalInvestment.add(totalTransactionCosts).div(qty)
    : d(0);
  // NSE/BSE standard equity tick size is ₹0.05
  const tickCeil =
    Math.ceil((breakEvenSellingPrice.toNumber() + 0.0001) * 20) / 20;
  const requiredGainPct = buy.gt(0)
    ? breakEvenSellingPrice.sub(buy).div(buy).mul(100)
    : d(0);

  return {
    totalInvestment: round2(totalInvestment),
    totalTransactionCosts: round2(totalTransactionCosts),
    breakEvenSellingPrice: round2(breakEvenSellingPrice),
    minimumProfitableSellingPrice: round2(tickCeil),
    requiredGainPct: round2(requiredGainPct),
  };
}

// ============================================================================
// ADVANCED CALCULATORS (18)
// ============================================================================

// 1. Dividend Yield
export function calcDividendYield(annualDividendPerShare: number, sharePrice: number) {
  const div = d(Math.max(0, annualDividendPerShare));
  const price = d(Math.max(0, sharePrice));
  const yieldPct = price.gt(0) ? div.div(price).mul(100) : d(0);
  return { dividendYieldPct: round2(yieldPct) };
}

// 2. Dividend Income
export function calcDividendIncome(
  sharesOwned: number,
  annualDividendPerShare: number,
  taxRatePct = 10 // Indian TDS > ₹5,000 or slab
) {
  const qty = d(Math.max(0, sharesOwned));
  const div = d(Math.max(0, annualDividendPerShare));
  const grossAnnual = qty.mul(div);
  const tax = grossAnnual.mul(d(Math.max(0, taxRatePct)).div(100));
  const netAnnual = grossAnnual.sub(tax);
  return {
    grossAnnualDividend: round2(grossAnnual),
    estimatedTax: round2(tax),
    netAnnualDividend: round2(netAnnual),
    monthlyAverageIncome: round2(netAnnual.div(12)),
  };
}

// 3. Stock Valuation (Graham Number + Earnings Multiple)
export function calcStockValuation(
  eps: number,
  bvps: number,
  currentPrice: number,
  fairPeMultiple: number
) {
  const e = d(eps);
  const b = d(bvps);
  const p = d(Math.max(0, currentPrice));
  const pe = d(Math.max(0, fairPeMultiple));

  const grahamNumber =
    e.gt(0) && b.gt(0) ? d(Math.sqrt(d(22.5).mul(e).mul(b).toNumber())) : d(0);
  const peFairValue = e.gt(0) ? e.mul(pe) : d(0);
  const blendedFairValue =
    grahamNumber.gt(0) && peFairValue.gt(0)
      ? grahamNumber.add(peFairValue).div(2)
      : Decimal.max(grahamNumber, peFairValue);
  const marginOfSafetyPct = blendedFairValue.gt(0)
    ? blendedFairValue.sub(p).div(blendedFairValue).mul(100)
    : d(0);

  return {
    grahamNumber: round2(grahamNumber),
    peFairValue: round2(peFairValue),
    blendedFairValue: round2(blendedFairValue),
    marginOfSafetyPct: round2(marginOfSafetyPct),
    valuationStatus:
      p.lte(0) || blendedFairValue.lte(0)
        ? 'Insufficient Data'
        : p.lt(blendedFairValue)
          ? 'Undervalued vs Intrinsic Estimate'
          : 'Overvalued vs Intrinsic Estimate',
  };
}

// 4. P/E Ratio
export function calcPeRatio(marketPrice: number, eps: number, sectorAvgPe = 22) {
  const price = d(Math.max(0, marketPrice));
  const e = d(eps);
  const peRatio = e.gt(0) ? price.div(e) : d(0);
  const earningsYieldPct = price.gt(0) && e.gt(0) ? e.div(price).mul(100) : d(0);
  const premiumDiscountPct =
    sectorAvgPe > 0 && peRatio.gt(0)
      ? peRatio.sub(sectorAvgPe).div(sectorAvgPe).mul(100)
      : d(0);

  return {
    peRatio: round2(peRatio),
    earningsYieldPct: round2(earningsYieldPct),
    premiumVsSectorPct: round2(premiumDiscountPct),
  };
}

// 5. EPS Calculator
export function calcEps(
  netIncome: number,
  preferredDividends: number,
  weightedShares: number
) {
  const ni = d(netIncome);
  const pref = d(Math.max(0, preferredDividends));
  const shares = d(Math.max(0, weightedShares));
  const earningsForCommon = ni.sub(pref);
  const eps = shares.gt(0) ? earningsForCommon.div(shares) : d(0);
  return {
    earningsAvailableToCommon: round2(earningsForCommon),
    eps: round2(eps),
  };
}

// 6. ROI Calculator
export function calcRoi(amountInvested: number, amountReturned: number, years = 1) {
  const inv = d(Math.max(0, amountInvested));
  const ret = d(Math.max(0, amountReturned));
  const netProfit = ret.sub(inv);
  const roiPct = inv.gt(0) ? netProfit.div(inv).mul(100) : d(0);
  const yrs = Math.max(0.01, years);
  const annualizedRoiPct =
    inv.gt(0) && ret.gt(0)
      ? d((Math.pow(ret.div(inv).toNumber(), 1 / yrs) - 1) * 100)
      : d(0);
  return {
    netProfit: round2(netProfit),
    roiPct: round2(roiPct),
    annualizedRoiPct: round2(annualizedRoiPct),
  };
}

// 7. Risk-to-Reward Calculator
export function calcRiskReward(entryPrice: number, stopLoss: number, targetPrice: number) {
  const entry = d(Math.max(0, entryPrice));
  const sl = d(Math.max(0, stopLoss));
  const target = d(Math.max(0, targetPrice));
  const risk = entry.sub(sl).abs();
  const reward = target.sub(entry).abs();
  const ratio = risk.gt(0) ? reward.div(risk) : d(0);
  const minWinRatePct = ratio.gt(0) ? d(1).div(d(1).add(ratio)).mul(100) : d(0);

  return {
    riskPerShare: round2(risk),
    rewardPerShare: round2(reward),
    riskRewardRatio: round2(ratio),
    riskRewardText: risk.gt(0) ? `1 : ${round2(ratio).toFixed(2)}` : 'N/A',
    breakevenWinRatePct: round2(minWinRatePct),
  };
}

// 8. Position Sizing Calculator
export function calcPositionSizing(
  accountCapital: number,
  riskPerTradePct: number,
  entryPrice: number,
  stopLossPrice: number
) {
  const cap = d(Math.max(0, accountCapital));
  const riskPct = d(Math.max(0, riskPerTradePct)).div(100);
  const entry = d(Math.max(0, entryPrice));
  const sl = d(Math.max(0, stopLossPrice));

  const maxRiskAmount = cap.mul(riskPct);
  const riskPerShare = entry.sub(sl).abs();
  const maxShares =
    riskPerShare.gt(0) ? Math.floor(maxRiskAmount.div(riskPerShare).toNumber()) : 0;
  const positionValue = entry.mul(maxShares);
  const capitalUtilizationPct = cap.gt(0) ? positionValue.div(cap).mul(100) : d(0);

  return {
    maxRiskAmount: round2(maxRiskAmount),
    riskPerShare: round2(riskPerShare),
    recommendedShares: maxShares,
    positionCapitalRequired: round2(positionValue),
    capitalUtilizationPct: round2(capitalUtilizationPct),
  };
}

// 9. Stop-Loss Calculator
export function calcStopLoss(
  entryPrice: number,
  quantity: number,
  stopLossPct: number,
  direction: 'long' | 'short' = 'long'
) {
  const entry = d(Math.max(0, entryPrice));
  const qty = d(Math.max(0, quantity));
  const pct = d(Math.max(0, stopLossPct)).div(100);

  const stopLossPrice =
    direction === 'long'
      ? entry.mul(d(1).sub(pct))
      : entry.mul(d(1).add(pct));
  const lossPerShare = entry.sub(stopLossPrice).abs();
  const maxCapitalLoss = lossPerShare.mul(qty);

  return {
    stopLossPrice: round2(Decimal.max(0, stopLossPrice)),
    lossPerShare: round2(lossPerShare),
    maxCapitalLoss: round2(maxCapitalLoss),
  };
}

// 10. Portfolio Allocation Calculator
export interface AllocationAssetInput {
  name: string;
  currentValue: number;
}

export function calcPortfolioAllocation(assets: AllocationAssetInput[]) {
  const total = assets.reduce((acc, a) => acc.add(Math.max(0, a.currentValue)), d(0));
  const items = assets.map((a) => {
    const val = d(Math.max(0, a.currentValue));
    const weightPct = total.gt(0) ? round2(val.div(total).mul(100)) : 0;
    return { name: a.name, value: round2(val), weightPct };
  });
  return { totalValue: round2(total), items };
}

// 11. Portfolio Rebalancing Calculator
export interface RebalanceAssetInput {
  name: string;
  currentValue: number;
  targetWeightPct: number;
}

export function calcPortfolioRebalancing(
  assets: RebalanceAssetInput[],
  additionalCash = 0
) {
  const currentTotal = assets.reduce(
    (acc, a) => acc.add(Math.max(0, a.currentValue)),
    d(0)
  );
  const newTotal = currentTotal.add(Math.max(0, additionalCash));
  const totalTargetWeight = assets.reduce((acc, a) => acc + Math.max(0, a.targetWeightPct), 0);

  const actions = assets.map((a) => {
    const curVal = d(Math.max(0, a.currentValue));
    const curPct = currentTotal.gt(0) ? curVal.div(currentTotal).mul(100) : d(0);
    const normTargetPct =
      totalTargetWeight > 0 ? (Math.max(0, a.targetWeightPct) / totalTargetWeight) * 100 : 0;
    const targetVal = newTotal.mul(normTargetPct / 100);
    const delta = targetVal.sub(curVal);
    return {
      name: a.name,
      currentValue: round2(curVal),
      currentWeightPct: round2(curPct),
      targetWeightPct: round2(normTargetPct),
      targetValue: round2(targetVal),
      actionAmount: round2(delta),
      action: delta.gt(1) ? 'BUY' : delta.lt(-1) ? 'SELL' : 'HOLD',
    };
  });

  return {
    currentTotal: round2(currentTotal),
    newTotal: round2(newTotal),
    totalTargetWeightPct: round2(totalTargetWeight),
    actions,
  };
}

// 12. Stock Split Calculator (e.g. 1 share split into N shares, or ratio newFor:oldHeld)
export function calcStockSplit(
  currentShares: number,
  currentAvgPrice: number,
  newSharesPerOld: number,
  oldSharesUnit = 1
) {
  const shares = d(Math.max(0, currentShares));
  const avg = d(Math.max(0, currentAvgPrice));
  const ratio =
    oldSharesUnit > 0 ? d(Math.max(0.01, newSharesPerOld)).div(oldSharesUnit) : d(1);

  const postSplitShares = shares.mul(ratio);
  const postSplitPrice = ratio.gt(0) ? avg.div(ratio) : avg;
  const totalValue = shares.mul(avg);

  return {
    splitFactor: round4(ratio),
    postSplitShares: round4(postSplitShares),
    adjustedAvgPrice: round2(postSplitPrice),
    totalValuePreserved: round2(totalValue),
  };
}

// 13. Bonus Share Calculator (e.g. bonusSharesIssued for every heldUnitShares, e.g., 1:1 or 1:2)
export function calcBonusShare(
  heldShares: number,
  avgBuyPrice: number,
  bonusIssued: number,
  forEveryHeld: number
) {
  const held = d(Math.max(0, heldShares));
  const avg = d(Math.max(0, avgBuyPrice));
  const ratio = forEveryHeld > 0 ? d(Math.max(0, bonusIssued)).div(forEveryHeld) : d(0);

  const bonusSharesReceived = Math.floor(held.mul(ratio).toNumber());
  const totalSharesAfterBonus = held.add(bonusSharesReceived);
  const totalCost = held.mul(avg);
  const adjustedAvgPrice = totalSharesAfterBonus.gt(0)
    ? totalCost.div(totalSharesAfterBonus)
    : d(0);

  return {
    bonusSharesReceived,
    totalSharesAfterBonus: round4(totalSharesAfterBonus),
    adjustedAvgPrice: round2(adjustedAvgPrice),
    totalCostBasis: round2(totalCost),
  };
}

// 14. Rights Issue Calculator
export function calcRightsIssue(
  heldShares: number,
  currentMarketPrice: number,
  entitlementNew: number,
  entitlementForEvery: number,
  rightsIssuePrice: number
) {
  const held = d(Math.max(0, heldShares));
  const cmp = d(Math.max(0, currentMarketPrice));
  const newUnits =
    entitlementForEvery > 0
      ? Math.floor(held.mul(Math.max(0, entitlementNew)).div(entitlementForEvery).toNumber())
      : 0;
  const issuePrice = d(Math.max(0, rightsIssuePrice));

  const additionalOutlay = issuePrice.mul(newUnits);
  const totalSharesAfter = held.add(newUnits);
  const preRightsVal = held.mul(cmp);
  const terp = totalSharesAfter.gt(0)
    ? preRightsVal.add(additionalOutlay).div(totalSharesAfter)
    : cmp;
  const discountToCmpPct = cmp.gt(0) ? cmp.sub(issuePrice).div(cmp).mul(100) : d(0);

  return {
    eligibleRightsShares: newUnits,
    additionalCapitalRequired: round2(additionalOutlay),
    totalSharesAfterRights: round4(totalSharesAfter),
    theoreticalExRightsPrice: round2(terp),
    issueDiscountPct: round2(discountToCmpPct),
  };
}

// 15. Mutual Fund Return Calculator (supports Lumpsum or Monthly SIP with Expense Ratio)
export function calcMutualFundReturn(
  mode: 'sip' | 'lumpsum',
  amount: number,
  years: number,
  grossAnnualReturnPct: number,
  expenseRatioPct: number
) {
  const netReturnPct = Math.max(-99, grossAnnualReturnPct - Math.max(0, expenseRatioPct));
  if (mode === 'sip') {
    const gross = calcSip({ amount, years, annualReturnPct: grossAnnualReturnPct, frequency: 'monthly' });
    const net = calcSip({ amount, years, annualReturnPct: netReturnPct, frequency: 'monthly' });
    return {
      totalInvested: net.totalInvested,
      grossEstimatedValue: gross.totalFutureValue,
      netEstimatedValue: net.totalFutureValue,
      netEstimatedGain: net.estimatedReturns,
      expenseDrag: round2(gross.totalFutureValue - net.totalFutureValue),
      netAnnualReturnPct: round2(netReturnPct),
    };
  } else {
    const gross = calcLumpsum(amount, years, grossAnnualReturnPct);
    const net = calcLumpsum(amount, years, netReturnPct);
    return {
      totalInvested: net.totalInvested,
      grossEstimatedValue: gross.futureValue,
      netEstimatedValue: net.futureValue,
      netEstimatedGain: net.estimatedReturns,
      expenseDrag: round2(gross.futureValue - net.futureValue),
      netAnnualReturnPct: round2(netReturnPct),
    };
  }
}

// 16. Lumpsum Investment Calculator
export function calcLumpsum(principal: number, years: number, annualReturnPct: number) {
  const p = d(Math.max(0, principal));
  const yrs = Math.max(0, years);
  const r = d(annualReturnPct).div(100);
  const fv = p.mul(d(1).add(r).pow(yrs));
  const estReturns = fv.sub(p);
  const absoluteGainPct = p.gt(0) ? estReturns.div(p).mul(100) : d(0);
  return {
    totalInvested: round2(p),
    estimatedReturns: round2(estReturns),
    futureValue: round2(fv),
    absoluteGainPct: round2(absoluteGainPct),
  };
}

// 17. Inflation-Adjusted Return Calculator
export function calcInflationAdjusted(
  principal: number,
  nominalReturnPct: number,
  inflationRatePct: number,
  years: number
) {
  const p = d(Math.max(0, principal));
  const nom = d(nominalReturnPct).div(100);
  const inf = d(inflationRatePct).div(100);
  const yrs = Math.max(0, years);

  const realRate = d(1).add(inf).gt(0)
    ? d(1).add(nom).div(d(1).add(inf)).sub(1)
    : nom;

  const nominalFutureValue = p.mul(d(1).add(nom).pow(yrs));
  const realPurchasingPower = p.mul(d(1).add(realRate).pow(yrs));

  return {
    nominalFutureValue: round2(nominalFutureValue),
    realPurchasingPower: round2(realPurchasingPower),
    inflationErosion: round2(nominalFutureValue.sub(realPurchasingPower)),
    realAnnualReturnPct: round2(realRate.mul(100)),
  };
}

// 18. XIRR Calculator for dated cash flows (negative = outflow/investment, positive = inflow/redemption)
export interface CashFlowEntry {
  date: string; // YYYY-MM-DD
  amount: number;
}

export function calcXirr(cashFlows: CashFlowEntry[]): {
  xirrPct: number | null;
  totalInvested: number;
  totalReturned: number;
  netGain: number;
  converged: boolean;
} {
  const valid = cashFlows
    .filter((cf) => cf.date && Number.isFinite(cf.amount) && cf.amount !== 0)
    .map((cf) => ({
      time: new Date(cf.date).getTime(),
      amount: cf.amount,
    }))
    .filter((cf) => Number.isFinite(cf.time))
    .sort((a, b) => a.time - b.time);

  let totalInvested = 0;
  let totalReturned = 0;
  for (const cf of valid) {
    if (cf.amount < 0) totalInvested += Math.abs(cf.amount);
    else totalReturned += cf.amount;
  }

  if (valid.length < 2 || totalInvested === 0 || totalReturned === 0) {
    return {
      xirrPct: null,
      totalInvested: round2(totalInvested),
      totalReturned: round2(totalReturned),
      netGain: round2(totalReturned - totalInvested),
      converged: false,
    };
  }

  const t0 = valid[0].time;
  const msPerYear = 365 * 24 * 60 * 60 * 1000;
  const yearsArr = valid.map((cf) => (cf.time - t0) / msPerYear);

  const npv = (rate: number): number => {
    let sum = 0;
    for (let i = 0; i < valid.length; i++) {
      sum += valid[i].amount / Math.pow(1 + rate, yearsArr[i]);
    }
    return sum;
  };

  const dNpv = (rate: number): number => {
    let sum = 0;
    for (let i = 0; i < valid.length; i++) {
      if (yearsArr[i] === 0) continue;
      sum -= (yearsArr[i] * valid[i].amount) / Math.pow(1 + rate, yearsArr[i] + 1);
    }
    return sum;
  };

  // Newton-Raphson with bounded clamp, falling back to bisection
  let guess = 0.12;
  let converged = false;
  for (let iter = 0; iter < 100; iter++) {
    const f = npv(guess);
    const df = dNpv(guess);
    if (Math.abs(f) < 1e-6) {
      converged = true;
      break;
    }
    if (!Number.isFinite(df) || Math.abs(df) < 1e-10) break;
    const next = guess - f / df;
    if (!Number.isFinite(next) || next <= -0.999) break;
    if (Math.abs(next - guess) < 1e-7) {
      guess = next;
      converged = true;
      break;
    }
    guess = next;
  }

  if (!converged) {
    // Bisection fallback in [-0.95, 10.0]
    let low = -0.95;
    let high = 10.0;
    let fLow = npv(low);
    const fHigh = npv(high);
    if (fLow * fHigh <= 0) {
      for (let i = 0; i < 120; i++) {
        const mid = (low + high) / 2;
        const fMid = npv(mid);
        if (Math.abs(fMid) < 1e-6 || high - low < 1e-7) {
          guess = mid;
          converged = true;
          break;
        }
        if (fLow * fMid <= 0) {
          high = mid;
        } else {
          low = mid;
          fLow = fMid;
        }
      }
    }
  }

  return {
    xirrPct: converged ? round2(guess * 100) : null,
    totalInvested: round2(totalInvested),
    totalReturned: round2(totalReturned),
    netGain: round2(totalReturned - totalInvested),
    converged,
  };
}

// ============================================================================
// TECHNICAL INDICATORS FOR INTERACTIVE CHARTS
// ============================================================================
export function enrichCandlesWithIndicators(candles: CandlePoint[]): CandlePoint[] {
  if (candles.length === 0) return [];
  const closes = candles.map((c) => c.close);

  // SMA 20 & Bollinger Bands (20, 2)
  const sma20: Array<number | null> = closes.map((_, idx) => {
    if (idx < 19) return null;
    const slice = closes.slice(idx - 19, idx + 1);
    return round2(slice.reduce((a, b) => a + b, 0) / 20);
  });

  const bbUpper: Array<number | null> = [];
  const bbLower: Array<number | null> = [];
  closes.forEach((_, idx) => {
    const mean = sma20[idx];
    if (mean === null) {
      bbUpper.push(null);
      bbLower.push(null);
      return;
    }
    const slice = closes.slice(idx - 19, idx + 1);
    const variance =
      slice.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / 20;
    const sd = Math.sqrt(variance);
    bbUpper.push(round2(mean + 2 * sd));
    bbLower.push(round2(mean - 2 * sd));
  });

  // EMA helper
  const calcEmaSeries = (values: number[], period: number): Array<number | null> => {
    const k = 2 / (period + 1);
    const res: Array<number | null> = new Array(values.length).fill(null);
    if (values.length < period) return res;
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    res[period - 1] = round2(ema);
    for (let i = period; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
      res[i] = round2(ema);
    }
    return res;
  };

  const ema20 = calcEmaSeries(closes, 20);
  const ema12 = calcEmaSeries(closes, 12);
  const ema26 = calcEmaSeries(closes, 26);

  // MACD (12, 26, 9)
  const macdLine: Array<number | null> = closes.map((_, i) =>
    ema12[i] !== null && ema26[i] !== null ? round2(ema12[i]! - ema26[i]!) : null
  );
  const validMacdIndices: number[] = [];
  const validMacdValues: number[] = [];
  macdLine.forEach((v, i) => {
    if (v !== null) {
      validMacdIndices.push(i);
      validMacdValues.push(v);
    }
  });
  const macdSignalRaw = calcEmaSeries(validMacdValues, 9);
  const macdSignal: Array<number | null> = new Array(closes.length).fill(null);
  validMacdIndices.forEach((origIdx, j) => {
    macdSignal[origIdx] = macdSignalRaw[j];
  });

  // RSI 14
  const rsi14: Array<number | null> = new Array(closes.length).fill(null);
  if (closes.length > 14) {
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= 14; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    let avgGain = gains / 14;
    let avgLoss = losses / 14;
    rsi14[14] = avgLoss === 0 ? 100 : round2(100 - 100 / (1 + avgGain / avgLoss));
    for (let i = 15; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * 13 + gain) / 14;
      avgLoss = (avgLoss * 13 + loss) / 14;
      rsi14[i] = avgLoss === 0 ? 100 : round2(100 - 100 / (1 + avgGain / avgLoss));
    }
  }

  return candles.map((c, i) => ({
    ...c,
    sma20: sma20[i],
    ema20: ema20[i],
    rsi14: rsi14[i],
    macd: macdLine[i],
    macdSignal: macdSignal[i],
    macdHist:
      macdLine[i] !== null && macdSignal[i] !== null
        ? round2(macdLine[i]! - macdSignal[i]!)
        : null,
    bbUpper: bbUpper[i],
    bbMiddle: sma20[i],
    bbLower: bbLower[i],
  }));
}
