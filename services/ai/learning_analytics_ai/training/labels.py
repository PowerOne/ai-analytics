"""Derive risk labels from a proxy for final grade (mean assessment %) or future transcript columns."""

from __future__ import annotations

import numpy as np
import pandas as pd

from learning_analytics_ai.config import settings


def proxy_final_grade_pct(df: pd.DataFrame) -> pd.Series:
    """
    When `enrollments.final_grade_points` exists in DB, switch training SQL to use it.
    For now: mean_assessment_pct is the proxy for end-of-term performance.
    """
    return df["mean_assessment_pct"].astype(float)


def assign_risk_class(proxy: pd.Series) -> np.ndarray:
    """3-class: 0=LOW, 1=MEDIUM, 2=HIGH risk (HIGH = low grades)."""
    hi = settings.risk_high_threshold
    med = settings.risk_medium_threshold
    return np.select([proxy < hi, proxy < med], [2, 1], default=0)
