import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import pdfParse from 'pdf-parse-fixed';
import { TextChunker } from '../utils/chunker.util.js';
import { embeddingService } from '../services/embedding.service.js';
import { similarityService } from '../services/similarity.service.js';

const prisma = new PrismaClient();
const chunker = new TextChunker(500, 100);

export class DocumentController {
  async uploadDocument(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No PDF file uploaded.' });
        return;
      }

      const dataBuffer = fs.readFileSync(req.file.path);
      const pdfData = await pdfParse(dataBuffer);
      const extractedText = pdfData.text ? pdfData.text.trim() : '';

      const chunks = chunker.chunkText(extractedText);

      const document = await prisma.document.create({
        data: {
          filename: req.file.originalname,
          filepath: req.file.path,
          filesize: req.file.size,
        },
      });

      const chunkRecords = [];
      for (const chunk of chunks) {
        const vector = await embeddingService.generateEmbedding(chunk.content);

        const savedChunk = await prisma.documentChunk.create({
          data: {
            documentId: document.id,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            embedding: JSON.stringify(vector),
          },
        });

        chunkRecords.push({
          id: savedChunk.id,
          chunkIndex: savedChunk.chunkIndex,
          vectorDimensions: vector.length,
        });
      }

      res.status(201).json({
        success: true,
        message: 'PDF uploaded, chunked, and embedded successfully!',
        document,
        storedChunksCount: chunkRecords.length,
      });
    } catch (error: any) {
      console.error('Document Processing Error:', error);
      res.status(500).json({ error: error?.message || 'Failed to process document.' });
    }
  }

  // Item 5: Similarity Search Endpoint (With documentId filter support)
  async searchDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { query, topK, documentId } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Please provide a valid query string.' });
        return;
      }

      // Convert documentId to number if provided, otherwise leave undefined to search all docs
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
      console.error('Similarity Search Error:', error);
      res.status(500).json({ error: error?.message || 'Failed to perform similarity search.' });
    }
  }
}