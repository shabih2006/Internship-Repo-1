import fs from 'fs';
import Groq from 'groq-sdk';

// UPDATED: Map our BCP-47 codes → Whisper's ISO-639-1 codes (Arabic removed)
const WHISPER_LANG_MAP: Record<string, string> = {
  'en-US': 'en',
  'ur-PK': 'ur',
  'es-ES': 'es',
  'fr-FR': 'fr',
  'de-DE': 'de',
  'zh-CN': 'zh',
};

export class SttService {
  private getGroqClient(): Groq {
    const apiKey = process.env.GROQ_API_KEY || 'dummy_key_fallback';
    return new Groq({ apiKey });
  }

  async transcribeAudio(filePath: string, languageCode: string = 'en-US'): Promise<string> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('Audio file does not exist on server path.');
      }

      const fileStream = fs.createReadStream(filePath);
      const groq = this.getGroqClient();

      const whisperLang = WHISPER_LANG_MAP[languageCode] || 'en';

      const translation = await groq.audio.transcriptions.create({
        file: fileStream,
        model: 'whisper-large-v3-turbo',
        response_format: 'json',
        language: whisperLang,
        temperature: 0.0,
      });

      return translation.text ? translation.text.trim() : '';
    } catch (error: any) {
      console.error('STT Transcription Error:', error);
      throw new Error(`Speech-to-Text failed: ${error?.message || 'Unknown error'}`);
    }
  }
}

export const sttService = new SttService();