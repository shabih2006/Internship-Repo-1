import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { PDFParse } from 'pdf-parse';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';
import { PrismaClient } from '@prisma/client';
import { embeddingService } from '../services/embedding.service.js';
import { similarityService } from '../services/similarity.service.js';

const prisma = new PrismaClient();

export interface Bbox { x: number; y: number; width: number; height: number; }
export interface ParsedBlock {
  id: string;
  type: 'text' | 'heading' | 'table';
  markdown: string;
  plainValue: string;
  html?: string;
  page: number;
  bbox: Bbox;
  lineBoxes: Bbox[];
}
export interface PageDim { width: number; height: number; }

// ============================================================
// LlamaParse structured-JSON normalization
// ============================================================

const normalizeBbox = (raw: any): Bbox | null => {
  if (!raw) return null;

  if (Array.isArray(raw) && raw.length >= 4 && raw.every((v) => typeof v === 'number')) {
    const [x, y, w, h] = raw;
    return { x, y, width: w, height: h };
  }

  if (typeof raw === 'object') {
    const x = raw.x ?? raw.left ?? raw.x0 ?? raw.l;
    const y = raw.y ?? raw.top ?? raw.y0 ?? raw.t;
    const w =
      raw.w ?? raw.width ??
      (raw.x1 !== undefined && x !== undefined ? raw.x1 - x : undefined) ??
      (raw.r !== undefined && x !== undefined ? raw.r - x : undefined);
    const h =
      raw.h ?? raw.height ??
      (raw.y1 !== undefined && y !== undefined ? raw.y1 - y : undefined) ??
      (raw.b !== undefined && y !== undefined ? raw.b - y : undefined);

    if ([x, y, w, h].every((v) => typeof v === 'number')) {
      return { x: x as number, y: y as number, width: w as number, height: h as number };
    }
  }

  return null;
};

const unionBbox = (boxes: Bbox[]): Bbox | null => {
  if (boxes.length === 0) return null;
  if (boxes.length === 1) return boxes[0];
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.width));
  const y1 = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
};

const classifyType = (raw: any): 'text' | 'heading' | 'table' => {
  const t = String(raw || 'text').toLowerCase();
  if (t === 'table') return 'table';
  if (t.includes('head') || t === 'title' || t === 'section') return 'heading';
  return 'text';
};

const extractTextFields = (item: any): { markdown: string; plainValue: string; html?: string } => {
  const markdown = item.md ?? item.markdown ?? item.value ?? item.text ?? item.content ?? '';
  const plainValue = item.value ?? item.text ?? item.content ?? markdown ?? '';
  const html = item.html ?? undefined;
  return {
    markdown: String(markdown || ''),
    plainValue: String(plainValue || ''),
    html: html ? String(html) : undefined,
  };
};

const isInstructionEcho = (text: string): boolean => {
  const lower = text.toLowerCase().trim();
  return (
    lower.startsWith('here is the content extracted') ||
    lower.startsWith('here is the extracted') ||
    lower.startsWith('sure, here') ||
    lower.startsWith('the content extracted') ||
    lower.includes('parsing instruction') ||
    lower.includes('bounding box units')
  );
};

const normalizeLlamaJson = (
  raw: any
): { blocks: ParsedBlock[]; pageDimensions: Record<number, PageDim> } => {
  const blocks: ParsedBlock[] = [];
  const pageDimensions: Record<number, PageDim> = {};

  const pages = raw?.pages;
  if (!Array.isArray(pages)) return { blocks, pageDimensions };

  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi];
    const pageNum =
      page.page ?? page.page_number ?? page.pageNumber ?? page.num ?? (pi + 1);
    const pageW = page.width ?? page.page_width ?? page.pageWidth;
    const pageH = page.height ?? page.page_height ?? page.pageHeight;

    if (typeof pageNum === 'number' && typeof pageW === 'number' && typeof pageH === 'number') {
      pageDimensions[pageNum] = { width: pageW, height: pageH };
    }

    const items = page.items ?? page.text_items ?? page.elements ?? page.blocks ?? [];
    if (!Array.isArray(items)) continue;

    for (let ii = 0; ii < items.length; ii++) {
      const item = items[ii];
      if (!item || typeof item !== 'object') continue;

      const itemType = classifyType(item.type || item.kind);
      const textFields = extractTextFields(item);
      const content = (textFields.markdown || textFields.plainValue || '').trim();
      if (!content) continue;
      if (isInstructionEcho(content)) continue;

      // ---- Per-line boxes (this is what we actually draw) ----
      const lineBoxes: Bbox[] = [];
      if (Array.isArray(item.layoutAwareBbox)) {
        for (const lb of item.layoutAwareBbox) {
          const norm = normalizeBbox(lb);
          if (norm && norm.width > 0 && norm.height > 0) {
            lineBoxes.push(norm);
          }
        }
      }

      // ---- Fallback: block-level bBox (only used if layoutAwareBbox missing) ----
      const mainBox = normalizeBbox(item.bBox ?? item.bbox ?? item.bounding_box);

      if (lineBoxes.length === 0 && !mainBox) continue;

      const bbox: Bbox = mainBox ?? unionBbox(lineBoxes)!;
      if (!bbox || bbox.width <= 0 || bbox.height <= 0) continue;

      blocks.push({
        id: `p${pageNum}-i${ii}`,
        type: itemType,
        markdown: textFields.markdown,
        plainValue: textFields.plainValue,
        html: textFields.html,
        page: typeof pageNum === 'number' ? pageNum : pi + 1,
        bbox,
        lineBoxes,
      });
    }
  }

  console.log(`[LlamaParse] ${blocks.length} blocks. lineBoxes totals:`,
    blocks.map((b) => b.lineBoxes.length).reduce((a, c) => a + c, 0));

  return { blocks, pageDimensions };
};

const blocksToMarkdown = (blocks: ParsedBlock[]): string => {
  const sorted = [...blocks].sort((a, b) => a.page - b.page);
  return sorted
    .map((b) => b.markdown || b.plainValue)
    .filter((s) => s && s.trim())
    .join('\n\n');
};

// ============================================================
// Local fallback helpers
// ============================================================

const tableToMarkdown = (table: string[][]): string => {
  if (table.length < 2 || table[0].length === 0) return '';
  const columnCount = table[0].length;
  const normalizeRow = (row: string[]) =>
    Array.from({ length: columnCount }, (_, i) =>
      String(row[i] || '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()
    );
  const header = normalizeRow(table[0]);
  const rows = table.slice(1).map(normalizeRow);
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
};

const extractPdfTables = async (filePath: string): Promise<string> => {
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  try {
    const result = await parser.getTable();
    const tables = result.pages.flatMap((p) => p.tables).map(tableToMarkdown).filter(Boolean);
    return tables.length > 0 ? `\n\n## Extracted Tables\n\n${tables.join('\n\n')}` : '';
  } finally {
    await parser.destroy();
  }
};

// ============================================================
// LlamaParse ingestion
// ============================================================

interface LlamaParseResult {
  blocks: ParsedBlock[];
  pageDimensions: Record<number, PageDim>;
}

const callLlamaParse = async (
  filePath: string,
  originalName: string,
  apiKey: string
): Promise<LlamaParseResult | null> => {
  console.log(`[LlamaParse] Uploading "${originalName}" (JSON mode)...`);

  // Try several flag combinations; the first that succeeds wins.
  // Different LlamaParse tiers reject different flags with 400.
  const flagVariants: Array<Record<string, string>> = [
    { result_type: 'json', output_tables_as_markdown: 'true' },
    { result_type: 'json' },
    { result_type: 'markdown' },
  ];

  let uploadRes: any = null;
  let lastError: any = null;
  let usedVariant: Record<string, string> | null = null;

  for (const flags of flagVariants) {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath), originalName);
    for (const [k, v] of Object.entries(flags)) formData.append(k, v);

    console.log(`[LlamaParse] Trying flags:`, flags);
    try {
      uploadRes = await axios.post(
        'https://api.cloud.llamaindex.ai/api/parsing/upload',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          maxBodyLength: Infinity,
        }
      );
      usedVariant = flags;
      console.log(`[LlamaParse] Upload succeeded with flags:`, flags);
      break;
    } catch (err: any) {
      lastError = err;
      console.error(`[LlamaParse] Flags failed:`, flags);
      console.error('  Status:', err?.response?.status);
      console.error('  Response body:', JSON.stringify(err?.response?.data, null, 2));
    }
  }

  if (!uploadRes) {
    console.error('[LlamaParse] All flag variants failed.');
    console.error('[LlamaParse] Last error body:', JSON.stringify(lastError?.response?.data, null, 2));
    return null;
  }

  const jobId = uploadRes.data.id;
  console.log(`[LlamaParse] Job created: ${jobId}`);

  let status = 'PENDING';
  let attempts = 0;

  while (status !== 'SUCCESS' && attempts < 90) {
    await new Promise((r) => setTimeout(r, 2000));
    attempts++;

    const statusRes = await axios.get(
      `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    status = statusRes.data.status;

    if (status === 'ERROR') {
      console.warn(`[LlamaParse] Job ${jobId} errored.`);
      return null;
    }
  }

  if (status !== 'SUCCESS') {
    console.warn(`[LlamaParse] Job ${jobId} did not finish in time.`);
    return null;
  }

  // Fetch result depending on requested result_type
  const requestedJson = usedVariant?.result_type === 'json';
  const resultEndpoint = requestedJson
    ? `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/json`
    : `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`;

  console.log(`[LlamaParse] Fetching result: ${resultEndpoint}`);
  const res = await axios.get(resultEndpoint, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const raw = res.data;

  try {
    fs.writeFileSync(
      path.join(process.cwd(), 'llama-debug.json'),
      typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2),
      'utf-8'
    );
    console.log('[LlamaParse] Wrote llama-debug.json');
  } catch {
    /* ignore */
  }

  // If we got markdown (no bboxes), return null and let caller fall back
  if (!requestedJson || typeof raw === 'string') {
    console.warn('[LlamaParse] Markdown-only result — no bboxes available. Falling back to local.');
    return null;
  }

  const { blocks, pageDimensions } = normalizeLlamaJson(raw);
  console.log(
    `[LlamaParse] Extracted ${blocks.length} blocks across ${Object.keys(pageDimensions).length} pages.`
  );
  if (blocks.length > 0) {
    console.log('[LlamaParse] Sample block:', JSON.stringify(blocks[0]).slice(0, 300));
  }

  return { blocks, pageDimensions };
};

// ============================================================
// Controller
// ============================================================

export class DocumentController {
  async uploadDocument(req: Request, res: Response): Promise<void> {
    const uploadedFilePath = req.file?.path;

    try {
      if (!req.file || !uploadedFilePath) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }

      console.log(`[Upload] Processing ${req.file.originalname}...`);

      const extension = path.extname(req.file.originalname).toLowerCase();
      const isTextDocument = ['.md', '.markdown', '.txt', '.html', '.htm'].includes(extension);
      const isPdfDocument = extension === '.pdf';
      const apiKey = process.env.LLAMA_CLOUD_API_KEY;

      let parsedMarkdownText = isTextDocument
        ? fs.readFileSync(uploadedFilePath, 'utf-8')
        : '';
      let blocks: ParsedBlock[] = [];
      let pageDimensions: Record<number, PageDim> = {};

      // 1. LlamaParse
      if (apiKey && !isTextDocument) {
        try {
          const result = await callLlamaParse(uploadedFilePath, req.file.originalname, apiKey);
          if (result) {
            blocks = result.blocks;
            pageDimensions = result.pageDimensions;
            if (blocks.length > 0) {
              parsedMarkdownText = blocksToMarkdown(blocks);
            }
          }
        } catch (llamaErr: any) {
          console.warn('[LlamaParse] failed:', llamaErr?.message || llamaErr);
        }
      }

      // 2. Local pdfjs for markdown (no bboxes)
      if (isPdfDocument && (!parsedMarkdownText || parsedMarkdownText.trim().length === 0)) {
        try {
          const loadingTask = getDocument({ data: new Uint8Array(fs.readFileSync(uploadedFilePath)) });
          const pdf = await loadingTask.promise;
          const pageTexts: string[] = [];
          for (let n = 1; n <= pdf.numPages; n++) {
            const page = await pdf.getPage(n);
            const viewport = page.getViewport({ scale: 1 });
            if (!pageDimensions[n]) {
              pageDimensions[n] = { width: viewport.width, height: viewport.height };
            }
            const content = await page.getTextContent();
            const txt = content.items
              .filter((i: any) => typeof i.str === 'string')
              .map((i: any) => i.str)
              .join(' ');
            pageTexts.push(`## Page ${n}\n\n${txt}`);
          }
          await loadingTask.destroy();
          parsedMarkdownText = pageTexts.join('\n\n---\n\n');
        } catch (e) {
          console.warn('Local PDF fallback failed:', e);
        }
      }

      // 3. OCR for images
      if (!isPdfDocument && !isTextDocument && (!parsedMarkdownText || parsedMarkdownText.trim().length === 0)) {
        try {
          const worker = await createWorker('eng');
          try {
            const ret = await worker.recognize(uploadedFilePath);
            parsedMarkdownText = ret.data.text ? ret.data.text.trim() : '';
          } finally {
            await worker.terminate();
          }
        } catch (e) {
          console.warn('OCR failed:', e);
        }
      }

      if (!parsedMarkdownText || parsedMarkdownText.trim().length === 0) {
        parsedMarkdownText = `# Document: ${req.file.originalname}\n\nNo readable content found.`;
      }

      const uploadsDir = path.dirname(uploadedFilePath);
      const markdownFileName = `${path.basename(uploadedFilePath, path.extname(uploadedFilePath))}.md`;
      const markdownFilePath = path.join(uploadsDir, markdownFileName);
      fs.writeFileSync(markdownFilePath, parsedMarkdownText, 'utf-8');

      const document = await prisma.document.create({
        data: {
          filename: req.file.originalname,
          filepath: req.file.path,
          filesize: req.file.size,
          markdown: parsedMarkdownText,
          blocksJson: JSON.stringify(blocks),
          pageDimensionsJson: JSON.stringify(pageDimensions),
        },
      });

      let chunkTexts: string[] = [];
      if (blocks.length > 0) {
        chunkTexts = blocks.map((b) => b.markdown || b.plainValue).filter((s) => s.trim());
      } else {
        try {
          const chunker = new (await import('../utils/chunker.util.js')).TextChunker(500);
          const chunks = chunker.chunkText(parsedMarkdownText);
          chunkTexts = chunks.map((c) => c.content);
        } catch {
          /* ignore */
        }
        if (chunkTexts.length === 0) chunkTexts = [parsedMarkdownText];
      }

      const chunkData = await Promise.all(
        chunkTexts.map(async (content, idx) => {
          let vector: number[] = [];
          try {
            vector = await embeddingService.generateEmbedding(content);
          } catch {
            vector = new Array(384).fill(0);
          }
          return {
            documentId: document.id,
            chunkIndex: idx,
            content,
            embedding: JSON.stringify(vector),
          };
        })
      );
      if (chunkData.length > 0) {
        await prisma.documentChunk.createMany({ data: chunkData });
      }

      const fileUrl = `http://localhost:3000/uploads/${path.basename(req.file.path)}`;
      const markdownUrl = `http://localhost:3000/uploads/${markdownFileName}`;

      res.status(201).json({
        success: true,
        documentId: document.id,
        fileUrl,
        markdownUrl,
        fileName: req.file.originalname,
        markdown: parsedMarkdownText,
        blocks,
        pageDimensions,
        chunks: chunkData.map((c, i) => ({
          id: i + 1,
          documentId: document.id,
          chunkIndex: c.chunkIndex,
          content: c.content,
        })),
      });
    } catch (error: any) {
      console.error('[Document Upload] Error:', error);
      res.status(500).json({ error: error?.message || 'Failed to process document.' });
    }
  }

  async getComparison(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid document id.' });
        return;
      }
      const doc = await prisma.document.findUnique({ where: { id } });
      if (!doc) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }
      res.status(200).json({
        success: true,
        documentId: doc.id,
        fileName: doc.filename,
        fileUrl: `http://localhost:3000/uploads/${path.basename(doc.filepath)}`,
        markdown: doc.markdown || '',
        blocks: doc.blocksJson ? JSON.parse(doc.blocksJson) : [],
        pageDimensions: doc.pageDimensionsJson ? JSON.parse(doc.pageDimensionsJson) : {},
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to load comparison.' });
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
      res.status(500).json({ error: error?.message || 'Failed to perform similarity search.' });
    }
  }
}