# FinMem Phase 1: Market Data Collection & Storage - Setup Guide

## Overview

Phase 1 establishes the foundational data infrastructure for FinMem. It collects historical and daily market data from two sources:

- **yfinance**: Stock market data (SPY price, VIX volatility index)
- **FRED API**: Macroeconomic indicators (CPI, Federal Funds Rate, Yield Spread, Unemployment)

This data is stored in PostgreSQL + TimescaleDB for optimized time-series querying.

## Architecture

```
Data Sources          Collection            Storage              Query
─────────────────────────────────────────────────────────────────────
yfinance       →   Python ingestion  →   PostgreSQL +    →   API endpoints
FRED API       →   scripts           →   TimescaleDB    →   Dashboard
                    (ingest_market_data.py)
```

## Prerequisites

1. **PostgreSQL 15+** with TimescaleDB extension
2. **Python 3.11+**
3. **FRED API Key** (free, register at https://fred.stlouisfed.org/docs/api/)

## Installation Steps

### Step 1: PostgreSQL + TimescaleDB Setup

#### On macOS (with Homebrew):
```bash
brew install postgresql
brew tap timescale/tap
brew install timescaledb
psql postgres -c "CREATE DATABASE finmem;"
```

#### On Linux (Ubuntu/Debian):
```bash
sudo apt install postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE DATABASE finmem;"
sudo -u postgres psql -d finmem -c "CREATE EXTENSION timescaledb;"
```

#### On Docker (Recommended):
```bash
docker run -d \
  --name finmem-postgres \
  -e POSTGRES_DB=finmem \
  -e POSTGRES_PASSWORD=finmem_password \
  -p 5432:5432 \
  timescale/timescaledb-docker-ha:latest-pg15
```

### Step 2: Python Dependencies

```bash
cd /path/to/FinMem

# Install with new database dependencies
pip install -e .

# Or individual packages if not using pyproject.toml:
pip install psycopg[binary] psycopg-pool apscheduler yfinance fredapi pandas numpy
```

### Step 3: Environment Configuration

```bash
# Copy template and fill in your values
cp .env.phase1 .env

# Edit .env with:
DATABASE_URL=postgresql://user:password@localhost:5432/finmem
FRED_API_KEY=your_fred_api_key_from_https://fred.stlouisfed.org/docs/api/
```

### Step 4: Initialize Database Schema

```bash
python scripts/init_db.py
```

Output:
```
2026-05-20 10:30:45 - INFO - Creating TimescaleDB extension...
2026-05-20 10:30:46 - INFO - Creating market_state table...
2026-05-20 10:30:47 - INFO - Converting market_state to TimescaleDB hypertable...
...
2026-05-20 10:30:50 - INFO - Database initialization completed successfully
```

### Step 5: Ingest Historical Data (First Time Only)

```bash
python scripts/ingest_market_data.py
```

This fetches 30+ years of historical data (1993-present):
- SPY: Daily closing prices + calculated returns (1-day, 5-day, 21-day)
- VIX: Daily volatility index + 21-day rolling volatility
- CPI, Fed Rate, Yield Spread, Unemployment: Monthly macroeconomic indicators

Expected output:
```
2026-05-20 10:35:12 - INFO - Connected to PostgreSQL database
2026-05-20 10:35:13 - INFO - Fetching SPY data from 1993-01-01...
2026-05-20 10:35:15 - INFO - Fetched 8427 SPY records
2026-05-20 10:35:16 - INFO - Fetching VIX data from 1993-01-01...
2026-05-20 10:35:18 - INFO - Fetched 8210 VIX records
2026-05-20 10:35:19 - INFO - Fetching macro indicators from FRED...
2026-05-20 10:35:22 - INFO - Fetched macro data: 8427 records
2026-05-20 10:35:23 - INFO - Merging all market data sources...
2026-05-20 10:35:24 - INFO - Merged dataset: 8427 total records
2026-05-20 10:35:25 - INFO - Inserting 8427 market state records...
2026-05-20 10:35:48 - INFO - Successfully inserted 8427 market state records
2026-05-20 10:35:49 - INFO - Recording data quality metrics...
2026-05-20 10:35:50 - INFO - Data ingestion completed successfully
```

Time: ~15-30 seconds (depends on network)

### Step 6: Verify Data

```bash
# Query latest market state
psql finmem -c "SELECT * FROM latest_market_state LIMIT 1;"

# Check data coverage
psql finmem -c "SELECT COUNT(*) as total_records, MIN(date) as oldest, MAX(date) as newest FROM market_state;"

# View data quality metrics
psql finmem -c "SELECT * FROM data_quality ORDER BY check_date DESC LIMIT 5;"
```

Expected output shows ~8400+ records with 30+ year coverage from 1993 to present date.

## Daily Updates

The system includes automatic daily updates that run at 06:00 UTC (after US market close).

### Option A: Using APScheduler (FastAPI Integration)

The scheduler is initialized when your FastAPI application starts:

```python
from api.scheduler import init_scheduler

app = FastAPI()

@app.on_event("startup")
async def startup():
    init_scheduler()
```

### Option B: Manual Daily Update

```bash
# Run this daily (or set up a cron job)
python scripts/ingest_market_data.py
```

### Option C: Cron Job (Linux/macOS)

```bash
# Add to crontab -e
0 6 * * * cd /path/to/FinMem && python scripts/ingest_market_data.py >> /tmp/finmem_ingest.log 2>&1
```

## Data Schema

### market_state (TimescaleDB Hypertable)
Primary table for daily market observations:

| Column | Type | Description | Source |
|--------|------|-------------|--------|
| date | DATE | Trading date | yfinance/FRED |
| spy_price | FLOAT8 | S&P 500 closing price | yfinance |
| spy_return_1d | FLOAT8 | 1-day return (%) | calculated |
| spy_return_5d | FLOAT8 | 5-day return (%) | calculated |
| spy_return_21d | FLOAT8 | 21-day return (%) | calculated |
| vix | FLOAT8 | VIX volatility index | yfinance |
| rolling_vol_21d | FLOAT8 | 21-day rolling volatility | calculated |
| cpi | FLOAT8 | Consumer Price Index | FRED (CPIAUCSL) |
| fed_rate | FLOAT8 | Federal Funds Rate (%) | FRED (FEDFUNDS) |
| yield_spread | FLOAT8 | 10Y - 2Y Treasury spread | FRED (T10Y2Y) |
| unemployment | FLOAT8 | Unemployment rate (%) | FRED (UNRATE) |

### data_quality
Tracks data freshness and completeness:

| Column | Type | Description |
|--------|------|-------------|
| check_date | DATE | When quality check ran |
| metric_name | VARCHAR | SPY, VIX, CPI, etc. |
| data_points_count | INT | Number of records present |
| missing_values | INT | Number of NULLs |
| quality_score | FLOAT8 | Percentage complete (0-100) |

### data_sources
Metadata about each data source:

| Column | Type | Description |
|--------|------|-------------|
| source_name | VARCHAR | 'yfinance' or 'FRED' |
| metric_name | VARCHAR | SPY, VIX, CPI, etc. |
| series_id | VARCHAR | FRED series ID (e.g., CPIAUCSL) |
| last_synced | TIMESTAMP | When data was last updated |
| records_count | INT | Number of records in database |
| status | VARCHAR | 'active' or 'inactive' |

## API Endpoints (Phase 2)

Once data is collected, these API endpoints expose it:

```
GET /api/market/latest      → Latest market state
GET /api/market/history?days=30  → Last N days
GET /api/data-quality       → Data freshness metrics
GET /api/data-sources       → Source metadata
```

## Troubleshooting

### "FRED_API_KEY not set"
```bash
# Verify key is in .env
cat .env | grep FRED_API_KEY

# Register at https://fred.stlouisfed.org/docs/api/
# Then add to .env and reload
```

### "Connection refused" PostgreSQL
```bash
# Check if PostgreSQL is running
psql postgres -c "SELECT version();"

# If using Docker:
docker ps | grep finmem-postgres

# Verify DATABASE_URL in .env
```

### Ingestion fails with "no data"
```bash
# Network issue with yfinance/FRED
# Try direct API test:
python -c "import yfinance; print(yfinance.download('SPY', start='2024-01-01', end='2024-01-02'))"
```

### Data gaps or missing metrics
```bash
# Check data_quality table
psql finmem -c "SELECT * FROM data_quality ORDER BY check_date DESC LIMIT 1;"

# Expected quality_score should be >90% for complete metrics
```

## Performance Characteristics

- **Data ingestion**: ~15-30 seconds for 30-year historical backfill
- **Daily updates**: ~2-5 seconds for new day's data
- **Query latency**: <100ms for latest state, <500ms for 30-day history
- **Storage**: ~50MB for 30+ years of daily + monthly data
- **Retention**: All data kept indefinitely (time-series optimized)

## Next Steps (Phase 2+)

1. **Episode Detection**: Identify market regimes (BULL, CRISIS, etc.) from raw data
2. **Vector Embeddings**: Create semantic embeddings of episodes
3. **LanceDB Storage**: Index episodes for similarity search
4. **Chat API**: Expose episodic reasoning over collected data
5. **UI Integration**: Display market context and historical analogs

## Files Created

- `scripts/init_db.py` - Initialize schema and indexes
- `scripts/ingest_market_data.py` - Historical + daily data ingestion
- `api/db.py` - Database connection pooling and query helpers
- `api/scheduler.py` - Scheduled daily update tasks
- `.env.phase1` - Environment variable template
- `finmem_db/schema.sql` - Full schema definition (reference)

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TimescaleDB Documentation](https://docs.timescale.com/)
- [yfinance Documentation](https://github.com/ranaroussi/yfinance)
- [FRED API Docs](https://fred.stlouisfed.org/docs/api/)
- [psycopg Documentation](https://www.psycopg.org/psycopg3/docs/)
