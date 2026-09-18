import { Request, Response } from 'express';
import { sttService } from '../services/stt.service.js';
import { similarityService } from '../services/similarity.service.js';
import { ttsService } from '../services/tts.service.js';
import axios from 'axios';
import https from 'https';

const httpsAgent = new https.Agent({ keepAlive: true });

// UPDATED: BCP-47 → human readable language names for the LLM prompt (Arabic removed)
const LANGUAGE_NAMES: Record<string, string> = {
  'en-US': 'English',
  'ur-PK': 'Urdu',
  'es-ES': 'Spanish',
  'fr-FR': 'French',
  'de-DE': 'German',
  'zh-CN': 'Mandarin Chinese',
};

export class VoiceController {
  async handleAudioUpload(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No audio file uploaded.' });
        return;
      }

      const languageCode: string = (req.body?.language as string) || 'en-US';
      const targetLanguageName = LANGUAGE_NAMES[languageCode] || 'English';

      const transcript = await sttService.transcribeAudio(req.file.path, languageCode);

      if (!transcript) {
        res.status(400).json({ error: 'Could not transcribe speech from audio.' });
        return;
      }

      const rawDocId = req.body?.documentId;
      const targetDocId = rawDocId ? Number(rawDocId) : undefined;

      const isOverviewQuery = /key points|summarize|summary|overview|discuss|about|خلاصہ|اہم نکات/i.test(transcript);
      const topKCount = isOverviewQuery ? 12 : 5;

      const relevantChunks = await similarityService.findSimilarChunks(
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
        const contextText = filteredChunks
          .map(
            (c, idx) =>
              `[Source ${idx + 1} | Document ID: ${c.documentId} | Chunk: #${c.chunkIndex}]\nContent: ${c.content}`
          )
          .join('\n\n');

        const languageDirective =
          targetLanguageName === 'English'
            ? ''
            : `\n\nIMPORTANT: You MUST write your entire answer in ${targetLanguageName}. Do not use English.`;

        const systemPrompt = `You are an AI voice assistant. Provide an extensive, highly detailed, multi-paragraph explanation to answer the user's question using ONLY the provided document context below. Write at least 3 to 4 full paragraphs detailing every section, point, and nuance mentioned in the context.${languageDirective}\n\nDOCUMENT CONTEXT:\n${contextText}`;

        const groqApiKey = process.env.GROQ_API_KEY;
        const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

        try {
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
              timeout: 60000,
              httpsAgent,
            }
          );

          aiAnswer = response.data?.choices?.[0]?.message?.content || 'No answer generated.';
        } catch (apiError: any) {
          console.error('Groq API Error Detail:', apiError?.response?.data || apiError?.message);
          aiAnswer = filteredChunks
            .slice(0, 5)
            .map((c, idx) => `From Source ${idx + 1}: ${c.content}`)
            .join(' ');
        }
      }

      let audioAnswerUrl = null;
      try {
        const audioFilePath = await ttsService.generateSpeech(aiAnswer, languageCode);
        audioAnswerUrl = `http://localhost:3000/${audioFilePath.replace(/\\/g, '/')}`;
      } catch (ttsErr) {
        console.error('TTS Generation Error:', ttsErr);
      }

      res.status(200).json({
        success: true,
        targetDocumentScope: targetDocId ? `Document #${targetDocId}` : 'All Documents',
        languageUsed: targetLanguageName,
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