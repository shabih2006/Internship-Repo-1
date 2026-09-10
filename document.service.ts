import pdfParse from 'pdf-parse';
import { PrismaClient } from '@prisma/client';
import { TextChunker, TextChunk } from '../utils/chunker.util.js';
import { embeddingService } from './embedding.service.js'; // Adjust path if needed

const prisma = new PrismaClient();
const textChunker = new TextChunker(500, 150);

/**
 * Normalizes extracted PDF text to add spaces between squeezed words
 * and strip slide noise/chatter.
 */
export function cleanPdfText(rawText: string): string {
  return rawText
    // 1. Insert space between lowercase and uppercase letter (e.g., "DBMSis" -> "DBMS is")
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // 2. Insert space between punctuation and glued words (e.g., "System?Adatabase" -> "System? A database")
    .replace(/([?!.,])([A-Za-z])/g, '$1 $2')
    // 3. Remove slide footer numbers and generic lecture noise
    .replace(/(Thank you|Any Queries\?|\bLecture \d+\b|\bSlide \d+\b)/gi, '')
    // 4. Collapse multiple newlines/spaces into single spaces
    .replace(/\s+/g, ' ')
    .trim();
}

export class DocumentService {
  /**
   * Re-indexes a document by replacing its previous chunks with fresh, clean chunks.
   */
  async reindexDocument(documentId: number, newChunks: TextChunk[]): Promise<void> {
    // 1. Delete old chunks for this document only
    await prisma.documentChunk.deleteMany({
      where: { documentId: documentId },
    });

    // 2. Generate vector embeddings for each new chunk and save to PostgreSQL
    for (const chunk of newChunks) {
      const embedding = await embeddingService.generateEmbedding(chunk.content);

      // Raw SQL query to save content along with vector embedding in PgVector
      await prisma.$executeRaw`
        INSERT INTO "DocumentChunk" ("documentId", "chunkIndex", "content", "embedding")
        VALUES (${documentId}, ${chunk.chunkIndex}, ${chunk.content}, ${embedding}::vector);
      `;
    }
  }

  /**
   * Main PDF processing method called during file upload.
   */
  async processAndStoreDocument(documentId: number, fileBuffer: Buffer): Promise<{ chunkCount: number }> {
    // 1. Parse PDF
    const pdfData = await pdfParse(fileBuffer);

    // 2. Clean extracted text (adds missing spaces, strips slide noise)
    const cleanedText = cleanPdfText(pdfData.text);

    // 3. Split into sentence-bounded chunks ending with full stops
    const chunks = textChunker.chunkText(cleanedText);

    // 4. Overwrite old chunks with new ones
    await this.reindexDocument(documentId, chunks);

    return { chunkCount: chunks.length };
  }
}

export const documentService = new DocumentService();