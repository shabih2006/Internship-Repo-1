import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ChatRepository {
  async saveConversation(studentId: number, role: string, message: string) {
    return await prisma.conversation.create({
      data: {
        studentId,
        role,
        message,
      },
    });
  }

  async getAllConversations(studentId?: number) {
    if (studentId) {
      return await prisma.conversation.findMany({
        where: { studentId },
        orderBy: { id: 'asc' },
      });
    }
    return await prisma.conversation.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async getRecentConversations(studentId: number, limit: number = 10) {
    const messages = await prisma.conversation.findMany({
      where: { studentId },
      orderBy: { id: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }

  async getUserPreference(studentId: number) {
    return await prisma.userPreference.findUnique({
      where: { studentId },
    });
  }

  async updateUserPreference(studentId: number, preferredLanguage: string, learningStyle: string = 'Detailed') {
    return await prisma.userPreference.upsert({
      where: { studentId },
      update: { preferredLanguage, learningStyle },
      create: { studentId, preferredLanguage, learningStyle },
    });
  }
}