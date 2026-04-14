/** Shapes returned by `GET /api/students` (tenant-scoped). */
export type StudentRosterRow = {
  id: string;
  externalId: string | null;
  givenName: string | null;
  familyName: string | null;
  displayName: string | null;
  email: string | null;
  gradeLevel: string | null;
  createdAt: string;
};

/** Shapes returned by `GET /api/classes` (tenant-scoped). */
export type ClassDirectoryRow = {
  id: string;
  name: string;
  sectionCode: string | null;
  room: string | null;
  subject: { code: string; name: string };
  term: { label: string };
  primaryTeacher: {
    id: string;
    displayName: string | null;
    email: string | null;
  } | null;
};
