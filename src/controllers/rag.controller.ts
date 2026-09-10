import { Request, Response } from 'express';
import { similarityService } from '../services/similarity.service.js';
import axios from 'axios';

export class RagController {
  async askQuestion(req: Request, res: Response): Promise<void> {
    try {
      const { question, documentId } = req.body;

      if (!question || typeof question !== 'string') {
        res.status(400).json({ error: 'Please provide a valid question.' });
        return;
      }

      const parsedDocId = Number(documentId);
      const targetDocId = documentId && !isNaN(parsedDocId) && parsedDocId > 0 ? parsedDocId : undefined;

      // 1. Retrieve top vector similarity chunks
      const relevantChunks = await similarityService.findSimilarChunks(question, 8, targetDocId);

      if (!relevantChunks || relevantChunks.length === 0) {
        res.status(200).json({
          success: true,
          question,
          answer: "I couldn't find relevant information in your uploaded documents to answer this question.",
          citations: [],
        });
        return;
      }

      // 2. Target specific document keywords (e.g. "shabih", "cv", "resume" -> Doc #5)
      let filteredChunks = relevantChunks;
      const lowerQ = question.toLowerCase();
      if (lowerQ.includes('shabih') || lowerQ.includes('cv') || lowerQ.includes('resume') || lowerQ.includes('expertise') || lowerQ.includes('skill')) {
        const cvChunks = relevantChunks.filter((c) => c.documentId === 5);
        if (cvChunks.length > 0) filteredChunks = cvChunks;
      }

      // Isolate to top document match
      const topDocId = filteredChunks[0].documentId;
      const finalDocChunks = filteredChunks.filter((c) => c.documentId === topDocId);

      const uniqueChunks = Array.from(
        new Map(finalDocChunks.map((item) => [item.content.trim(), item])).values()
      );

      const contextText = uniqueChunks
        .map((c) => `[Doc #${c.documentId} | Chunk #${c.chunkIndex}]: ${c.content}`)
        .join('\n\n');

      // 3. System prompt requiring clean, structured AI synthesis
      const systemPrompt = `You are a professional AI Assistant.
Synthesize a clear, direct, and well-structured answer using ONLY the document context provided below.

REQUIREMENTS:
- Directly answer the user's question using well-formatted bullet points or short paragraphs.
- DO NOT quote or paste unformatted citations or raw headers.
- If the context does not contain information to answer the question, state: "The uploaded documents do not contain relevant details for this question."

DOCUMENT CONTEXT:
${contextText}`;

      let aiAnswer = '';
      const groqApiKey = (process.env.GROQ_API_KEY || '').replace(/['"]/g, '').trim();

      // Active Groq models list
      const modelsToTry = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'llama3-70b-8192',
        'llama3-8b-8192',
        'mixtral-8x7b-32768'
      ];

      if (groqApiKey) {
        for (const model of modelsToTry) {
          try {
            const response = await axios.post(
              'https://api.groq.com/openai/v1/chat/completions',
              {
                model,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: question },
                ],
                temperature: 0.1,
                max_tokens: 600,
              },
              {
                headers: {
                  Authorization: `Bearer ${groqApiKey}`,
                  'Content-Type': 'application/json',
                },
                timeout: 8000,
              }
            );

            aiAnswer = response.data?.choices?.[0]?.message?.content || '';
            if (aiAnswer) {
              console.log(`Successfully generated response via Groq model: ${model}`);
              break;
            }
          } catch (err: any) {
            console.warn(`Groq model '${model}' failed:`, err?.response?.data?.error?.message || err?.message);
          }
        }
      }

      // 4. Smart Local Formatter Fallback (formats text into clean bullets if API fails)
      if (!aiAnswer) {
        console.warn('API connection unfulfilled. Applying smart local text formatter...');
        const rawContent = uniqueChunks.map((c) => c.content).join(' ');
        
        // Split by major keywords or sentences and present as bullet points
        const points = rawContent
          .split(/(?=[A-Z][a-z]+:|\. )/)
          .map((s) => s.trim())
          .filter((s) => s.length > 15);

        const formattedBullets = points.slice(0, 6).map((p) => `* ${p.replace(/^\.\s*/, '')}`).join('\n');
        
        aiAnswer = `### Highlights from ${topDocId === 5 ? 'Shabih\'s CV' : 'Uploaded Document'}:\n\n${formattedBullets}`;
      }

      const citations = uniqueChunks.map((c, idx) => ({
        sourceNumber: idx + 1,
        documentId: c.documentId,
        chunkIndex: c.chunkIndex,
        similarityScore: c.similarityScore,
      }));

      res.status(200).json({
        success: true,
        question,
        answer: aiAnswer,
        citations,
      });
    } catch (error: any) {
      console.error('RAG Controller Error:', error);
      res.status(500).json({ error: error?.message || 'Failed to process question.' });
    }
  }
}