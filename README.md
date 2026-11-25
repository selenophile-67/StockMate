# StockMate — Smart Stock Calculator & Investment Analysis Platform

StockMate is a full-stack Indian equity (NSE/BSE) calculation, portfolio management, watchlist, and market analysis platform built with React, TypeScript, Tailwind CSS, Express, Decimal.js, and Recharts.

## Key Features

- **Main Dashboard**: Real-time/delayed NSE & BSE index cards (NIFTY 50, SENSEX, NIFTY BANK, NIFTY IT), IST market status (`Open` / `Closed`), portfolio KPI summary, sector diversification & P/L charts, watchlist snapshot, recent calculations, and Indian market headlines.
- **8 Core Calculators**:
  1. Stock Profit & Loss
  2. Average Stock Price (dynamic multi-lot entries)
  3. Indian Brokerage & Statutory Charges (Delivery, Intraday, Futures, Options across NSE/BSE with Oct 2024+ & Pre-Oct 2024 date-aware STT, Exchange Txn, SEBI, Stamp Duty, 18% GST, and DP charges)
  4. Stock Target Price & Risk-to-Reward
  5. Stock SIP Planner (Monthly, Quarterly, Yearly + compounding curve)
  6. CAGR Calculator
  7. Stock Return Calculator (capital gains + dividends + annualized return)
  8. Break-Even Price Calculator (with ₹0.05 exchange tick rounding)
- **18 Advanced Calculators**: Dividend Yield, Dividend Income, Stock Valuation (Graham Number & P/E), P/E Ratio, EPS, ROI, Risk-to-Reward, Position Sizing, Stop-Loss, Portfolio Allocation, Portfolio Rebalancing, Stock Split, Bonus Share, Rights Issue (TERP), Mutual Fund Return, Lumpsum Investment, Inflation-Adjusted Return, and dated Cash-Flow XIRR Solver.
- **AI Calculation Explainer**: Optional server-side Gemini (`gemini-4-hydrogen`) educational breakdown for any calculation.
- **Portfolio & Watchlist Management**: Multiple portfolios, buy/sell transactions, dividend logging, CSV broker statement import, sorting/filtering, side-by-side stock comparison, multiple watchlists, 52-week range bars, manual price override fallback, and target/stop-loss price alerts.
- **Interactive Charts**: Candlestick, Line, Area, and Bar charts across `1D`, `1W`, `1M`, `3M`, `6M`, `1Y`, and `5Y` intervals with `SMA (20)`, `EMA (20)`, `Bollinger Bands`, `RSI (14)`, and `MACD` indicators.
- **Reports & Exports**: Downloadable PDF, Excel (`.xlsx`), and CSV reports, print-friendly summary view, indicative STCG/LTCG tax estimator, and Financial Goal Tracker.
- **Authentication & Persistence**: JWT + bcryptjs registration, login, demo workspace (`demo@stockmate.in` / `Demo@1234`), email verification, password reset, and user-isolated persistent storage (`data/stockmate-db.json`).

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `GEMINI_API_KEY`: Optional Google Gemini API key for server-side calculation explanations.
- `JWT_SECRET`: Secret key used to sign session JWTs.
- `PORT`: Server port (defaults to `3000`).

## Local Setup & Commands

```bash
npm install
npm run test:finance   # Run decimal-safe financial formula unit tests
npm run dev            # Start Express + Vite dev server on http://localhost:3000
npm run build          # Build production frontend bundle into dist/
npm run start          # Run production server on port 3000
```

## Disclaimer

StockMate is an educational and calculation tool. It does not provide investment advice, stock recommendations, or guaranteed returns. Market data and calculated projections may be subject to delays or estimation. Please verify applicable charges and consult qualified financial professionals before making investment decisions.
