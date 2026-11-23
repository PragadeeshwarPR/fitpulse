process.env.NODE_ENV = "test";
process.env.GEMINI_MOCK = "true";
process.env.DATABASE_URL ??= "postgresql://fitpulse:fitpulse@localhost:5432/fitpulse?schema=public";
