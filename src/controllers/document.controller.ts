import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import pdfParse from 'pdf-parse-fixed';

const prisma = new PrismaClient();

export class DocumentController {
  async uploadDocument(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No PDF file uploaded.' });
        return;
      }

      // Read file buffer for PDF text extraction
      const dataBuffer = fs.readFileSync(req.file.path);
      const pdfData = await pdfParse(dataBuffer);
      const extractedText = pdfData.text ? pdfData.text.trim() : '';

      // Save document metadata in PostgreSQL
      const document = await prisma.document.create({
        data: {
          filename: req.file.originalname,
          filepath: req.file.path,
          filesize: req.file.size,
        },
      });

      // Item 2 Verification Response
      res.status(201).json({
        success: true,
        message: 'PDF uploaded and text extracted successfully!',
        document,
        extractedText: extractedText || 'No printable text found in PDF.',
        pageCount: pdfData.numpages,
      });
    } catch (error: any) {
      console.error('Document Upload & Extraction Error:', error);
      res.status(500).json({ error: error?.message || 'Failed to extract text from PDF.' });
    }
  }
}