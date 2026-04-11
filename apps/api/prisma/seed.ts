import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function random(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 1): number {
  const v = min + Math.random() * (max - min);
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

function makeDeltas(): { performance: number; attendance: number; engagement: number; risk: number } {
  return {
    performance: random(-10, 10),
    attendance: random(-10, 10),
    engagement: random(-10, 10),
    risk: random(-10, 10),
  };
}

function makeTiers(): { performance: number; attendance: number; engagement: number; risk: number } {
  return {
    performance: random(1, 3),
    attendance: random(1, 3),
    engagement: random(1, 3),
    risk: random(1, 3),
  };
}

function makeFlags(): {
  lowPerformance: boolean;
  lowAttendance: boolean;
  lowEngagement: boolean;
  highRisk: boolean;
} {
  return {
    lowPerformance: Math.random() < 0.2,
    lowAttendance: Math.random() < 0.2,
    lowEngagement: Math.random() < 0.2,
    highRisk: Math.random() < 0.2,
  };
}

function mondayUtcContaining(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = (day + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function riskCategoryFromComposite(c: number): "low" | "medium" | "high" {
  if (c < 35) return "low";
  if (c < 65) return "medium";
  return "high";
}

function riskTierFromCategory(cat: "low" | "medium" | "high"): "LOW" | "MEDIUM" | "HIGH" {
  return cat.toUpperCase() as "LOW" | "MEDIUM" | "HIGH";
}

function makeRiskReasons(): string[] {
  const pool = [
    "Attendance below cohort average",
    "Engagement drop vs prior week",
    "Performance volatility",
    "Multiple missed assignments",
    "LMS inactivity streak",
    "Risk composite trending up",
  ];
  const n = random(1, 3);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(pool[random(0, pool.length - 1)]);
  return Array.from(new Set(out));
}

function makeRiskDeltas(): Record<string, number> {
  return {
    performance: random(-10, 10),
    attendance: random(-10, 10),
    engagement: random(-10, 10),
    risk: random(-10, 10),
  };
}

async function wipeDevData(): Promise<void> {
  await prisma.importJobError.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.fieldMapping.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.intervention.deleteMany();
  await prisma.weeklyStudentSnapshot.deleteMany();
  await prisma.weeklyClassSnapshot.deleteMany();
  await prisma.weeklyCohortSnapshot.deleteMany();
  await prisma.weeklySchoolSnapshot.deleteMany();
  await prisma.assessmentResult.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.lmsActivityEvent.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.user.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.term.deleteMany();
  await prisma.academicYear.deleteMany();
  await prisma.school.deleteMany();
}

type WeekMetrics = {
  performance: number;
  attendance: number;
  engagement: number;
  riskScore: number;
  riskComposite: number;
  riskCategory: "low" | "medium" | "high";
  riskStability: number;
};

function buildWeekMetrics(seed: number, weekOffset: number): WeekMetrics {
  const wobble = weekOffset * 3;
  const performance = Math.min(95, Math.max(40, randomFloat(42, 92) + wobble + (seed % 7)));
  const attendance = Math.min(100, Math.max(60, randomFloat(62, 98) - wobble * 0.5));
  const engagement = Math.min(90, Math.max(30, randomFloat(32, 88) + (seed % 5)));
  const riskScore = Math.min(90, Math.max(10, randomFloat(12, 88) - wobble * 0.4));
  const riskComposite = Math.min(90, Math.max(10, randomFloat(15, 85) + (seed % 6) * 0.5));
  const riskCategory = riskCategoryFromComposite(riskComposite);
  const riskStability = random(0, 100);
  return { performance, attendance, engagement, riskScore, riskComposite, riskCategory, riskStability };
}

async function main(): Promise<void> {
  await wipeDevData();

  const school = await prisma.school.create({
    data: {
      name: "Future Academy",
      slug: "future-academy",
      timezone: "UTC",
      metadata: { seeded: true },
    },
  });

  const academicYear = await prisma.academicYear.create({
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
      academicYearId: academicYear.id,
      label: "Fall 2025",
      sequenceNo: 1,
      startsOn: new Date("2025-08-15"),
      endsOn: new Date("2025-12-20"),
    },
  });

  const subject = await prisma.subject.create({
    data: {
      schoolId: school.id,
      code: "CORE",
      name: "Core Studies",
      metadata: {},
    },
  });

  const teacherRows = await prisma.$transaction([
    prisma.teacher.create({
      data: {
        schoolId: school.id,
        displayName: "Morgan Grade7A",
        email: "morgan.7a@future.academy",
        externalId: "T-7A",
      },
    }),
    prisma.teacher.create({
      data: {
        schoolId: school.id,
        displayName: "Riley Grade7B",
        email: "riley.7b@future.academy",
        externalId: "T-7B",
      },
    }),
    prisma.teacher.create({
      data: {
        schoolId: school.id,
        displayName: "Jordan Grade8A",
        email: "jordan.8a@future.academy",
        externalId: "T-8A",
      },
    }),
  ]);

  const [t7a, t7b, t8a] = teacherRows;

  const classRows = await prisma.$transaction([
    prisma.class.create({
      data: {
        schoolId: school.id,
        subjectId: subject.id,
        termId: term.id,
        name: "Grade 7A",
        sectionCode: "7A",
        primaryTeacherId: t7a.id,
        room: "A-101",
      },
    }),
    prisma.class.create({
      data: {
        schoolId: school.id,
        subjectId: subject.id,
        termId: term.id,
        name: "Grade 7B",
        sectionCode: "7B",
        primaryTeacherId: t7b.id,
        room: "A-102",
      },
    }),
    prisma.class.create({
      data: {
        schoolId: school.id,
        subjectId: subject.id,
        termId: term.id,
        name: "Grade 8A",
        sectionCode: "8A",
        primaryTeacherId: t8a.id,
        room: "B-201",
      },
    }),
  ]);

  const [class7a, class7b, class8a] = classRows;
  const classes = [class7a, class7b, class8a];
  const classForIndex = (i: number) => (i < 10 ? class7a : i < 20 ? class7b : class8a);

  const firstNames = [
    "Avery", "Blake", "Casey", "Drew", "Emery", "Finley", "Gray", "Harper", "Indigo", "Jamie",
    "Kai", "Logan", "Morgan", "Noel", "Oakley", "Parker", "Quinn", "Reese", "Sage", "Taylor",
    "Uri", "Vale", "Winter", "Xen", "Yael", "Zuri", "Alex", "Billie", "Cameron", "Dakota",
  ];
  const lastNames = [
    "Nguyen", "Patel", "Garcia", "Kim", "Silva", "Brown", "Lee", "Martinez", "Singh", "Chen",
    "Ali", "Okafor", "Ivanov", "Costa", "Nakamura", "Hughes", "Petrov", "Diaz", "Khan", "Lopez",
    "Walker", "Young", "Baker", "Nelson", "Carter", "Mitchell", "Perez", "Roberts", "Turner", "Phillips",
  ];

  const thisWeekMonday = mondayUtcContaining(new Date());
  const lastWeekMonday = new Date(thisWeekMonday);
  lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);

  const studentWeekData: {
    studentId: string;
    classId: string;
    lastWeek: WeekMetrics;
    thisWeek: WeekMetrics;
  }[] = [];

  for (let i = 0; i < 30; i++) {
    const klass = classForIndex(i);
    const deltas = makeDeltas();
    const tiers = makeTiers();
    const flags = makeFlags();
    const stability = random(0, 100);
    const performance = randomFloat(40, 95);
    const attendance = randomFloat(60, 100);
    const engagement = randomFloat(30, 90);
    const riskScore = randomFloat(10, 90);

    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        classId: klass.id,
        externalId: `FA-${String(i + 1).padStart(3, "0")}`,
        givenName: firstNames[i],
        familyName: lastNames[i],
        displayName: `${firstNames[i]} ${lastNames[i]}`,
        gradeLevel: i < 20 ? "7" : "8",
        cohortYear: 2028,
        demographics: {},
        metadata: { seedIndex: i },
        performance,
        attendance,
        engagement,
        riskScore,
        deltas,
        tiers,
        flags,
        stability,
      },
    });

    const last = buildWeekMetrics(i, 1);
    const thisWeek = buildWeekMetrics(i, 0);

    await prisma.enrollment.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        classId: klass.id,
        status: "active",
        enrolledOn: new Date("2025-08-20"),
      },
    });

    studentWeekData.push({
      studentId: student.id,
      classId: klass.id,
      lastWeek: last,
      thisWeek,
    });
  }

  for (const row of studentWeekData) {
    const rrLast = makeRiskReasons();
    const rdLast = makeRiskDeltas();
    await prisma.weeklyStudentSnapshot.create({
      data: {
        schoolId: school.id,
        studentId: row.studentId,
        weekStartDate: lastWeekMonday,
        performance: row.lastWeek.performance,
        attendance: row.lastWeek.attendance,
        engagement: row.lastWeek.engagement,
        riskScore: row.lastWeek.riskScore,
        riskTier: riskTierFromCategory(row.lastWeek.riskCategory),
        riskComposite: row.lastWeek.riskComposite,
        riskCategory: row.lastWeek.riskCategory,
        riskReasons: rrLast,
        riskStability: row.lastWeek.riskStability,
        riskDeltas: rdLast,
      },
    });

    const rrThis = makeRiskReasons();
    const rdThis = makeRiskDeltas();
    await prisma.weeklyStudentSnapshot.create({
      data: {
        schoolId: school.id,
        studentId: row.studentId,
        weekStartDate: thisWeekMonday,
        performance: row.thisWeek.performance,
        attendance: row.thisWeek.attendance,
        engagement: row.thisWeek.engagement,
        riskScore: row.thisWeek.riskScore,
        riskTier: riskTierFromCategory(row.thisWeek.riskCategory),
        riskComposite: row.thisWeek.riskComposite,
        riskCategory: row.thisWeek.riskCategory,
        riskReasons: rrThis,
        riskStability: row.thisWeek.riskStability,
        riskDeltas: rdThis,
      },
    });
  }

  function avg(nums: number[]): number {
    if (nums.length === 0) return 0;
    return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
  }

  for (const week of [lastWeekMonday, thisWeekMonday] as const) {
    for (const klass of classes) {
      const rows = studentWeekData.filter((r) => r.classId === klass.id);
      const key = week.getTime() === lastWeekMonday.getTime() ? "lastWeek" : "thisWeek";
      const perf = rows.map((r) => r[key].performance);
      const att = rows.map((r) => r[key].attendance);
      const eng = rows.map((r) => r[key].engagement);
      const risk = rows.map((r) => r[key].riskScore);
      const comp = rows.map((r) => r[key].riskComposite);
      const stab = rows.map((r) => r[key].riskStability);
      const cats = rows.map((r) => r[key].riskCategory);
      const low = cats.filter((c) => c === "low").length;
      const med = cats.filter((c) => c === "medium").length;
      const high = cats.filter((c) => c === "high").length;

      await prisma.weeklyClassSnapshot.create({
        data: {
          schoolId: school.id,
          classId: klass.id,
          weekStartDate: week,
          performance: avg(perf),
          attendance: avg(att),
          engagement: avg(eng),
          riskScore: avg(risk),
          riskComposite: avg(comp),
          riskCategory: high >= med && high >= low ? "high" : med >= low ? "medium" : "low",
          riskReasons: makeRiskReasons(),
          riskStability: avg(stab),
          riskDeltas: makeRiskDeltas(),
        },
      });
    }
  }

  for (const week of [lastWeekMonday, thisWeekMonday] as const) {
    const key = week.getTime() === lastWeekMonday.getTime() ? "lastWeek" : "thisWeek";
    const all = studentWeekData.map((r) => r[key]);
    const perf = all.map((m) => m.performance);
    const att = all.map((m) => m.attendance);
    const eng = all.map((m) => m.engagement);
    const comps = all.map((m) => m.riskComposite);
    const cats = all.map((m) => m.riskCategory);
    const low = cats.filter((c) => c === "low").length;
    const med = cats.filter((c) => c === "medium").length;
    const high = cats.filter((c) => c === "high").length;

    await prisma.weeklySchoolSnapshot.create({
      data: {
        schoolId: school.id,
        weekStartDate: week,
        performance: avg(perf),
        attendance: avg(att),
        engagement: avg(eng),
        riskLow: low,
        riskMedium: med,
        riskHigh: high,
        riskAverage: avg(comps),
        interventionsCreated: random(0, 8),
        interventionsResolved: random(0, 5),
        riskComposite: avg(comps),
        riskCategory: high > 12 ? "high" : med > 10 ? "medium" : "low",
        riskReasons: makeRiskReasons(),
        riskStability: random(40, 95),
        riskDeltas: makeRiskDeltas(),
      },
    });
  }

  await prisma.intervention.createMany({
    data: [
      {
        schoolId: school.id,
        teacherId: t7a.id,
        classId: class7a.id,
        studentId: studentWeekData[0].studentId,
        triggerType: "risk_spike",
        description: "Check-in meeting scheduled after composite increase.",
        recommendations: ["Counselor touchpoint", "Parent email"],
        status: "open",
      },
      {
        schoolId: school.id,
        teacherId: t7b.id,
        classId: class7b.id,
        studentId: studentWeekData[12].studentId,
        triggerType: "attendance",
        description: "Attendance recovery plan started.",
        status: "in_progress",
      },
    ],
  });

  console.log("Seed complete:", {
    schoolId: school.id,
    schoolName: school.name,
    thisWeekMonday: thisWeekMonday.toISOString(),
    lastWeekMonday: lastWeekMonday.toISOString(),
    classes: classes.map((c) => ({ id: c.id, name: c.name })),
    students: 30,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
