const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
] as const;

const optionalEnvVars = {
  PORT: '3001',
  NODE_ENV: 'development',
  FRONTEND_URL: 'http://localhost:3000',
} as const;

export function validateEnv() {
  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please check your .env file or environment configuration.');
    process.exit(1);
  }

  // Set defaults for optional vars
  for (const [key, defaultValue] of Object.entries(optionalEnvVars)) {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
      console.warn(`⚠️  ${key} not set, using default: ${defaultValue}`);
    }
  }

  // Validate JWT_SECRET is not the default
  if (process.env.JWT_SECRET === 'change-this-to-a-secure-random-string-in-production' && process.env.NODE_ENV === 'production') {
    console.error('❌ JWT_SECRET is using the default value. Please set a secure random string in production.');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
}

export const env = {
  get DATABASE_URL() { return process.env.DATABASE_URL!; },
  get JWT_SECRET() { return process.env.JWT_SECRET!; },
  get PORT() { return parseInt(process.env.PORT || '3001', 10); },
  get NODE_ENV() { return process.env.NODE_ENV || 'development'; },
  get FRONTEND_URL() { return process.env.FRONTEND_URL || 'http://localhost:3000'; },
};
