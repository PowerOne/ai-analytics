-- =============================================================================
-- learning_analytics — canonical MySQL 8 schema (aligned with apps/api)
-- =============================================================================
-- Source: mysqldump --no-data from a migrated Docker instance (MySQL 8.4).
-- Excluded: _legacy_attendance_migrated (optional rename target after data move).
--
-- New database:
--   mysql … -e "CREATE DATABASE learning_analytics CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
--   mysql … learning_analytics < schema.sql
--
-- Existing installs: prefer ordered scripts under sql/ rather than replaying
-- this file in full.
--
-- Tenant bootstrap (placeholder school, roles, default term): run the ordered
-- SQL migrations under sql/ (e.g. 20260416_users_auth_tenant_migration.sql and
-- 20260416_schema_api_alignment.sql) after this DDL, or insert equivalent seed rows.
-- =============================================================================

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `assessment_results`
--

DROP TABLE IF EXISTS `assessment_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_results` (
  `id` varchar(36) NOT NULL,
  `school_id` varchar(36) NOT NULL,
  `assessment_id` int NOT NULL,
  `student_id` int NOT NULL,
  `score_percent` decimal(12,6) NOT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_ar_school_assessment` (`school_id`,`assessment_id`),
  KEY `idx_ar_student` (`school_id`,`student_id`,`deleted_at`),
  KEY `fk_ar_assessment` (`assessment_id`),
  KEY `fk_ar_student` (`student_id`),
  CONSTRAINT `fk_ar_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `assessments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ar_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `fk_ar_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assessments`
--

DROP TABLE IF EXISTS `assessments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `school_id` varchar(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `class_id` int NOT NULL,
  `assessment_type` enum('quiz','homework','exam','project') NOT NULL,
  `max_score` decimal(5,2) NOT NULL,
  `administered_on` date NOT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `term_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `class_id` (`class_id`),
  KEY `fk_assessments_school` (`school_id`),
  CONSTRAINT `assessments_ibfk_2` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assessments_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `attendance_records`
--

DROP TABLE IF EXISTS `attendance_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_records` (
  `id` varchar(36) NOT NULL,
  `school_id` varchar(36) NOT NULL,
  `class_id` int NOT NULL,
  `student_id` int NOT NULL,
  `session_date` date NOT NULL,
  `session_index` int NOT NULL DEFAULT '0',
  `status` varchar(32) NOT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_att_school_class_date` (`school_id`,`class_id`,`session_date`),
  KEY `idx_att_student` (`school_id`,`student_id`,`deleted_at`),
  KEY `fk_att_class` (`class_id`),
  KEY `fk_att_student` (`student_id`),
  CONSTRAINT `fk_att_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_att_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `fk_att_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `classes`
--

DROP TABLE IF EXISTS `classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `classes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `school_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `section_code` varchar(64) DEFAULT NULL,
  `room` varchar(64) DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `grade` int NOT NULL,
  `subject_id` int NOT NULL,
  `term_id` int NOT NULL,
  `primary_teacher_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `subject_id` (`subject_id`),
  KEY `teacher_id` (`primary_teacher_id`),
  KEY `fk_classes_school` (`school_id`),
  KEY `fk_classes_term` (`term_id`),
  CONSTRAINT `classes_ibfk_1` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `classes_ibfk_2` FOREIGN KEY (`primary_teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_classes_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `fk_classes_term` FOREIGN KEY (`term_id`) REFERENCES `terms` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `enrollments`
--

DROP TABLE IF EXISTS `enrollments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `enrollments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `school_id` varchar(36) NOT NULL,
  `student_id` int NOT NULL,
  `class_id` int NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'active',
  `role` varchar(32) NOT NULL DEFAULT 'student',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `enrolled_on` date DEFAULT NULL,
  `enrollment_date` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `student_id` (`student_id`),
  KEY `class_id` (`class_id`),
  KEY `fk_enrollments_school` (`school_id`),
  CONSTRAINT `enrollments_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `enrollments_ibfk_2` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollments_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `interventions`
--

DROP TABLE IF EXISTS `interventions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `interventions` (
  `id` varchar(36) NOT NULL,
  `school_id` varchar(36) NOT NULL,
  `teacher_id` int NOT NULL,
  `class_id` int DEFAULT NULL,
  `student_id` int DEFAULT NULL,
  `trigger_type` varchar(128) NOT NULL,
  `description` text NOT NULL,
  `notes` text,
  `recommendations` json DEFAULT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'open',
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_int_school_created` (`school_id`,`created_at`),
  KEY `idx_int_school_teacher` (`school_id`,`teacher_id`),
  KEY `fk_int_teacher` (`teacher_id`),
  KEY `fk_int_class` (`class_id`),
  KEY `fk_int_student` (`student_id`),
  CONSTRAINT `fk_int_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_int_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `fk_int_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_int_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lms_activity_events`
--

DROP TABLE IF EXISTS `lms_activity_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lms_activity_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `school_id` varchar(36) NOT NULL,
  `student_id` int NOT NULL,
  `class_id` int DEFAULT NULL,
  `occurred_at` timestamp(3) NOT NULL,
  `event_type` varchar(64) NOT NULL DEFAULT 'activity',
  `engagement_score` decimal(14,6) DEFAULT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'active',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_lms_school_student_time` (`school_id`,`student_id`,`deleted_at`,`occurred_at`),
  KEY `idx_lms_school_class_time` (`school_id`,`class_id`,`deleted_at`,`occurred_at`),
  KEY `fk_lms_student` (`student_id`),
  KEY `fk_lms_class` (`class_id`),
  CONSTRAINT `fk_lms_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_lms_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `fk_lms_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `risk_scores`
--

DROP TABLE IF EXISTS `risk_scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `risk_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `risk_level` enum('low','medium','high') NOT NULL,
  `score` decimal(5,2) NOT NULL,
  `generated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `student_id` (`student_id`),
  CONSTRAINT `risk_scores_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `schools`
--

DROP TABLE IF EXISTS `schools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schools` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students` (
  `id` int NOT NULL AUTO_INCREMENT,
  `school_id` varchar(36) NOT NULL,
  `given_name` varchar(100) DEFAULT NULL,
  `family_name` varchar(100) DEFAULT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `external_source` varchar(64) DEFAULT NULL,
  `external_id` varchar(128) DEFAULT NULL,
  `grade_level` varchar(32) DEFAULT NULL,
  `cohort_year` int DEFAULT NULL,
  `demographics` json DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `performance` decimal(12,6) DEFAULT NULL,
  `attendance` decimal(12,6) DEFAULT NULL,
  `engagement` decimal(12,6) DEFAULT NULL,
  `risk_score` decimal(12,6) DEFAULT NULL,
  `deltas` json DEFAULT NULL,
  `tiers` json DEFAULT NULL,
  `flags` json DEFAULT NULL,
  `stability` decimal(12,6) DEFAULT NULL,
  `class_id` int DEFAULT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `gender` enum('male','female') NOT NULL,
  `date_of_birth` date NOT NULL,
  `guardian_contact` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_students_school` (`school_id`),
  CONSTRAINT `fk_students_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `subjects`
--

DROP TABLE IF EXISTS `subjects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subjects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `school_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `code` varchar(64) NOT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subjects_school_code` (`school_id`,`code`),
  CONSTRAINT `fk_subjects_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `teachers`
--

DROP TABLE IF EXISTS `teachers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teachers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `school_id` varchar(36) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `given_name` varchar(100) DEFAULT NULL,
  `family_name` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `subject_specialization` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `fk_teachers_school` (`school_id`),
  CONSTRAINT `fk_teachers_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `teachers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `terms`
--

DROP TABLE IF EXISTS `terms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `terms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `school_id` varchar(36) NOT NULL,
  `label` varchar(255) NOT NULL,
  `starts_on` date DEFAULT NULL,
  `ends_on` date DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_terms_school` (`school_id`),
  CONSTRAINT `fk_terms_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `school_id` varchar(36) DEFAULT NULL,
  `teacher_id` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `student_id` int DEFAULT NULL COMMENT 'optional: future student-login',
  `role` enum('ADMIN','PRINCIPAL','TEACHER') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_school_id` (`school_id`),
  KEY `idx_users_teacher_id` (`teacher_id`),
  CONSTRAINT `fk_users_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `fk_users_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `weekly_class_snapshots`
--

DROP TABLE IF EXISTS `weekly_class_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `weekly_class_snapshots` (
  `id` varchar(36) NOT NULL,
  `schoolId` varchar(36) NOT NULL,
  `classId` varchar(36) NOT NULL,
  `weekStartDate` date NOT NULL,
  `performance` decimal(14,6) DEFAULT NULL,
  `attendance` decimal(14,6) DEFAULT NULL,
  `engagement` decimal(14,6) DEFAULT NULL,
  `riskScore` decimal(14,6) DEFAULT NULL,
  `riskComposite` decimal(14,6) DEFAULT NULL,
  `riskCategory` varchar(64) DEFAULT NULL,
  `riskReasons` json DEFAULT NULL,
  `riskStability` decimal(14,6) DEFAULT NULL,
  `riskDeltas` json DEFAULT NULL,
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_wcs_class_week` (`schoolId`,`classId`,`weekStartDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `weekly_cohort_snapshots`
--

DROP TABLE IF EXISTS `weekly_cohort_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `weekly_cohort_snapshots` (
  `id` varchar(36) NOT NULL,
  `schoolId` varchar(36) NOT NULL,
  `cohortType` varchar(32) NOT NULL,
  `cohortId` varchar(255) NOT NULL,
  `weekStartDate` date NOT NULL,
  `name` varchar(512) NOT NULL,
  `performance` decimal(14,6) DEFAULT NULL,
  `attendance` decimal(14,6) DEFAULT NULL,
  `engagement` decimal(14,6) DEFAULT NULL,
  `riskLow` int DEFAULT NULL,
  `riskMedium` int DEFAULT NULL,
  `riskHigh` int DEFAULT NULL,
  `riskAverage` decimal(14,6) DEFAULT NULL,
  `interventions` int DEFAULT '0',
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_wcoh_school_week` (`schoolId`,`weekStartDate`),
  KEY `idx_wcoh_lookup` (`schoolId`,`cohortType`,`cohortId`,`weekStartDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `weekly_school_snapshots`
--

DROP TABLE IF EXISTS `weekly_school_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `weekly_school_snapshots` (
  `id` varchar(36) NOT NULL,
  `schoolId` varchar(36) NOT NULL,
  `weekStartDate` date NOT NULL,
  `performance` decimal(14,6) DEFAULT NULL,
  `attendance` decimal(14,6) DEFAULT NULL,
  `engagement` decimal(14,6) DEFAULT NULL,
  `riskLow` int DEFAULT NULL,
  `riskMedium` int DEFAULT NULL,
  `riskHigh` int DEFAULT NULL,
  `riskAverage` decimal(14,6) DEFAULT NULL,
  `interventionsCreated` int DEFAULT '0',
  `interventionsResolved` int DEFAULT '0',
  `riskComposite` decimal(14,6) DEFAULT NULL,
  `riskCategory` varchar(64) DEFAULT NULL,
  `riskReasons` json DEFAULT NULL,
  `riskStability` decimal(14,6) DEFAULT NULL,
  `riskDeltas` json DEFAULT NULL,
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_wsch_school_week` (`schoolId`,`weekStartDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `weekly_student_snapshots`
--

DROP TABLE IF EXISTS `weekly_student_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `weekly_student_snapshots` (
  `id` varchar(36) NOT NULL,
  `schoolId` varchar(36) NOT NULL,
  `studentId` varchar(36) NOT NULL,
  `weekStartDate` date NOT NULL,
  `performance` decimal(14,6) DEFAULT NULL,
  `attendance` decimal(14,6) DEFAULT NULL,
  `engagement` decimal(14,6) DEFAULT NULL,
  `riskScore` decimal(14,6) DEFAULT NULL,
  `riskTier` varchar(32) DEFAULT NULL,
  `riskComposite` decimal(14,6) DEFAULT NULL,
  `riskCategory` varchar(64) DEFAULT NULL,
  `riskReasons` json DEFAULT NULL,
  `riskStability` decimal(14,6) DEFAULT NULL,
  `riskDeltas` json DEFAULT NULL,
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_wss_student_week` (`schoolId`,`studentId`,`weekStartDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- End of schema

