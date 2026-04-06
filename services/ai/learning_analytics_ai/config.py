"""Runtime settings (DATABASE_URL, model paths)."""

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://analytics:analytics@localhost:5432/learning_analytics"
    model_dir: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parent.parent / "artifacts",
        description="Directory for risk_gbc_v1.joblib (mount volume in Docker)",
    )
    risk_model_version: str = "risk_gbc_v1"
    # Training / labels (proxy final grade = mean assessment % when no transcript grade)
    risk_high_threshold: float = 60.0
    risk_medium_threshold: float = 80.0
    # When set, /predict/* requires header X-Internal-Key matching this value.
    internal_api_key: str | None = Field(default=None, validation_alias="INTERNAL_API_KEY")


settings = Settings()
