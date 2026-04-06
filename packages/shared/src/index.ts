/** Unified learning analytics roles (expand for Parent/Student later). */
export type UserRole = "admin" | "principal" | "teacher" | "parent" | "student";

/** Canonical identifiers after MIS/LMS mapping. */
export interface OrganizationRef {
  id: string;
  name: string;
}

export interface LearnerRef {
  id: string;
  organizationId: string;
  externalIds: Record<string, string>;
}

export interface LearningEvent {
  id: string;
  learnerId: string;
  occurredAt: string;
  type: "assessment" | "activity" | "login" | "content_view" | "other";
  payload: Record<string, unknown>;
}

/** AI pipeline job types. */
export type AiJobType = "risk_prediction" | "engagement" | "mastery";

export interface AiJobRequest {
  jobType: AiJobType;
  organizationId: string;
  learnerIds?: string[];
}

export interface AiJobResult {
  jobId: string;
  jobType: AiJobType;
  status: "queued" | "running" | "completed" | "failed";
  scores?: Record<string, number>;
  metadata?: Record<string, unknown>;
}
