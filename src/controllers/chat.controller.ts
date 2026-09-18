import { Request, Response } from 'express';
import { LiveAIService } from '../services/live-ai.service.js';
import { ChatRepository } from '../repositories/chat.repository.js';
import { similarityService } from '../services/similarity.service.js';
import { buildRagPrompt } from '../config/prompt.config.js';

const liveAIService = new LiveAIService();
const chatRepository = new ChatRepository();

// UPDATED: Removed Arabic
const LANGUAGE_MAP: Record<string, string> = {
  'en-US': 'English',
  'ur-PK': 'Urdu',
  'es-ES': 'Spanish',
  'fr-FR': 'French',
  'de-DE': 'German',
  'zh-CN': 'Mandarin Chinese',
};

export class ChatController {
  async handleChat(req: Request, res: Response): Promise<void> {
    try {
      const { studentId = 1, prompt, documentId, language = 'en-US', targetLanguageName } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Valid prompt string is required.' });
        return;
      }

      let targetLanguage = LANGUAGE_MAP[language] || 'English';
      if (targetLanguageName) {
        const cleanName = targetLanguageName.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
        targetLanguage = cleanName.split('(')[0].trim();
      }

      console.log(`[ChatController] Incoming request. Selected language: ${targetLanguage}`);

      let contextText = '';
      try {
        const targetDocId = documentId ? Number(documentId) : undefined;
        const relevantChunks = await similarityService.findSimilarChunks(prompt, 3, targetDocId);

        if (relevantChunks && relevantChunks.length > 0) {
          contextText = relevantChunks.map((c: any) => c.content).join('\n---\n');
        }
      } catch (searchErr) {
        console.warn('[RAG Search Warning]: Proceeding without document context:', searchErr);
      }

      const finalPrompt = buildRagPrompt(contextText, prompt);

      const reply = await liveAIService.generateResponse(Number(studentId), finalPrompt, targetLanguage);

      res.status(200).json({
        success: true,
        reply,
        languageUsed: targetLanguage,
        retrievedContextUsed: Boolean(contextText),
      });
    } catch (error: any) {
      console.error('[Chat Controller Error]:', error);
      res.status(500).json({ error: error?.message || 'Failed to process request.' });
    }
  }

  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const studentId = Number(req.query.studentId || 1);
      const history = await chatRepository.getAllConversations(studentId);
      res.status(200).json({ success: true, history });
    } catch (error: any) {
      console.error('[Chat History Error]:', error);
      res.status(500).json({ error: error?.message || 'Failed to retrieve chat history.' });
    }
  }

  async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const studentId = Number(req.body.studentId || 1);
      const { preferredLanguage, learningStyle = 'Detailed' } = req.body;

      if (!preferredLanguage || typeof preferredLanguage !== 'string') {
        res.status(400).json({ error: 'preferredLanguage is required.' });
        return;
      }

      const preference = await chatRepository.updateUserPreference(
        studentId,
        preferredLanguage,
        learningStyle
      );
      res.status(200).json({ success: true, preference });
    } catch (error: any) {
      console.error('[Chat Preferences Error]:', error);
      res.status(500).json({ error: error?.message || 'Failed to update preferences.' });
    }
  }
}