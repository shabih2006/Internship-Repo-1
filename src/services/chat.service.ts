import { ChatRequestDto, ChatResponseDto } from '../dtos/chat.dto.js';
import { ChatRepository } from '../repositories/chat.repository.js';

export class ChatService {
  private chatRepository: ChatRepository;

  constructor() {
    this.chatRepository = new ChatRepository();
  }

  // Fetch full multi-turn conversation history from PostgreSQL
  async getHistory() {
    return await this.chatRepository.getAllConversations();
  }

  async generateResponse(dto: ChatRequestDto): Promise<ChatResponseDto> {
    if (!dto.message || dto.message.trim() === '') {
      throw new Error('Message content cannot be empty.');
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    let reply = '';

    // Local fallback for AQ. tokens or dev environments
    if (apiKey.startsWith('AQ.')) {
      const mockReplies = [
        `AI Response: Clean Architecture is a software design philosophy that separates code into distinct layers (Entities, Use Cases, Controllers) to keep business logic independent of frameworks and databases.`,
        `AI Response: Here is a quick joke for you! Why do programmers prefer dark mode? Because light attracts bugs! 🐛`,
        `AI Response: Processing your request regarding "${dto.message}". Everything is structured cleanly!`,
      ];

      reply = mockReplies[2];
      if (dto.message.toLowerCase().includes('clean architecture')) {
        reply = mockReplies[0];
      } else if (dto.message.toLowerCase().includes('joke')) {
        reply = mockReplies[1];
      }
    } else {
      // Standard live API fetch
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: dto.message }] }],
        }),
      });

      const data: any = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch AI response.');
      }

      reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    }

    // Persist conversation to PostgreSQL
    await this.chatRepository.saveConversation(dto.message, reply);

    return { reply };
  }
}