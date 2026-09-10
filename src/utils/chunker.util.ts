export interface TextChunk {
  chunkIndex: number;
  content: string;
}

export class TextChunker {
  private targetChunkSize: number;

  constructor(targetChunkSize: number = 500) {
    this.targetChunkSize = targetChunkSize;
  }

  public chunkText(text: string): TextChunk[] {
    // Clean whitespace
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    if (!cleanedText) return [];

    // Split strictly by sentence boundaries (. ! ?)
    const sentenceRegex = /[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g;
    const sentences = cleanedText.match(sentenceRegex) || [cleanedText];

    const chunks: TextChunk[] = [];
    let currentChunkSentences: string[] = [];
    let currentLength = 0;
    let chunkIndex = 0;

    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim();
      // Skip meaningless numbers / isolated bullet artifacts
      if (!sentence || /^\d+$/.test(sentence) || sentence.length < 5) continue;

      currentChunkSentences.push(sentence);
      currentLength += sentence.length + 1;

      if (currentLength >= this.targetChunkSize) {
        let chunkContent = currentChunkSentences.join(' ').trim();

        if (!/[.!?]$/.test(chunkContent)) {
          chunkContent += '.';
        }

        chunks.push({
          chunkIndex,
          content: chunkContent,
        });

        chunkIndex++;
        currentChunkSentences = [];
        currentLength = 0;
      }
    }

    if (currentChunkSentences.length > 0) {
      let finalContent = currentChunkSentences.join(' ').trim();
      if (!/[.!?]$/.test(finalContent)) {
        finalContent += '.';
      }

      chunks.push({
        chunkIndex,
        content: finalContent,
      });
    }

    return chunks;
  }
}