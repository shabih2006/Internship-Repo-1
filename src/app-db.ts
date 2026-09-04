import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { AuthController } from './controllers/auth.controller.js';
import { StudentController } from './controllers/student.controller.js';
import { ChatController } from './controllers/chat.controller.js';

const app = express();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
}

app.use(express.json());

const authController = new AuthController();
const studentController = new StudentController();
const chatController = new ChatController();

// ========================================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ========================================================
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

// ========================================================
// ROUTE DEFINITIONS (DELEGATED TO CONTROLLERS)
// ========================================================
app.post('/auth/register', (req, res) => authController.register(req, res));
app.post('/auth/login', (req, res) => authController.login(req, res));

app.get('/students', authenticateToken, (req, res) => studentController.getAll(req, res));
app.get('/students/:id', authenticateToken, (req, res) => studentController.getById(req, res));
app.post('/students', authenticateToken, (req, res) => studentController.create(req, res));
app.delete('/students/:id', authenticateToken, authorizeRoles('ADMIN'), (req, res) => studentController.delete(req, res));

// ========================================================
// AI CHATBOT ROUTES (TASK 7.1)
// ========================================================
app.post('/chat', (req, res) => chatController.handleChat(req, res));
app.get('/chat/history', (req, res) => chatController.getHistory(req, res));

// 404 HANDLER
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found.` });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

// Configure explicit server timeout handling (15s)
server.timeout = 15000;