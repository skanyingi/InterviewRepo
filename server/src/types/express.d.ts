import type { InferSelectModel } from 'drizzle-orm';
import type { users } from '../db/schema.js';

type User = InferSelectModel<typeof users>;

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionToken?: string;
    }
  }
}

export {};
