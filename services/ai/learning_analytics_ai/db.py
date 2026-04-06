"""SQLAlchemy engine for feature extraction and batch writes."""

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from learning_analytics_ai.config import settings


def get_engine() -> Engine:
    return create_engine(settings.database_url, pool_pre_ping=True)
