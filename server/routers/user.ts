import { publicProcedure, router } from '../trpc/trpc';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../schema';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const userRouter = router({
  // Register new user with referral support
  register: publicProcedure
    .input(z.object({
      username: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      phoneNumber: z.string().optional(),
      referralCode: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const { username, email, password, phoneNumber, referralCode } = input;
        
        // Check if user already exists
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
          
        if (existingUser.length > 0) {
          throw new Error('User already exists');
        }
        
        // Hash password
        const bcrypt = await import('bcryptjs');
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Generate unique referral code for new user (guaranteed unique)
        let userReferralCode = '';
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!isUnique && attempts < maxAttempts) {
          userReferralCode = `ATLAS${nanoid(6).toUpperCase()}`;
          
          // Check if code already exists
          const existingCode = await db
            .select()
            .from(users)
            .where(eq(users.referralCode, userReferralCode))
            .limit(1);
          
          if (existingCode.length === 0) {
            isUnique = true;
          } else {
            attempts++;
          }
        }
        
        if (!isUnique || !userReferralCode) {
          throw new Error('Failed to generate unique referral code');
        }
        
        // Create new user
        const userId = nanoid();
        await db.insert(users).values({
          id: userId,
          username,
          email,
          passwordHash,
          role: 'user',
          referralCode: userReferralCode,
          referredBy: referralCode || null,
        });
        
        return {
          success: true,
          message: 'User registered successfully',
          user: {
            id: userId,
            username,
            email,
            role: 'user',
            referralCode: userReferralCode,
          }
        };
      } catch (error) {
        console.error('Registration error:', error);
        throw new Error(error instanceof Error ? error.message : 'Registration failed');
      }
    }),
    
  // Get user referral info
  getReferralInfo: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      try {
        const user = await db
          .select({
            referralCode: users.referralCode,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
          
        if (user.length === 0) {
          throw new Error('User not found');
        }
        
        const referralCode = user[0].referralCode;
        if (!referralCode) {
          // Should never happen - all users should have a referral code from registration
          // But if it does, generate a unique one (this is a safety fallback)
          let newReferralCode = '';
          let isUnique = false;
          let attempts = 0;
          const maxAttempts = 10;
          
          while (!isUnique && attempts < maxAttempts) {
            newReferralCode = `ATLAS${nanoid(6).toUpperCase()}`;
            
            // Check if code already exists
            const existingCode = await db
              .select()
              .from(users)
              .where(eq(users.referralCode, newReferralCode))
              .limit(1);
            
            if (existingCode.length === 0) {
              isUnique = true;
            } else {
              attempts++;
            }
          }
          
          if (!isUnique || !newReferralCode) {
            throw new Error('Failed to generate unique referral code');
          }
          
          await db
            .update(users)
            .set({ referralCode: newReferralCode })
            .where(eq(users.id, input.userId));
            
          return {
            referralCode: newReferralCode,
            referralLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?ref=${newReferralCode}`,
          };
        }
        
        return {
          referralCode,
          referralLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?ref=${referralCode}`,
        };
      } catch (error) {
        console.error('Get referral info error:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to get referral info');
      }
    }),
    
  // Get user's referral team
  getReferralTeam: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      try {
        // Get user's referral code
        const user = await db
          .select({ referralCode: users.referralCode })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
          
        if (user.length === 0 || !user[0].referralCode) {
          return {
            level1: 0,
            level2: 0,
            level3: 0,
            total: 0,
          };
        }
        
        const referralCode = user[0].referralCode;
        
        // Count level 1 referrals (direct)
        const level1Users = await db
          .select({ id: users.id, referralCode: users.referralCode })
          .from(users)
          .where(eq(users.referredBy, referralCode));
          
        const level1 = level1Users.length;
        
        // Optimize: Get all level 2 referrals in one query using IN clause
        let level2 = 0;
        let level2Users: { referralCode: string | null }[] = [];
        
        if (level1Users.length > 0) {
          const level1Codes = level1Users
            .map(u => u.referralCode)
            .filter((code): code is string => code !== null);
          
          if (level1Codes.length > 0) {
            level2Users = await db
              .select({ referralCode: users.referralCode })
              .from(users)
              .where(sql`${users.referredBy} IN ${level1Codes}`);
            level2 = level2Users.length;
          }
        }
        
        // Optimize: Get all level 3 referrals in one query using IN clause
        let level3 = 0;
        
        if (level2Users.length > 0) {
          const level2Codes = level2Users
            .map(u => u.referralCode)
            .filter((code): code is string => code !== null);
          
          if (level2Codes.length > 0) {
            const level3Users = await db
              .select()
              .from(users)
              .where(sql`${users.referredBy} IN ${level2Codes}`);
            level3 = level3Users.length;
          }
        }
        
        return {
          level1,
          level2,
          level3,
          total: level1 + level2 + level3,
        };
      } catch (error) {
        console.error('Get referral team error:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to get referral team');
      }
    }),
});
