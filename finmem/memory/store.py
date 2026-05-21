import os
import lancedb
import pyarrow as pa
import numpy as np
import pandas as pd
from rich.console import Console
from finmem.data.schemas import Episode
from finmem.memory.embeddings import embed_episode, EMBED_DIM

console  = Console()
DB_PATH  = os.path.join(os.path.dirname(__file__), "..", "..", "finmem_db")
TBL_NAME = "episodes"

# Module-level cache: recomputed only when episodes are re-indexed
_whitened_cache: tuple[np.ndarray, pd.DataFrame, np.ndarray, np.ndarray] | None = None


def get_whitened_state() -> tuple[np.ndarray, pd.DataFrame, np.ndarray, np.ndarray]:
    """
    Returns (whitened_vecs, df, mean_vec, top_pcs).

    Applies all-but-the-top postprocessing (Mu & Viswanath, ICLR 2018) to the
    stored 519-dim hybrid embeddings (512-dim Matryoshka text + 7 structural).
    Removes the dominant principal component — the global 'financial episode'
    direction — and re-normalises, producing an isotropic space where cosine
    similarity is actually discriminative.

    Cached in memory; invalidated by store_episodes().
    """
    global _whitened_cache
    if _whitened_cache is not None:
        return _whitened_cache

    from sklearn.decomposition import PCA

    tbl = get_table()
    df  = tbl.to_pandas().reset_index(drop=True)
    vecs = np.stack(df["vector"].values).astype(np.float32)

    mean_vec = vecs.mean(axis=0)
    centered = vecs - mean_vec

    pca = PCA(n_components=1, random_state=42)
    pca.fit(centered)
    top_pcs = pca.components_  # shape (1, EMBED_DIM)

    proj     = centered @ top_pcs.T @ top_pcs
    whitened = centered - proj
    norms    = np.linalg.norm(whitened, axis=1, keepdims=True)
    whitened = (whitened / np.where(norms < 1e-8, 1.0, norms)).astype(np.float32)

    _whitened_cache = (whitened, df, mean_vec, top_pcs)
    return _whitened_cache


def _schema() -> pa.Schema:
    return pa.schema([
        pa.field("id",               pa.string()),
        pa.field("start_date",       pa.string()),
        pa.field("end_date",         pa.string()),
        pa.field("duration_days",    pa.int32()),
        pa.field("avg_daily_return", pa.float32()),
        pa.field("total_return",     pa.float32()),
        pa.field("max_drawdown",     pa.float32()),
        pa.field("rolling_vol",      pa.float32()),
        pa.field("vix_level",        pa.float32()),
        pa.field("cpi",              pa.float32()),
        pa.field("fed_rate",         pa.float32()),
        pa.field("yield_spread",     pa.float32()),
        pa.field("unemployment",     pa.float32()),
        pa.field("spy_return_1m_after", pa.float32()),
        pa.field("spy_return_3m_after", pa.float32()),
        pa.field("spy_return_6m_after", pa.float32()),
        pa.field("regime",           pa.string()),
        pa.field("prose_summary",    pa.string()),
        pa.field("vector",           pa.list_(pa.float32(), EMBED_DIM)),
    ])


def get_table():
    db = lancedb.connect(DB_PATH)
    if TBL_NAME in db.table_names():
        return db.open_table(TBL_NAME)
    return db.create_table(TBL_NAME, schema=_schema())


def store_episodes(episodes: list[Episode]) -> None:
    db    = lancedb.connect(DB_PATH)
    rows  = []
    console.print(f"[cyan]Embedding and storing {len(episodes)} episodes...[/cyan]")
    for ep in episodes:
        vec = embed_episode(ep)
        rows.append({
            "id":                  ep.id,
            "start_date":          str(ep.start_date),
            "end_date":            str(ep.end_date),
            "duration_days":       ep.duration_days,
            "avg_daily_return":    ep.avg_daily_return,
            "total_return":        ep.total_return,
            "max_drawdown":        ep.max_drawdown,
            "rolling_vol":         ep.rolling_vol,
            "vix_level":           ep.vix_level,
            "cpi":                 ep.cpi,
            "fed_rate":            ep.fed_rate,
            "yield_spread":        ep.yield_spread,
            "unemployment":        ep.unemployment,
            "spy_return_1m_after": ep.spy_return_1m_after or 0.0,
            "spy_return_3m_after": ep.spy_return_3m_after or 0.0,
            "spy_return_6m_after": ep.spy_return_6m_after or 0.0,
            "regime":              ep.regime,
            "prose_summary":       ep.prose_summary,
            "vector":              vec.tolist(),
        })

    if TBL_NAME in db.table_names():
        db.drop_table(TBL_NAME)
    tbl = db.create_table(TBL_NAME, data=rows, schema=_schema())
    console.print(f"[green]Stored {len(rows)} episodes in LanceDB[/green]")
    global _whitened_cache
    _whitened_cache = None  # invalidate on re-index
    return tbl


def count_episodes() -> int:
    try:
        tbl = get_table()
        return tbl.count_rows()
    except Exception:
        return 0


def episode_date_range() -> tuple[str, str]:
    try:
        tbl = get_table()
        df  = tbl.to_pandas()[["start_date", "end_date"]]
        if df.empty:
            return "", ""
        s = df["start_date"].min()
        e = df["end_date"].max()
        import pandas as pd
        if pd.isna(s) or pd.isna(e):
            return "", ""
        return str(s), str(e)
    except Exception:
        return "", ""
