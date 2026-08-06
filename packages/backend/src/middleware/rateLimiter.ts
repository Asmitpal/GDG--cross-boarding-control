import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs:  15 * 60 * 1000, // 15 min
  max:       200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests', message: 'Rate limit exceeded. Try again later.' },
});

export const webhookLimiter = rateLimit({
  windowMs:  60 * 1000, // 1 min
  max:       20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests', message: 'Webhook rate limit exceeded.' },
});
