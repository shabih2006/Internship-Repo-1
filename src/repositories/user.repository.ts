import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { Email: email } });
  }

  async createUser(data: { Email: string; Password: string; Role: string }) {
    return prisma.user.create({
      data,
    });
  }
}