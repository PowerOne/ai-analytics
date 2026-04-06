"""
Optional XGBoost classifier (install: pip install ".[xgboost]").

Swap into train_risk.py:
  from xgboost import XGBClassifier
  clf = XGBClassifier(
      n_estimators=200,
      max_depth=4,
      learning_rate=0.05,
      objective="multi:softprob",
      num_class=3,
      random_state=42,
  )
  clf.fit(X_train, y_train)

Same FEATURE_COLUMNS; save with RiskModelBundle by typing model as Any or a small Protocol.
"""
