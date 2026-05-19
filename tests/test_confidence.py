import pytest
from unittest.mock import MagicMock
from finmem.reasoning.confidence import confidence_gate
from finmem.data.schemas import QueryResult, MarketState, RetrievalResult, Episode
from datetime import date


def _make_result(confidence: float) -> QueryResult:
    state = MarketState(
        date=date(2026, 1, 1), spy_price=500.0, spy_return_1d=0.001,
        spy_return_5d=-0.02, spy_return_21d=-0.05, vix=28.0,
        cpi=3.8, fed_rate=5.25, yield_spread=-0.42,
        unemployment=4.1, rolling_vol_21d=0.012,
    )
    return QueryResult(
        query_state=state,
        retrieved=[],
        confidence=confidence,
        has_analog=confidence >= 0.45,
    )


def test_high_confidence_passes():
    result = _make_result(0.80)
    should_reason, prefix = confidence_gate(result)
    assert should_reason is True
    assert prefix == ""


def test_medium_confidence_passes_with_warning():
    result = _make_result(0.55)
    should_reason, prefix = confidence_gate(result)
    assert should_reason is True
    assert "Moderate confidence" in prefix


def test_low_confidence_refuses():
    result = _make_result(0.30)
    should_reason, msg = confidence_gate(result)
    assert should_reason is False
    assert "No confident historical analog" in msg


def test_exact_high_threshold():
    result = _make_result(0.65)
    should_reason, prefix = confidence_gate(result)
    assert should_reason is True
    assert prefix == ""


def test_exact_low_threshold():
    result = _make_result(0.45)
    should_reason, _ = confidence_gate(result)
    assert should_reason is True
