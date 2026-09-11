import { Request, Response } from 'express';
import fs from 'fs';
// @ts-ignore
import pdfParseModule from 'pdf-parse-fixed';
import { PrismaClient } from '@prisma/client';
import { TextChunker } from '../utils/chunker.util.js';
import { embeddingService } from '../services/embedding.service.js';
import { similarityService } from '../services/similarity.service.js';

// Safe module interop resolution for pdf-parse-fixed
const pdfParse = (pdfParseModule as any)?.default || pdfParseModule;

const prisma = new PrismaClient();
const chunker = new TextChunker(500);

export class DocumentController {
  async uploadDocument(req: Request, res: Response): Promise<void> {
    const uploadedFilePath = req.file?.path;

    try {
      if (!req.file || !uploadedFilePath) {
        res.status(400).json({ error: 'No PDF file uploaded. 📁' });
        return;
      }

      // 1. Read and parse PDF text content safely
      const dataBuffer = fs.readFileSync(uploadedFilePath);
      const pdfData = await pdfParse(dataBuffer);
      const extractedText = pdfData.text ? pdfData.text.trim() : '';

      if (!extractedText) {
        res.status(400).json({ error: 'Extracted PDF contains no readable text.' });
        return;
      }

      // 2. Chunk text
      const chunks = chunker.chunkText(extractedText);

      // 3. Store Parent Document in DB
      const document = await prisma.document.create({
        data: {
          filename: req.file.originalname,
          filepath: req.file.path,
          filesize: req.file.size,
        },
      });

      // 4. Generate embeddings in parallel batches for faster processing
      const chunkData = await Promise.all(
        chunks.map(async (chunk) => {
          const vector = await embeddingService.generateEmbedding(chunk.content);
          return {
            documentId: document.id,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            embedding: JSON.stringify(vector),
          };
        })
      );

      // 5. Bulk insert chunks to database
      await prisma.documentChunk.createMany({
        data: chunkData,
      });

      res.status(201).json({
        success: true,
        message: 'PDF uploaded, chunked, and embedded successfully! 🚀',
        document,
        storedChunksCount: chunkData.length,
      });
    } catch (error: any) {
      console.error('[Document Processing Error]:', error);
      res.status(500).json({ error: error?.message || 'Failed to process document.' });
    } finally {
      // 6. Cleanup temporary uploaded file from disk if necessary
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (cleanupErr) {
          console.warn('[File Cleanup Warning]: Could not remove temp file:', cleanupErr);
        }
      }
    }
  }

  // Similarity Search Endpoint
  async searchDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { query, topK, documentId } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Please provide a valid query string.' });
        return;
      }

      // Convert documentId to number if provided, otherwise leave undefined to search across all docs
      const targetDocId = documentId ? Number(documentId) : undefined;

      const results = await similarityService.findSimilarChunks(query, topK || 3, targetDocId);

      res.status(200).json({
        success: true,
        query,
        targetDocumentId: targetDocId || 'All Documents',
        resultCount: results.length,
        relevantChunks: results,
      });
    } catch (error: any) {
      console.error('[Similarity Search Error]:', error);
      res.status(500).json({ error: error?.message || 'Failed to perform similarity search.' });
    }
  }
}