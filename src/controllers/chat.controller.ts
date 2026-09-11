import { Request, Response } from 'express';
import { LiveAIService } from '../services/live-ai.service.js';
import { similarityService } from '../services/similarity.service.js';

const liveAIService = new LiveAIService();

const LANGUAGE_MAP: Record<string, string> = {
  'en-US': 'English',
  'ur-PK': 'Urdu',
  'es-ES': 'Spanish',
  'fr-FR': 'French',
  'de-DE': 'German',
  'zh-CN': 'Mandarin Chinese',
  'ar-SA': 'Arabic',
};

export class ChatController {
  async handleChat(req: Request, res: Response): Promise<void> {
    try {
      const { studentId = 1, prompt, documentId, language = 'en-US', targetLanguageName } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Valid prompt string is required.' });
        return;
      }

      // Determine target language flexibly
      let targetLanguage = LANGUAGE_MAP[language] || 'English';
      if (targetLanguageName) {
        // Strip out emojis from friendly name (e.g., "🇫🇷 French (Français)" -> "French")
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

      let finalPrompt = prompt;
      if (contextText) {
        finalPrompt = `RELEVANT DOCUMENT CONTEXT:\n${contextText}\n\nUSER QUESTION: ${prompt}`;
      }

      // Explicitly prepend prompt level instruction
      const mandatoryLanguagePrompt = `[TRANSLATION MANDATE: YOU MUST ANSWER ENTIRELY IN NATIVE ${targetLanguage.toUpperCase()} SCRIPT. DO NOT USE ENGLISH.]\n\n${finalPrompt}`;

      const reply = await liveAIService.generateResponse(Number(studentId), mandatoryLanguagePrompt, targetLanguage);

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
}