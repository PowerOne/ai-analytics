const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // -----------------------------
  // 1. Create School
  // -----------------------------
  const school = await prisma.school.create({
    data: {
      name: "Global International School",
      address: "Abu Dhabi, UAE",
      code: "GIS-001",
      timezone: "Asia/Dubai"
    }
  });

  // -----------------------------
  // 2. Create Teachers
  // -----------------------------
  const teacherJohn = await prisma.teacher.create({
    data: {
      givenName: "John",
      familyName: "Mathews",
      displayName: "John Mathews",
      email: "john.mathews@gis.edu",
      subject: "Mathematics",
      schoolId: school.id
    }
  });

  const teacherSara = await prisma.teacher.create({
    data: {
      givenName: "Sara",
      familyName: "Williams",
      displayName: "Sara Williams",
      email: "sara.williams@gis.edu",
      subject: "Science",
      schoolId: school.id
    }
  });

  // -----------------------------
  // 3. Create Students
  // -----------------------------
  const studentA = await prisma.student.create({
    data: {
      givenName: "Aisha",
      familyName: "Khan",
      displayName: "Aisha Khan",
      gradeLevel: "Grade 8",
      schoolId: school.id
    }
  });

  const studentB = await prisma.student.create({
    data: {
      givenName: "Rohan",
      familyName: "Patel",
      displayName: "Rohan Patel",
      gradeLevel: "Grade 8",
      schoolId: school.id
    }
  });

  // -----------------------------
  // 4. Create Subjects
  // -----------------------------
  const mathSubject = await prisma.subject.create({
    data: {
      schoolId: school.id,
      code: "MATH8",
      name: "Mathematics"
    }
  });

  const scienceSubject = await prisma.subject.create({
    data: {
      schoolId: school.id,
      code: "SCI8",
      name: "Science"
    }
  });

  // -----------------------------
  // 5. Create Academic Year + Term
  // -----------------------------
  const academicYear = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      label: "2025-2026",
      startsOn: new Date("2025-09-01"),
      endsOn: new Date("2026-06-30")
    }
  });

  const term1 = await prisma.term.create({
    data: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      label: "Term 1",
      sequenceNo: 1,
      startsOn: new Date("2025-09-01"),
      endsOn: new Date("2025-12-15")
    }
  });

  // -----------------------------
  // 6. Create Classes
  // -----------------------------
  const mathClass = await prisma.class.create({
    data: {
      schoolId: school.id,
      subjectId: mathSubject.id,
      termId: term1.id,
      name: "Mathematics - Grade 8",
      primaryTeacherId: teacherJohn.id
    }
  });

  const scienceClass = await prisma.class.create({
    data: {
      schoolId: school.id,
      subjectId: scienceSubject.id,
      termId: term1.id,
      name: "Science - Grade 8",
      primaryTeacherId: teacherSara.id
    }
  });

  // -----------------------------
  // 7. Enroll Students
  // -----------------------------
  await prisma.enrollment.createMany({
    data: [
      { schoolId: school.id, studentId: studentA.id, classId: mathClass.id },
      { schoolId: school.id, studentId: studentA.id, classId: scienceClass.id },
      { schoolId: school.id, studentId: studentB.id, classId: mathClass.id },
      { schoolId: school.id, studentId: studentB.id, classId: scienceClass.id }
    ]
  });

  // -----------------------------
  // 8. Create Admin User
  // -----------------------------
  await prisma.user.create({
    data: {
      email: "admin@gis.edu",
      passwordHash: "Admin@123", // hash later
      role: "ADMIN",
      schoolId: school.id
    }
  });

  console.log("✅ Seed complete.");
}

main()
  .then(() => {
    console.log("🌱 Database seeded successfully.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  });
