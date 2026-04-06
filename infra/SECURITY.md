# Security model — Learning Analytics platform

## 1. Multi-tenant (`school_id`)

- **Source of truth:** Every `User` belongs to exactly one `school_id` (JWT payload + DB).
- **API enforcement:**
  - **JWT validation** (`JwtStrategy`): reloads user by `sub` + `schoolId` from token; invalid cross-tenant tokens fail.
  - **Query filters:** Services use helpers such as `scopeClasses(user)`, `scopeStudents(user)` so Prisma `where` clauses always include `schoolId: user.schoolId` (and teacher scoping where applicable).
  - **URL parameters:** If routes expose `schoolId` in path/query, apply `SchoolParamGuard` so `params.schoolId === user.schoolId`.
- **Not recommended:** Trusting `school_id` from the client body without matching JWT.

Optional hardening: PostgreSQL **Row Level Security** on `school_id` as a second line of defense.

## 2. RBAC (ADMIN, PRINCIPAL, TEACHER)

| Role        | Typical access |
|------------|----------------|
| ADMIN      | Full read within tenant; school-wide analytics & insights. |
| PRINCIPAL  | Same as ADMIN for analytics (policy can diverge later). |
| TEACHER    | Classes where `primary_teacher_id` matches `user.teacherId`; students via those enrollments. |

**Enforcement:** `@Roles(UserRole.ADMIN, ...)` + `RolesGuard` on controllers; teacher scoping in `tenant-scope.ts` + `ForbiddenException` in analytics when accessing another teacher’s class.

## 3. Frontend ↔ Backend (JWT)

- Browser stores session (demo: `localStorage`; production: httpOnly cookie or BFF).
- API: `Authorization: Bearer <JWT>`; secret `JWT_SECRET`; expiry `JWT_EXPIRES_DAYS`.
- CORS: `CORS_ORIGIN` lists allowed web origins (comma-separated).

## 4. Backend ↔ AI service

- **Shared secret:** `INTERNAL_API_KEY` on both sides; Python FastAPI validates `X-Internal-Key` on `/predict/*` when the variable is set.
- **Network:** In Docker Compose, services on an internal network; only API needs outbound to `ai:8000`, not the public internet for admin tasks.
- **Kubernetes:** Place API and AI in the same namespace; use `NetworkPolicy` to restrict ingress to AI from the API `Deployment` only.

## 5. Secrets management

| Environment | Practice |
|-------------|----------|
| Local dev   | `.env` (gitignored); never commit secrets. |
| Docker Compose | `env_file: .env` or inline only for non-prod; use Docker secrets for prod. |
| Single VM   | systemd `EnvironmentFile` with `chmod 600`, or SOPS/age-encrypted env. |
| Kubernetes  | `Secret` resources; inject as env vars; enable encryption at rest; rotate JWT + internal keys. |

## 6. Deployment notes

- **Single VM:** `docker compose up -d`; reverse proxy (Caddy/NGINX) TLS termination; Postgres on same host or managed DB.
- **Kubernetes:** Deployments + Services for `web`, `api`, `ai`; StatefulSet or managed Postgres; Ingress with TLS; ConfigMaps for non-secret config.
