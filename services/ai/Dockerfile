FROM python:3.12-slim AS runner
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY services/ai/pyproject.toml ./
COPY services/ai/learning_analytics_ai ./learning_analytics_ai
RUN mkdir -p /app/artifacts
RUN pip install --no-cache-dir .
ENV MODEL_DIR=/app/artifacts
EXPOSE 8000
CMD ["uvicorn", "learning_analytics_ai.main:app", "--host", "0.0.0.0", "--port", "8000"]
