"""POST /predict/student_risk — single or batch."""

from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from learning_analytics_ai.security import verify_internal_api_key
from learning_analytics_ai.services.prediction import (
    build_matrix_for_school,
    filter_pairs,
    get_bundle,
    predict_enrollments,
)

router = APIRouter(
    prefix="/predict",
    tags=["predict"],
    dependencies=[Depends(verify_internal_api_key)],
)


def _float_or_none(v: object) -> float | None:
    if v is None:
        return None
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if isinstance(x, float) and math.isnan(x):
        return None
    return x


class EnrollmentRef(BaseModel):
    student_id: str
    class_id: str


class StudentRiskRequest(BaseModel):
    school_id: str = Field(..., description="Tenant scope; required for SQL filters")
    student_id: str | None = None
    class_id: str | None = None
    enrollments: list[EnrollmentRef] | None = None


class RiskRow(BaseModel):
    school_id: str
    student_id: str
    class_id: str
    risk_score: float | None = Field(None, description="0–100, P(HIGH risk class)")
    risk_level: str
    engagement_score: float = Field(..., description="0–100 rules-based composite")
    top_factors: list[dict[str, Any]] = []


class StudentRiskResponse(BaseModel):
    model_version: str | None
    results: list[RiskRow]


@router.post("/student_risk", response_model=StudentRiskResponse)
def post_student_risk(body: StudentRiskRequest) -> StudentRiskResponse:
    bundle = get_bundle()
    df_all = build_matrix_for_school(body.school_id)
    if df_all.empty:
        raise HTTPException(404, "No enrollments for school_id")

    pairs: list[tuple[str, str]] = []
    if body.enrollments:
        pairs = [(e.student_id, e.class_id) for e in body.enrollments]
    elif body.student_id and body.class_id:
        pairs = [(body.student_id, body.class_id)]
    else:
        raise HTTPException(400, "Provide student_id+class_id or enrollments[]")

    df = filter_pairs(df_all, pairs)
    if df.empty:
        raise HTTPException(404, "No matching student/class enrollment")

    scored = predict_enrollments(df, bundle)
    rows: list[RiskRow] = []
    for i in range(len(scored)):
        r = scored.iloc[i]
        rows.append(
            RiskRow(
                school_id=str(r["school_id"]),
                student_id=str(r["student_id"]),
                class_id=str(r["class_id"]),
                risk_score=_float_or_none(r["risk_score"]),
                risk_level=str(r["risk_level"]),
                engagement_score=float(r["engagement_score"]),
                top_factors=list(r["top_factors"]) if isinstance(r["top_factors"], list) else [],
            )
        )

    return StudentRiskResponse(
        model_version=bundle.version if bundle else None,
        results=rows,
    )
