import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Demo High School",
      slug: "demo-high",
      timezone: "America/New_York",
    },
  });

  const year = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      label: "2025-2026",
      startsOn: new Date("2025-08-01"),
      endsOn: new Date("2026-06-30"),
    },
  });

  const term = await prisma.term.create({
    data: {
      schoolId: school.id,
      academicYearId: year.id,
      label: "Fall 2025",
      sequenceNo: 1,
      startsOn: new Date("2025-08-15"),
      endsOn: new Date("2025-12-20"),
    },
  });

  const teacher = await prisma.teacher.create({
    data: {
      schoolId: school.id,
      displayName: "Jane Teacher",
      email: "teacher@demo.school",
      externalId: "T001",
    },
  });

  const subject = await prisma.subject.create({
    data: {
      schoolId: school.id,
      code: "MATH101",
      name: "Algebra I",
    },
  });

  const klass = await prisma.class.create({
    data: {
      schoolId: school.id,
      subjectId: subject.id,
      termId: term.id,
      name: "Algebra I — Period 3",
      sectionCode: "03",
      primaryTeacherId: teacher.id,
    },
  });

  await prisma.student.createMany({
    data: [
      {
        schoolId: school.id,
        externalId: "S001",
        givenName: "Alex",
        familyName: "Rivera",
        gradeLevel: "9",
      },
      {
        schoolId: school.id,
        externalId: "S002",
        givenName: "Sam",
        familyName: "Chen",
        gradeLevel: "9",
      },
    ],
  });
  const studentRows = await prisma.student.findMany({ where: { schoolId: school.id } });

  for (const s of studentRows) {
    await prisma.enrollment.create({
      data: {
        schoolId: school.id,
        studentId: s.id,
        classId: klass.id,
        status: "active",
      },
    });
  }

  const assessment = await prisma.assessment.create({
    data: {
      schoolId: school.id,
      classId: klass.id,
      title: "Unit 1 Test",
      assessmentType: "exam",
      maxScore: 100,
      administeredOn: new Date("2025-09-15"),
    },
  });

  for (const s of studentRows) {
    await prisma.assessmentResult.create({
      data: {
        schoolId: school.id,
        assessmentId: assessment.id,
        studentId: s.id,
        scoreRaw: 80 + Math.floor(Math.random() * 15),
        scorePercent: 82 + Math.floor(Math.random() * 10),
        submittedAt: new Date("2025-09-15T14:00:00Z"),
      },
    });
  }

  for (const s of studentRows) {
    await prisma.attendanceRecord.createMany({
      data: [
        {
          schoolId: school.id,
          classId: klass.id,
          studentId: s.id,
          sessionDate: new Date("2025-09-10"),
          status: "present",
        },
        {
          schoolId: school.id,
          classId: klass.id,
          studentId: s.id,
          sessionDate: new Date("2025-09-12"),
          status: "present",
        },
      ],
    });
    await prisma.lmsActivityEvent.create({
      data: {
        schoolId: school.id,
        studentId: s.id,
        classId: klass.id,
        occurredAt: new Date("2025-09-14T10:00:00Z"),
        eventType: "page_view",
        durationSeconds: 120,
        engagementScore: 0.72,
      },
    });
  }

  const hash = await bcrypt.hash("password123", 10);
  await prisma.user.upsert({
    where: { email: "admin@demo.school" },
    update: { passwordHash: hash },
    create: {
      email: "admin@demo.school",
      passwordHash: hash,
      schoolId: school.id,
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "teacher@demo.school" },
    update: { passwordHash: hash, teacherId: teacher.id },
    create: {
      email: "teacher@demo.school",
      passwordHash: hash,
      schoolId: school.id,
      role: UserRole.TEACHER,
      teacherId: teacher.id,
    },
  });

  console.log("Seed complete:", { schoolId: school.id, classId: klass.id });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
