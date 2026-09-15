import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { PrismaClient } from '@prisma/client';
import { embeddingService } from '../services/embedding.service.js';
import { similarityService } from '../services/similarity.service.js';

const prisma = new PrismaClient();

const tableToMarkdown = (table: string[][]): string => {
  if (table.length < 2 || table[0].length === 0) return '';

  const columnCount = table[0].length;
  const normalizeRow = (row: string[]) =>
    Array.from({ length: columnCount }, (_, index) =>
      String(row[index] || '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()
    );

  const header = normalizeRow(table[0]);
  const rows = table.slice(1).map(normalizeRow);
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
};

const insertTableAtHeader = (pageText: string, table: string[][]): string => {
  const markdownTable = tableToMarkdown(table);
  const firstCell = String(table[0]?.[0] || '').replace(/\s+/g, ' ').trim();
  if (!markdownTable || !firstCell) return pageText;

  const headerWords = firstCell.split(' ').filter(Boolean).slice(0, 8);
  const headerPattern = headerWords
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+') + '(?![A-Za-z])';
  const match = new RegExp(headerPattern, 'i').exec(pageText);

  if (!match || match.index === undefined) return `${pageText}\n\n${markdownTable}`;

  return `${pageText.slice(0, match.index)}\n\n${markdownTable}\n\n${pageText.slice(match.index)}`;
};

const removeExactTableLines = (pageText: string, table: string[][]): string => {
  const fragments = new Set<string>();

  for (const row of table) {
    for (const cell of row) {
      const normalizedCell = String(cell || '').replace(/\r\n/g, '\n').trim();
      for (const fragment of normalizedCell.split('\n')) {
        const normalizedFragment = fragment.replace(/\s+/g, ' ').trim().toLowerCase();
        if (normalizedFragment.length > 1) fragments.add(normalizedFragment);
      }
    }
  }

  return pageText
    .split('\n')
    .filter((line) => !fragments.has(line.replace(/\s+/g, ' ').trim().toLowerCase()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const extractPdfTables = async (filePath: string): Promise<string> => {
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  try {
    const result = await parser.getTable();
    const tables = result.pages.flatMap((page) => page.tables).map(tableToMarkdown).filter(Boolean);
    return tables.length > 0 ? `\n\n## Extracted Tables\n\n${tables.join('\n\n')}` : '';
  } finally {
    await parser.destroy();
  }
};

const extractStructuredPdfMarkdown = async (filePath: string): Promise<string> => {
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  try {
    let textResult: Awaited<ReturnType<PDFParse['getText']>> | null = null;
    let tableResult: Awaited<ReturnType<PDFParse['getTable']>> | null = null;

    try {
      textResult = await parser.getText();
    } catch (textErr) {
      console.warn('PDF text extraction failed; continuing with table extraction.');
    }

    try {
      tableResult = await parser.getTable();
    } catch (tableErr) {
      console.warn('PDF table extraction failed; continuing with text extraction.');
    }

    if (!textResult) return '';

    const tablesByPage = new Map<number, string[][][]>();
    for (const page of tableResult?.pages || []) {
      const pageTables = page.tables.filter((table) => table.length > 1);
      if (pageTables.length > 0) tablesByPage.set(page.num, pageTables);
    }

    return textResult.pages
      .map((page) => {
        let pageText = page.text.trim();
        const pageTables = tablesByPage.get(page.num) || [];
        for (const table of pageTables) {
          const markdownTable = tableToMarkdown(table);
          const firstCell = String(table[0]?.[0] || '').replace(/\s+/g, ' ').trim();
          const headerWords = firstCell.split(' ').filter(Boolean).slice(0, 8);
          const headerPattern = headerWords
            .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('\\s+') + '(?![A-Za-z])';
          const headerMatch = headerPattern ? new RegExp(headerPattern, 'i').exec(pageText) : null;
          const marker = `__MARKDOWN_TABLE_${page.num}_${Math.random().toString(36).slice(2)}__`;

          if (headerMatch && headerMatch.index !== undefined) {
            pageText = `${pageText.slice(0, headerMatch.index)}${marker}${pageText.slice(headerMatch.index + headerMatch[0].length)}`;
          } else {
            pageText = `${pageText}\n${marker}`;
          }

          pageText = removeExactTableLines(pageText, table);
          pageText = pageText.replace(marker, `\n\n${markdownTable}\n\n`);
        }
        return [
          `## Page ${page.num}`,
          pageText,
        ]
          .filter(Boolean)
          .join('\n\n');
      })
      .join('\n\n---\n\n');
  } finally {
    await parser.destroy();
  }
};

const normalizeMarkdownStructure = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (/^[\u2022\u25cf\u25aa\u25e6]\s*/.test(trimmed)) {
        return `- ${trimmed.replace(/^[\u2022\u25cf\u25aa\u25e6]\s*/, '')}`;
      }

      const isHeading =
        trimmed.length > 2 &&
        trimmed.length < 100 &&
        (/^[A-Z][A-Z\s&(),/\-]+:?$/.test(trimmed) ||
          (/^[A-Z][A-Za-z\s&(),/\-]+:$/.test(trimmed) && trimmed.split(/\s+/).length <= 10)) &&
        !trimmed.startsWith('|');

      if (isHeading && !trimmed.startsWith('#')) {
        return `## ${trimmed.replace(/:$/, '')}`;
      }

      return line;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// HELPER FUNCTION: REGEX PARSER THAT KEEPS COMPLETE MARKDOWN TABLES TOGETHER
const parseTextIntoBlocks = (text: string): string[] => {
  if (!text) return [];

  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd());
  const blocks: string[] = [];
  let currentBlockBuffer: string[] = [];
  let insideTable = false;

  const flushTextBlock = () => {
    const textChunk = currentBlockBuffer.join(' ').replace(/\s+/g, ' ').trim();
    if (textChunk) blocks.push(textChunk);
    currentBlockBuffer = [];
  };

  const isSectionHeading = (line: string) =>
    line.trim().length > 2 &&
    line.trim().length < 100 &&
    (/^[A-Z][A-Z\s&(),/-]+:?$/.test(line.trim()) || line.trim().endsWith(':'));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableLine = line.trim().startsWith('|') || (line.trim().startsWith('+-') && line.includes('-+'));

    if (isTableLine) {
      if (!insideTable && currentBlockBuffer.length > 0) {
        flushTextBlock();
      }
      insideTable = true;
      currentBlockBuffer.push(line);
    } else {
      if (insideTable) {
        const tableChunk = currentBlockBuffer.join('\n').trim();
        if (tableChunk) blocks.push(tableChunk);
        currentBlockBuffer = [];
        insideTable = false;
      }

      if (line.trim() === '') {
        flushTextBlock();
      } else {
        if (isSectionHeading(line)) {
          flushTextBlock();
          blocks.push(line.trim());
          continue;
        }
        currentBlockBuffer.push(line);

        const currentLength = currentBlockBuffer.join(' ').length;
        if (currentLength >= 650 && /[.!?:)]$/.test(line.trim())) {
          flushTextBlock();
        }
      }
    }
  }

  if (currentBlockBuffer.length > 0) {
    const finalChunk = currentBlockBuffer.join('\n').trim();
    if (finalChunk) blocks.push(finalChunk);
  }

  return blocks;
};

export class DocumentController {
  async uploadDocument(req: Request, res: Response): Promise<void> {
    const uploadedFilePath = req.file?.path;

    try {
      if (!req.file || !uploadedFilePath) {
        res.status(400).json({ error: 'No file uploaded. 📁' });
        return;
      }

      console.log(`[Upload Received]: Processing ${req.file.originalname}... 🚀`);

      const apiKey = process.env.LLAMA_CLOUD_API_KEY;
      let parsedMarkdownText = '';

      // --- ATTEMPT 1: LLAMAPARSE REST API FOR PRESERVING TABLES ---
      if (apiKey) {
        try {
          console.log(`[LlamaParse REST API]: Uploading "${req.file.originalname}"... 🚀`);

          const formData = new FormData();
          formData.append('file', fs.createReadStream(uploadedFilePath), req.file.originalname);
          formData.append('result_type', 'markdown');
          formData.append('output_tables_as_markdown', 'true');
          formData.append('use_vendor_multimodal_model', 'true');
          formData.append(
            'parsing_instruction',
            'Extract all contents accurately. Output ALL tables as valid GitHub-Flavored Markdown tables with pipe columns (| Column |) and divider rows (|---|). Do not flatten tables into plain text.'
          );

          const uploadRes = await axios.post(
            'https://api.cloud.llamaindex.ai/api/parsing/upload',
            formData,
            {
              headers: {
                ...formData.getHeaders(),
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
              },
            }
          );

          const jobId = uploadRes.data.id;
          console.log(`[LlamaParse REST API]: Job Created: ${jobId} ⏳`);

          let status = 'PENDING';
          let attempts = 0;

          while (status !== 'SUCCESS' && attempts < 60) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            attempts++;

            const statusRes = await axios.get(
              `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`,
              { headers: { Authorization: `Bearer ${apiKey}` } }
            );

            status = statusRes.data.status;

            if (status === 'SUCCESS') {
              const resultRes = await axios.get(
                `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`,
                { headers: { Authorization: `Bearer ${apiKey}` } }
              );

              if (typeof resultRes.data === 'string') {
                parsedMarkdownText = resultRes.data;
              } else if (resultRes.data && typeof resultRes.data === 'object') {
                parsedMarkdownText = resultRes.data.markdown || resultRes.data.text || '';
                if (!parsedMarkdownText && Array.isArray(resultRes.data.pages)) {
                  parsedMarkdownText = resultRes.data.pages
                    .map((p: any) => p.markdown || p.text)
                    .join('\n\n');
                }
              }
              break;
            } else if (status === 'ERROR') {
              break;
            }
          }
        } catch (llamaErr) {
          console.warn('⚠️ LlamaParse API failed. Falling back to local engines...');
        }
      }

      // --- FALLBACK 2: LOCAL PDF-PARSE ---
      if (!parsedMarkdownText || parsedMarkdownText.trim().length === 0) {
        try {
          parsedMarkdownText = await extractStructuredPdfMarkdown(uploadedFilePath);
        } catch (pdfErr) {
          console.warn('⚠️ Local pdf-parse engine error.');
        }
      }

      // --- FALLBACK 3: TESSERACT OCR ---
      if (!parsedMarkdownText || parsedMarkdownText.trim().length === 0) {
        try {
          if (/\.pdf$/i.test(uploadedFilePath)) {
            throw new Error('Tesseract OCR requires an image input, not a PDF.');
          }

          const worker = await createWorker('eng');
          try {
            const ret = await worker.recognize(uploadedFilePath);
            parsedMarkdownText = ret.data.text ? ret.data.text.trim() : '';
          } finally {
            await worker.terminate();
          }
        } catch (ocrErr) {
          console.warn('⚠️ Tesseract OCR failed.');
        }
      }

      if (!parsedMarkdownText || parsedMarkdownText.trim().length === 0) {
        parsedMarkdownText = `# Document: ${req.file.originalname}\n\nNo readable content found in this file.`;
      }

      // PDF text extraction flattens tables; recover their cell structure separately.
      if (!/^\s*\|.+\|\s*$/m.test(parsedMarkdownText)) {
        try {
          parsedMarkdownText += await extractPdfTables(uploadedFilePath);
        } catch (tableErr) {
          console.warn('PDF table extraction failed; continuing with text only.');
        }
      }

      parsedMarkdownText = normalizeMarkdownStructure(parsedMarkdownText);

      // Save local .md file
      const uploadsDir = path.dirname(uploadedFilePath);
      const markdownFileName = `${path.basename(
        uploadedFilePath,
        path.extname(uploadedFilePath)
      )}.md`;
      const markdownFilePath = path.join(uploadsDir, markdownFileName);
      fs.writeFileSync(markdownFilePath, parsedMarkdownText, 'utf-8');

      // SPLIT TEXT INTO PARAGRAPHS AND TABLES INTACT
      const rawBlocks = parseTextIntoBlocks(parsedMarkdownText);
      const blocksToProcess = rawBlocks.length > 0 ? rawBlocks : [parsedMarkdownText.trim()];

      const extractedBlocks = blocksToProcess.map((blockText, idx) => ({
        id: `blk-${idx + 1}`,
        text: blockText,
      }));

      // SAVE DB & EMBEDDINGS
      const document = await prisma.document.create({
        data: {
          filename: req.file.originalname,
          filepath: req.file.path,
          filesize: req.file.size,
        },
      });

      const chunkData = await Promise.all(
        extractedBlocks.map(async (block, idx) => {
          let vector: number[] = [];
          try {
            vector = await embeddingService.generateEmbedding(block.text);
          } catch (e) {
            vector = new Array(384).fill(0);
          }
          return {
            documentId: document.id,
            chunkIndex: idx,
            content: block.text,
            embedding: JSON.stringify(vector),
          };
        })
      );
      await prisma.documentChunk.createMany({ data: chunkData });

      const fileNameOnly = path.basename(req.file.path);
      const fileUrl = `http://localhost:3000/uploads/${fileNameOnly}`;
      const markdownUrl = `http://localhost:3000/uploads/${markdownFileName}`;

      res.status(201).json({
        success: true,
        message: 'Document processed & Markdown saved! ⚡',
        documentId: document.id,
        fileUrl,
        markdownUrl,
        fileName: req.file.originalname,
        fullExtractedText: parsedMarkdownText,
        extractedBlocks,
        chunks: chunkData.map((c, idx) => ({
          id: idx + 1,
          documentId: document.id,
          chunkIndex: c.chunkIndex,
          content: c.content,
        })),
      });
    } catch (error: any) {
      console.error('[Document Upload Controller Error]:', error);
      res.status(500).json({ error: error?.message || 'Failed to process document.' });
    }
  }

  async searchDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { query, topK, documentId } = req.body;
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Please provide a valid query string.' });
        return;
      }
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