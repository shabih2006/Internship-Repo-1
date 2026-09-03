import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding fresh data into PostgreSQL...');

  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  // 1. Seed Users
  await prisma.user.createMany({
    data: [
      { Email: 'admin@cs.edu', Password: adminPassword, Role: 'ADMIN' },
      { Email: 'student@cs.edu', Password: userPassword, Role: 'USER' },
    ],
  });

  // 2. Seed Teachers
  await prisma.teacher.createMany({
    data: [
      { TeacherID: 1, TeacherName: 'Dr. Usman Ali', Email: 'usman@umt.edu.pk', PhoneNo: '122-3456-5423' },
      { TeacherID: 2, TeacherName: 'Arsalan Ahmed', Email: 'arsalan@cs.edu', PhoneNo: '555-0199-8821' },
    ],
  });

  // 3. Seed Students
  await prisma.student.createMany({
    data: [
      { StudentID: 101, StudentName: 'Shabih Haider', PhoneNo: '0300-1234567', DOB: '2002-05-14', Email: 'shabih@univ.edu.pk' },
      { StudentID: 102, StudentName: 'Hassan Naeem', PhoneNo: '0311-7654321', DOB: '2003-08-22', Email: 'hassan@univ.edu.pk' },
    ],
  });

  // 4. Seed Courses
  await prisma.courses.createMany({
    data: [
      { CourseID: 201, CourseNmae: 'Database Systems', CreditHours: 3, TeacherID: 1 },
      { CourseID: 202, CourseNmae: 'Data Structures', CreditHours: 4, TeacherID: 2 },
    ],
  });

  // 5. Seed Enrollments
  await prisma.enrollment.createMany({
    data: [
      { EnrollmentID: 501, StudentID: 101, CourseID: 201, EnrollmentDate: '2026-09-02' },
      { EnrollmentID: 502, StudentID: 102, CourseID: 202, EnrollmentDate: '2026-09-02' },
    ],
  });

  // 6. Seed Results
  await prisma.results.createMany({
    data: [
      { ResultID: 901, EnrollmentID: 501, Grade: 'A+', GPA: 4.0 },
      { ResultID: 902, EnrollmentID: 502, Grade: 'A', GPA: 3.7 },
    ],
  });

  console.log('🎉 PostgreSQL database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });