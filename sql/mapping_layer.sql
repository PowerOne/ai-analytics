-- Mapping layer: MIS/LMS → unified model (per-school configs, imports, errors)
-- Depends on: schools (from unified_learning_analytics_core.sql)

BEGIN;

-- ---------------------------------------------------------------------------
-- data_sources — one logical integration per school (CSV bucket, REST vendor, etc.)
-- ---------------------------------------------------------------------------

CREATE TABLE data_sources (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL,
  description         TEXT,
  integration_mode    TEXT NOT NULL DEFAULT 'csv_excel'
    CHECK (integration_mode IN ('csv_excel', 'rest', 'both')),
  connection_config   JSONB NOT NULL DEFAULT '{}',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  UNIQUE (school_id, id),
  CONSTRAINT uq_data_sources_school_slug UNIQUE (school_id, slug)
);

CREATE INDEX idx_data_sources_school ON data_sources (school_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN data_sources.connection_config IS
  'REST: base_url, auth (oauth2_client_credentials|api_key|none), headers, pagination. CSV: delimiter, encoding, has_header_row.';

-- ---------------------------------------------------------------------------
-- field_mappings — versioned mapping spec (JSON) per entity for a data source
-- ---------------------------------------------------------------------------

CREATE TABLE field_mappings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  data_source_id      UUID NOT NULL,
  name                TEXT NOT NULL,
  entity_type         TEXT NOT NULL
    CHECK (entity_type IN (
      'student', 'teacher', 'subject', 'class', 'enrollment',
      'assessment', 'assessment_result', 'assignment', 'assignment_submission',
      'attendance_record', 'lms_activity_event', 'term', 'academic_year'
    )),
  version             INTEGER NOT NULL DEFAULT 1,
  mapping_spec        JSONB NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  UNIQUE (school_id, id),
  CONSTRAINT fk_field_mappings_data_source
    FOREIGN KEY (school_id, data_source_id) REFERENCES data_sources (school_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_field_mappings_version
    UNIQUE (school_id, data_source_id, entity_type, version)
);

CREATE INDEX idx_field_mappings_source ON field_mappings (school_id, data_source_id)
  WHERE deleted_at IS NULL AND is_active = true;

COMMENT ON COLUMN field_mappings.mapping_spec IS
  'See mapping_spec.schema.json — column/jsonPath → unified field, transforms, keys, validation.';

-- ---------------------------------------------------------------------------
-- import_jobs — each CSV upload or REST pull run
-- ---------------------------------------------------------------------------

CREATE TABLE import_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  data_source_id      UUID NOT NULL,
  field_mapping_id    UUID NOT NULL,
  job_type            TEXT NOT NULL
    CHECK (job_type IN ('csv_upload', 'rest_pull', 'replay', 'manual')),
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'queued', 'validating', 'processing', 'completed',
      'completed_with_errors', 'failed', 'cancelled'
    )),
  storage_key         TEXT,
  original_file_name TEXT,
  content_type        TEXT,
  file_size_bytes     BIGINT,
  rows_total          INTEGER,
  rows_processed      INTEGER NOT NULL DEFAULT 0,
  rows_failed         INTEGER NOT NULL DEFAULT 0,
  rows_skipped        INTEGER NOT NULL DEFAULT 0,
  error_summary       JSONB NOT NULL DEFAULT '{}',
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_by_user_id  UUID,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, id),
  CONSTRAINT fk_ij_data_source
    FOREIGN KEY (school_id, data_source_id) REFERENCES data_sources (school_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_ij_field_mapping
    FOREIGN KEY (school_id, field_mapping_id) REFERENCES field_mappings (school_id, id) ON DELETE RESTRICT
);

CREATE INDEX idx_import_jobs_school_created ON import_jobs (school_id, created_at DESC);
CREATE INDEX idx_import_jobs_status ON import_jobs (school_id, status);

-- ---------------------------------------------------------------------------
-- import_job_errors — row-level validation / transform / FK errors
-- ---------------------------------------------------------------------------

CREATE TABLE import_job_errors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  import_job_id       UUID NOT NULL,
  row_index           INTEGER,
  source_column       TEXT,
  target_field        TEXT,
  severity            TEXT NOT NULL DEFAULT 'error'
    CHECK (severity IN ('error', 'warning')),
  error_code          TEXT NOT NULL,
  message             TEXT NOT NULL,
  raw_value           TEXT,
  unified_key         JSONB,
  payload             JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, id),
  CONSTRAINT fk_import_job_errors_job
    FOREIGN KEY (school_id, import_job_id) REFERENCES import_jobs (school_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_import_job_errors_job ON import_job_errors (school_id, import_job_id);
CREATE INDEX idx_import_job_errors_severity ON import_job_errors (school_id, import_job_id, severity);

COMMIT;
