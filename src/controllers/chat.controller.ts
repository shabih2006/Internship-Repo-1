import { Request, Response } from 'express';
import ChatService from '../services/chat.service.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

export class ChatController {
  private chatService: ChatService;

  constructor() {
    this.chatService = new ChatService();
  }

  async handleChat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Extract studentId from authenticated JWT payload
      const studentId = req.user?.id || 1;
      
      const result = await this.chatService.generateResponse(studentId, req.body);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getHistory(_req: Request, res: Response): Promise<void> {
    try {
      const history = await this.chatService.getHistory();
      res.status(200).json({ success: true, history });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}