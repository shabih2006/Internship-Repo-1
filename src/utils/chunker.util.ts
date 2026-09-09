export interface TextChunk {
  chunkIndex: number;
  content: string;
}

export class TextChunker {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(chunkSize: number = 500, chunkOverlap: number = 100) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  public chunkText(text: string): TextChunk[] {
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    if (!cleanedText) return [];

    const chunks: TextChunk[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < cleanedText.length) {
      let end = Math.min(start + this.chunkSize, cleanedText.length);

      // Align end boundary to nearest word boundary
      if (end < cleanedText.length) {
        const lastSpace = cleanedText.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace;
        }
      }

      const chunkText = cleanedText.slice(start, end).trim();

      if (chunkText.length > 0) {
        chunks.push({
          chunkIndex,
          content: chunkText,
        });
        chunkIndex++;
      }

      if (end === cleanedText.length) break;

      // Move forward while respecting overlap and word boundary
      let nextStart = end - this.chunkOverlap;
      if (nextStart > start) {
        const spaceIndex = cleanedText.indexOf(' ', nextStart);
        if (spaceIndex !== -1 && spaceIndex < end) {
          nextStart = spaceIndex + 1;
        }
      } else {
        nextStart = end;
      }

      start = nextStart;
    }

    return chunks;
  }
}