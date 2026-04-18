import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AssessmentsModule } from "./assessments/assessments.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { AuthModule } from "./auth/auth.module";
import { ClassesModule } from "./classes/classes.module";
import { CohortAnalyticsModule } from "./cohort-analytics/cohort-analytics.module";
import { DashboardsModule } from "./dashboards/dashboards.module";
import { HealthModule } from "./health/health.module";
import { InsightsModule } from "./insights/insights.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { InterventionsModule } from "./interventions/interventions.module";
import { LmsHeatmapsModule } from "./lms-heatmaps/lms-heatmaps.module";
import { PrincipalReportsModule } from "./principal-reports/principal-reports.module";
import { MysqlModule } from "./database/mysql.module";
import { RiskModule } from "./risk/risk.module";
import { SnapshotsModule } from "./snapshots/snapshots.module";
import { StudentsModule } from "./students/students.module";
import { TeacherAnalyticsModule } from "./teacher-analytics/teacher-analytics.module";
import { TeachersModule } from "./teachers/teachers.module";
import { TrendsModule } from "./trends/trends.module";
import { WeeklyReportsModule } from "./weekly-reports/weekly-reports.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MysqlModule,
    TrendsModule,
    AnalyticsModule,
    InsightsModule,
    RiskModule,
    TeacherAnalyticsModule,
    InterventionsModule,
    CohortAnalyticsModule,
    DashboardsModule,
    SnapshotsModule,
    PrincipalReportsModule,
    LmsHeatmapsModule,
    WeeklyReportsModule,
    IntegrationsModule,
    HealthModule,
    AuthModule,
    StudentsModule,
    TeachersModule,
    ClassesModule,
    AssessmentsModule,
    AttendanceModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
