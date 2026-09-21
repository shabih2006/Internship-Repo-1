// src/services/similarity.service.ts
import { PrismaClient } from '@prisma/client';
import { embeddingService } from './embedding.service';

const prisma = new PrismaClient();

export interface SimilarChunk {
  id: number;
  documentId: number;
  chunkIndex: number;
  content: string;
  similarityScore: number;
}

interface DbDocumentChunk {
  id: number;
  documentId: number;
  chunkIndex: number;
  content: string;
  embedding: unknown;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class SimilarityService {
  /**
   * Find top-K similar chunks.
   * @param question   - the user's query
   * @param limit      - max results
   * @param documentId - if provided, restrict search to this document only.
   *                     If null/undefined, search across ALL documents.
   */
  async findSimilarChunks(
    question: string,
    limit: number = 5,
    documentId?: number
  ): Promise<SimilarChunk[]> {
    const queryEmbedding = await embeddingService.generateEmbedding(question);

    try {
      const whereClause =
        documentId && !isNaN(documentId) && documentId > 0
          ? { documentId: Number(documentId) }
          : {};

      console.log(
        `[Similarity] Searching ${documentId ? `doc #${documentId}` : 'ALL docs'} (top ${limit})`
      );

      const allDbChunks = (await prisma.documentChunk.findMany({
        where: whereClause,
        take: 2000,
      })) as unknown as DbDocumentChunk[];

      const scored: SimilarChunk[] = allDbChunks.map((c) => {
        let emb: number[] = [];
        if (Array.isArray(c.embedding)) {
          emb = c.embedding as number[];
        } else if (typeof c.embedding === 'string') {
          try {
            emb = JSON.parse(c.embedding);
          } catch {
            /* ignore invalid JSON */
          }
        }

        return {
          id: Number(c.id || 0),
          documentId: Number(c.documentId || 1),
          chunkIndex: Number(c.chunkIndex || 0),
          content: String(c.content || ''),
          similarityScore:
            emb.length > 0 ? cosineSimilarity(queryEmbedding, emb) : 0,
        };
      });

      scored.sort((a, b) => b.similarityScore - a.similarityScore);
      return scored.slice(0, limit);
    } catch (err) {
      console.error('Similarity search failed:', err);
      return [];
    }
  }
}

export const similarityService = new SimilarityService();