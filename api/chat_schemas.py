"""Chat interface data models for Phase 4"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


class ChatMessage(BaseModel):
    """Single message in conversation"""
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime
    message_id: str = Field(default_factory=lambda: str(int(datetime.now().timestamp() * 1000)))


class ConversationContext(BaseModel):
    """Context accumulated from conversation"""
    preferred_horizon: Optional[Literal["1m", "3m", "6m", "1y"]] = None
    preferred_regime: Optional[str] = None
    preferred_confidence_level: Optional[Literal["HIGH", "MEDIUM", "LOW"]] = None
    last_query_type: Optional[str] = None
    clarifications_needed: List[str] = Field(default_factory=list)
    user_preference: Optional[str] = None  # "conservative", "aggressive", "balanced"


class ChatRequest(BaseModel):
    """User message in chat"""
    conversation_id: str = Field(default_factory=lambda: f"conv_{int(datetime.now().timestamp())}")
    user_message: str = Field(..., min_length=1, max_length=1000)
    include_context: bool = True
    include_risk_disclaimer: bool = True


class QueryAnalysis(BaseModel):
    """Parsed user query"""
    query_type: Literal["natural_language", "market_state", "regime", "clarification"]
    original_query: str
    interpreted_market_state: Optional[dict] = None
    interpreted_regime: Optional[str] = None
    time_horizon: Optional[Literal["1m", "3m", "6m", "1y"]] = "6m"
    confidence_threshold: float = 0.3
    needs_clarification: bool = False
    clarification_questions: List[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1, description="How confident are we in parsing")


class EpisodeReference(BaseModel):
    """Reference to historical episode in response"""
    episode_id: int
    regime: str
    period: str  # "2008-10-10 to 2008-12-08"
    duration_days: int
    return_6m: float
    win_rate_context: str  # "This is a BEAR episode..."


class ChatResponse(BaseModel):
    """Assistant response with reasoning"""
    conversation_id: str
    message: str  # Main conversational response
    confidence_level: Literal["HIGH", "MEDIUM", "LOW"]
    confidence_explanation: str  # Why we have this confidence

    # Evidence from Phase 3
    similar_episodes_count: int
    win_rate: float
    avg_return_6m: float
    median_return_6m: float

    # Risk & Context
    risk_summary: Optional[str] = None  # Worst/best case outcomes
    important_caveats: List[str] = Field(default_factory=list)

    # Follow-ups & Suggestions
    suggested_follow_ups: List[str] = Field(default_factory=list)
    actionable_insights: List[str] = Field(default_factory=list)
    watch_points: List[str] = Field(default_factory=list)  # What would invalidate the pattern

    # Phase 2: Historical Pattern Analysis (Correlational, not causal)
    metric_variation: Optional[dict] = Field(default=None)  # Which metrics vary most (not "importance")
    historical_indicators: Optional[List[str]] = Field(default=None)  # What preceded transitions (n=16)
    regime_distribution: Optional[dict] = Field(default=None)  # Regime frequencies in similar episodes

    # Metadata
    query_used: str
    episodes_referenced: List[EpisodeReference] = Field(default_factory=list)


class ConversationSummary(BaseModel):
    """Summary of conversation thread"""
    conversation_id: str
    created_at: datetime
    messages_count: int
    context: ConversationContext
    last_message_timestamp: datetime
    key_findings: List[str]
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]


class RiskAssessment(BaseModel):
    """Risk analysis for pattern"""
    worst_case_loss: float
    best_case_gain: float
    typical_outcome: float
    win_rate_pct: float
    sharpe_ratio: float
    confidence_in_pattern: Literal["HIGH", "MEDIUM", "LOW"]
    sample_size: int
    is_statistically_significant: bool
    caveat: str


class DisclaimerType(BaseModel):
    """Risk disclaimers"""
    type: Literal["legal", "statistical", "methodological", "data_limitation"]
    text: str
    severity: Literal["INFO", "WARNING", "CRITICAL"]
