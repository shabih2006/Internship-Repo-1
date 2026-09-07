import { ChatRequestDto, ChatResponseDto } from '../dtos/chat.dto.js';
import { ChatRepository } from '../repositories/chat.repository.js';
import { AIProxyService } from './ai-proxy.service.js';

export default class ChatService {
  private aiProxyService: AIProxyService;
  private chatRepository: ChatRepository;

  constructor() {
    this.aiProxyService = new AIProxyService();
    this.chatRepository = new ChatRepository();
  }

  async getHistory(studentId?: number) {
    return await this.chatRepository.getAllConversations(studentId);
  }

  async generateResponse(studentId: number, dto: ChatRequestDto): Promise<ChatResponseDto> {
    if (!dto.message || dto.message.trim() === '') {
      throw new Error('Message content cannot be empty.');
    }

    const reply = await this.aiProxyService.generateResponse(studentId, dto.message);
    return { reply };
  }
}