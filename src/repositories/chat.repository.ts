import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ChatRepository {
  async saveConversation(userPrompt: string, aiReply: string) {
    return await prisma.conversation.create({
      data: {
        userPrompt,
        aiReply,
      },
    });
  }

  async getAllConversations() {
    return await prisma.conversation.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}