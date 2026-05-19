import pytest
import numpy as np
from unittest.mock import patch, MagicMock
from finmem.memory.retrieval import _assign_regime
from finmem.data.schemas import MarketState
from datetime import date


def _make_state(**kwargs) -> MarketState:
    defaults = dict(
        date=date(2026, 1, 1),
        spy_price=500.0,
        spy_return_1d=0.001,
        spy_return_5d=-0.02,
        spy_return_21d=-0.05,
        vix=28.0,
        cpi=3.8,
        fed_rate=5.25,
        yield_spread=-0.42,
        unemployment=4.1,
        rolling_vol_21d=0.012,
    )
    defaults.update(kwargs)
    return MarketState(**defaults)


def test_regime_crisis():
    state = _make_state(vix=40.0)
    assert _assign_regime(state) == "CRISIS"


def test_regime_tightening_slowdown():
    state = _make_state(vix=20.0, yield_spread=-0.5, fed_rate=4.0)
    assert _assign_regime(state) == "TIGHTENING+SLOWDOWN"


def test_regime_bull():
    state = _make_state(vix=15.0, spy_return_21d=0.08, yield_spread=0.5)
    assert _assign_regime(state) == "BULL"


def test_regime_stable():
    state = _make_state(vix=16.0, spy_return_21d=0.01, yield_spread=0.5,
                        cpi=2.5, fed_rate=2.0)
    assert _assign_regime(state) == "STABLE"
