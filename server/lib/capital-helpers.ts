import { db } from '../db';
import { capital } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Get or create capital record for a user
 * This helper function eliminates code duplication across routers
 */
export async function getOrCreateCapital(userId: string) {
  const userCapital = await db
    .select()
    .from(capital)
    .where(eq(capital.userId, userId))
    .limit(1);

  if (userCapital.length === 0) {
    // Create new capital record with default values
    const newCapital = {
      userId,
      funding: 0.00,
      profitBuffer: 0.00,
      availableCapital: 0.00,
      updatedAt: new Date(),
    };
    
    await db.insert(capital).values(newCapital);
    
    return newCapital;
  }

  return userCapital[0];
}

/**
 * Calculate available capital from funding and profit buffer
 */
export function calculateAvailableCapital(funding: number, profitBuffer: number): number {
  return funding + profitBuffer;
}

/**
 * Validate capital amount
 */
export function validateAmount(amount: number, minAmount: number = 0): void {
  if (amount <= minAmount) {
    throw new Error(`المبلغ يجب أن يكون أكبر من ${minAmount}`);
  }
}
