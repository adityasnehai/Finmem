import pytest
import pandas as pd
import numpy as np
from unittest.mock import patch
from finmem.data.episode_builder import _assign_regime, _compute_forward_returns


def _make_df(n=200):
    idx    = pd.date_range("2020-01-01", periods=n, freq="B")
    close  = pd.Series(100 + np.cumsum(np.random.randn(n) * 0.5), index=idx)
    df = pd.DataFrame({
        "spy_close":       close,
        "spy_return_1d":   close.pct_change().fillna(0),
        "spy_return_5d":   close.pct_change(5).fillna(0),
        "spy_return_21d":  close.pct_change(21).fillna(0),
        "rolling_vol_21d": close.pct_change().rolling(21).std().fillna(0.01),
        "vix":             np.full(n, 20.0),
        "cpi":             np.full(n, 3.0),
        "fed_rate":        np.full(n, 5.0),
        "yield_spread":    np.full(n, -0.3),
        "unemployment":    np.full(n, 4.0),
    }, index=idx)
    return df


def test_assign_regime_crisis():
    row = {"vix_level": 40, "max_drawdown": -0.2, "cpi": 3, "fed_rate": 5,
           "yield_spread": -0.3, "avg_daily_return": -0.01}
    assert _assign_regime(row) == "CRISIS"


def test_assign_regime_tightening():
    row = {"vix_level": 18, "max_drawdown": -0.03, "cpi": 7, "fed_rate": 5,
           "yield_spread": 0.1, "avg_daily_return": 0.0}
    assert _assign_regime(row) == "TIGHTENING"


def test_assign_regime_stable():
    row = {"vix_level": 15, "max_drawdown": -0.01, "cpi": 2.5, "fed_rate": 1.5,
           "yield_spread": 1.0, "avg_daily_return": 0.001}
    assert _assign_regime(row) == "STABLE"


def test_compute_forward_returns():
    df  = _make_df(300)
    res = _compute_forward_returns(df, 50)
    assert "spy_return_1m_after"  in res
    assert "spy_return_3m_after"  in res
    assert "spy_return_6m_after"  in res
    assert res["spy_return_1m_after"] is not None


def test_compute_forward_returns_near_end():
    df  = _make_df(60)
    res = _compute_forward_returns(df, 55)
    assert res["spy_return_6m_after"] is None
