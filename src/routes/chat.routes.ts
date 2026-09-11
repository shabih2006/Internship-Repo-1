import { Router, Request, Response } from 'express';
import { ChatController } from '../controllers/chat.controller.js';

const router = Router();
const chatController = new ChatController();

router.post('/chat', (req: Request, res: Response) => {
  chatController.handleChat(req, res);
});

export default router;