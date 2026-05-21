"""Query parser with natural language understanding"""

import logging
import re
from typing import Optional, Dict, List
from api.chat_schemas import QueryAnalysis, ConversationContext

logger = logging.getLogger(__name__)


class QueryParser:
    """Parse user natural language queries"""

    # Known market metrics
    METRICS = {
        'vix': 'vix', 'volatility': 'vix', 'vol': 'vix',
        'spy': 'spy_price', 'price': 'spy_price', 'market': 'spy_price',
        'inflation': 'cpi', 'cpi': 'cpi',
        'fed': 'fed_rate', 'interest': 'fed_rate', 'rate': 'fed_rate',
        'yield': 'yield_spread', 'spread': 'yield_spread',
        'unemployment': 'unemployment', 'jobs': 'unemployment'
    }

    # Known regimes
    REGIMES = ['BULL', 'BEAR', 'RECOVERY', 'STAGNATION', 'RECESSION']

    # Keywords for query types
    HISTORY_KEYWORDS = ['what', 'when', 'similar', 'like', 'compare', 'happened']
    STATE_KEYWORDS = ['now', 'current', 'today', 'market is', 'spy at', 'vix is']
    REGIME_KEYWORDS = ['bull', 'bear', 'recovery', 'recession', 'stagnation']

    def parse(
        self,
        user_message: str,
        context: Optional[ConversationContext] = None
    ) -> QueryAnalysis:
        """Parse user message and determine query type

        Returns QueryAnalysis with:
        - query_type: natural_language, market_state, regime, or clarification
        - interpreted_market_state: extracted metrics
        - needs_clarification: bool
        - clarification_questions: List[str]
        """
        context = context or ConversationContext()

        # Clean message
        message_clean = user_message.lower().strip()

        # Try to parse as market state query first
        market_state = self._extract_market_state(message_clean)
        if market_state and len(market_state) >= 2:  # At least 2 metrics
            return QueryAnalysis(
                query_type="market_state",
                original_query=user_message,
                interpreted_market_state=market_state,
                time_horizon=context.preferred_horizon or "6m",
                confidence=0.9
            )

        # Check for regime query
        regime = self._extract_regime(message_clean)
        if regime:
            return QueryAnalysis(
                query_type="regime",
                original_query=user_message,
                interpreted_regime=regime,
                time_horizon=context.preferred_horizon or "6m",
                confidence=0.95
            )

        # Check for time horizon
        horizon = self._extract_time_horizon(message_clean, context)

        # Check if clarification needed
        clarifications = []
        if not horizon:
            clarifications.append("What time horizon are you interested in? (1m, 3m, 6m, 1y)")
        if not regime and "regime" not in message_clean:
            clarifications.append("Any preference on market regime? (BULL, BEAR, RECOVERY, etc.)")

        # Default to natural language query
        return QueryAnalysis(
            query_type="natural_language",
            original_query=user_message,
            time_horizon=horizon or "6m",
            needs_clarification=len(clarifications) > 0,
            clarification_questions=clarifications,
            confidence=0.7 if clarifications else 0.85
        )

    def _extract_market_state(self, message: str) -> Optional[Dict[str, float]]:
        """Extract market metrics from message

        Examples:
        - "SPY at 450, VIX 22, CPI 3.2"
        - "Markets: price=450, vol=22"
        """
        market_state = {}

        # SPY price: "spy at 450" or "price 450" or "450"
        spy_match = re.search(r'(?:spy|price|market)[:\s]+(\d+(?:\.\d+)?)', message)
        if spy_match:
            market_state['spy_price'] = float(spy_match.group(1))

        # VIX: "vix 22" or "volatility 22"
        vix_match = re.search(r'(?:vix|volatility|vol)[:\s]+(\d+(?:\.\d+)?)', message)
        if vix_match:
            market_state['vix'] = float(vix_match.group(1))

        # CPI: "cpi 3.2" or "inflation 3.2"
        cpi_match = re.search(r'(?:cpi|inflation)[:\s]+(\d+(?:\.\d+)?)', message)
        if cpi_match:
            market_state['cpi'] = float(cpi_match.group(1))

        # Fed Rate: "fed 5.5" or "rate 5.5"
        fed_match = re.search(r'(?:fed|rate|interest)[:\s]+(\d+(?:\.\d+)?)', message)
        if fed_match:
            market_state['fed_rate'] = float(fed_match.group(1))

        # Yield spread: "spread 0.5"
        yield_match = re.search(r'(?:yield|spread)[:\s]+([+-]?\d+(?:\.\d+)?)', message)
        if yield_match:
            market_state['yield_spread'] = float(yield_match.group(1))

        # Unemployment: "unemployment 3.8"
        unemp_match = re.search(r'(?:unemployment|jobless)[:\s]+(\d+(?:\.\d+)?)', message)
        if unemp_match:
            market_state['unemployment'] = float(unemp_match.group(1))

        return market_state if market_state else None

    def _extract_regime(self, message: str) -> Optional[str]:
        """Extract market regime from message"""
        for regime in self.REGIMES:
            if regime.lower() in message:
                return regime
        return None

    def _extract_time_horizon(self, message: str, context: ConversationContext) -> Optional[str]:
        """Extract time horizon from message"""
        if '1 month' in message or '1m' in message:
            return "1m"
        if '3 month' in message or '3m' in message:
            return "3m"
        if '6 month' in message or '6m' in message or 'half year' in message:
            return "6m"
        if '1 year' in message or '1y' in message or '12 month' in message:
            return "1y"

        # Fall back to context
        return context.preferred_horizon

    def generate_clarification_follow_up(
        self,
        analysis: QueryAnalysis
    ) -> str:
        """Generate follow-up question if clarification needed"""
        if not analysis.needs_clarification:
            return ""

        questions = analysis.clarification_questions
        if not questions:
            return ""

        if len(questions) == 1:
            return f"Just to clarify: {questions[0]}"

        return "I need a bit more info:\n" + "\n".join(f"- {q}" for q in questions)

    def is_follow_up_to_previous(self, message: str, context: ConversationContext) -> bool:
        """Detect if message references previous query"""
        if not context.last_query_type:
            return False

        follow_up_keywords = ['that', 'it', 'this', 'those', 'same', 'also', 'compared to']
        return any(kw in message.lower() for kw in follow_up_keywords)

    def extract_user_preference(self, message: str) -> Optional[str]:
        """Extract user risk preference"""
        if any(word in message.lower() for word in ['conservative', 'safe', 'low risk']):
            return "conservative"
        if any(word in message.lower() for word in ['aggressive', 'high risk', 'risky']):
            return "aggressive"
        if any(word in message.lower() for word in ['balanced', 'moderate']):
            return "balanced"
        return None
