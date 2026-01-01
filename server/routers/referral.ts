import { publicProcedure, router } from '../trpc/trpc';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const referralRouter = router({
  // Get user referral info
  info: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      try {
        const { userId } = input;

        const user = await db
          .select({
            referralCode: users.referralCode,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, userId))
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
            .where(eq(users.id, userId));
          
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
  team: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      try {
        const { userId } = input;

        // Get user's referral code
        const user = await db
          .select({ referralCode: users.referralCode })
          .from(users)
          .where(eq(users.id, userId))
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
        
        // Count level 2 referrals
        let level2 = 0;
        for (const level1User of level1Users) {
          if (level1User.referralCode) {
            const level2Count = await db
              .select()
              .from(users)
              .where(eq(users.referredBy, level1User.referralCode));
            level2 += level2Count.length;
          }
        }
        
        // Count level 3 referrals
        let level3 = 0;
        for (const level1User of level1Users) {
          if (level1User.referralCode) {
            const level2Users = await db
              .select({ referralCode: users.referralCode })
              .from(users)
              .where(eq(users.referredBy, level1User.referralCode));
              
            for (const level2User of level2Users) {
              if (level2User.referralCode) {
                const level3Count = await db
                  .select()
                  .from(users)
                  .where(eq(users.referredBy, level2User.referralCode));
                level3 += level3Count.length;
              }
            }
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

