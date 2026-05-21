# Phase 1 Deployment Checklist

Use this checklist to verify your Phase 1 deployment is complete and working correctly.

## Prerequisites ✓

- [ ] PostgreSQL 15+ installed locally or Docker ready
- [ ] Python 3.11+ installed
- [ ] FRED API key obtained from https://fred.stlouisfed.org/docs/api/
- [ ] Project dependencies installed (`pip install -e .`)

## Setup Steps

### Step 1: Database Setup
- [ ] PostgreSQL is running and accessible
- [ ] Database `finmem` exists
- [ ] Connection string tested: `psql finmem -c "SELECT version();"`

### Step 2: Environment Configuration
- [ ] `.env.phase1` copied to `.env`
- [ ] `DATABASE_URL` configured correctly in `.env`
- [ ] `FRED_API_KEY` added to `.env` from your FRED account
- [ ] `.env` file is in `.gitignore` (check with `git status`)

### Step 3: Schema Initialization
- [ ] Ran: `make db-init` or `python scripts/init_db.py`
- [ ] Output shows: "Database initialization completed successfully"
- [ ] Verify tables exist:
  ```bash
  psql finmem -c "\dt"
  # Should list: market_state, episodes, data_quality, data_sources
  ```

### Step 4: Historical Data Ingestion
- [ ] Ran: `make db-ingest` or `python scripts/ingest_market_data.py`
- [ ] Output shows: "Successfully inserted 8427 market state records" (or similar count)
- [ ] No error messages in output
- [ ] Verify data was inserted:
  ```bash
  psql finmem -c "SELECT COUNT(*) as total_records FROM market_state;"
  # Should show: 8427 or similar
  ```

### Step 5: Data Quality Verification
Run these verification queries:

```bash
# 1. Check record count
psql finmem -c "SELECT COUNT(*) FROM market_state;"
# Expected: 8000+ records

# 2. Check date range
psql finmem -c "SELECT MIN(date) as oldest, MAX(date) as newest FROM market_state;"
# Expected: oldest ~1993-01-29, newest ~2026-05-20

# 3. Check metric coverage
psql finmem -c "SELECT 
  COUNT(*) as total,
  COUNT(spy_price) as spy_count,
  COUNT(vix) as vix_count,
  COUNT(cpi) as cpi_count,
  COUNT(fed_rate) as fed_count
FROM market_state;"
# Expected: High counts for all metrics (>8000)

# 4. View latest record
psql finmem -c "SELECT * FROM latest_market_state;"
# Expected: Today's (or most recent) market data

# 5. Check data quality table
psql finmem -c "SELECT * FROM data_quality ORDER BY check_date DESC LIMIT 3;"
# Expected: Quality scores >90% for all metrics

# 6. Check data sources table
psql finmem -c "SELECT source_name, metric_name, last_synced, status FROM data_sources;"
# Expected: All rows show status='active'
```

- [ ] All verification queries return expected results
- [ ] Data coverage spans 1993-present (30+ years)
- [ ] Quality scores are >90% for all metrics
- [ ] Data sources show recent sync timestamps

## API Integration (Phase 2 Preparation)

### Test Connection Pool
```python
from api.db import init_pool, get_latest_market_state, get_market_history

# Initialize pool
init_pool()

# Test latest market state query
state = get_latest_market_state()
print(f"Latest SPY: ${state['spy_price']}, VIX: {state['vix']}")
```
- [ ] Query returns valid data without errors
- [ ] Response time is <100ms

### Test Scheduler (Optional)
```python
from api.scheduler import init_scheduler
scheduler = init_scheduler()
# Will schedule daily update at 06:00 UTC
```
- [ ] Scheduler starts without errors
- [ ] Check logs for: "Scheduler initialized with daily market update at 06:00 UTC"

## Operational Verification

### Manual Daily Update Test
```bash
# Run the ingest script manually to test daily updates
make db-ingest

# OR if you want to test with limited data:
python scripts/ingest_market_data.py
```
- [ ] Script runs without errors
- [ ] New records are inserted (check record count before/after)

### Check Logs
```bash
# Verify logging is working
make db-ingest 2>&1 | grep -E "INFO|ERROR"
# Should show informational messages, no errors
```
- [ ] Info messages show the ingest pipeline steps
- [ ] No ERROR level messages in output

### Data Freshness
```bash
psql finmem -c "SELECT last_synced FROM data_sources ORDER BY last_synced DESC LIMIT 1;"
# Should show a timestamp from today or recently
```
- [ ] Last sync timestamp is recent (within last 24 hours if daily update ran)

## File Checklist

Verify all Phase 1 files were created:

```
scripts/
├── [ ] init_db.py                    (150 lines)
├── [ ] ingest_market_data.py         (270 lines)
└── [existing files]

api/
├── [ ] db.py                         (130 lines)
├── [ ] scheduler.py                  (60 lines)
└── [existing files]

finmem_db/
├── [ ] schema.sql                    (reference)

Root:
├── [ ] .env.phase1                   (template)
├── [ ] PHASE1_QUICKSTART.md          (setup guide)
├── [ ] PHASE1_SETUP.md               (comprehensive)
├── [ ] PHASE1_ARCHITECTURE.md        (diagrams)
├── [ ] PHASE1_IMPLEMENTATION.md      (details)
├── [ ] PHASE1_SUMMARY.txt            (overview)
├── [ ] PHASE1_DEPLOYMENT_CHECKLIST.md (this file)
├── [ ] Makefile                      (updated)
└── [ ] pyproject.toml                (updated)
```

- [ ] All Phase 1 files exist
- [ ] No merge conflicts in modified files

## Performance Baseline

Run these benchmarks to establish baseline performance:

```bash
# Measure ingest time
time make db-ingest
# Expected: 15-30 seconds for full historical backfill

# Measure query latency
psql finmem -c "EXPLAIN ANALYZE SELECT * FROM latest_market_state;"
# Expected: <100ms

# Measure 30-day query
psql finmem -c "SELECT COUNT(*) FROM market_state WHERE date >= CURRENT_DATE - 30;"
# Expected: <500ms
```

- [ ] Initial ingest completes in <45 seconds
- [ ] Latest state query completes in <100ms
- [ ] 30-day history query completes in <500ms
- [ ] Record these baseline numbers for monitoring

## Integration Readiness

- [ ] Can import `get_latest_market_state()` from `api/db.py`
- [ ] Can import `get_market_history()` from `api/db.py`
- [ ] Can import `init_scheduler()` from `api/scheduler.py`
- [ ] FastAPI can be configured to use database functions
- [ ] Connection pooling is working (tested above)

## Documentation Review

- [ ] Read PHASE1_QUICKSTART.md (should take 5 minutes)
- [ ] Read PHASE1_SETUP.md thoroughly (for reference)
- [ ] Understand PHASE1_ARCHITECTURE.md diagram
- [ ] Know where to find troubleshooting in PHASE1_SETUP.md

## Final Verification

Run this comprehensive verification script:

```bash
#!/bin/bash
echo "=== Phase 1 Deployment Verification ==="
echo ""

echo "1. Database Connection..."
psql finmem -c "SELECT 'OK' as status;" && echo "✓ Connected"

echo ""
echo "2. Tables Created..."
COUNT=$(psql finmem -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | head -n 3 | tail -n 1)
echo "✓ $COUNT tables found"

echo ""
echo "3. Data Inserted..."
RECORDS=$(psql finmem -c "SELECT COUNT(*) FROM market_state;" | head -n 3 | tail -n 1)
echo "✓ $RECORDS market state records"

echo ""
echo "4. Latest State..."
psql finmem -c "SELECT date, spy_price, vix FROM latest_market_state;"

echo ""
echo "5. Data Quality..."
psql finmem -c "SELECT metric_name, quality_score FROM data_quality ORDER BY check_date DESC LIMIT 4;"

echo ""
echo "✅ Phase 1 Deployment Verified!"
```

- [ ] Run verification script and ensure all checks pass

## Troubleshooting Notes

If any checks fail, see PHASE1_SETUP.md:
- [ ] PostgreSQL connection issues → PostgreSQL Setup section
- [ ] FRED API errors → Prerequisites section
- [ ] Data insertion failures → Troubleshooting section
- [ ] Performance issues → Performance Characteristics section

## Sign-off

- [ ] All checklist items completed
- [ ] No errors or warnings during deployment
- [ ] Data verified in database
- [ ] Ready to proceed with Phase 2 (Episode Detection)

**Deployment Date**: _______________

**Deployed By**: _______________

**Notes**: 
```
[Space for any notes or observations]
```

---

## Next Steps After Deployment

1. **Monitor Daily Updates**: Check that daily updates run at 06:00 UTC
2. **Set Up Monitoring**: Track data_quality and data_sources tables
3. **Begin Phase 2**: Start Episode Detection implementation
4. **Documentation**: Keep PHASE1_SETUP.md handy for troubleshooting

## Quick Reference Commands

```bash
# Initialize schema (one-time)
make db-init

# Ingest historical data (one-time, 15-30 seconds)
make db-ingest

# Manual daily update (can run anytime)
make db-update

# Check latest data
psql finmem -c "SELECT * FROM latest_market_state;"

# Monitor ingestion logs
tail -f /tmp/finmem_ingest.log

# Connect to database
psql finmem
```

---

**Status**: Ready for Phase 2 ✅

Phase 1 is complete when all checklist items are checked off. Once verified, your data layer is production-ready for the episodic reasoning system in Phase 2.
