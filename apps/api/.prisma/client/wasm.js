
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('@prisma/client/runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  schoolId: 'schoolId',
  role: 'role',
  teacherId: 'teacherId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SchoolScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  timezone: 'timezone',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.AcademicYearScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  label: 'label',
  startsOn: 'startsOn',
  endsOn: 'endsOn',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.TermScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  academicYearId: 'academicYearId',
  label: 'label',
  sequenceNo: 'sequenceNo',
  startsOn: 'startsOn',
  endsOn: 'endsOn',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.TeacherScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  externalSource: 'externalSource',
  externalId: 'externalId',
  givenName: 'givenName',
  familyName: 'familyName',
  displayName: 'displayName',
  email: 'email',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.StudentScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  externalSource: 'externalSource',
  externalId: 'externalId',
  givenName: 'givenName',
  familyName: 'familyName',
  displayName: 'displayName',
  email: 'email',
  gradeLevel: 'gradeLevel',
  cohortYear: 'cohortYear',
  demographics: 'demographics',
  metadata: 'metadata',
  performance: 'performance',
  attendance: 'attendance',
  engagement: 'engagement',
  riskScore: 'riskScore',
  deltas: 'deltas',
  tiers: 'tiers',
  flags: 'flags',
  stability: 'stability',
  classId: 'classId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.SubjectScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  code: 'code',
  name: 'name',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.ClassScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  subjectId: 'subjectId',
  termId: 'termId',
  sectionCode: 'sectionCode',
  name: 'name',
  primaryTeacherId: 'primaryTeacherId',
  room: 'room',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.EnrollmentScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  studentId: 'studentId',
  classId: 'classId',
  role: 'role',
  status: 'status',
  enrolledOn: 'enrolledOn',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.AssessmentScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  classId: 'classId',
  title: 'title',
  assessmentType: 'assessmentType',
  maxScore: 'maxScore',
  administeredOn: 'administeredOn',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.AssessmentResultScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  assessmentId: 'assessmentId',
  studentId: 'studentId',
  scoreRaw: 'scoreRaw',
  scorePercent: 'scorePercent',
  attemptNo: 'attemptNo',
  submittedAt: 'submittedAt',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.AttendanceRecordScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  classId: 'classId',
  studentId: 'studentId',
  sessionDate: 'sessionDate',
  sessionIndex: 'sessionIndex',
  status: 'status',
  source: 'source',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.LmsActivityEventScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  studentId: 'studentId',
  classId: 'classId',
  occurredAt: 'occurredAt',
  eventType: 'eventType',
  durationSeconds: 'durationSeconds',
  engagementScore: 'engagementScore',
  payload: 'payload',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.DataSourceScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  name: 'name',
  type: 'type',
  config: 'config',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FieldMappingScalarFieldEnum = {
  id: 'id',
  dataSourceId: 'dataSourceId',
  targetModel: 'targetModel',
  targetField: 'targetField',
  sourceField: 'sourceField',
  transform: 'transform',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ImportJobScalarFieldEnum = {
  id: 'id',
  dataSourceId: 'dataSourceId',
  status: 'status',
  rowCount: 'rowCount',
  errorCount: 'errorCount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ImportJobErrorScalarFieldEnum = {
  id: 'id',
  importJobId: 'importJobId',
  rowNumber: 'rowNumber',
  message: 'message',
  rawData: 'rawData',
  createdAt: 'createdAt'
};

exports.Prisma.InterventionScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  teacherId: 'teacherId',
  classId: 'classId',
  studentId: 'studentId',
  triggerType: 'triggerType',
  description: 'description',
  notes: 'notes',
  recommendations: 'recommendations',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WeeklyStudentSnapshotScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  studentId: 'studentId',
  weekStartDate: 'weekStartDate',
  performance: 'performance',
  attendance: 'attendance',
  engagement: 'engagement',
  riskScore: 'riskScore',
  riskTier: 'riskTier',
  riskComposite: 'riskComposite',
  riskCategory: 'riskCategory',
  riskReasons: 'riskReasons',
  riskStability: 'riskStability',
  riskDeltas: 'riskDeltas',
  createdAt: 'createdAt'
};

exports.Prisma.WeeklyClassSnapshotScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  classId: 'classId',
  weekStartDate: 'weekStartDate',
  performance: 'performance',
  attendance: 'attendance',
  engagement: 'engagement',
  riskScore: 'riskScore',
  riskComposite: 'riskComposite',
  riskCategory: 'riskCategory',
  riskReasons: 'riskReasons',
  riskStability: 'riskStability',
  riskDeltas: 'riskDeltas',
  createdAt: 'createdAt'
};

exports.Prisma.WeeklyCohortSnapshotScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  cohortType: 'cohortType',
  cohortId: 'cohortId',
  name: 'name',
  weekStartDate: 'weekStartDate',
  performance: 'performance',
  attendance: 'attendance',
  engagement: 'engagement',
  riskLow: 'riskLow',
  riskMedium: 'riskMedium',
  riskHigh: 'riskHigh',
  riskAverage: 'riskAverage',
  interventions: 'interventions',
  createdAt: 'createdAt'
};

exports.Prisma.WeeklySchoolSnapshotScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  weekStartDate: 'weekStartDate',
  performance: 'performance',
  attendance: 'attendance',
  engagement: 'engagement',
  riskLow: 'riskLow',
  riskMedium: 'riskMedium',
  riskHigh: 'riskHigh',
  riskAverage: 'riskAverage',
  interventionsCreated: 'interventionsCreated',
  interventionsResolved: 'interventionsResolved',
  riskComposite: 'riskComposite',
  riskCategory: 'riskCategory',
  riskReasons: 'riskReasons',
  riskStability: 'riskStability',
  riskDeltas: 'riskDeltas',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.UserRole = exports.$Enums.UserRole = {
  ADMIN: 'ADMIN',
  PRINCIPAL: 'PRINCIPAL',
  TEACHER: 'TEACHER'
};

exports.Prisma.ModelName = {
  User: 'User',
  School: 'School',
  AcademicYear: 'AcademicYear',
  Term: 'Term',
  Teacher: 'Teacher',
  Student: 'Student',
  Subject: 'Subject',
  Class: 'Class',
  Enrollment: 'Enrollment',
  Assessment: 'Assessment',
  AssessmentResult: 'AssessmentResult',
  AttendanceRecord: 'AttendanceRecord',
  LmsActivityEvent: 'LmsActivityEvent',
  DataSource: 'DataSource',
  FieldMapping: 'FieldMapping',
  ImportJob: 'ImportJob',
  ImportJobError: 'ImportJobError',
  Intervention: 'Intervention',
  WeeklyStudentSnapshot: 'WeeklyStudentSnapshot',
  WeeklyClassSnapshot: 'WeeklyClassSnapshot',
  WeeklyCohortSnapshot: 'WeeklyCohortSnapshot',
  WeeklySchoolSnapshot: 'WeeklySchoolSnapshot'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
