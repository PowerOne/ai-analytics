export type InterventionRecord = {
  id: string;
  schoolId: string;
  teacherId: string;
  classId: string | null;
  studentId: string | null;
  triggerType: string;
  description: string;
  recommendations: unknown | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherOption = {
  id: string;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
  email: string | null;
};

export const INTERVENTION_STATUSES = ["open", "in_progress", "resolved"] as const;
