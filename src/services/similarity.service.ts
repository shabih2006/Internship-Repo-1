import { PrismaClient } from '@prisma/client';
import { embeddingService } from './embedding.service.js';

const prisma = new PrismaClient();

export interface SimilarChunk {
  id: number;
  documentId: number;
  chunkIndex: number;
  content: string;
  similarityScore: number;
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
  async findSimilarChunks(
    question: string,
    limit: number = 5,
    documentId?: number
  ): Promise<SimilarChunk[]> {
    const queryEmbedding = await embeddingService.generateEmbedding(question);
    const vectorString = `[${queryEmbedding.join(',')}]`;

    let chunks: any[] = [];

    // 1. Try vector similarity search on PostgreSQL
    try {
      if (documentId !== undefined && !isNaN(documentId) && documentId > 0) {
        chunks = await prisma.$queryRaw`
          SELECT id, document_id as "documentId", chunk_index as "chunkIndex", content,
                 1 - (embedding <=> ${vectorString}::vector) as "similarityScore"
          FROM public.document_chunk
          WHERE document_id = ${documentId}
          ORDER BY embedding <=> ${vectorString}::vector ASC
          LIMIT ${limit};
        `;
      } else {
        chunks = await prisma.$queryRaw`
          SELECT id, document_id as "documentId", chunk_index as "chunkIndex", content,
                 1 - (embedding <=> ${vectorString}::vector) as "similarityScore"
          FROM public.document_chunk
          ORDER BY embedding <=> ${vectorString}::vector ASC
          LIMIT ${limit};
        `;
      }
    } catch (e) {
      console.warn('Vector query failed, using in-memory cosine fallback...');
    }

    // 2. In-memory Cosine fallback if vector query returns nothing
    if (!chunks || chunks.length === 0) {
      try {
        const whereClause = documentId ? { documentId: Number(documentId) } : {};
        const allDbChunks = await prisma.documentChunk.findMany({
          where: whereClause,
          take: 200,
        });

        const scored = allDbChunks.map((c: any) => {
          let emb: number[] = [];
          if (Array.isArray(c.embedding)) emb = c.embedding;
          else if (typeof c.embedding === 'string') {
            try { emb = JSON.parse(c.embedding); } catch (err) {}
          }
          return {
            id: c.id,
            documentId: c.documentId || c.document_id || 1,
            chunkIndex: c.chunkIndex || c.chunk_index || 0,
            content: c.content,
            similarityScore: emb.length > 0 ? cosineSimilarity(queryEmbedding, emb) : 0,
          };
        });

        scored.sort((a, b) => b.similarityScore - a.similarityScore);
        chunks = scored.slice(0, limit);
      } catch (err) {
        console.error('Fallback error:', err);
      }
    }

    return (chunks || []).map((c) => ({
      id: Number(c.id || 0),
      documentId: Number(c.documentId || c.document_id || 1),
      chunkIndex: Number(c.chunkIndex || c.chunk_index || 0),
      content: String(c.content || ''),
      similarityScore: Number(c.similarityScore || 0),
    }));
  }
}

export const similarityService = new SimilarityService();