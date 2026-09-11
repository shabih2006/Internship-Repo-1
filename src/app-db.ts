import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import path from 'path';

import { audioUpload } from './middleware/audioUpload.middleware.js';
import { VoiceController } from './controllers/voice.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { StudentController } from './controllers/student.controller.js';
import { ChatController } from './controllers/chat.controller.js';
import { DocumentController } from './controllers/document.controller.js';
import { uploadPdf } from './middlewares/upload.middleware.js';
import { RagController } from './controllers/rag.controller.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_development_secret_key';

// 1. ENABLE CORS FOR FRONTEND UI (React / Vite)
app.use(
  cors({
    origin: true, // Allow all local development origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 2. PARSE JSON REQUEST BODIES
app.use(express.json());

// 3. SERVE STATIC AUDIO FILES
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const authController = new AuthController();
const studentController = new StudentController();
const chatController = new ChatController();
const documentController = new DocumentController();
const voiceController = new VoiceController();
const ragController = new RagController();

// RATE LIMITER FOR AUTHENTICATED CHAT
const chatRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30, // Increased threshold for active testing
  message: {
    success: false,
    error: 'Too many chat requests from this IP. Please wait a minute before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// AUTHENTICATION MIDDLEWARE
interface AuthenticatedRequest extends Request {
  user?: any;
}

const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token has expired. Please log in again.' });
        return;
      }
      res.status(401).json({ error: 'Invalid or malformed token.' });
      return;
    }
    req.user = user;
    next();
  });
};

const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]`,
      });
      return;
    }
    next();
  };
};

// ==========================================
// UNAUTHENTICATED PUBLIC ROUTES (For React Chat UI)
// ==========================================
app.post('/api/chat', (req, res) => chatController.handleChat(req, res));
app.post('/api/chat-rag', (req, res) => chatController.handleChat(req, res));

// NEW: PUBLIC DOCUMENT UPLOAD ENDPOINT FOR REACT FRONTEND
app.post('/api/upload', uploadPdf.single('document'), (req, res) =>
  documentController.uploadDocument(req, res)
);

// AUTHENTICATION ROUTES
app.post('/auth/register', (req, res) => authController.register(req, res));
app.post('/auth/login', (req, res) => authController.login(req, res));

// DOCUMENT SEARCH ROUTES
app.post('/documents/search', authenticateToken, (req, res) =>
  documentController.searchDocuments(req, res)
);

// STUDENT MANAGEMENT ROUTES
app.get('/students', authenticateToken, (req, res) => studentController.getAll(req, res));
app.get('/students/:id', authenticateToken, (req, res) => studentController.getById(req, res));
app.post('/students', authenticateToken, (req, res) => studentController.create(req, res));
app.delete('/students/:id', authenticateToken, authorizeRoles('ADMIN'), (req, res) =>
  studentController.delete(req, res)
);

// AUTHENTICATED AI CHATBOT ROUTES
app.post('/chat', chatRateLimiter, authenticateToken, (req, res) =>
  chatController.handleChat(req, res)
);
app.get('/chat/history', authenticateToken, (req, res) => chatController.getHistory(req, res));
app.put('/chat/preferences', authenticateToken, (req, res) =>
  chatController.updatePreferences(req, res)
);

// RAG DOCUMENT ROUTES (AUTHENTICATED)
app.post('/documents/upload', authenticateToken, uploadPdf.single('file'), (req, res) =>
  documentController.uploadDocument(req, res)
);
app.post('/ai/chat-rag', authenticateToken, (req, res) => ragController.askQuestion(req, res));

// INSPECT DOCUMENT CHUNKS
app.get('/api/chunks', async (req, res) => {
  try {
    const documentId = req.query.documentId ? Number(req.query.documentId) : undefined;

    const chunks = await prisma.documentChunk.findMany({
      where: documentId ? { documentId } : {},
      orderBy: { chunkIndex: 'asc' },
      take: 50,
      select: {
        id: true,
        documentId: true,
        chunkIndex: true,
        content: true,
      },
    });

    res.status(200).json({
      success: true,
      count: chunks.length,
      chunks,
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to fetch document chunks' });
  }
});

// RAG VOICE ASSISTANT ROUTES
app.post('/ai/voice-upload', authenticateToken, audioUpload.single('audio'), (req, res) =>
  voiceController.handleAudioUpload(req, res)
);
app.post('/voice/upload', authenticateToken, audioUpload.single('file'), (req, res) =>
  voiceController.handleAudioUpload(req, res)
);

// 404 HANDLER
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found.` });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

// Timeout extension for voice & LLM generation pipelines
server.timeout = 120000;