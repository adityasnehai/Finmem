"""Phase 3 Query Engine - Hybrid semantic + metadata search"""

import logging
import lancedb
import numpy as np
import psycopg
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from api.similarity_search import init_search_engine, encode_text
from api.schemas import SimilarEpisode, EpisodeOutcome

logger = logging.getLogger(__name__)


class QueryEngine:
    """Query engine for finding similar episodes and generating reasoning"""

    def __init__(self, db_url: str, lancedb_path: str = "./finmem_lancedb"):
        self.db_url = db_url
        self.lancedb_path = lancedb_path
        self._lancedb = None
        self._postgres_conn = None

    def connect(self):
        """Initialize connections to LanceDB and PostgreSQL"""
        init_search_engine()
        self._lancedb = lancedb.connect(self.lancedb_path)
        self._postgres_conn = psycopg.connect(self.db_url)
        logger.info("Query engine connected to LanceDB and PostgreSQL")

    def close(self):
        """Close connections"""
        if self._postgres_conn:
            self._postgres_conn.close()

    def semantic_search(
        self, query_text: str, top_k: int = 5, min_confidence: float = 0.5
    ) -> List[Dict]:
        """Search by semantic similarity (text query → embedding → similar episodes)

        Args:
            query_text: Natural language query about market conditions
            top_k: Number of results to return
            min_confidence: Minimum confidence threshold (0-1)

        Returns:
            List of similar episodes with similarity scores
        """
        try:
            # Encode query to embedding (using FinBERT from Phase 2)
            query_embedding = encode_text(query_text)

            # Search LanceDB (returns L2 distance)
            table = self._lancedb.open_table("episodes")
            results = table.search(query_embedding).limit(top_k * 2).to_list()

            # Convert L2 distance to confidence score
            # For normalized vectors: similarity = 1 / (1 + L2_distance)
            # This gives higher scores to smaller distances
            filtered = []
            for result in results:
                l2_distance = result['_distance']
                # Convert L2 distance to similarity score (0-100)
                # Smaller L2 distance = higher similarity
                similarity = 1.0 / (1.0 + l2_distance / 768.0)  # Normalize by dimension
                confidence = similarity * 100

                if confidence >= min_confidence * 100:
                    filtered.append({
                        'episode_id': result['episode_id'],
                        'regime': result['regime'],
                        'start_date': result['start_date'],
                        'end_date': result['end_date'],
                        'l2_distance': l2_distance,
                        'similarity_score': confidence,
                        'avg_vix': result.get('avg_vix'),
                        'avg_cpi': result.get('avg_cpi'),
                        'avg_fed_rate': result.get('avg_fed_rate'),
                    })

            return filtered[:top_k]

        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return []

    def metadata_filter(
        self,
        regime: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> List[int]:
        """Get episode IDs matching metadata filters

        Args:
            regime: Filter by regime (BULL, BEAR, etc.)
            date_from: Start date (YYYY-MM-DD)
            date_to: End date (YYYY-MM-DD)

        Returns:
            List of matching episode IDs
        """
        try:
            cur = self._postgres_conn.cursor()

            query = "SELECT id FROM episodes WHERE 1=1"
            params = []

            if regime:
                query += " AND regime = %s"
                params.append(regime)

            if date_from:
                query += " AND start_date >= %s"
                params.append(date_from)

            if date_to:
                query += " AND end_date <= %s"
                params.append(date_to)

            cur.execute(query, params)
            results = cur.fetchall()
            cur.close()

            return [row[0] for row in results]

        except Exception as e:
            logger.error(f"Metadata filter failed: {e}")
            return []

    def hybrid_search(
        self,
        query_text: str,
        top_k: int = 5,
        min_confidence: float = 0.5,
        regime: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> List[Dict]:
        """Hybrid search: semantic similarity + metadata filters

        Algorithm:
        1. Get semantic search results (top_k * 2 candidates)
        2. Filter by metadata (regime, date range)
        3. Return top_k matching both criteria

        Args:
            query_text: Natural language query
            top_k: Results to return
            min_confidence: Minimum confidence threshold
            regime: Optional regime filter
            date_from: Optional start date
            date_to: Optional end date

        Returns:
            Top-K episodes matching both semantic + metadata criteria
        """
        # Get semantic search candidates
        semantic_results = self.semantic_search(query_text, top_k * 3, min_confidence)

        if not semantic_results:
            logger.warning("No semantic search results found")
            return []

        # Get metadata filter if specified
        if regime or date_from or date_to:
            allowed_ids = set(self.metadata_filter(regime, date_from, date_to))
            semantic_results = [r for r in semantic_results if r['episode_id'] in allowed_ids]

        return semantic_results[:top_k]

    def get_episode_outcomes(self, episode_id: int) -> Tuple[Dict, int]:
        """Get outcome metrics for an episode from PostgreSQL

        Returns:
            (outcome_dict, duration_days)
        """
        try:
            cur = self._postgres_conn.cursor()

            cur.execute("""
                SELECT id, start_date, end_date, total_return, max_drawdown,
                       spy_return_6m_after
                FROM episodes
                WHERE id = %s
            """, (episode_id,))

            row = cur.fetchone()
            cur.close()

            if not row:
                return {}, 0

            ep_id, start_date, end_date, total_return, max_drawdown, spy_return_6m = row

            duration_days = (end_date - start_date).days

            return {
                'return_6m': spy_return_6m,  # Only 6m forward return available in current schema
                'max_gain': max(0, total_return),
                'max_loss': min(0, total_return),
                'total_return': total_return,
                'max_drawdown': max_drawdown,
            }, duration_days

        except Exception as e:
            logger.error(f"Failed to get episode outcomes: {e}")
            return {}, 0

    def build_similar_episodes(
        self, semantic_results: List[Dict], search_space_total: int
    ) -> List[SimilarEpisode]:
        """Convert semantic search results to SimilarEpisode objects with outcomes

        Args:
            semantic_results: Output from hybrid_search
            search_space_total: Total episodes in database

        Returns:
            List of SimilarEpisode with validated outcomes
        """
        episodes = []

        for result in semantic_results:
            outcomes_dict, duration = self.get_episode_outcomes(result['episode_id'])

            if not outcomes_dict:
                continue

            outcome = EpisodeOutcome(
                return_6m=outcomes_dict.get('return_6m'),
                max_gain=outcomes_dict['max_gain'],
                max_loss=outcomes_dict['max_loss'],
                sharpe_ratio_6m=self._calculate_sharpe(
                    outcomes_dict.get('return_6m'),
                    outcomes_dict.get('max_drawdown'),
                ),
            )

            episode = SimilarEpisode(
                episode_id=result['episode_id'],
                regime=result['regime'],
                start_date=result['start_date'],
                end_date=result['end_date'],
                duration_days=duration,
                avg_vix=result.get('avg_vix'),
                avg_cpi=result.get('avg_cpi'),
                avg_fed_rate=result.get('avg_fed_rate'),
                similarity_score=result['similarity_score'],
                l2_distance=result['l2_distance'],
                outcomes=outcome,
            )

            episodes.append(episode)

        return episodes

    def _calculate_sharpe(self, return_pct: Optional[float], max_drawdown: Optional[float]) -> float:
        """Calculate Sharpe ratio from return and max drawdown

        Validated approach: Use max_drawdown as volatility proxy
        Sharpe = return / max_drawdown (both as %)
        Risk-free rate approximation: already subtracted in empirical returns

        Args:
            return_pct: 6-month return (%)
            max_drawdown: Maximum drawdown during period (%)

        Returns:
            Sharpe ratio (or 0 if data unavailable)
        """
        if return_pct is None or max_drawdown is None or max_drawdown == 0:
            return 0.0

        # Avoid division by zero, use absolute value of drawdown
        volatility = abs(max_drawdown)
        if volatility < 0.1:  # Too small, avoid spurious Sharpe
            return 0.0

        sharpe = return_pct / volatility
        return float(np.clip(sharpe, -10, 10))  # Reasonable bounds

    def get_regime_distribution(self) -> Dict[str, int]:
        """Get distribution of regimes in database

        Returns:
            Dict of regime -> count
        """
        try:
            cur = self._postgres_conn.cursor()
            cur.execute("""
                SELECT regime, COUNT(*) as count
                FROM episodes
                GROUP BY regime
                ORDER BY count DESC
            """)

            results = cur.fetchall()
            cur.close()

            return {row[0]: row[1] for row in results}

        except Exception as e:
            logger.error(f"Failed to get regime distribution: {e}")
            return {}

    def get_total_episodes(self) -> int:
        """Get total number of episodes in database"""
        try:
            cur = self._postgres_conn.cursor()
            cur.execute("SELECT COUNT(*) FROM episodes")
            count = cur.fetchone()[0]
            cur.close()
            return count
        except Exception as e:
            logger.error(f"Failed to get episode count: {e}")
            return 0

    def get_historical_indicators(self, episode_id: int) -> Dict:
        """Get market indicators that PRECEDED a regime shift (VALIDATED HISTORICAL PATTERN).

        IMPORTANT: These are market conditions observed BEFORE transitions in historical data.
        This does NOT prove causation - only correlation. Sample size n=16 transitions.

        Args:
            episode_id: ID of the episode

        Returns:
            Dict with lead-lag indicators (VIX, Fed rate, yield spread, etc.)
        """
        try:
            cur = self._postgres_conn.cursor()
            cur.execute("""
                SELECT shift_from_regime, shift_to_regime, shift_date,
                       vix_5d_avg, vix_10d_avg, vix_20d_avg, vix_spike_pct,
                       returns_5d, returns_10d, returns_20d,
                       yield_spread_5d, yield_inversion_depth,
                       cpi_change_pct, fed_rate_change_bps,
                       vix_spike_detected, yield_inversion_detected, fed_tightening
                FROM historical_regime_indicators
                WHERE episode_id = %s
            """, (episode_id,))

            row = cur.fetchone()
            cur.close()

            if not row:
                return {}

            return {
                'shift_from_regime': row[0],
                'shift_to_regime': row[1],
                'shift_date': str(row[2]),
                'vix_5d_avg': row[3],
                'vix_10d_avg': row[4],
                'vix_20d_avg': row[5],
                'vix_spike_pct': row[6],
                'returns_5d': row[7],
                'returns_10d': row[8],
                'returns_20d': row[9],
                'yield_spread_5d': row[10],
                'yield_inversion_depth': row[11],
                'cpi_change_pct': row[12],
                'fed_rate_change_bps': row[13],
                'vix_spike_detected': row[14],
                'yield_inversion_detected': row[15],
                'fed_tightening': row[16],
            }

        except Exception as e:
            logger.error(f"Failed to get precursors for episode {episode_id}: {e}")
            return {}

    def get_regime_transition_frequencies(self) -> Dict[str, Dict[str, float]]:
        """Get historical regime transition FREQUENCIES (VALIDATED HISTORICAL DATA ONLY).

        IMPORTANT LIMITATIONS:
        - Based on n=16 transitions across 35+ years
        - Shows what happened historically, NOT what will happen
        - Sample too small for reliable probability estimation
        - Does NOT account for regime-specific drivers or market structure changes

        Returns:
            Dict mapping "FROM_REGIME" → {"TO_REGIME": observed_frequency, ...}
        """
        try:
            cur = self._postgres_conn.cursor()
            cur.execute("""
                SELECT shift_from_regime, shift_to_regime, COUNT(*) as count
                FROM historical_regime_indicators
                GROUP BY shift_from_regime, shift_to_regime
            """)

            rows = cur.fetchall()
            cur.close()

            # Build transition matrix
            transitions = {}
            for from_regime, to_regime, count in rows:
                if from_regime not in transitions:
                    transitions[from_regime] = {}
                transitions[from_regime][to_regime] = count

            # Convert counts to probabilities
            for from_regime in transitions:
                total = sum(transitions[from_regime].values())
                for to_regime in transitions[from_regime]:
                    transitions[from_regime][to_regime] = float(
                        transitions[from_regime][to_regime] / total
                    )

            return transitions

        except Exception as e:
            logger.error(f"Failed to get regime transition matrix: {e}")
            return {}

    def get_indicator_frequencies(self, similar_episodes: List[SimilarEpisode]) -> Dict:
        """Get frequency of market indicators BEFORE similar episodes (VALIDATED HISTORICAL).

        IMPORTANT: Shows what indicators were present BEFORE transitions, not what causes them.
        - Based on n=16 historical transitions
        - Frequencies (what % had VIX spike) are valid
        - Causal claims ("these cause shifts") are NOT valid

        Args:
            similar_episodes: List of similar episodes

        Returns:
            Dict with indicator frequencies and market condition stats
        """
        indicators = []
        for episode in similar_episodes:
            indicator_data = self.get_historical_indicators(episode.episode_id)
            if indicator_data:
                indicators.append(indicator_data)

        if not indicators:
            return {}

        # Calculate frequencies and aggregate statistics (all validated, no causal claims)
        summary = {
            'episodes_analyzed': len(indicators),
            'vix_spike_frequency': sum(1 for p in indicators if p.get('vix_spike_detected')) / len(indicators),
            'yield_inversion_frequency': sum(1 for p in indicators if p.get('yield_inversion_detected')) / len(indicators),
            'fed_tightening_frequency': sum(1 for p in indicators if p.get('fed_tightening')) / len(indicators),
            'avg_vix_5d_before_shift': float(np.mean([p.get('vix_5d_avg', 0) for p in indicators if p.get('vix_5d_avg')])),
            'avg_market_returns_5d': float(np.mean([p.get('returns_5d', 0) for p in indicators if p.get('returns_5d')])),
            'note': 'Frequencies show what historically preceded shifts (n=16). Not predictive.'
        }

        return summary
