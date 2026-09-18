import gTTS from 'gtts';
import fs from 'fs';
import path from 'path';

// UPDATED: Map BCP-47 → gTTS ISO-639-1 (Arabic removed)
const GTTS_LANG_MAP: Record<string, string> = {
  'en-US': 'en',
  'ur-PK': 'ur',
  'es-ES': 'es',
  'fr-FR': 'fr',
  'de-DE': 'de',
  'zh-CN': 'zh-CN',
};

// Helper: Detect if text contains Urdu/Arabic script characters
const isUrduScript = (text: string): boolean => {
  const urduRegex = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return urduRegex.test(text);
};

export class TtsService {
  private outputDir: string;

  constructor() {
    this.outputDir = path.resolve(process.cwd(), 'uploads', 'audio_answers');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateSpeech(text: string, languageCode: string = 'en-US'): Promise<string> {
    this.ensureDirectoryExists();

    const filename = `answer-${Date.now()}.mp3`;
    const filePath = path.join(this.outputDir, filename);

    // 1. Sanitize text
    const plainText = text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\[Source\s*\d+\]/gi, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/[*#_`~>-]/g, ' ')
      .replace(/[\r\n]+/g, '. ')
      .replace(/\s+/g, ' ')
      .replace(/\.\s*\./g, '.')
      .trim();

    const finalText = plainText || 'No answer provided.';

    // UPDATED: Detect if text is actually Urdu and use Urdu TTS
    const textIsUrdu = isUrduScript(finalText);
    let gttsLang: string;

    if (textIsUrdu) {
      gttsLang = 'ur';
      console.log('[TTS] Detected Urdu text, using Urdu TTS voice');
    } else {
      gttsLang = GTTS_LANG_MAP[languageCode] || 'en';
    }

    // 2. Sentence & Clause Aware Chunking
    const maxChunk = gttsLang === 'ur' ? 100 : 150;
    const chunks = this.splitIntoChunks(finalText, maxChunk);

    if (chunks.length === 1) {
      await this.saveChunkToFile(chunks[0], filePath, gttsLang);
      return filePath;
    }

    const tempFiles: string[] = [];

    try {
      for (let i = 0; i < chunks.length; i++) {
        const tempPath = path.join(this.outputDir, `temp-${Date.now()}-${i}.mp3`);
        await this.saveChunkToFile(chunks[i], tempPath, gttsLang);
        tempFiles.push(tempPath);
      }

      const audioBuffers = tempFiles.map((file) => fs.readFileSync(file));
      fs.writeFileSync(filePath, Buffer.concat(audioBuffers));
    } finally {
      tempFiles.forEach((file) => {
        if (fs.existsSync(file)) {
          try {
            fs.unlinkSync(file);
          } catch (err) {
            console.warn('[TTS Cleanup Warning]: Could not delete temp file:', file);
          }
        }
      });
    }

    return filePath;
  }

  private splitIntoChunks(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining.trim());
        break;
      }

      let splitIndex = -1;
      const sentenceEndMatches = [...remaining.matchAll(/[\.\!\?۔]\s/g)]; // include Urdu full stop ۔
      for (const match of sentenceEndMatches) {
        if (match.index! + 1 <= maxLength) {
          splitIndex = match.index! + 1;
        } else {
          break;
        }
      }

      if (splitIndex === -1) {
        const clauseMatches = [...remaining.matchAll(/[\,\;\:،]\s/g)]; // include Urdu comma ،
        for (const match of clauseMatches) {
          if (match.index! + 1 <= maxLength) {
            splitIndex = match.index! + 1;
          } else {
            break;
          }
        }
      }

      if (splitIndex === -1) {
        splitIndex = remaining.lastIndexOf(' ', maxLength);
      }

      if (splitIndex === -1 || splitIndex === 0) {
        splitIndex = maxLength;
      }

      const chunk = remaining.substring(0, splitIndex).trim();
      if (chunk) chunks.push(chunk);
      remaining = remaining.substring(splitIndex).trim();
    }

    return chunks;
  }

  private saveChunkToFile(text: string, filePath: string, lang: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const gtts = new gTTS(text, lang);
      gtts.save(filePath, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}

export const ttsService = new TtsService();