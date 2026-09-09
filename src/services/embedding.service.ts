import { pipeline } from '@xenova/transformers';

class EmbeddingService {
  private extractor: any = null;

  private async getExtractor() {
    if (!this.extractor) {
      // Lazy load the MiniLM-L6-v2 model for 384-dimensional dense vectors
      this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return this.extractor;
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    try {
      const extractor = await this.getExtractor();
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      console.error('Error generating vector embedding:', error);
      throw new Error('Failed to generate vector embedding for text chunk.');
    }
  }
}

export const embeddingService = new EmbeddingService();