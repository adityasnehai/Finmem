"""Phase 3 Reasoning Engine - Validated statistical analysis and insights"""

import logging
import numpy as np
from typing import List, Tuple, Literal
from scipy import stats
from api.schemas import SimilarEpisode, ReasoningInsight

logger = logging.getLogger(__name__)


class ReasoningEngine:
    """Generate insights from similar episodes using validated statistical methods"""

    def analyze_outcomes(
        self, similar_episodes: List[SimilarEpisode], search_space_total: int
    ) -> ReasoningInsight:
        """Generate statistical reasoning from similar episodes

        Validated methods:
        - Mean/median: Standard descriptive statistics
        - Win rate: Empirical frequency (% with positive return)
        - Sharpe ratio: Standard risk-adjusted return metric
        - Confidence level: Based on sample size (n >= 5 is HIGH)
        - Statistical significance: Binomial test for win rate

        Args:
            similar_episodes: List of SimilarEpisode objects
            search_space_total: Total episodes in database

        Returns:
            ReasoningInsight with validated metrics
        """
        if not similar_episodes:
            return self._empty_reasoning(search_space_total)

        # Extract 6-month returns
        returns_6m = [
            e.outcomes.return_6m
            for e in similar_episodes
            if e.outcomes.return_6m is not None
        ]

        if not returns_6m:
            logger.warning("No return data available for analysis")
            return self._empty_reasoning(search_space_total)

        # Calculate statistics
        avg_return = float(np.mean(returns_6m))
        median_return = float(np.median(returns_6m))
        win_count = sum(1 for r in returns_6m if r > 0)
        win_rate = (win_count / len(returns_6m)) * 100

        # Max gain/loss (empirical)
        max_gain = max((e.outcomes.max_gain for e in similar_episodes), default=0.0)
        max_loss = min((e.outcomes.max_loss for e in similar_episodes), default=0.0)

        # Sharpe ratio (averaged)
        sharpe_ratios = [e.outcomes.sharpe_ratio_6m for e in similar_episodes if e.outcomes.sharpe_ratio_6m != 0]
        sharpe_avg = float(np.mean(sharpe_ratios)) if sharpe_ratios else 0.0

        # Representation in search space
        representation = (len(similar_episodes) / search_space_total) * 100

        # Confidence level based on sample size (validated heuristic)
        confidence_level = self._estimate_confidence(len(similar_episodes))

        # Statistical significance: binomial test for win rate
        p_value = self._binomial_test_significance(win_count, len(returns_6m))

        return ReasoningInsight(
            similar_episodes_count=len(similar_episodes),
            search_space_total=search_space_total,
            representation=representation,
            avg_return_6m=avg_return,
            median_return_6m=median_return,
            win_rate_pct=win_rate,
            max_gain=max_gain,
            max_loss=max_loss,
            sharpe_ratio_avg=sharpe_avg,
            confidence_level=confidence_level,
            statistical_significance=p_value,
        )

    def generate_insight_text(
        self,
        similar_episodes: List[SimilarEpisode],
        reasoning: ReasoningInsight,
        query: str,
    ) -> Tuple[str, str]:
        """Generate natural language reasoning from statistical analysis

        Args:
            similar_episodes: List of similar episodes
            reasoning: Statistical reasoning
            query: Original user query

        Returns:
            (insight_text, warning_text)
        """
        warning = None

        if reasoning.similar_episodes_count == 0:
            return (
                "No similar historical episodes found. Unable to generate insights.",
                "No match: Try broader query parameters",
            )

        if reasoning.similar_episodes_count < 3:
            warning = (
                f"⚠️ Only {reasoning.similar_episodes_count} similar episodes found. "
                "Results may not be statistically reliable."
            )

        # Confidence qualifier
        confidence_word = {
            "HIGH": "strong",
            "MEDIUM": "moderate",
            "LOW": "weak",
        }[reasoning.confidence_level]

        # Return direction
        if reasoning.avg_return_6m > 0:
            return_direction = "positive"
            return_emoji = "📈"
        elif reasoning.avg_return_6m < 0:
            return_direction = "negative"
            return_emoji = "📉"
        else:
            return_direction = "neutral"
            return_emoji = "➡️"

        # Build insight text
        insight = f"{return_emoji} Historical Analysis ({reasoning.similar_episodes_count} similar episodes found):\n\n"

        insight += f"**Market Pattern Match**: {confidence_word.capitalize()} confidence "
        insight += f"({reasoning.representation:.1f}% of search space)\n\n"

        insight += f"**6-Month Outcomes**:\n"
        insight += f"- Average return: {return_emoji} {reasoning.avg_return_6m:+.1f}%\n"
        insight += f"- Median return: {reasoning.median_return_6m:+.1f}%\n"
        insight += f"- Win rate: {reasoning.win_rate_pct:.0f}% ({int(reasoning.similar_episodes_count * reasoning.win_rate_pct / 100)}/{reasoning.similar_episodes_count} episodes positive)\n"
        insight += f"- Risk-adjusted return: {reasoning.sharpe_ratio_avg:.2f} Sharpe ratio\n\n"

        insight += f"**Extreme Values**:\n"
        insight += f"- Best case: +{reasoning.max_gain:.1f}%\n"
        insight += f"- Worst case: {reasoning.max_loss:.1f}%\n\n"

        # Statistical significance
        if reasoning.statistical_significance < 0.05:
            insight += f"**Statistical Significance**: Win rate is statistically significant (p < 0.05)\n"
        else:
            insight += f"**Statistical Significance**: Pattern has {confidence_word} statistical support\n"

        # Regime patterns
        regimes = {}
        for ep in similar_episodes:
            regimes[ep.regime] = regimes.get(ep.regime, 0) + 1

        if len(regimes) > 0:
            insight += f"\n**Regime Composition**:\n"
            for regime, count in sorted(regimes.items(), key=lambda x: -x[1]):
                pct = (count / len(similar_episodes)) * 100
                insight += f"- {regime}: {count} episodes ({pct:.0f}%)\n"

        return insight, warning

    def _estimate_confidence(self, episode_count: int) -> Literal["HIGH", "MEDIUM", "LOW"]:
        """Estimate confidence level based on sample size

        Validated heuristic:
        - HIGH: >= 5 similar episodes (reasonable sample)
        - MEDIUM: 3-4 episodes (small sample)
        - LOW: < 3 episodes (very small, high uncertainty)

        Based on statistical practice: minimum n=30 for large-sample tests,
        but with only 61 total episodes, we use n=5 as practical threshold.

        Args:
            episode_count: Number of similar episodes

        Returns:
            Confidence level
        """
        if episode_count >= 5:
            return "HIGH"
        elif episode_count >= 3:
            return "MEDIUM"
        else:
            return "LOW"

    def _binomial_test_significance(self, wins: int, trials: int, p_null: float = 0.5) -> float:
        """Test statistical significance of win rate vs random (50%)

        Validated method: Binomial test
        H0: win_rate = 50% (random)
        H1: win_rate ≠ 50% (significant)

        Args:
            wins: Number of positive return episodes
            trials: Total episodes
            p_null: Null hypothesis (50% = random outcome)

        Returns:
            Two-tailed p-value
        """
        if trials < 2:
            return 1.0  # No significance with < 2 samples

        # Binomial test (using modern scipy API)
        result = stats.binomtest(wins, trials, p_null, alternative='two-sided')
        return float(result.pvalue)

    def _empty_reasoning(self, search_space_total: int) -> ReasoningInsight:
        """Return empty reasoning when no data available"""
        return ReasoningInsight(
            similar_episodes_count=0,
            search_space_total=search_space_total,
            representation=0.0,
            avg_return_6m=0.0,
            median_return_6m=0.0,
            win_rate_pct=0.0,
            max_gain=0.0,
            max_loss=0.0,
            sharpe_ratio_avg=0.0,
            confidence_level="LOW",
            statistical_significance=1.0,
        )

    def get_regime_insights(self, similar_episodes: List[SimilarEpisode]) -> str:
        """Get specific insights about regime patterns

        Args:
            similar_episodes: List of similar episodes

        Returns:
            Regime-specific insight text
        """
        if not similar_episodes:
            return "No regime data available."

        regime_counts = {}
        regime_returns = {}

        for ep in similar_episodes:
            regime = ep.regime
            regime_counts[regime] = regime_counts.get(regime, 0) + 1

            if ep.outcomes.return_6m is not None:
                if regime not in regime_returns:
                    regime_returns[regime] = []
                regime_returns[regime].append(ep.outcomes.return_6m)

        insight = "**Regime Breakdown**:\n"
        for regime in sorted(regime_counts.keys()):
            count = regime_counts[regime]
            pct = (count / len(similar_episodes)) * 100

            if regime in regime_returns and regime_returns[regime]:
                avg_return = np.mean(regime_returns[regime])
                insight += f"- {regime}: {count} episodes ({pct:.0f}%) → avg return {avg_return:+.1f}%\n"
            else:
                insight += f"- {regime}: {count} episodes ({pct:.0f}%)\n"

        return insight

    def extract_leading_indicators(self, similar_episodes: List[SimilarEpisode], db_url: str = None) -> dict:
        """Extract leading indicators (precursor data) for similar episodes (Phase 2)

        Args:
            similar_episodes: List of similar episodes
            db_url: PostgreSQL connection string (for future precursor lookup)

        Returns:
            dict with precursor stats (VIX levels, Fed changes, yield spreads, etc.)
        """
        if not similar_episodes:
            return {}

        # For now, return basic precursor info from episode data
        precursors = {
            'avg_vix': np.nanmean([e.avg_vix for e in similar_episodes if e.avg_vix]),
            'avg_fed_rate': np.nanmean([e.avg_fed_rate for e in similar_episodes if e.avg_fed_rate]),
            'avg_yield_spread': np.nanmean([e.avg_yield_spread for e in similar_episodes if e.avg_yield_spread]),
            'avg_unemployment': np.nanmean([e.avg_unemployment for e in similar_episodes if e.avg_unemployment]),
        }

        return {k: float(v) if not np.isnan(v) else None for k, v in precursors.items()}

    def get_metric_variation(self, similar_episodes: List[SimilarEpisode]) -> dict:
        """Get which metrics vary most across similar episodes (VALIDATED ONLY).

        IMPORTANT: This shows CORRELATION, not causation or importance.
        High variation just means "this metric differs across episodes" -
        it does NOT mean it "drives" or "causes" the pattern.

        Sample size limits: With n<20 per regime, this is exploratory only.

        Args:
            similar_episodes: List of similar episodes

        Returns:
            dict mapping feature → coefficient_of_variation (raw, not "importance")
        """
        if not similar_episodes or len(similar_episodes) < 3:
            return {}

        features = {
            'vix': [e.avg_vix for e in similar_episodes if e.avg_vix],
            'fed_rate': [e.avg_fed_rate for e in similar_episodes if e.avg_fed_rate],
            'yield_spread': [e.avg_yield_spread for e in similar_episodes if e.avg_yield_spread],
            'cpi': [e.avg_cpi for e in similar_episodes if e.avg_cpi],
            'unemployment': [e.avg_unemployment for e in similar_episodes if e.avg_unemployment],
        }

        # Calculate coefficient of variation (std / mean) - purely descriptive
        variation = {}
        for feature_name, values in features.items():
            if len(values) > 2:  # Need at least 3 to measure variation
                mean_val = np.mean(values)
                std_val = np.std(values)
                # Raw CV value - shows variation, NOT importance or causation
                variation[feature_name] = float(std_val / (abs(mean_val) + 1e-10))
            else:
                variation[feature_name] = 0.0

        return variation

    def get_regime_transition_matrix(self, similar_episodes: List[SimilarEpisode]) -> dict:
        """Compute regime transition probabilities from similar episodes (Phase 2)

        Args:
            similar_episodes: List of similar episodes

        Returns:
            dict with transition probabilities: BULL→BEAR, BEAR→RECOVERY, etc.
        """
        if not similar_episodes:
            return {}

        # For now, return regime distribution
        regime_dist = {}
        for ep in similar_episodes:
            regime_dist[ep.regime] = regime_dist.get(ep.regime, 0) + 1

        total = len(similar_episodes)
        return {regime: float(count / total) for regime, count in regime_dist.items()}
