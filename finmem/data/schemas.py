from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class MarketState(BaseModel):
    date: date
    spy_price: float
    spy_return_1d: float
    spy_return_5d: float
    spy_return_21d: float
    vix: float
    cpi: float
    fed_rate: float
    yield_spread: float  # 10Y-2Y
    unemployment: float
    rolling_vol_21d: float

    @property
    def regime_label(self) -> str:
        if self.vix > 30:
            return "CRISIS"
        if self.fed_rate > self.fed_rate and self.cpi > 4:
            return "TIGHTENING"
        if self.yield_spread < -0.2:
            return "TIGHTENING+SLOWDOWN"
        if self.spy_return_21d > 0.05:
            return "RECOVERY"
        return "STABLE"


class Episode(BaseModel):
    id: str
    start_date: date
    end_date: date
    duration_days: int

    # Price features
    avg_daily_return: float
    total_return: float
    max_drawdown: float
    rolling_vol: float
    spy_return_1m_after: Optional[float] = None
    spy_return_3m_after: Optional[float] = None
    spy_return_6m_after: Optional[float] = None

    # Macro features at episode start
    vix_level: float
    cpi: float
    fed_rate: float
    yield_spread: float
    unemployment: float

    # Labels
    regime: str
    prose_summary: str = ""

    # Embedding stored separately in LanceDB
    embedding: Optional[list[float]] = None


class RetrievalResult(BaseModel):
    episode: Episode
    similarity: float
    regime_bonus: float
    recency_penalty: float
    final_score: float


class QueryResult(BaseModel):
    query_state: MarketState
    retrieved: list[RetrievalResult]
    confidence: float
    has_analog: bool
    reasoning: str = ""
    latency_ms: float = 0.0
