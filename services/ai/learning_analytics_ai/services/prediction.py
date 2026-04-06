"""Load features for specific enrollments and run risk + engagement scoring."""

from __future__ import annotations

import numpy as np
import pandas as pd

from learning_analytics_ai.db import get_engine
from learning_analytics_ai.features.engineering import (
    FEATURE_COLUMNS,
    build_feature_matrix,
    compute_score_trends,
    engagement_score_row,
)
from learning_analytics_ai.features.queries import ASSESSMENT_SERIES_SQL, FEATURE_BASE_SQL
from learning_analytics_ai.models.risk_model import (
    RiskModelBundle,
    default_model_path,
    risk_level_from_score,
)


def load_school_frames(school_id: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    eng = get_engine()
    base = pd.read_sql_query(FEATURE_BASE_SQL, eng, params={"school_id": school_id})
    series = pd.read_sql_query(ASSESSMENT_SERIES_SQL, eng, params={"school_id": school_id})
    return base, series


def build_matrix_for_school(school_id: str) -> pd.DataFrame:
    base, series = load_school_frames(school_id)
    if base.empty:
        return pd.DataFrame()
    trends = compute_score_trends(series)
    return build_feature_matrix(base, trends)


def predict_enrollments(
    df: pd.DataFrame,
    bundle: RiskModelBundle | None,
) -> pd.DataFrame:
    """Add columns risk_score_0_1, risk_level, engagement_score_0_100, top_factors (as JSON)."""
    out = df.copy()
    if df.empty:
        return out

    X = df[FEATURE_COLUMNS].values.astype(float)
    if bundle is not None:
        p_high = bundle.predict_proba_high_risk(X)
        out["risk_score"] = np.round(100 * p_high, 2)
        out["risk_level"] = [risk_level_from_score(float(x)) for x in p_high]
        out["top_factors"] = [bundle.top_factors(X[i : i + 1]) for i in range(len(df))]
    else:
        out["risk_score"] = [None] * len(df)
        out["risk_level"] = ["UNKNOWN"] * len(df)
        out["top_factors"] = [[] for _ in range(len(df))]

    out["engagement_score"] = [engagement_score_row(out.iloc[i]) for i in range(len(out))]
    return out


def filter_pairs(df: pd.DataFrame, pairs: list[tuple[str, str]]) -> pd.DataFrame:
    if df.empty or not pairs:
        return df.iloc[0:0]
    mask = np.zeros(len(df), dtype=bool)
    for sid, cid in pairs:
        mask |= (df["student_id"].astype(str) == sid) & (df["class_id"].astype(str) == cid)
    return df.loc[mask].copy()


def get_bundle() -> RiskModelBundle | None:
    path = default_model_path()
    if not path.exists():
        return None
    return RiskModelBundle.load(path)
