import { Request, Response } from 'express';
import { similarityService } from '../services/similarity.service.js';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export class RagController {
  async askQuestion(req: Request, res: Response): Promise<void> {
    try {
      const { question, documentId } = req.body;

      if (!question || typeof question !== 'string') {
        res.status(400).json({ error: 'Please provide a valid question.' });
        return;
      }

      // 1. Silent Context Retrieval (Optional RAG Enhancement)
      let contextText = '';
      let citations: any[] = [];

      try {
        const parsedDocId = Number(documentId);
        const targetDocId = documentId && !isNaN(parsedDocId) && parsedDocId > 0 ? parsedDocId : undefined;

        const relevantChunks = await similarityService.findSimilarChunks(question, 3, targetDocId);
        if (relevantChunks && relevantChunks.length > 0) {
          const uniqueChunks = Array.from(
            new Map(relevantChunks.map((item) => [item.content.trim(), item])).values()
          );

          contextText = uniqueChunks
            .map((c) => `[Doc #${c.documentId}]: ${c.content}`)
            .join('\n\n');

          citations = uniqueChunks.map((c, idx) => ({
            sourceNumber: idx + 1,
            documentId: c.documentId,
            chunkIndex: c.chunkIndex,
            similarityScore: c.similarityScore,
          }));
        }
      } catch (err) {
        // Continue if vector search yields no results
      }

      // 2. Pure ChatGPT / Gemini Style System Prompt
      const systemPrompt = `You are a smart, articulate, witty, and versatile AI assistant.
Answer ANY and ALL questions directly, accurately, naturally, and comprehensively.

INSTRUCTIONS:
- Answer general knowledge, celebrities, geography, science, math, coding, or casual chat using your full intelligence.
- If relevant document context is provided below AND matches the user's inquiry, use it to enrich your answer.
- Do NOT refuse to answer or state "the documents do not contain information". Answer the question directly!

${contextText ? `DOCUMENT CONTEXT (Optional):\n${contextText}` : ''}`;

      let aiAnswer = '';

      // Clean Keys from process.env
      const groqKey = (process.env.GROQ_API_KEY || '').replace(/['"]/g, '').trim();
      const openRouterKey = (process.env.OPENROUTER_API_KEY || '').replace(/['"]/g, '').trim();

      // 3. Live LLM Call 1: Groq API (Llama 3.3 70B Versatile)
      if (groqKey) {
        const models = ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'mixtral-8x7b-32768'];
        for (const model of models) {
          try {
            const response = await axios.post(
              'https://api.groq.com/openai/v1/chat/completions',
              {
                model,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: question },
                ],
                temperature: 0.7,
                max_tokens: 1000,
              },
              {
                headers: {
                  Authorization: `Bearer ${groqKey}`,
                  'Content-Type': 'application/json',
                },
                timeout: 12000,
              }
            );

            aiAnswer = response.data?.choices?.[0]?.message?.content || '';
            if (aiAnswer) {
              console.log(`[REAL AI SUCCESS] Responded via Groq model (${model})`);
              break;
            }
          } catch (err: any) {
            console.warn(`[Groq ${model} Failed]:`, err?.response?.data?.error?.message || err?.message);
          }
        }
      }

      // 4. Live LLM Call 2: OpenRouter API (Google Gemini 2.0 Flash)
      if (!aiAnswer && openRouterKey) {
        try {
          const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
              model: 'google/gemini-2.0-flash-lite-preview-02-05:free',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question },
              ],
            },
            {
              headers: {
                Authorization: `Bearer ${openRouterKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'RAG Assistant',
              },
              timeout: 12000,
            }
          );

          aiAnswer = response.data?.choices?.[0]?.message?.content || '';
          if (aiAnswer) {
            console.log('[REAL AI SUCCESS] Responded via OpenRouter (Gemini Flash)');
          }
        } catch (err: any) {
          console.warn('[OpenRouter Failed]:', err?.response?.data?.error?.message || err?.message);
        }
      }

      // 5. Honest Error State (NO FAKE IF/ELSE FALLBACKS!)
      if (!aiAnswer) {
        aiAnswer = `❌ **Live LLM Connection Failed**: Both Groq and OpenRouter failed to respond. Please check your terminal console logs to see the exact API key or model error!`;
      }

      res.status(200).json({
        success: true,
        question,
        answer: aiAnswer,
        citations: citations.length > 0 ? citations : [],
      });
    } catch (error: any) {
      console.error('RAG Controller Error:', error);
      res.status(500).json({ error: error?.message || 'Failed to process question.' });
    }
  }
}