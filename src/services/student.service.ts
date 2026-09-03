import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class StudentService {
  async getAllStudents() {
    return prisma.student.findMany();
  }

  async getStudentById(id: number) {
    const student = await prisma.student.findUnique({ where: { StudentID: id } });
    if (!student) {
      throw new Error('Student not found.');
    }
    return student;
  }

  async createStudent(data: { StudentID: number; StudentName: string; PhoneNo: string; DOB: string; Email: string }) {
    return prisma.student.create({
      data: {
        StudentID: Number(data.StudentID),
        StudentName: data.StudentName,
        PhoneNo: data.PhoneNo,
        DOB: data.DOB,
        Email: data.Email,
      },
    });
  }

  async deleteStudent(id: number) {
    return prisma.student.delete({ where: { StudentID: id } });
  }
}