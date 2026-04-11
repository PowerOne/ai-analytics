"""Stub LLM-style /generate-* routes; replace with real LLM integration in production."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from learning_analytics_ai.security import verify_internal_api_key

router = APIRouter(tags=["generate"], dependencies=[Depends(verify_internal_api_key)])


def _summary(path: str) -> dict[str, str]:
    return {
        "summary": f"Stub response for {path}. Configure LLM integration for production.",
    }


@router.post("/generate-teacher-dashboard-summary")
async def generate_teacher_dashboard_summary(payload: dict[str, Any] | None = None) -> dict[str, str]:
    _ = payload
    return _summary("/generate-teacher-dashboard-summary")


@router.post("/generate-principal-dashboard-summary")
async def generate_principal_dashboard_summary(payload: dict[str, Any] | None = None) -> dict[str, str]:
    _ = payload
    return _summary("/generate-principal-dashboard-summary")


@router.post("/generate-cohort-dashboard-summary")
async def generate_cohort_dashboard_summary(payload: dict[str, Any] | None = None) -> dict[str, str]:
    _ = payload
    return _summary("/generate-cohort-dashboard-summary")


@router.post("/generate-student360-summary")
async def generate_student360_summary(payload: dict[str, Any] | None = None) -> dict[str, str]:
    _ = payload
    return _summary("/generate-student360-summary")


@router.post("/generate-weekly-teacher-report")
async def generate_weekly_teacher_report(payload: dict[str, Any] | None = None) -> dict[str, str]:
    _ = payload
    return _summary("/generate-weekly-teacher-report")


@router.post("/generate-principal-report-summary")
async def generate_principal_report_summary(payload: dict[str, Any] | None = None) -> dict[str, str]:
    _ = payload
    return _summary("/generate-principal-report-summary")


@router.post("/generate-cohort-summary")
async def generate_cohort_summary(payload: dict[str, Any] | None = None) -> dict[str, str]:
    _ = payload
    return _summary("/generate-cohort-summary")


@router.post("/generate-lms-heatmap-summary")
async def generate_lms_heatmap_summary(payload: dict[str, Any] | None = None) -> dict[str, str]:
    _ = payload
    return _summary("/generate-lms-heatmap-summary")


@router.post("/generate-insights")
async def generate_insights(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    _ = payload
    return {
        "summary": "Class insights (stub). Configure LLM integration for production.",
        "risks": ["Stub risk signal — replace with model output."],
        "recommendations": ["Stub recommendation — replace with model output."],
    }


@router.post("/generate-interventions")
async def generate_interventions(payload: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    _ = payload
    return []


@router.post("/generate-school-interventions")
async def generate_school_interventions(payload: dict[str, Any] | None = None) -> dict[str, list[dict[str, Any]]]:
    _ = payload
    return {"schoolInterventions": []}


@router.post("/generate-intervention-recommendations")
async def generate_intervention_recommendations(payload: dict[str, Any] | None = None) -> dict[str, list[str]]:
    _ = payload
    return {"recommendations": ["Review attendance patterns", "Schedule a check-in with the student"]}
