import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting schema and recreating tables...');

  // 1. Disable foreign key checks to safely drop old tables
  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF;`);

  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS Results;`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS Enrollment;`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS Courses;`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS Teacher;`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS Student;`);

  // 2. Re-enable foreign key checks
  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON;`);

  // 3. Create fresh tables with exact primary/foreign keys
  await prisma.$executeRawUnsafe(`
    CREATE TABLE Student (
      StudentID INT PRIMARY KEY,
      StudentName VARCHAR(100) NOT NULL,
      PhoneNo VARCHAR(20),
      DOB DATE,
      Email VARCHAR(100)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE Teacher (
      TeacherID INT PRIMARY KEY,
      TeacherName VARCHAR(100) NOT NULL,
      Email VARCHAR(100),
      PhoneNo VARCHAR(20)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE Courses (
      CourseID INT PRIMARY KEY,
      CourseNmae VARCHAR(100) NOT NULL,
      CreditHours INT,
      TeacherID INT,
      FOREIGN KEY (TeacherID) REFERENCES Teacher(TeacherID)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE Enrollment (
      EnrollmentID INT PRIMARY KEY,
      StudentID INT NOT NULL,
      CourseID INT NOT NULL,
      EnrollmentDate DATE,
      FOREIGN KEY (StudentID) REFERENCES Student(StudentID),
      FOREIGN KEY (CourseID) REFERENCES Courses(CourseID)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE Results (
      ResultID INT PRIMARY KEY,
      EnrollmentID INT NOT NULL,
      Grade VARCHAR(5),
      GPA DECIMAL(3,2),
      FOREIGN KEY (EnrollmentID) REFERENCES Enrollment(EnrollmentID)
    );
  `);

  console.log('Inserting seed records...');

  // 4. Insert sample data across all 5 tables
  await prisma.$executeRawUnsafe(`
    INSERT INTO Teacher (TeacherID, TeacherName, Email, PhoneNo)
    VALUES (1, 'Dr. Smith', 'smith@example.com', '123-456-7890');
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO Student (StudentID, StudentName, Email, PhoneNo)
    VALUES (1, 'Shabih Haider', 'shabih@example.com', '987-654-3210');
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO Courses (CourseID, CourseNmae, CreditHours, TeacherID)
    VALUES (101, 'Intro to Computer Science', 3, 1);
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO Enrollment (EnrollmentID, StudentID, CourseID, EnrollmentDate)
    VALUES (1, 1, 101, '2026-09-01');
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO Results (ResultID, EnrollmentID, Grade, GPA)
    VALUES (1, 1, 'A', 4.0);
  `);

  console.log('✅ Database seeded with all 5 tables successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });