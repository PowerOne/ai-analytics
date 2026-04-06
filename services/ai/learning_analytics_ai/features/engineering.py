"""Pandas transforms: attendance rate, trends, normalized LMS counts, submission rate."""

from __future__ import annotations

import numpy as np
import pandas as pd


FEATURE_COLUMNS = [
    "mean_assessment_pct",
    "score_trend",
    "attendance_rate",
    "lms_event_count_log",
    "submission_rate",
]


def _score_trend(series: pd.Series, dates: pd.Series) -> float:
    """Linear slope of score vs time order; 0 if insufficient points."""
    s = series.dropna()
    if len(s) < 2:
        return 0.0
    t = np.arange(len(s), dtype=float)
    coef = np.polyfit(t, s.values.astype(float), 1)
    return float(coef[0])


def compute_score_trends(series_df: pd.DataFrame) -> pd.DataFrame:
    """From long-format assessment series, compute per (student_id, class_id) trend."""
    if series_df.empty:
        return pd.DataFrame(
            columns=["school_id", "student_id", "class_id", "score_trend"]
        )

    rows: list[dict[str, str | float]] = []
    for (sid, stid, cid), g in series_df.groupby(["school_id", "student_id", "class_id"]):
        g = g.sort_values("submitted_at")
        val = (
            _score_trend(g["score_percent"], g["submitted_at"]) if len(g) >= 2 else 0.0
        )
        rows.append(
            {"school_id": sid, "student_id": stid, "class_id": cid, "score_trend": val}
        )
    return pd.DataFrame(rows)


def build_feature_matrix(base: pd.DataFrame, trends: pd.DataFrame | None) -> pd.DataFrame:
    """Merge SQL aggregates + trends; fill NaNs; derive rates."""
    df = base.copy()
    if trends is not None and not trends.empty:
        df = df.merge(
            trends,
            on=["school_id", "student_id", "class_id"],
            how="left",
        )
    else:
        df["score_trend"] = 0.0

    df["mean_assessment_pct"] = df["mean_assessment_pct"].fillna(50.0)
    df["score_trend"] = df["score_trend"].fillna(0.0)

    att_total = df["attendance_sessions"].fillna(0).clip(lower=0)
    att_ok = df["attendance_present_like"].fillna(0).clip(lower=0)
    df["attendance_rate"] = np.where(att_total > 0, att_ok / att_total, 0.5)

    df["lms_event_count_log"] = np.log1p(df["lms_event_count"].fillna(0))

    asg = df["assignments_count"].fillna(0)
    sub = df["submissions_count"].fillna(0)
    df["submission_rate"] = np.where(asg > 0, (sub / asg).clip(0, 1), 0.5)

    return df


def engagement_score_row(row: pd.Series) -> float:
    """
    Explainable composite 0–100 (not trained; rules-based).
    Weights sum to 1; adjust in product as needed.
    """
    att = float(row.get("attendance_rate", 0.5))
    lms = float(row.get("lms_event_count_log", 0))
    lms_norm = min(1.0, lms / np.log1p(30))
    sub = float(row.get("submission_rate", 0.5))
    perf = float(row.get("mean_assessment_pct", 50)) / 100.0
    return float(
        100.0
        * (
            0.35 * att
            + 0.25 * lms_norm
            + 0.25 * sub
            + 0.15 * perf
        )
    )
