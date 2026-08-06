import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export const config = {
  port:            parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv:         process.env['NODE_ENV'] ?? 'development',
  databaseUrl:     requireEnv('DATABASE_URL', 'postgresql://crossboarding:crossboarding_secret@localhost:5432/crossboarding'),
  redisUrl:        requireEnv('REDIS_URL', 'redis://localhost:6379'),
  apiKey:          requireEnv('API_KEY', 'dev-secret-key'),
  corsOrigin:      process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  slackWebhook:    process.env['SLACK_WEBHOOK_URL'] ?? '',
  oktaDomain:      process.env['OKTA_DOMAIN'] ?? '',
  oktaToken:       process.env['OKTA_API_TOKEN'] ?? '',
  githubOrg:       process.env['GITHUB_ORG'] ?? '',
  githubToken:     process.env['GITHUB_TOKEN'] ?? '',
  isDev:           (process.env['NODE_ENV'] ?? 'development') === 'development',
} as const;
