// src/controllers/rag.controller.ts
import { Request, Response } from 'express';
import { similarityService } from '../services/similarity.service.js';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export class RagController {
  async askQuestion(req: Request, res: Response): Promise<void> {
    try {
      // 1. NEW: Accept chat history from the frontend
      const { question, documentId, history = [] } = req.body;

      if (!question || typeof question !== 'string') {
        res.status(400).json({ error: 'Please provide a valid question.' });
        return;
      }

      // 2. Silent Context Retrieval (Search only the active document)
      let contextText = '';
      let citations: any[] = [];

      try {
        const parsedDocId = Number(documentId);
        // Only search if a documentId is actually provided
        const targetDocId = documentId && !isNaN(parsedDocId) && parsedDocId > 0 ? parsedDocId : undefined;

        if (targetDocId) {
          const relevantChunks = await similarityService.findSimilarChunks(question, 3, targetDocId);
          if (relevantChunks && relevantChunks.length > 0) {
            const uniqueChunks = Array.from(
              new Map(relevantChunks.map((item) => [item.content.trim(), item])).values()
            );
            contextText = uniqueChunks.map((c) => `[Doc #${c.documentId}]: ${c.content}`).join('\n\n');
            citations = uniqueChunks.map((c, idx) => ({
              sourceNumber: idx + 1,
              documentId: c.documentId,
              chunkIndex: c.chunkIndex,
              similarityScore: c.similarityScore,
            }));
          }
        }
      } catch (err) {
        console.warn('[RAG] Vector search failed, proceeding without context.');
      }

      // 3. Build the System Prompt
      let systemPrompt = `You are a smart, articulate, and helpful AI assistant.
Answer ANY and ALL questions directly, naturally, and comprehensively.
If relevant document context is provided below, use it to answer. If not, use your general knowledge.
NEVER refuse to answer.`;

      if (contextText) {
        systemPrompt += `\n\nDOCUMENT CONTEXT (Use this to answer if relevant):\n${contextText}`;
      }

      // 4. NEW: Construct the message array with History
      // We map the frontend history format to the LLM format
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((msg: any) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        })),
        { role: 'user', content: question }
      ];

      let aiAnswer = '';

      // Clean Keys
      const groqKey = (process.env.GROQ_API_KEY || '').replace(/['"]/g, '').trim();
      const openRouterKey = (process.env.OPENROUTER_API_KEY || '').replace(/['"]/g, '').trim();

      // 5. Call Groq (Passing the full messages array)
      if (groqKey) {
        const models = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama3-70b-8192'];
        for (const model of models) {
          try {
            console.log(`[RAG] Attempting Groq (${model})...`);
            const response = await axios.post(
              'https://api.groq.com/openai/v1/chat/completions',
              {
                model,
                messages: messages, // <--- Pass full history here
                temperature: 0.7,
                max_tokens: 1000,
              },
              {
                headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
                timeout: 15000,
              }
            );
            aiAnswer = response.data?.choices?.[0]?.message?.content || '';
            if (aiAnswer) { console.log(`[RAG SUCCESS] Groq (${model})`); break; }
          } catch (err: any) {
            console.warn(`[Groq ${model} Failed]:`, err?.response?.data?.error?.message || err?.message);
          }
        }
      }

      // 6. Fallback to OpenRouter
      if (!aiAnswer && openRouterKey) {
        const openRouterModels = ['meta-llama/llama-3.3-70b-instruct:free', 'mistralai/mistral-7b-instruct:free'];
        for (const model of openRouterModels) {
          try {
            console.log(`[RAG] Attempting OpenRouter (${model})...`);
            const response = await axios.post(
              'https://openrouter.ai/api/v1/chat/completions',
              {
                model: model,
                messages: messages, // <--- Pass full history here
              },
              {
                headers: {
                  Authorization: `Bearer ${openRouterKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'http://localhost:3000',
                  'X-Title': 'RAG Assistant',
                },
                timeout: 15000,
              }
            );
            aiAnswer = response.data?.choices?.[0]?.message?.content || '';
            if (aiAnswer) { console.log(`[RAG SUCCESS] OpenRouter (${model})`); break; }
          } catch (err: any) {
            console.warn(`[OpenRouter ${model} Failed]:`, err?.response?.data?.error?.message || err?.message);
          }
        }
      }

      if (!aiAnswer) {
        aiAnswer = `❌ **LLM Connection Failed**: Check terminal logs for API errors.`;
      }

      res.status(200).json({
        success: true,
        question,
        answer: aiAnswer,
        citations: citations.length > 0 ? citations : [],
      });
    } catch (error: any) {
      console.error('[RAG Controller Error]:', error);
      res.status(500).json({ error: error?.message || 'Failed to process question.' });
    }
  }
}