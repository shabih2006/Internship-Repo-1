import gTTS from 'gtts';
import path from 'path';
import fs from 'fs';

export class TtsService {
  async generateSpeech(text: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const outputDir = 'uploads/audio_answers';
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const filename = `answer-${Date.now()}.mp3`;
        const filePath = path.join(outputDir, filename);

        // Sanitize text length for gTTS if needed
        const cleanText = text.replace(/[*#_`]/g, '').trim() || 'No answer provided.';

        const gtts = new gTTS(cleanText, 'en');
        gtts.save(filePath, (err: any) => {
          if (err) {
            return reject(err);
          }
          resolve(filePath);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const ttsService = new TtsService();