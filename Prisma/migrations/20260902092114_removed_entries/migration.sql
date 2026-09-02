/*
  Warnings:

  - You are about to drop the `Course` table. If the table is not empty, all the data it contains will be lost.
  - You are about to alter the column `GPA` on the `Results` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Float`.

*/
-- DropIndex
DROP INDEX "Course_code_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Course";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Courses" (
    "CourseID" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "CourseNmae" TEXT NOT NULL,
    "CreditHours" INTEGER,
    "TeacherID" INTEGER,
    CONSTRAINT "Courses_TeacherID_fkey" FOREIGN KEY ("TeacherID") REFERENCES "Teacher" ("TeacherID") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Courses" ("CourseID", "CourseNmae", "CreditHours", "TeacherID") SELECT "CourseID", "CourseNmae", "CreditHours", "TeacherID" FROM "Courses";
DROP TABLE "Courses";
ALTER TABLE "new_Courses" RENAME TO "Courses";
CREATE TABLE "new_Enrollment" (
    "EnrollmentID" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "StudentID" INTEGER NOT NULL,
    "CourseID" INTEGER NOT NULL,
    "EnrollmentDate" TEXT,
    CONSTRAINT "Enrollment_StudentID_fkey" FOREIGN KEY ("StudentID") REFERENCES "Student" ("StudentID") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Enrollment_CourseID_fkey" FOREIGN KEY ("CourseID") REFERENCES "Courses" ("CourseID") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Enrollment" ("CourseID", "EnrollmentDate", "EnrollmentID", "StudentID") SELECT "CourseID", "EnrollmentDate", "EnrollmentID", "StudentID" FROM "Enrollment";
DROP TABLE "Enrollment";
ALTER TABLE "new_Enrollment" RENAME TO "Enrollment";
CREATE TABLE "new_Results" (
    "ResultID" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "EnrollmentID" INTEGER NOT NULL,
    "Grade" TEXT,
    "GPA" REAL,
    CONSTRAINT "Results_EnrollmentID_fkey" FOREIGN KEY ("EnrollmentID") REFERENCES "Enrollment" ("EnrollmentID") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Results" ("EnrollmentID", "GPA", "Grade", "ResultID") SELECT "EnrollmentID", "GPA", "Grade", "ResultID" FROM "Results";
DROP TABLE "Results";
ALTER TABLE "new_Results" RENAME TO "Results";
CREATE TABLE "new_Student" (
    "StudentID" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "StudentName" TEXT NOT NULL,
    "PhoneNo" TEXT,
    "DOB" TEXT,
    "Email" TEXT
);
INSERT INTO "new_Student" ("DOB", "Email", "PhoneNo", "StudentID", "StudentName") SELECT "DOB", "Email", "PhoneNo", "StudentID", "StudentName" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
