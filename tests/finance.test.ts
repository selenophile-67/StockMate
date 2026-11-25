import assert from 'node:assert/strict';
import {
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
  formatINR,
} from '../src/lib/finance';

function runTests() {
  // 1. Profit & Loss
  const pl = calcProfitLoss({
    buyPrice: 1000,
    sellPrice: 1200,
    quantity: 50,
    brokerageCharges: 40,
    otherCharges: 110,
  });
  assert.equal(pl.totalBuyingValue, 50000);
  assert.equal(pl.totalSellingValue, 60000);
  assert.equal(pl.grossPnL, 10000);
  assert.equal(pl.totalCharges, 150);
  assert.equal(pl.netPnL, 9850);
  assert.equal(pl.returnPct, 19.7);
  assert.equal(pl.breakEvenSellingPrice, 1003);

  // Zero denominator edge case
  const plZero = calcProfitLoss({
    buyPrice: 0,
    sellPrice: 0,
    quantity: 0,
    brokerageCharges: 0,
    otherCharges: 0,
  });
  assert.equal(plZero.returnPct, 0);
  assert.equal(plZero.breakEvenSellingPrice, 0);

  // 2. Average Price
  const avg = calcAveragePrice(
    [
      { price: 100, quantity: 10 },
      { price: 150, quantity: 10 },
    ],
    140
  );
  assert.equal(avg.totalQuantity, 20);
  assert.equal(avg.totalInvestment, 2500);
  assert.equal(avg.averagePrice, 125);
  assert.equal(avg.currentMarketValue, 2800);
  assert.equal(avg.unrealizedPnL, 300);
  assert.equal(avg.unrealizedPnLPct, 12);

  // 3. Indian Brokerage (Oct 2024+ Delivery)
  const brk = calcBrokerage({
    segment: 'delivery',
    exchange: 'NSE',
    buyPrice: 1000,
    sellPrice: 1100,
    quantity: 100,
    brokerageMode: 'flat',
    brokerageFlatPerOrder: 20,
    brokeragePct: 0,
    dpChargesOnSell: 15.93,
    effectiveDate: '2024-10-01',
  });
  assert.equal(brk.buyTurnover, 100000);
  assert.equal(brk.sellTurnover, 110000);
  assert.equal(brk.grossPnL, 10000);
  assert.equal(brk.sttBuy, 100); // 0.1% of 100,000
  assert.equal(brk.sttSell, 110); // 0.1% of 110,000
  assert.equal(brk.stampDuty, 15); // 0.015% of 100,000
  assert.ok(brk.totalCharges > 250 && brk.totalCharges < 350);
  assert.equal(brk.netPnL, Number((10000 - brk.totalCharges).toFixed(2)));

  // 4. Target Price
  const tp = calcTargetPrice({
    buyPrice: 500,
    quantity: 100,
    targetPrice: 650,
    stopLossPrice: 450,
    estimatedCharges: 100,
  });
  assert.equal(tp.investedAmount, 50000);
  assert.equal(tp.expectedProfitAtTarget, 14900);
  assert.equal(tp.expectedLossAtStopLoss, 5100);
  assert.equal(tp.riskToRewardRatio, 3);

  // 5. SIP
  const sip = calcSip({
    amount: 10000,
    years: 10,
    annualReturnPct: 12,
    frequency: 'monthly',
  });
  assert.equal(sip.totalInvested, 1200000);
  assert.ok(sip.totalFutureValue > 2300000 && sip.totalFutureValue < 2400000);
  assert.equal(sip.schedule.length, 10);

  // 6. CAGR
  const cagr = calcCagr({ initialValue: 100000, finalValue: 200000, years: 5 });
  assert.equal(cagr.totalProfit, 100000);
  assert.equal(cagr.overallReturnPct, 100);
  assert.equal(cagr.cagrPct, 14.87);

  // 7. Stock Return
  const sr = calcStockReturn({
    initialInvestment: 100000,
    currentPrice: 1200,
    quantity: 100,
    dividendsReceived: 5000,
    years: 2,
  });
  assert.equal(sr.capitalGain, 20000);
  assert.equal(sr.totalReturn, 25000);
  assert.equal(sr.totalReturnPct, 25);
  assert.equal(sr.annualizedReturnPct, 11.8);

  // 8. Break-even
  const be = calcBreakEven({
    buyPrice: 1000,
    quantity: 10,
    brokeragePerOrder: 20,
    taxesAndFeesAmount: 30,
  });
  assert.equal(be.totalInvestment, 10000);
  assert.equal(be.totalTransactionCosts, 70);
  assert.equal(be.breakEvenSellingPrice, 1007);
  assert.equal(be.minimumProfitableSellingPrice, 1007.05);

  // Advanced 1-18
  assert.equal(calcDividendYield(25, 1000).dividendYieldPct, 2.5);
  assert.equal(calcDividendIncome(200, 15, 10).netAnnualDividend, 2700);
  const val = calcStockValuation(50, 200, 300, 20);
  assert.ok(val.grahamNumber > 470 && val.grahamNumber < 480);
  assert.equal(calcPeRatio(1000, 40, 20).peRatio, 25);
  assert.equal(calcEps(5000000, 200000, 1000000).eps, 4.8);
  assert.equal(calcRoi(50000, 75000, 2).roiPct, 50);
  assert.equal(calcRiskReward(100, 90, 130).riskRewardRatio, 3);
  assert.equal(calcPositionSizing(100000, 2, 500, 480).recommendedShares, 100);
  assert.equal(calcStopLoss(1000, 50, 5, 'long').stopLossPrice, 950);
  assert.equal(
    calcPortfolioAllocation([
      { name: 'A', currentValue: 60000 },
      { name: 'B', currentValue: 40000 },
    ]).items[0].weightPct,
    60
  );
  const reb = calcPortfolioRebalancing(
    [
      { name: 'Equity', currentValue: 70000, targetWeightPct: 60 },
      { name: 'Debt', currentValue: 30000, targetWeightPct: 40 },
    ],
    0
  );
  assert.equal(reb.actions[0].action, 'SELL');
  assert.equal(reb.actions[0].actionAmount, -10000);
  assert.equal(calcStockSplit(100, 1500, 5, 1).postSplitShares, 500);
  assert.equal(calcStockSplit(100, 1500, 5, 1).adjustedAvgPrice, 300);
  assert.equal(calcBonusShare(100, 600, 1, 1).totalSharesAfterBonus, 200);
  assert.equal(calcBonusShare(100, 600, 1, 1).adjustedAvgPrice, 300);
  const rights = calcRightsIssue(100, 500, 1, 5, 400);
  assert.equal(rights.eligibleRightsShares, 20);
  assert.equal(rights.additionalCapitalRequired, 8000);
  assert.ok(calcMutualFundReturn('lumpsum', 100000, 5, 12, 1).netEstimatedValue < calcLumpsum(100000, 5, 12).futureValue);
  assert.equal(calcInflationAdjusted(100000, 12, 6, 1).realAnnualReturnPct, 5.66);

  // XIRR test: Invest ₹10,000 on 2024-01-01, receive ₹11,200 on 2025-01-01 (~11.97% given leap year 2024)
  const xirr = calcXirr([
    { date: '2024-01-01', amount: -10000 },
    { date: '2025-01-01', amount: 11200 },
  ]);
  assert.equal(xirr.converged, true);
  assert.ok(xirr.xirrPct !== null && xirr.xirrPct > 11.8 && xirr.xirrPct < 12.1);

  assert.equal(formatINR(123456.78), '₹1,23,456.78');

  console.log('ALL STOCKMATE FINANCIAL UNIT TESTS PASSED');
}

runTests();
