import { LiveAIService } from './live-ai.service.js';
import { type IAIService } from './ai.interface.js';

export class AIProxyService implements IAIService {
  private primaryService: LiveAIService;

  constructor() {
    this.primaryService = new LiveAIService();
  }

  async generateResponse(studentId: number, prompt: string): Promise<string> {
    return this.primaryService.generateResponse(studentId, prompt);
  }
}