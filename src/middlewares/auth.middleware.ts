import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, error: 'Access token required.' });
    return;
  }

  const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

  jwt.verify(token, secret, (err, decoded: any) => {
    if (err) {
      res.status(403).json({ success: false, error: 'Invalid or expired token.' });
      return;
    }

    req.user = {
      id: decoded.id || decoded.studentId || decoded.userId || 1,
      role: decoded.role || 'STUDENT',
    };

    next();
  });
};