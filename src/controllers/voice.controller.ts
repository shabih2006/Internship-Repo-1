import { Request, Response } from 'express';
import { sttService } from '../services/stt.service.js';
import { similarityService } from '../services/similarity.service.js';
import { ttsService } from '../services/tts.service.js';
import axios from 'axios';
import https from 'https';

// Keep HTTP connection alive to prevent socket hang-ups during LLM generation
const httpsAgent = new https.Agent({ keepAlive: true });

export class VoiceController {
  async handleAudioUpload(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No audio file uploaded.' });
        return;
      }

      // 1. STT: Transcribe spoken audio
      const transcript = await sttService.transcribeAudio(req.file.path);

      if (!transcript) {
        res.status(400).json({ error: 'Could not transcribe speech from audio.' });
        return;
      }

      // 2. Parse documentId scope
      const rawDocId = req.body?.documentId;
      const targetDocId = rawDocId ? Number(rawDocId) : undefined;

      // 3. Search vector DB for matching context chunks (topK = 12 for overviews)
      const isOverviewQuery = /key points|summarize|summary|overview|discuss|about/i.test(transcript);
      const topKCount = isOverviewQuery ? 12 : 5;

      let relevantChunks = await similarityService.findSimilarChunks(
        transcript,
        topKCount,
        targetDocId
      );

      const MIN_SIMILARITY_THRESHOLD = isOverviewQuery ? 0.0 : 0.25;
      const filteredChunks = relevantChunks.filter(
        (c) => c.similarityScore >= MIN_SIMILARITY_THRESHOLD
      );

      let aiAnswer = '';

      if (filteredChunks.length === 0) {
        aiAnswer = targetDocId
          ? `I could not find relevant context in Document #${targetDocId} to answer your spoken question.`
          : 'I do not have enough relevant information in the uploaded documents to answer your question.';
      } else {
        // Construct RAG prompt
        const contextText = filteredChunks
          .map(
            (c, idx) =>
              `[Source ${idx + 1} | Document ID: ${c.documentId} | Chunk: #${c.chunkIndex}]\nContent: ${c.content}`
          )
          .join('\n\n');

        const systemPrompt = `You are an AI voice assistant. Provide an extensive, highly detailed, multi-paragraph explanation to answer the user's question using ONLY the provided document context below. Write at least 3 to 4 full paragraphs detailing every section, point, and nuance mentioned in the context.\n\nDOCUMENT CONTEXT:\n${contextText}`;

        const groqApiKey = process.env.GROQ_API_KEY;
        const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

        try {
          // Send request to Groq API with 60s timeout and keepAlive agent
          const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              model: groqModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: transcript },
              ],
              temperature: 0.1,
              max_tokens: 1000,
            },
            {
              headers: {
                Authorization: `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json',
              },
              timeout: 60000, // 60s timeout to prevent socket dropouts
              httpsAgent,
            }
          );

          aiAnswer = response.data?.choices?.[0]?.message?.content || 'No answer generated.';
        } catch (apiError: any) {
          console.error('Groq API Error Detail:', apiError?.response?.data || apiError?.message);

          // Full context fallback without length truncation
          aiAnswer = filteredChunks
            .slice(0, 5)
            .map((c, idx) => `From Source ${idx + 1}: ${c.content}`)
            .join(' ');
        }
      }

      // 4. TTS: Synthesize answer text into audio .mp3 file
      let audioAnswerUrl = null;
      try {
        const audioFilePath = await ttsService.generateSpeech(aiAnswer);
        audioAnswerUrl = `http://localhost:3000/${audioFilePath.replace(/\\/g, '/')}`;
      } catch (ttsErr) {
        console.error('TTS Generation Error:', ttsErr);
      }

      // 5. Respond with transcript, AI answer, TTS audio URL, and source citations
      res.status(200).json({
        success: true,
        targetDocumentScope: targetDocId ? `Document #${targetDocId}` : 'All Documents',
        transcript,
        answer: aiAnswer,
        audioAnswerUrl,
        citations: filteredChunks.map((c, idx) => ({
          sourceNumber: idx + 1,
          documentId: c.documentId,
          chunkIndex: c.chunkIndex,
          similarityScore: c.similarityScore,
          snippet: c.content.substring(0, 150) + '...',
        })),
      });
    } catch (error: any) {
      console.error('Voice Processing Error:', error);
      res.status(500).json({ error: error?.message || 'Failed to process voice query.' });
    }
  }
}