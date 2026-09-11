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

interface RawQueryChunk {
  id: number | bigint;
  documentId: number;
  chunkIndex: number;
  content: string;
  similarityScore: number | string;
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
  async findSimilarChunks(
    question: string,
    limit: number = 5,
    documentId?: number
  ): Promise<SimilarChunk[]> {
    const queryEmbedding = await embeddingService.generateEmbedding(question);
    const vectorString = `[${queryEmbedding.join(',')}]`;

    let chunks: SimilarChunk[] = [];

    // 1. Try vector similarity search on PostgreSQL (pgvector)
    try {
      let rawResults: RawQueryChunk[] = [];

      if (documentId !== undefined && !isNaN(documentId) && documentId > 0) {
        rawResults = await prisma.$queryRaw<RawQueryChunk[]>`
          SELECT id, document_id as "documentId", chunk_index as "chunkIndex", content,
                 1 - (embedding <=> ${vectorString}::vector) as "similarityScore"
          FROM public.document_chunk
          WHERE document_id = ${documentId}
          ORDER BY embedding <=> ${vectorString}::vector ASC
          LIMIT ${limit};
        `;
      } else {
        rawResults = await prisma.$queryRaw<RawQueryChunk[]>`
          SELECT id, document_id as "documentId", chunk_index as "chunkIndex", content,
                 1 - (embedding <=> ${vectorString}::vector) as "similarityScore"
          FROM public.document_chunk
          ORDER BY embedding <=> ${vectorString}::vector ASC
          LIMIT ${limit};
        `;
      }

      if (rawResults && rawResults.length > 0) {
        chunks = rawResults.map((c) => ({
          id: Number(c.id),
          documentId: Number(c.documentId),
          chunkIndex: Number(c.chunkIndex),
          content: String(c.content || ''),
          similarityScore: Number(c.similarityScore || 0),
        }));
      }
    } catch (e: unknown) {
      console.warn('Vector query failed, using in-memory cosine fallback...');
    }

    // 2. In-memory Cosine Fallback
    if (!chunks || chunks.length === 0) {
      try {
        const whereClause =
          documentId && !isNaN(documentId) && documentId > 0
            ? { documentId: Number(documentId) }
            : {};

        const allDbChunks = (await prisma.documentChunk.findMany({
          where: whereClause,
          take: 200,
        })) as unknown as DbDocumentChunk[];

        const scored: SimilarChunk[] = allDbChunks.map((c) => {
          let emb: number[] = [];
          if (Array.isArray(c.embedding)) {
            emb = c.embedding as number[];
          } else if (typeof c.embedding === 'string') {
            try {
              emb = JSON.parse(c.embedding);
            } catch (err: unknown) {
              // Ignore invalid string JSON formatting
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
        chunks = scored.slice(0, limit);
      } catch (err: unknown) {
        console.error('In-memory similarity fallback failed:', err);
      }
    }

    return chunks;
  }
}

export const similarityService = new SimilarityService();