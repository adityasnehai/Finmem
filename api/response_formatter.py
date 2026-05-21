"""Format Phase 3 reasoning into conversational responses"""

import logging
from typing import List, Tuple
from api.schemas import SimilarEpisode, ReasoningInsight
from api.chat_schemas import ChatResponse, RiskAssessment, EpisodeReference

logger = logging.getLogger(__name__)


class ResponseFormatter:
    """Convert Phase 3 insights to conversational responses"""

    def format_response(
        self,
        query: str,
        similar_episodes: List[SimilarEpisode],
        reasoning: ReasoningInsight,
        user_preference: str = "balanced"
    ) -> ChatResponse:
        """Format complete chat response"""

        # Generate conversational message
        message = self._generate_message(similar_episodes, reasoning, user_preference)

        # Generate risk assessment
        risk = self._assess_risk(similar_episodes, reasoning)

        # Generate follow-up suggestions
        follow_ups = self._generate_follow_ups(reasoning, similar_episodes)

        # Generate actionable insights
        actions = self._generate_actions(reasoning, risk)

        # Generate watch points (what would break pattern)
        watch_points = self._generate_watch_points(similar_episodes)

        # Convert episodes to references
        episode_refs = [
            EpisodeReference(
                episode_id=ep.episode_id,
                regime=ep.regime,
                period=f"{ep.start_date} to {ep.end_date}",
                duration_days=ep.duration_days,
                return_6m=ep.outcomes.return_6m or 0.0,
                win_rate_context=f"{ep.regime} episode, {ep.outcomes.return_6m:+.1f}% return"
            )
            for ep in similar_episodes[:5]  # Top 5 episodes
        ]

        # Generate caveats
        caveats = self._generate_caveats(reasoning, similar_episodes)

        # Confidence explanation
        confidence_exp = self._explain_confidence(reasoning)

        return ChatResponse(
            conversation_id="",  # Will be filled by chat manager
            message=message,
            confidence_level=reasoning.confidence_level,
            confidence_explanation=confidence_exp,
            similar_episodes_count=reasoning.similar_episodes_count,
            win_rate=reasoning.win_rate_pct,
            avg_return_6m=reasoning.avg_return_6m,
            median_return_6m=reasoning.median_return_6m,
            risk_summary=f"Worst case: {risk.worst_case_loss:.1f}%. Best case: +{risk.best_case_gain:.1f}%. Typical: {risk.typical_outcome:+.1f}%",
            important_caveats=caveats,
            suggested_follow_ups=follow_ups,
            actionable_insights=actions,
            watch_points=watch_points,
            query_used=query,
            episodes_referenced=episode_refs
        )

    def _generate_message(
        self,
        episodes: List[SimilarEpisode],
        reasoning: ReasoningInsight,
        preference: str
    ) -> str:
        """Generate main conversational message"""
        if reasoning.similar_episodes_count == 0:
            return "I couldn't find any historical episodes matching your query. Try different search terms or broader filters."

        emoji = "📈" if reasoning.avg_return_6m > 0 else "📉" if reasoning.avg_return_6m < 0 else "➡️"

        message = f"{emoji} **Historical Pattern Found** ({reasoning.similar_episodes_count} similar episodes)\n\n"

        # Main finding
        message += f"In markets similar to your description:\n"
        message += f"- **Average 6-month return**: {reasoning.avg_return_6m:+.1f}%\n"
        message += f"- **Median return**: {reasoning.median_return_6m:+.1f}%\n"
        message += f"- **Win rate**: {reasoning.win_rate_pct:.0f}% (positive returns)\n"
        message += f"- **Risk-adjusted return**: {reasoning.sharpe_ratio_avg:.2f} Sharpe ratio\n\n"

        # Confidence level
        confidence_text = {
            "HIGH": "strong confidence",
            "MEDIUM": "moderate confidence",
            "LOW": "low confidence"
        }[reasoning.confidence_level]

        message += f"**Confidence**: {confidence_text} ({reasoning.representation:.1f}% of search space)\n\n"

        # Risk context
        max_gain = max((ep.outcomes.max_gain for ep in episodes), default=0.0)
        max_loss = min((ep.outcomes.max_loss for ep in episodes), default=0.0)

        message += f"**Risk context**:\n"
        message += f"- Best case: +{max_gain:.1f}%\n"
        message += f"- Worst case: {max_loss:.1f}%\n\n"

        # Regime breakdown
        regimes = {}
        for ep in episodes:
            regimes[ep.regime] = regimes.get(ep.regime, 0) + 1

        if len(regimes) > 0:
            message += f"**Market regimes in pattern**:\n"
            for regime, count in sorted(regimes.items(), key=lambda x: -x[1]):
                pct = (count / len(episodes)) * 100
                message += f"- {regime}: {count} episodes ({pct:.0f}%)\n"

        return message

    def _assess_risk(
        self,
        episodes: List[SimilarEpisode],
        reasoning: ReasoningInsight
    ) -> RiskAssessment:
        """Assess risk of pattern"""
        max_gain = max((ep.outcomes.max_gain for ep in episodes), default=0.0)
        max_loss = min((ep.outcomes.max_loss for ep in episodes), default=0.0)

        return RiskAssessment(
            worst_case_loss=max_loss,
            best_case_gain=max_gain,
            typical_outcome=reasoning.avg_return_6m,
            win_rate_pct=reasoning.win_rate_pct,
            sharpe_ratio=reasoning.sharpe_ratio_avg,
            confidence_in_pattern=reasoning.confidence_level,
            sample_size=reasoning.similar_episodes_count,
            is_statistically_significant=reasoning.statistical_significance < 0.05,
            caveat="Pattern based on historical data only"
        )

    def _explain_confidence(self, reasoning: ReasoningInsight) -> str:
        """Explain why we have this confidence level"""
        if reasoning.confidence_level == "HIGH":
            return (f"High confidence: Found {reasoning.similar_episodes_count} similar episodes with "
                   f"consistent outcomes. Win rate is statistically significant (p={reasoning.statistical_significance:.4f}).")
        elif reasoning.confidence_level == "MEDIUM":
            return (f"Moderate confidence: Found {reasoning.similar_episodes_count} similar episodes. "
                   f"Pattern exists but sample size is small.")
        else:
            return (f"Low confidence: Very few ({reasoning.similar_episodes_count}) similar episodes found. "
                   f"Results may not be reliable. Consider broader search parameters.")

    def _generate_caveats(
        self,
        reasoning: ReasoningInsight,
        episodes: List[SimilarEpisode]
    ) -> List[str]:
        """Generate important caveats"""
        caveats = [
            "⚠️ Past performance does not guarantee future results",
            "⚠️ Only 61 total market episodes available (1990-2030)",
            "⚠️ This is historical analysis, not financial advice"
        ]

        if reasoning.similar_episodes_count < 3:
            caveats.append(f"⚠️ Very few similar episodes ({reasoning.similar_episodes_count}) - results unreliable")

        if reasoning.statistical_significance >= 0.05:
            caveats.append("⚠️ Win rate is not statistically significant (could be random)")

        # Check if episodes span different time periods
        if len(episodes) > 0:
            start_years = [ep.start_date.split('-')[0] for ep in episodes]
            if len(set(start_years)) > 3:
                caveats.append("⚠️ Episodes span multiple decades - market behavior may differ")

        return caveats

    def _generate_follow_ups(
        self,
        reasoning: ReasoningInsight,
        episodes: List[SimilarEpisode]
    ) -> List[str]:
        """Generate suggested follow-up questions"""
        follow_ups = []

        if reasoning.similar_episodes_count > 0:
            follow_ups.append("What specific market conditions are you most concerned about?")
            follow_ups.append("Would you like to see a different time horizon (1m, 3m, 1y)?")

            # Check regime composition
            regimes = {}
            for ep in episodes:
                regimes[ep.regime] = regimes.get(ep.regime, 0) + 1

            if len(regimes) > 1:
                follow_ups.append(f"Would you like to focus on just one regime? (Currently showing {len(regimes)} regimes)")

        if reasoning.win_rate_pct > 60:
            follow_ups.append("Are you interested in sizing based on this win rate?")
        elif reasoning.win_rate_pct < 50:
            follow_ups.append("Would you like to see risk management suggestions for this pattern?")

        return follow_ups

    def _generate_actions(
        self,
        reasoning: ReasoningInsight,
        risk: RiskAssessment
    ) -> List[str]:
        """Generate actionable insights"""
        actions = []

        # Based on win rate
        if reasoning.win_rate_pct >= 75:
            actions.append(f"High win rate ({reasoning.win_rate_pct:.0f}%) suggests confidence in pattern")
        elif reasoning.win_rate_pct <= 50:
            actions.append(f"Win rate of {reasoning.win_rate_pct:.0f}% suggests caution - nearly 50/50")

        # Based on Sharpe ratio
        if reasoning.sharpe_ratio_avg > 1.0:
            actions.append(f"Sharpe ratio of {reasoning.sharpe_ratio_avg:.2f} indicates good risk-adjusted return")
        elif reasoning.sharpe_ratio_avg < 0.5:
            actions.append(f"Low Sharpe ratio ({reasoning.sharpe_ratio_avg:.2f}) - returns don't compensate for risk")

        # Based on range
        range_pct = risk.best_case_gain - abs(risk.worst_case_loss)
        if range_pct > 30:
            actions.append(f"Wide outcome range ({risk.worst_case_loss:.1f}% to +{risk.best_case_gain:.1f}%) - high uncertainty")

        # Based on significance
        if risk.is_statistically_significant:
            actions.append("Pattern is statistically significant - not due to random chance")
        else:
            actions.append("Pattern may be due to random variation - verify with additional context")

        return actions

    def _generate_watch_points(self, episodes: List[SimilarEpisode]) -> List[str]:
        """What would break this pattern"""
        watch_points = [
            "If market regime changes to RECESSION, pattern may break",
            "If volatility (VIX) spikes unexpectedly, pattern becomes unreliable",
            "If historical relationships breakdown (correlations change), adjust strategy",
            "If you see 3+ consecutive losses, pattern is likely broken"
        ]

        # Based on actual episodes
        if len(episodes) > 0:
            regimes = {}
            for ep in episodes:
                regimes[ep.regime] = regimes.get(ep.regime, 0) + 1

            dominant_regime = max(regimes, key=regimes.get)
            watch_points.insert(
                0,
                f"If market exits {dominant_regime} regime, this pattern no longer applies"
            )

        return watch_points

    def _generate_pattern_summary(self, reasoning: ReasoningInsight, metric_variation: dict = None) -> str:
        """Summarize market conditions that HISTORICALLY PRECEDED this pattern (VALIDATED ONLY).

        IMPORTANT DISCLAIMER: This is CORRELATIONAL analysis, not causal.
        - Shows which metrics varied most across similar historical episodes
        - Does NOT prove these metrics "drive" or "cause" the pattern
        - High variation just means "different episodes had different values"
        - Sample size n=16 transitions = too small for causal claims

        Args:
            reasoning: Statistical insight from similar episodes
            metric_variation: dict mapping features to coefficient_of_variation (not importance)

        Returns:
            Validated pattern summary text
        """
        if not metric_variation or not any(metric_variation.values()):
            return "Historical pattern found in similar episodes. Market conditions vary by episode."

        # Sort features by variation (purely descriptive, NOT causal)
        sorted_features = sorted(metric_variation.items(), key=lambda x: x[1], reverse=True)

        message = "**Market Conditions in Similar Episodes**:\n"
        message += "(Metrics that varied most - NOT ranked by importance or causation)\n"
        total_variation = sum(v for k, v in sorted_features if v > 0)

        for i, (feature, variation) in enumerate(sorted_features[:3], 1):
            if variation > 0:
                pct = (variation / total_variation * 100) if total_variation > 0 else 0
                feature_names = {
                    'vix': 'Volatility (VIX)',
                    'fed_rate': 'Federal Funds Rate',
                    'yield_spread': 'Treasury Yield Spread',
                    'cpi': 'Inflation (CPI)',
                    'unemployment': 'Unemployment Rate'
                }
                display_name = feature_names.get(feature, feature)
                message += f"{i}. {display_name}: {pct:.0f}% variation across episodes\n"

        return message

    def _generate_historical_indicators_note(self, similar_episodes: List[SimilarEpisode]) -> str:
        """Note market indicators that HISTORICALLY PRECEDED regime shifts (VALIDATED).

        IMPORTANT: These indicators came BEFORE transitions in historical data.
        - Does NOT predict future shifts (past ≠ future)
        - Sample size n=16 transitions (very small for pattern recognition)
        - Correlational only (not proven causal)
        - Use as ONE signal among many, not as deterministic predictor

        Args:
            similar_episodes: List of similar episodes

        Returns:
            Historical indicators note (with proper disclaimers)
        """
        # Check if episodes have observed indicators from historical analysis
        episodes_with_indicators = [
            ep for ep in similar_episodes
            if hasattr(ep, 'observed_indicator') and ep.observed_indicator
        ]

        if not episodes_with_indicators:
            return ""

        indicators = set()
        for ep in episodes_with_indicators:
            if hasattr(ep, 'precursor_indicators') and ep.precursor_indicators:
                indicators.update(ep.precursor_indicators.split(','))

        message = "\n📊 **Historical Lead-Lag Indicators** (n=16 transitions):\n"
        message += "(These conditions historically PRECEDED regime shifts. Not predictive.)\n"

        indicator_names = {
            'vix_spike': 'VIX > 34.1 (95th percentile)',
            'yield_inversion': 'Negative yield spread',
            'fed_tightening': 'Fed rate increases',
        }

        for indicator in sorted(indicators):
            if indicator in indicator_names:
                message += f"- {indicator_names[indicator]}\n"

        message += "\n⚠️ **DISCLAIMER**: Historical patterns ≠ future predictions. "
        message += "Sample size (n=16) is too small for reliable forecasting. "
        message += "Use as pattern recognition only."

        return message
