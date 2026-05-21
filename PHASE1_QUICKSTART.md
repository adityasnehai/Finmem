# Phase 1 Quick Start (5 minutes)

## What's Phase 1?
Collect 30+ years of daily market data and store in PostgreSQL + TimescaleDB.

## Prerequisites
- PostgreSQL running locally or via Docker
- FRED API key (free: https://fred.stlouisfed.org/docs/api/)
- Python 3.11+

## 5-Minute Setup

### 1. Start PostgreSQL (if using Docker)
```bash
docker run -d --name finmem-postgres \
  -e POSTGRES_DB=finmem \
  -e POSTGRES_PASSWORD=finmem_password \
  -p 5432:5432 \
  timescale/timescaledb-docker-ha:latest-pg15
```

### 2. Configure Environment
```bash
cp .env.phase1 .env
# Edit .env: replace FRED_API_KEY with your key from https://fred.stlouisfed.org/docs/api/
# Default DATABASE_URL works for Docker or local PostgreSQL
```

### 3. Install Dependencies
```bash
pip install -e .
```

### 4. Initialize Database Schema (One-time)
```bash
make db-init
# Output: Database initialization completed successfully
```

### 5. Ingest Historical Data (15-30 seconds)
```bash
make db-ingest
# Output: Successfully inserted 8427 market state records
```

### 6. Verify Installation
```bash
psql finmem -c "SELECT COUNT(*) FROM market_state;"
# Should show: 8427 (or similar high number)
```

## Result
✅ PostgreSQL + TimescaleDB database populated with 30+ years of market data:
- 8,400+ daily observations
- SPY price, VIX, CPI, Fed Rate, Yield Spread, Unemployment
- Automatically calculated returns and volatility

## Next Steps
- Daily updates: `make db-update` (runs automatically on schedule)
- API integration: See [PHASE1_SETUP.md](PHASE1_SETUP.md) for detailed API endpoints
- Phase 2: Episode detection and regime identification

## Troubleshooting

**PostgreSQL won't connect?**
```bash
# Check if running
psql postgres -c "SELECT version();"

# Or check Docker container
docker ps | grep finmem-postgres
```

**FRED API error?**
```bash
# Verify key in .env
cat .env | grep FRED_API_KEY

# Get one at https://fred.stlouisfed.org/docs/api/
```

**Ingest takes long or fails?**
```bash
# Check network connectivity to yfinance/FRED
python -c "import yfinance; print(yfinance.download('SPY', start='2024-01-01', end='2024-01-02'))"
```

## For Detailed Setup
See [PHASE1_SETUP.md](PHASE1_SETUP.md) for:
- Database architecture details
- Data schema documentation
- Cron job setup for daily updates
- Performance characteristics
- Full troubleshooting guide
