import gTTS from 'gtts';
import fs from 'fs';
import path from 'path';

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

  async generateSpeech(text: string): Promise<string> {
    this.ensureDirectoryExists();

    const filename = `answer-${Date.now()}.mp3`;
    const filePath = path.join(this.outputDir, filename);

    // 1. Sanitize text: remove markdown, URLs, citations, and extra punctuation
    const plainText = text
      .replace(/https?:\/\/\S+/g, '') // Remove URLs
      .replace(/\[Source\s*\d+\]/gi, '') // Remove citations
      .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
      .replace(/[*#_`~>-]/g, ' ') // Remove markdown headers/formatting
      .replace(/[\r\n]+/g, '. ') // Turn newlines into periods
      .replace(/\s+/g, ' ') // Collapse spaces
      .replace(/\.\s*\./g, '.') // Fix double periods
      .trim();

    const finalText = plainText || 'No answer provided.';

    // 2. Sentence & Clause Aware Chunking (Max 150 chars per request)
    const chunks = this.splitIntoChunks(finalText, 150);

    // If single chunk, save directly without temporary files
    if (chunks.length === 1) {
      await this.saveChunkToFile(chunks[0], filePath);
      return filePath;
    }

    // 3. Process multiple chunks safely
    const tempFiles: string[] = [];

    try {
      for (let i = 0; i < chunks.length; i++) {
        const tempPath = path.join(this.outputDir, `temp-${Date.now()}-${i}.mp3`);
        await this.saveChunkToFile(chunks[i], tempPath);
        tempFiles.push(tempPath);
      }

      // 4. Merge buffers
      const audioBuffers = tempFiles.map((file) => fs.readFileSync(file));
      fs.writeFileSync(filePath, Buffer.concat(audioBuffers));
    } finally {
      // 5. Cleanup temporary chunk files
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

      // Try splitting by sentence boundary first
      let splitIndex = -1;
      const sentenceEndMatches = [...remaining.matchAll(/[\.\!\?]\s/g)];

      for (const match of sentenceEndMatches) {
        if (match.index! + 1 <= maxLength) {
          splitIndex = match.index! + 1;
        } else {
          break;
        }
      }

      // Fallback to clause boundary (comma, semicolon)
      if (splitIndex === -1) {
        const clauseMatches = [...remaining.matchAll(/[\,\;\:]\s/g)];
        for (const match of clauseMatches) {
          if (match.index! + 1 <= maxLength) {
            splitIndex = match.index! + 1;
          } else {
            break;
          }
        }
      }

      // Fallback to space split
      if (splitIndex === -1) {
        splitIndex = remaining.lastIndexOf(' ', maxLength);
      }

      // Hard cut if no space found
      if (splitIndex === -1 || splitIndex === 0) {
        splitIndex = maxLength;
      }

      const chunk = remaining.substring(0, splitIndex).trim();
      if (chunk) chunks.push(chunk);
      remaining = remaining.substring(splitIndex).trim();
    }

    return chunks;
  }

  private saveChunkToFile(text: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const gtts = new gTTS(text, 'en');
      gtts.save(filePath, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}

export const ttsService = new TtsService();