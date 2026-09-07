import rateLimit from 'express-rate-limit';

export const chatRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 10, // Limit each IP/user to 10 chat requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests! Please wait a minute before sending more prompts.',
  },
});