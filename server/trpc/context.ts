import { inferAsyncReturnType } from '@trpc/server';
import * as express from 'express';
import { jwtVerify } from 'jose';
import { db } from '../db';
import { users } from '../schema';
import { eq } from 'drizzle-orm';

// JWT secret from environment
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

// A context function for tRPC with authentication
export const createContext = async ({ req, res }: { req: express.Request; res: express.Response }) => {
  let user = null;
  
  // Try to get token from Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      // Verify JWT token
      const { payload } = await jwtVerify(token, JWT_SECRET);
      
      // Get user from database
      if (payload.userId && typeof payload.userId === 'string') {
        const userResult = await db
          .select()
          .from(users)
          .where(eq(users.id, payload.userId))
          .limit(1);
        
        if (userResult.length > 0) {
          user = userResult[0];
        }
      }
    } catch (error) {
      // Token is invalid or expired
      console.error('JWT verification failed:', error);
    }
  }
  
  return {
    req,
    res,
    user, // null if not authenticated, or user object if authenticated
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;
