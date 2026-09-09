import { PrismaClient } from '@prisma/client';
import { embeddingService } from './embedding.service.js';

const prisma = new PrismaClient();

export class SimilarityService {
  async findSimilarChunks(query: string, topK: number = 3, targetDocId?: number) {
    const queryVector = await embeddingService.generateEmbedding(query);

    // Filter by documentId if passed
    const whereClause = targetDocId && !isNaN(Number(targetDocId)) 
      ? { documentId: Number(targetDocId) } 
      : {};

    const chunks = await prisma.documentChunk.findMany({
      where: whereClause,
    });

    if (chunks.length === 0) {
      return [];
    }

    const scoredChunks = chunks.map((chunk) => {
      const chunkVector = JSON.parse(chunk.embedding);
      const similarityScore = this.cosineSimilarity(queryVector, chunkVector);
      return {
        id: chunk.id,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        similarityScore,
      };
    });

    return scoredChunks
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, topK);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const similarityService = new SimilarityService();