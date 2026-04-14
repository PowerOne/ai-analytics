const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // -----------------------------
  // 1. Create Schools
  // -----------------------------
  const school = await prisma.school.create({
    data: {
      name: "Global International School",
      address: "Abu Dhabi, UAE",
      code: "GIS-001"
    }
  });

  // -----------------------------
  // 2. Create Teachers
  // -----------------------------
  const teacherJohn = await prisma.teacher.create({
    data: {
      name: "John Mathews",
      email: "john.mathews@gis.edu",
      subject: "Mathematics",
      schoolId: school.id
    }
  });

  const teacherSara = await prisma.teacher.create({
    data: {
      name: "Sara Williams",
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
      name: "Aisha Khan",
      grade: "Grade 8",
      schoolId: school.id
    }
  });

  const studentB = await prisma.student.create({
    data: {
      name: "Rohan Patel",
      grade: "Grade 8",
      schoolId: school.id
    }
  });

  // -----------------------------
  // 4. Create Classes
  // -----------------------------
  const mathClass = await prisma.class.create({
    data: {
      name: "Mathematics - Grade 8",
      teacherId: teacherJohn.id,
      schoolId: school.id
    }
  });

  const scienceClass = await prisma.class.create({
    data: {
      name: "Science - Grade 8",
      teacherId: teacherSara.id,
      schoolId: school.id
    }
  });

  // -----------------------------
  // 5. Enroll Students
  // -----------------------------
  await prisma.studentClassEnrollment.createMany({
    data: [
      { studentId: studentA.id, classId: mathClass.id },
      { studentId: studentA.id, classId: scienceClass.id },
      { studentId: studentB.id, classId: mathClass.id },
      { studentId: studentB.id, classId: scienceClass.id }
    ]
  });

  // -----------------------------
  // 6. Create Admin User
  // -----------------------------
  await prisma.user.create({
    data: {
      email: "admin@gis.edu",
      password: "Admin@123", // You can hash later
      role: "ADMIN",
      schoolId: school.id
    }
  });

  // -----------------------------
  // 7. Risk Engine Baseline Data
  // -----------------------------
  await prisma.riskFactor.createMany({
    data: [
      { name: "Attendance", weight: 0.4 },
      { name: "Grades", weight: 0.4 },
      { name: "Behavior", weight: 0.2 }
    ]
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
