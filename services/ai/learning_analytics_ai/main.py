"""FastAPI entry: health + risk prediction API."""

from fastapi import FastAPI

from learning_analytics_ai.api.predict import router as predict_router

app = FastAPI(
    title="Learning Analytics AI",
    version="0.1.0",
    description="Tabular risk (sklearn) + rules-based engagement; batch writes to ai_student_class_scores.",
)

app.include_router(predict_router)


@app.get("/health")
def health():
    return {"status": "up", "service": "learning-analytics-ai"}
