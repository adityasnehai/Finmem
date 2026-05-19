import os
import pandas as pd
import yfinance as yf
from fredapi import Fred
from datetime import date, timedelta
from rich.console import Console

console = Console()

FRED_SERIES = {
    "cpi":          "CPIAUCSL",
    "fed_rate":     "FEDFUNDS",
    "yield_spread": "T10Y2Y",
    "unemployment": "UNRATE",
}

START_DATE = "1993-01-01"
END_DATE   = date.today().strftime("%Y-%m-%d")


def load_spy(start: str = START_DATE, end: str = END_DATE) -> pd.DataFrame:
    console.print("[dim]Fetching SPY from yfinance...[/dim]")
    spy = yf.download("SPY", start=start, end=end, progress=False, auto_adjust=True)
    spy = spy[["Close", "Volume"]].copy()
    spy.columns = ["spy_close", "spy_volume"]
    spy.index = pd.to_datetime(spy.index).normalize()

    spy["spy_return_1d"]  = spy["spy_close"].pct_change(1)
    spy["spy_return_5d"]  = spy["spy_close"].pct_change(5)
    spy["spy_return_21d"] = spy["spy_close"].pct_change(21)
    spy["rolling_vol_21d"] = spy["spy_return_1d"].rolling(21).std()
    return spy.dropna(subset=["spy_return_1d"])


def load_vix(start: str = START_DATE, end: str = END_DATE) -> pd.DataFrame:
    console.print("[dim]Fetching VIX from yfinance...[/dim]")
    vix = yf.download("^VIX", start=start, end=end, progress=False, auto_adjust=True)
    vix = vix[["Close"]].copy()
    vix.columns = ["vix"]
    vix.index = pd.to_datetime(vix.index).normalize()
    return vix


def load_macro(start: str = START_DATE, end: str = END_DATE) -> pd.DataFrame:
    fred = Fred(api_key=os.environ["FRED_API_KEY"])
    frames = {}
    for name, series_id in FRED_SERIES.items():
        console.print(f"[dim]Fetching {series_id} from FRED...[/dim]")
        s = fred.get_series(series_id, observation_start=start, observation_end=end)
        frames[name] = s
    macro = pd.DataFrame(frames)
    macro.index = pd.to_datetime(macro.index).normalize()
    macro = macro.resample("D").last().ffill()
    return macro


def load_all(start: str = START_DATE, end: str = END_DATE) -> pd.DataFrame:
    spy   = load_spy(start, end)
    vix   = load_vix(start, end)
    macro = load_macro(start, end)

    df = spy.join(vix, how="left").join(macro, how="left")
    df = df.ffill().dropna(
        subset=["spy_close", "vix", "cpi", "fed_rate", "yield_spread", "unemployment"]
    )
    df.index.name = "date"
    console.print(f"[green]Loaded {len(df)} trading days ({df.index[0].date()} → {df.index[-1].date()})[/green]")
    return df
