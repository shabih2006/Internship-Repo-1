import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class StudentRepository {
  async findAll() {
    return prisma.student.findMany();
  }

  async findById(id: number) {
    return prisma.student.findUnique({ where: { StudentID: id } });
  }

  async create(data: { StudentID: number; StudentName: string; PhoneNo: string; DOB: string; Email: string }) {
    return prisma.student.create({
      data,
    });
  }

  async delete(id: number) {
    return prisma.student.delete({ where: { StudentID: id } });
  }
}