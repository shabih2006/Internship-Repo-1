import gTTS from 'gtts';
import fs from 'fs';
import path from 'path';

export class TtsService {
  async generateSpeech(text: string): Promise<string> {
    const outputDir = 'uploads/audio_answers';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `answer-${Date.now()}.mp3`;
    const filePath = path.join(outputDir, filename);

    // 1. Clean Markdown symbols, citations, and sanitize newlines into punctuation
    const plainText = text
      .replace(/\[Source\s*\d+\]/gi, '')
      .replace(/[*#_`~>-]/g, ' ')
      .replace(/[\r\n]+/g, '. ')  // Convert newlines into periods so every line ends with punctuation!
      .replace(/\s+/g, ' ')
      .trim();

    const finalText = plainText || 'No answer provided.';

    // 2. Safe Chunking Strategy: Split by length (max 120 chars) to prevent dropping ANY tail text
    const chunks: string[] = [];
    let remainingText = finalText;

    while (remainingText.length > 0) {
      if (remainingText.length <= 120) {
        chunks.push(remainingText.trim());
        break;
      }

      // Find the last space before 120 characters
      let sliceIndex = remainingText.lastIndexOf(' ', 120);
      if (sliceIndex === -1 || sliceIndex === 0) {
        sliceIndex = 120; // Force split if no space exists
      }

      const chunk = remainingText.substring(0, sliceIndex).trim();
      if (chunk) chunks.push(chunk);
      remainingText = remainingText.substring(sliceIndex).trim();
    }

    // 3. Generate MP3 files for every single chunk
    const tempFiles: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const tempPath = path.join(outputDir, `temp-${Date.now()}-${i}.mp3`);
      await this.saveChunkToFile(chunks[i], tempPath);
      tempFiles.push(tempPath);
    }

    // 4. Merge all chunk buffers into final MP3 file
    const audioBuffers = tempFiles.map((file) => fs.readFileSync(file));
    fs.writeFileSync(filePath, Buffer.concat(audioBuffers));

    // 5. Clean up temp files
    tempFiles.forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    return filePath;
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