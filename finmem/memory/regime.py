"""
HMM-based market regime detector.

Replaces rule-based waterfall with a Gaussian HMM (Hamilton 1989) fitted on
6 daily features: [spy_return_1d, rolling_vol_21d, vix, cpi, fed_rate, yield_spread].

After fitting, each latent state is mapped to a regime label by comparing
emission means along interpretable axes (vol, return, macro). The mapping is
deterministic given the fitted means — no thresholds are hand-coded.

Reference: Hamilton, J.D. (1989). A new approach to the economic analysis of
nonstationary time series and the business cycle. Econometrica, 57(2), 357-384.

Usage:
  fit_and_save(df)                     # during ingest
  predict_sequence_regime(df, s, e)    # episode labeling (majority vote over date range)
  predict_state_regime(state)          # live query (single-observation prediction)
"""

import os
import pickle
import numpy as np
import pandas as pd
from hmmlearn.hmm import GaussianHMM
from sklearn.preprocessing import StandardScaler

MODEL_PATH = os.path.join(os.path.dirname(__file__), "hmm_regime.pkl")

FEATURES = ["spy_return_1d", "rolling_vol_21d", "vix", "cpi", "fed_rate", "yield_spread"]
N_COMPONENTS = 7  # one per target label

_cache: dict | None = None  # {model, scaler, state_map}


# ── public API ────────────────────────────────────────────────────────────────

def fit_and_save(df: pd.DataFrame) -> None:
    """Fit GaussianHMM on full historical dataframe and save to disk."""
    global _cache
    X, _ = _features(df)
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    model = GaussianHMM(
        n_components=N_COMPONENTS,
        covariance_type="full",
        n_iter=500,
        random_state=42,
        verbose=False,
    )
    model.fit(Xs)

    state_map = _map_states(model, scaler)
    _cache = {"model": model, "scaler": scaler, "state_map": state_map}

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(_cache, f)


def predict_sequence_regime(df: pd.DataFrame, start_date, end_date) -> str:
    """
    Predict regime for an episode date range via majority vote.
    Uses the full daily sequence — the correct way to query an HMM.
    """
    _load()
    if _cache is None:
        return "STABLE"

    mask = (df.index >= pd.Timestamp(start_date)) & (df.index <= pd.Timestamp(end_date))
    chunk = df[mask][FEATURES].dropna()
    if len(chunk) < 2:
        return "STABLE"

    Xs = _cache["scaler"].transform(chunk.values)
    states = _cache["model"].predict(Xs)
    dominant = int(np.bincount(states).argmax())
    return _cache["state_map"].get(dominant, "STABLE")


def predict_state_regime(state) -> str:
    """
    Predict regime for current MarketState (single observation).
    Used for live regime display and retrieval reranking bonus.
    """
    _load()
    if _cache is None:
        return "STABLE"

    obs = np.array([[
        state.spy_return_1d,    # must match training feature: daily return
        state.rolling_vol_21d,
        state.vix,
        state.cpi,
        state.fed_rate,
        state.yield_spread,
    ]])
    Xs = _cache["scaler"].transform(obs)
    state_id = int(_cache["model"].predict(Xs)[0])
    return _cache["state_map"].get(state_id, "STABLE")


def is_fitted() -> bool:
    return os.path.exists(MODEL_PATH)


# ── internal ──────────────────────────────────────────────────────────────────

def _load() -> None:
    global _cache
    if _cache is not None:
        return
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            _cache = pickle.load(f)


def _features(df: pd.DataFrame) -> tuple[np.ndarray, pd.DatetimeIndex]:
    sub = df[FEATURES].dropna()
    return sub.values, sub.index


def _map_states(model: GaussianHMM, scaler: StandardScaler) -> dict[int, str]:
    """
    Deterministically map each HMM state to a regime label by inspecting
    emission means in the original (unscaled) feature space.

    Feature indices:
      0: spy_return_1d   1: rolling_vol_21d   2: vix
      3: cpi             4: fed_rate          5: yield_spread
    """
    # Un-scale means back to original space for interpretability
    means_orig = scaler.inverse_transform(model.means_)

    chars = [
        {
            "state":   i,
            "ret":     means_orig[i, 0],
            "vol":     means_orig[i, 1],
            "vix":     means_orig[i, 2],
            "cpi":     means_orig[i, 3],
            "fed":     means_orig[i, 4],
            "spread":  means_orig[i, 5],
        }
        for i in range(N_COMPONENTS)
    ]

    assigned: dict[int, str] = {}
    remaining = list(range(N_COMPONENTS))

    def _pick(key_fn, pool):
        best = max(pool, key=key_fn)
        return best["state"]

    def _assign(state_id: int, label: str):
        assigned[state_id] = label
        remaining.remove(state_id)

    pool = chars  # alias for clarity

    # CRISIS: highest VIX (panic, extreme vol event)
    _assign(_pick(lambda c: c["vix"], pool), "CRISIS")

    pool = [c for c in chars if c["state"] in remaining]

    # SELLOFF: among remaining, highest vol + most negative return
    _assign(_pick(lambda c: c["vol"] - c["ret"] * 10, pool), "SELLOFF")

    pool = [c for c in chars if c["state"] in remaining]

    # TIGHTENING: highest CPI + highest fed rate (inflation + policy)
    _assign(_pick(lambda c: c["cpi"] + c["fed"], pool), "TIGHTENING")

    pool = [c for c in chars if c["state"] in remaining]

    # TIGHTENING+SLOWDOWN: most negative yield spread (inversion)
    _assign(_pick(lambda c: -c["spread"], pool), "TIGHTENING+SLOWDOWN")

    pool = [c for c in chars if c["state"] in remaining]

    # BULL: highest return + lowest vol
    _assign(_pick(lambda c: c["ret"] - c["vol"], pool), "BULL")

    pool = [c for c in chars if c["state"] in remaining]

    # EASING+RECOVERY: lowest fed rate + positive return
    _assign(_pick(lambda c: -c["fed"] + c["ret"], pool), "EASING+RECOVERY")

    pool = [c for c in chars if c["state"] in remaining]

    # STABLE: whatever remains
    for c in pool:
        assigned[c["state"]] = "STABLE"

    return assigned
