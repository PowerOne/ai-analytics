"""Sklearn GradientBoostingClassifier wrapper + feature importance explanations."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier

from learning_analytics_ai.config import settings
from learning_analytics_ai.features.engineering import FEATURE_COLUMNS


class RiskModelBundle:
    def __init__(self, model: GradientBoostingClassifier, feature_names: list[str], version: str):
        self.model = model
        self.feature_names = feature_names
        self.version = version

    def predict_proba_high_risk(self, X: np.ndarray) -> np.ndarray:
        """Probability of class index 2 (HIGH risk) per row."""
        proba = self.model.predict_proba(X)
        classes = list(self.model.classes_)
        if 2 not in classes:
            return np.zeros(len(X))
        idx = classes.index(2)
        return proba[:, idx]

    def top_factors(self, X_row: np.ndarray, top_k: int = 3) -> list[dict[str, Any]]:
        """Approximate contributions via feature_importances_ * |z-scored feature|."""
        imp = self.model.feature_importances_
        x = X_row.ravel()
        denom = np.abs(x).sum() + 1e-9
        contrib = imp * (np.abs(x) / denom)
        order = np.argsort(-contrib)[:top_k]
        return [
            {
                "feature": self.feature_names[i],
                "weight": float(imp[i]),
                "approx_contribution": float(contrib[i]),
            }
            for i in order
        ]

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "model": self.model,
                "feature_names": self.feature_names,
                "version": self.version,
            },
            path,
        )

    @classmethod
    def load(cls, path: Path) -> "RiskModelBundle":
        raw = joblib.load(path)
        return cls(raw["model"], raw["feature_names"], raw["version"])


def default_model_path() -> Path:
    return settings.model_dir / f"{settings.risk_model_version}.joblib"


def risk_level_from_score(p_high: float) -> str:
    if p_high >= 0.55:
        return "HIGH"
    if p_high >= 0.25:
        return "MEDIUM"
    return "LOW"
