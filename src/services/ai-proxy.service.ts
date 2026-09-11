import { LiveAIService } from './live-ai.service.js';

export class AIProxyService {
  private liveAIService: LiveAIService;

  constructor() {
    this.liveAIService = new LiveAIService();
  }

  async generateResponse(studentId: number, prompt: string): Promise<string> {
    return await this.liveAIService.generateResponse(studentId, prompt);
  }
}