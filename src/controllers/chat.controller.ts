import { Request, Response } from 'express';
import ChatService from '../services/chat.service.js';

const chatService = new ChatService();

export class ChatController {
  async handleChat(req: Request, res: Response): Promise<void> {
    try {
      const { message } = req.body;
      if (!message || typeof message !== 'string' || message.trim() === '') {
        res.status(400).json({ error: 'Message content cannot be empty.' });
        return;
      }

      const result = await chatService.generateResponse({ message });
      res.status(200).json(result);
    } catch (error: any) {
      console.error('ChatController Error:', error);

      const statusCode = error.status || 500;
      const errorMessage = error.message || 'Our AI assistant is temporarily unavailable. Please try again later.';

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  async getHistory(_req: Request, res: Response): Promise<void> {
    try {
      const history = await chatService.getHistory();
      res.status(200).json({ history });
    } catch (error: any) {
      console.error('ChatController History Error:', error);
      res.status(500).json({ error: 'Failed to retrieve chat history.' });
    }
  }
}