"""
Scheduled tasks for daily market data updates using APScheduler
"""

import logging
import os
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


def daily_market_update():
    """Daily scheduled task to update market data from yfinance and FRED."""
    logger.info("Starting daily market data update...")

    try:
        from scripts.ingest_market_data import MarketDataIngester

        db_url = os.getenv('DATABASE_URL', 'postgresql://localhost/finmem')
        fred_api_key = os.getenv('FRED_API_KEY', '')

        if not fred_api_key:
            logger.error("FRED_API_KEY not configured")
            return

        ingester = MarketDataIngester(db_url, fred_api_key)

        # Only fetch yesterday's data for incremental updates
        # For initial setup, use ingest_market_data.py directly
        ingester.connect()
        from datetime import datetime, timedelta
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        today = datetime.now().strftime("%Y-%m-%d")

        spy_data = ingester.fetch_spy_data(start_date=yesterday)
        vix_data = ingester.fetch_vix_data(start_date=yesterday)
        macro_data = ingester.fetch_all_macro_data()
        macro_data = macro_data[macro_data['date'] >= yesterday]

        if not spy_data.empty:
            market_state = ingester.merge_all_data(spy_data, vix_data, macro_data)
            ingester.insert_market_state(market_state)
            ingester.record_data_quality()

        ingester.close()
        logger.info("Daily market data update completed")

    except Exception as e:
        logger.error(f"Daily market data update failed: {e}", exc_info=True)


def daily_episode_detection():
    """Daily scheduled task to detect new episodes and update outcomes incrementally."""
    logger.info("Starting daily episode detection...")

    try:
        from scripts.detect_episodes import detect_episodes

        db_url = os.getenv('DATABASE_URL', 'postgresql://localhost/finmem')

        result = detect_episodes(db_url, incremental=True, days_back=30)
        logger.info(f"Daily episode detection completed: {result}")

    except Exception as e:
        logger.error(f"Daily episode detection failed: {e}", exc_info=True)


def init_scheduler():
    """Initialize and start the APScheduler background scheduler."""
    scheduler = BackgroundScheduler(daemon=True)

    # Schedule daily market update at 6:00 AM UTC (after US market closes)
    scheduler.add_job(
        daily_market_update,
        trigger=CronTrigger(hour=6, minute=0),
        id='daily_market_update',
        name='Daily Market Data Update',
        replace_existing=True,
    )

    # Schedule daily episode detection at 6:30 AM UTC (30 min after market update)
    scheduler.add_job(
        daily_episode_detection,
        trigger=CronTrigger(hour=6, minute=30),
        id='daily_episode_detection',
        name='Daily Episode Detection',
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler initialized:")
    logger.info("  - Daily market update at 06:00 UTC")
    logger.info("  - Daily episode detection at 06:30 UTC")

    return scheduler
