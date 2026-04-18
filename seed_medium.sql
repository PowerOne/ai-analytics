-- ============================================
-- PART 2 — CORE SEED DATA
-- ============================================

-- -------------------------
-- SUBJECTS
-- -------------------------
INSERT INTO subjects (name) VALUES
('Mathematics'),
('Science'),
('English'),
('Arabic'),
('ICT'),
('Physical Education'),
('Art'),
('Music'),
('Social Studies'),
('Electives');

-- -------------------------
-- ADMIN + PRINCIPAL USERS (bcrypt hashed)
-- Password for all: Admin123!
-- bcrypt hash: $2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW
-- -------------------------
INSERT INTO users (email, password_hash, role) VALUES
('admin@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'admin'),
('principal1@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'principal'),
('principal2@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'principal'),
('principal3@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'principal');

-- -------------------------
-- TEACHER USERS (20 teachers)
-- -------------------------
INSERT INTO users (email, password_hash, role) VALUES
('teacher1@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher2@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher3@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher4@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher5@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher6@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher7@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher8@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher9@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher10@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher11@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher12@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher13@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher14@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher15@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher16@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher17@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher18@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher19@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher'),
('teacher20@demo.school', '$2b$10$u1q9zH0e6QFqVhQ0eZxO7uQ3xk7uJtQpFJ6uYl8eQm8QJtq7xJ8yW', 'teacher');

-- -------------------------
-- TEACHER PROFILES (20 names)
-- -------------------------
INSERT INTO teachers (user_id, first_name, last_name, subject_specialization) VALUES
(5, 'Aisha', 'Rahman', 'Mathematics'),
(6, 'Omar', 'Siddiqui', 'Science'),
(7, 'Liam', 'Patel', 'English'),
(8, 'Maya', 'Al-Qasimi', 'Arabic'),
(9, 'Sophia', 'Mendes', 'ICT'),
(10, 'Daniel', 'Hughes', 'Physical Education'),
(11, 'Fatima', 'Khan', 'Art'),
(12, 'Noah', 'Fernandez', 'Music'),
(13, 'Zara', 'Hassan', 'Social Studies'),
(14, 'Ethan', 'Varghese', 'Mathematics'),
(15, 'Layla', 'Nasser', 'Science'),
(16, 'Jonas', 'Petrov', 'English'),
(17, 'Sara', 'Mahmoud', 'Arabic'),
(18, 'Yusuf', 'Karim', 'ICT'),
(19, 'Hana', 'Othman', 'Physical Education'),
(20, 'Rami', 'Saleh', 'Art'),
(21, 'Isabella', 'Costa', 'Music'),
(22, 'Khalid', 'Jabari', 'Social Studies'),
(23, 'Emily', 'Turner', 'Mathematics'),
(24, 'Owen', 'Mitchell', 'Science');

-- -------------------------
-- CLASSES (25 classes)
-- -------------------------
INSERT INTO classes (name, grade, subject_id, teacher_id) VALUES
('Grade 1 - Math', 1, 1, 1),
('Grade 1 - English', 1, 3, 3),
('Grade 1 - Science', 1, 2, 2),
('Grade 2 - Math', 2, 1, 10),
('Grade 2 - English', 2, 3, 11),
('Grade 2 - Science', 2, 2, 12),
('Grade 3 - Math', 3, 1, 14),
('Grade 3 - English', 3, 3, 16),
('Grade 3 - Science', 3, 2, 15),
('Grade 4 - Arabic', 4, 4, 4),
('Grade 4 - ICT', 4, 5, 5),
('Grade 4 - PE', 4, 6, 6),
('Grade 5 - Math', 5, 1, 23),
('Grade 5 - English', 5, 3, 16),
('Grade 5 - Science', 5, 2, 24),
('Grade 6 - Social Studies', 6, 9, 9),
('Grade 6 - Art', 6, 7, 7),
('Grade 6 - Music', 6, 8, 8),
('Grade 7 - Math', 7, 1, 1),
('Grade 7 - Science', 7, 2, 2),
('Grade 8 - English', 8, 3, 3),
('Grade 9 - Arabic', 9, 4, 4),
('Grade 10 - ICT', 10, 5, 5),
('Grade 11 - PE', 11, 6, 6),
('Grade 12 - Electives', 12, 10, 20);
