import { LiveAIService } from './live-ai.service.js';

export class AIProxyService {
  private liveAIService: LiveAIService;

  constructor() {
    this.liveAIService = new LiveAIService();
  }
  // Increase token limit for full, detailed answers
max_tokens: 1000; // Change from 150/200 to 1000+
  async generateResponse(studentId: number, prompt: string): Promise<string> {
    return await this.liveAIService.generateResponse(studentId, prompt);
  }
}