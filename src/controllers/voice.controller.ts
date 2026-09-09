import { Request, Response } from 'express';
import { sttService } from '../services/stt.service.js';
import { similarityService } from '../services/similarity.service.js';
import { ttsService } from '../services/tts.service.js';
import axios from 'axios';

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

      // 3. Search vector DB for matching context chunks
      const isOverviewQuery = /key points|summarize|summary|overview|discuss|about/i.test(transcript);
      const topKCount = isOverviewQuery ? 5 : 3;

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

        const systemPrompt = `You are an AI voice assistant. Answer the user's spoken question using ONLY the provided document context below. Keep it short and conversational for voice playback. Cite sources like [Source 1].\n\nDOCUMENT CONTEXT:\n${contextText}`;

        try {
          const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
              model: 'meta-llama/llama-3.1-8b-instruct:free',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: transcript },
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

          aiAnswer = response.data?.choices?.[0]?.message?.content || 'No answer generated.';
        } catch (apiError: any) {
          const primarySource = filteredChunks[0];
          aiAnswer = `Based on Document #${primarySource.documentId} [Source 1]: ${primarySource.content.substring(0, 200)}...`;
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