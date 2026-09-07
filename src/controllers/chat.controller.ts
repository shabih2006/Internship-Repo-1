import { Request, Response } from 'express';
import { ChatRepository } from '../repositories/chat.repository.js';
import ChatService from '../services/chat.service.js';

const chatService = new ChatService();

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

export class ChatController {
  async handleChat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { message } = req.body;
      if (!message || typeof message !== 'string' || message.trim() === '') {
        res.status(400).json({ error: 'Message content cannot be empty.' });
        return;
      }

      const studentId = req.user?.id || 1;
      const result = await chatService.generateResponse(studentId, { message });
      res.status(200).json(result);
    } catch (error: any) {
      console.error('ChatController Error:', error);
      res.status(500).json({
        success: false,
        error: 'An internal server error occurred while processing your request.',
      });
    }
  }

  async getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user?.id;
      const history = await chatService.getHistory(studentId);
      res.status(200).json({ success: true, history });
    } catch (error: any) {
      console.error('ChatController History Error:', error);
      res.status(500).json({ error: 'Failed to retrieve chat history.' });
    }
  }

  async updatePreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user?.id || 1;
      const { preferredLanguage, learningStyle } = req.body;

      if (!preferredLanguage) {
        res.status(400).json({ error: 'preferredLanguage is required.' });
        return;
      }

      const repository = new ChatRepository();
      const updated = await repository.updateUserPreference(
        studentId,
        preferredLanguage,
        learningStyle || 'Detailed'
      );

      res.status(200).json({ success: true, preference: updated });
    } catch (error: any) {
      console.error('Update Preferences Error:', error);
      res.status(500).json({ error: 'Failed to update user preferences.' });
    }
  }
}