import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { chatRateLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();
const chatController = new ChatController();

router.post('/', authenticateToken, chatRateLimiter, (req, res) => chatController.handleChat(req, res));
router.get('/history', authenticateToken, (req, res) => chatController.getHistory(req, res));
router.put('/preferences', authenticateToken, (req, res) => chatController.updatePreferences(req, res));

export default router;