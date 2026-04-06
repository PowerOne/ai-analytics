# Kubernetes (outline)

1. **Namespace:** `learning-analytics`
2. **Secrets:** `jwt-secret`, `internal-api-key`, `database-url` (or use external RDS connection string).
3. **Deployments:** `web`, `api`, `ai` — env from ConfigMap + Secret.
4. **Service:** ClusterIP for `api` and `ai`; Ingress only to `web` (port 3000) and optionally `api` for mobile/API clients.
5. **Postgres:** Managed cloud DB recommended; if in-cluster, StatefulSet + PVC + backups.
6. **NetworkPolicy:** Deny all ingress to `ai` except from `api` pod selector.

Apply order: namespace → secrets → deployments → services → ingress.
