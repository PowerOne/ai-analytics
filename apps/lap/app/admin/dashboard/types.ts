export type DashboardStudent = {
  id: string;
  gradeLevel: string | null;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
};

export type DashboardClass = {
  id: string;
  name: string;
  sectionCode: string | null;
  subject?: { code: string; name: string } | null;
};

export type DashboardTeacher = {
  id: string;
  displayName: string | null;
  email: string | null;
  subject: string | null;
};

export type DashboardIntervention = {
  id: string;
  status: string;
  triggerType: string;
  description: string;
  createdAt: string;
  studentId: string | null;
  classId: string | null;
};

export type DashboardCohort = {
  id: string;
  name: string;
  performance: number;
  attendance: number;
  engagement: number;
  interventions: number;
  risk: {
    low: number;
    medium: number;
    high: number;
    average: number;
  };
};
