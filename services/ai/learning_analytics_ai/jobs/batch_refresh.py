"""
Nightly / cron batch: recompute scores for all active enrollments in a school and UPSERT into DB.

Usage:
  DATABASE_URL=... python -m learning_analytics_ai.jobs.batch_refresh --school-id <uuid>

Schedule (examples):
  - Linux cron: 0 2 * * * cd /app && /usr/local/bin/python -m learning_analytics_ai.jobs.batch_refresh --school-id ...
  - Kubernetes CronJob
  - Airflow DAG calling this script
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.engine import Engine

from learning_analytics_ai.db import get_engine
from learning_analytics_ai.services.prediction import (
    build_matrix_for_school,
    get_bundle,
    predict_enrollments,
)


UPSERT_SQL = text(
    """
    INSERT INTO ai_student_class_scores (
      school_id, student_id, class_id,
      risk_score, risk_level, engagement_score,
      top_factors, model_version, computed_at
    ) VALUES (
      CAST(:school_id AS uuid),
      CAST(:student_id AS uuid),
      CAST(:class_id AS uuid),
      :risk_score,
      :risk_level,
      :engagement_score,
      CAST(:top_factors AS jsonb),
      :model_version,
      CAST(:computed_at AS timestamptz)
    )
    ON CONFLICT (school_id, student_id, class_id) DO UPDATE SET
      risk_score = EXCLUDED.risk_score,
      risk_level = EXCLUDED.risk_level,
      engagement_score = EXCLUDED.engagement_score,
      top_factors = EXCLUDED.top_factors,
      model_version = EXCLUDED.model_version,
      computed_at = EXCLUDED.computed_at
    """
)


def persist_rows(engine: Engine, school_id: str, df) -> int:
    bundle = get_bundle()
    scored = predict_enrollments(df, bundle)
    model_ver = bundle.version if bundle else None
    now = datetime.now(UTC).isoformat()
    n = 0
    with engine.begin() as conn:
        for i in range(len(scored)):
            r = scored.iloc[i]
            conn.execute(
                UPSERT_SQL,
                {
                    "school_id": school_id,
                    "student_id": str(r["student_id"]),
                    "class_id": str(r["class_id"]),
                    "risk_score": float(r["risk_score"]) if r["risk_score"] is not None else None,
                    "risk_level": str(r["risk_level"]),
                    "engagement_score": float(r["engagement_score"]),
                    "top_factors": json.dumps(r["top_factors"]),
                    "model_version": model_ver,
                    "computed_at": now,
                },
            )
            n += 1
    return n


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--school-id", required=True)
    args = parser.parse_args()

    df = build_matrix_for_school(args.school_id)
    if df.empty:
        print("No rows to score.")
        return

    engine = get_engine()
    n = persist_rows(engine, args.school_id, df)
    print(f"Upserted {n} rows for school {args.school_id}")


if __name__ == "__main__":
    main()
