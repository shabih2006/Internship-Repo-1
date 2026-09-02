/*
  Warnings:

  - The primary key for the `Enrollment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `courseId` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the column `studentId` on the `Enrollment` table. All the data in the column will be lost.
  - The primary key for the `Student` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Student` table. All the data in the column will be lost.
  - Added the required column `CourseID` to the `Enrollment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `StudentID` to the `Enrollment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `StudentName` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Courses" (
    "CourseID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "CourseNmae" TEXT NOT NULL,
    "CreditHours" INTEGER,
    "TeacherID" INTEGER,
    CONSTRAINT "Courses_TeacherID_fkey" FOREIGN KEY ("TeacherID") REFERENCES "Teacher" ("TeacherID") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "Results" (
    "ResultID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "EnrollmentID" INTEGER NOT NULL,
    "Grade" TEXT,
    "GPA" DECIMAL,
    CONSTRAINT "Results_EnrollmentID_fkey" FOREIGN KEY ("EnrollmentID") REFERENCES "Enrollment" ("EnrollmentID") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "Teacher" (
    "TeacherID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "TeacherName" TEXT NOT NULL,
    "Email" TEXT,
    "PhoneNo" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Enrollment" (
    "EnrollmentID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "StudentID" INTEGER NOT NULL,
    "CourseID" INTEGER NOT NULL,
    "EnrollmentDate" DATETIME,
    CONSTRAINT "Enrollment_CourseID_fkey" FOREIGN KEY ("CourseID") REFERENCES "Courses" ("CourseID") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "Enrollment_StudentID_fkey" FOREIGN KEY ("StudentID") REFERENCES "Student" ("StudentID") ON DELETE NO ACTION ON UPDATE NO ACTION
);
DROP TABLE "Enrollment";
ALTER TABLE "new_Enrollment" RENAME TO "Enrollment";
CREATE TABLE "new_Student" (
    "StudentID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "StudentName" TEXT NOT NULL,
    "PhoneNo" TEXT,
    "DOB" DATETIME,
    "Email" TEXT
);
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
