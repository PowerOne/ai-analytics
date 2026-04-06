"""
Offline training: load features for a school, derive labels, fit GradientBoosting, save artifact.

Usage:
  DATABASE_URL=... python -m learning_analytics_ai.training.train_risk --school-id <uuid>
"""

from __future__ import annotations

import argparse
import json

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

from learning_analytics_ai.config import settings
from learning_analytics_ai.db import get_engine
from learning_analytics_ai.features.engineering import (
    FEATURE_COLUMNS,
    build_feature_matrix,
    compute_score_trends,
)
from learning_analytics_ai.features.queries import ASSESSMENT_SERIES_SQL, FEATURE_BASE_SQL
from learning_analytics_ai.models.risk_model import RiskModelBundle, default_model_path
from learning_analytics_ai.training.labels import assign_risk_class, proxy_final_grade_pct


def load_frames(school_id: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    eng = get_engine()
    base = pd.read_sql_query(FEATURE_BASE_SQL, eng, params={"school_id": school_id})
    series = pd.read_sql_query(ASSESSMENT_SERIES_SQL, eng, params={"school_id": school_id})
    return base, series


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--school-id", required=True, help="Train on historical rows for this school")
    parser.add_argument("--test-size", type=float, default=0.2)
    args = parser.parse_args()

    base, series = load_frames(args.school_id)
    if base.empty:
        raise SystemExit("No enrollment rows; nothing to train.")

    trends = compute_score_trends(series)
    df = build_feature_matrix(base, trends)
    df["proxy_final"] = proxy_final_grade_pct(df)
    y = assign_risk_class(df["proxy_final"])

    X = df[FEATURE_COLUMNS].values
    if len(np.unique(y)) < 2:
        raise SystemExit("Need at least 2 risk classes in data; add more history or adjust thresholds.")

    _, counts = np.unique(y, return_counts=True)
    strat = y if len(counts) >= 2 and int(np.min(counts)) >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=42, stratify=strat
    )

    clf = GradientBoostingClassifier(random_state=42, max_depth=3, n_estimators=120)
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)
    print(classification_report(y_test, y_pred, zero_division=0))

    bundle = RiskModelBundle(clf, FEATURE_COLUMNS, settings.risk_model_version)
    out = default_model_path()
    bundle.save(out)
    meta = {
        "version": settings.risk_model_version,
        "school_id_train": args.school_id,
        "artifact": str(out),
        "n_samples": len(df),
        "features": FEATURE_COLUMNS,
    }
    out.with_suffix(".json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("Saved:", out)


if __name__ == "__main__":
    main()
