import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service.js';

const chatService = new ChatService();

export class ChatController {
  async handleChat(req: Request, res: Response): Promise<void> {
    try {
      const result = await chatService.generateResponse(req.body);
      res.status(200).json(result);
    } catch (error: any) {
      const status = error.status || 400;
      const message = error.message || 'Failed to process chat request.';
      res.status(status).json({ error: message });
    }
  }
}