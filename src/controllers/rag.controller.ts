import { Request, Response } from 'express';
import { similarityService } from '../services/similarity.service.js';
import axios from 'axios';

export class RagController {
  async askQuestion(req: Request, res: Response): Promise<void> {
    try {
      const { question, documentId } = req.body; // Target specific doc via documentId

      if (!question || typeof question !== 'string') {
        res.status(400).json({ error: 'Please provide a valid question.' });
        return;
      }

      // Pass documentId (parsed as number if provided)
      const targetDocId = documentId ? Number(documentId) : undefined;
      const relevantChunks = await similarityService.findSimilarChunks(question, 3, targetDocId);

      const MIN_SIMILARITY_THRESHOLD = 0.25;
      const filteredChunks = relevantChunks.filter(
        (c) => c.similarityScore >= MIN_SIMILARITY_THRESHOLD
      );

      if (filteredChunks.length === 0) {
        res.status(200).json({
          success: true,
          question,
          answer: targetDocId
            ? `I could not find relevant context in Document #${targetDocId} to answer this question.`
            : "I do not have enough relevant information in the uploaded documents to answer this question.",
          citations: [],
        });
        return;
      }

      const contextText = filteredChunks
        .map(
          (c, idx) =>
            `[Source ${idx + 1} | Document ID: ${c.documentId} | Chunk: #${c.chunkIndex}]\nContent: ${c.content}`
        )
        .join('\n\n');

      const systemPrompt = `You are a strict, helpful AI assistant. Answer the user's question ONLY using the provided document context below. If the context does not contain the answer, state that you do not know.\n\nDOCUMENT CONTEXT:\n${contextText}`;

      let aiAnswer = '';
      try {
        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'meta-llama/llama-3.1-8b-instruct:free',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: question },
            ],
            temperature: 0.1,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || 'sk-or-v1-guest'}`,
              'Content-Type': 'application/json',
            },
          }
        );

        aiAnswer = response.data?.choices?.[0]?.message?.content || '';
      } catch (apiError: any) {
        const primarySource = filteredChunks[0];
        aiAnswer = `Based on Document #${primarySource.documentId} [Source 1]: ${primarySource.content.substring(0, 200)}...`;
      }

      const citations = filteredChunks.map((c, idx) => ({
        sourceNumber: idx + 1,
        documentId: c.documentId,
        chunkIndex: c.chunkIndex,
        similarityScore: c.similarityScore,
        snippet: c.content.substring(0, 150) + '...',
      }));

      res.status(200).json({
        success: true,
        question,
        targetDocumentId: targetDocId || 'All Documents',
        answer: aiAnswer,
        citations,
      });
    } catch (error: any) {
      console.error('RAG Query Error:', error);
      res.status(500).json({ error: error?.message || 'Failed to process question.' });
    }
  }
}