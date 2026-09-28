// src/app-db.ts

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import cors from "cors";
import path from "path";

import { AuthController } from "./controllers/auth.controller.js";
import { StudentController } from "./controllers/student.controller.js";
import { ChatController } from "./controllers/chat.controller.js";
import { DocumentController } from "./controllers/document.controller.js";
import { uploadPdf } from "./middlewares/upload.middleware.js";
import { RagController } from "./controllers/rag.controller.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error(
    "FATAL ERROR: JWT_SECRET is not defined in environment variables.",
  );
  process.exit(1);
}

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Controllers
const authController = new AuthController();
const studentController = new StudentController();
const chatController = new ChatController();
const documentController = new DocumentController();
const ragController = new RagController();

// Rate Limiters
const chatRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: {
    success: false,
    error: "Too many chat requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication Middleware
interface AuthenticatedRequest extends Request {
  user?: any;
}

const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Access denied. No token provided." });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      const message =
        err.name === "TokenExpiredError"
          ? "Token has expired. Please log in again."
          : "Invalid or malformed token.";
      res.status(401).json({ error: message });
      return;
    }
    req.user = user;
    next();
  });
};

const authorizeRoles = (...allowedRoles: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res
        .status(403)
        .json({
          error: `Forbidden: Access restricted to roles [${allowedRoles.join(", ")}]`,
        });
      return;
    }
    next();
  };
};

// Inject the authenticated user's ID into req.body.studentId (for chat routes)
const injectUserId = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.user?.userId) {
    req.body.studentId = req.user.userId;
  }
  next();
};

// ==========================================
// API ROUTES
// ==========================================

// --- Authentication ---
app.post("/api/auth/register", (req, res) => authController.register(req, res));
app.post("/api/auth/login", (req, res) => authController.login(req, res));

// --- Students (Protected) ---
app.get("/api/students", authenticateToken, (req, res) =>
  studentController.getAll(req, res),
);
app.get("/api/students/:id", authenticateToken, (req, res) =>
  studentController.getById(req, res),
);
app.post(
  "/api/students",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res) => studentController.create(req, res),
);
app.delete(
  "/api/students/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res) => studentController.delete(req, res),
);

// --- Chat (Protected & Rate-Limited) ---
app.post(
  "/api/chat",
  chatRateLimiter,
  authenticateToken,
  injectUserId,
  (req, res) => chatController.handleChat(req, res),
);
app.get("/api/chat/history", authenticateToken, (req, res) =>
  chatController.getHistory(req, res),
);
app.delete("/api/chat/history", authenticateToken, (req, res) =>
  chatController.clearHistory(req, res),
);
app.put("/api/chat/preferences", authenticateToken, injectUserId, (req, res) =>
  chatController.updatePreferences(req, res),
);

// --- Documents & RAG (Protected) ---
app.post(
  "/api/documents/upload",
  authenticateToken,
  uploadPdf.single("document"),
  (req, res) => documentController.uploadDocument(req, res),
);
app.get("/api/documents/:id/comparison", authenticateToken, (req, res) =>
  documentController.getComparison(req, res),
);
app.post("/api/documents/search", authenticateToken, (req, res) =>
  documentController.searchDocuments(req, res),
);
app.post("/api/ai/chat-rag", authenticateToken, (req, res) =>
  ragController.askQuestion(req, res),
);

// --- Chunks Inspection (Protected) ---
app.get("/api/chunks", authenticateToken, async (req, res) => {
  try {
    const documentId = req.query.documentId
      ? Number(req.query.documentId)
      : undefined;
    const chunks = await prisma.documentChunk.findMany({
      where: documentId ? { documentId } : {},
      orderBy: { chunkIndex: "asc" },
      take: 50,
    });
    res.status(200).json({ success: true, count: chunks.length, chunks });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error?.message || "Failed to fetch document chunks" });
  }
});

// ==========================================
// CENTRALIZED ERROR & 404 HANDLERS
// ==========================================

// 404 Not Found Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found.` });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    console.error(`[400] Malformed JSON Body: ${err.message}`);
    return res
      .status(400)
      .json({ error: "Invalid JSON payload sent in request body." });
  }

  console.error("[500] Unhandled Server Error:", err);
  res.status(500).json({ error: "Internal Server Error." });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

// Timeout extension for long-running processes like LLM generation
server.timeout = 120000;
