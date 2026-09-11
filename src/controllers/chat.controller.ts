import { Request, Response } from 'express';
import { LiveAIService } from '../services/live-ai.service.js';
import { similarityService } from '../services/similarity.service.js';

const liveAIService = new LiveAIService();

export class ChatController {
  async handleChat(req: Request, res: Response): Promise<void> {
    try {
      const { studentId = 1, prompt, documentId } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Valid prompt string is required.' });
        return;
      }

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
        finalPrompt = `RELEVANT DOCUMENT CONTEXT:\n${contextText}\n\nUSER QUESTION: ${prompt}\n\nINSTRUCTIONS: Answer using the document context above if relevant. Otherwise, use your broad internal knowledge base.`;
      }

      const reply = await liveAIService.generateResponse(Number(studentId), finalPrompt);

      res.status(200).json({
        success: true,
        reply,
        retrievedContextUsed: Boolean(contextText),
      });
    } catch (error: any) {
      console.error('[Chat Controller Error]:', error);
      res.status(500).json({ error: error?.message || 'Failed to process request.' });
    }
  }
}