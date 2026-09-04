import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service.js';

const chatService = new ChatService();

export class ChatController {
  async handleChat(req: Request, res: Response): Promise<void> {
    try {
      // Validate input payload before passing to service
      const { message } = req.body;
      if (!message || typeof message !== 'string' || message.trim() === '') {
        res.status(400).json({ error: 'Message content cannot be empty.' });
        return;
      }

      // Delegate request processing & DB storage to service
      const result = await chatService.generateResponse({ message });

      // Return successful response
      res.status(200).json(result);
    } catch (error: any) {
      console.error('ChatController Error:', error);

      // Handle unexpected runtime or database errors cleanly
      const statusCode = error.status || 500;
      const errorMessage = error.message || 'An unexpected error occurred while processing your request.';

      res.status(statusCode).json({ error: errorMessage });
    }
  }

  // Handle fetching multi-turn conversation history
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