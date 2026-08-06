import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth in test environment
  if (config.nodeEnv === 'test') { next(); return; }

  const key = req.headers['x-api-key'];
  if (!key || key !== config.apiKey) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid X-API-Key header' });
    return;
  }
  next();
}
