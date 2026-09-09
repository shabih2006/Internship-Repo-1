import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';

const authService = new AuthService();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, role } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const user = await authService.registerUser(email, password, role);

      res.status(201).json({
        message: 'User registered successfully!',
        user,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Server error during registration.' });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      // Pass email, password, and JWT secret to match the updated loginUser signature
      const result = await authService.loginUser(email, password, JWT_SECRET);

      res.status(200).json({
        message: 'Login successful!',
        ...result,
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message || 'Server error during login.' });
    }
  }
}