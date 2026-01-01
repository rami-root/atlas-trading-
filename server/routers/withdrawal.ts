import { authenticatedProcedure, router } from '../trpc/trpc';
import { db } from '../db';
import { capital, transactions } from '../schema';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

export const withdrawalRouter = router({
  create: authenticatedProcedure
    .input(z.object({
      amount: z.string().transform((val) => parseFloat(val)),
      walletAddress: z.string().min(1, 'عنوان المحفظة مطلوب'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { amount, walletAddress } = input;
        const userId = ctx.user.id; // Get userId from authenticated context

        if (amount <= 0) {
          throw new Error('المبلغ يجب أن يكون أكبر من صفر');
        }

        if (amount < 10) {
          throw new Error('الحد الأدنى للسحب 10 USDT');
        }

        // Fetch current capital
        const userCapital = await db
          .select()
          .from(capital)
          .where(eq(capital.userId, userId))
          .limit(1);

        if (userCapital.length === 0) {
          throw new Error('لم يتم العثور على رأس المال');
        }

        const currentCapital = userCapital[0];
        const netProfits = currentCapital.profitBuffer;

        // Check if user has enough profits
        if (netProfits < 10) {
          throw new Error('يجب أن يكون لديك 10 USDT على الأقل من الأرباح للسحب');
        }

        if (amount > netProfits) {
          throw new Error(`لا يمكن سحب أكثر من ${netProfits.toFixed(2)} USDT (الأرباح المتاحة)`);
        }

        // Calculate fee and net amount
        const fee = amount * 0.20;
        const netAmount = amount - fee;

        // Update capital (deduct from profits only)
        const newProfitBuffer = currentCapital.profitBuffer - amount;
        const newAvailableCapital = currentCapital.funding + newProfitBuffer;

        // Use database transaction to ensure atomicity
        await db.transaction(async (tx) => {
          await tx
            .update(capital)
            .set({
              profitBuffer: newProfitBuffer,
              availableCapital: newAvailableCapital,
              updatedAt: new Date(),
            })
            .where(eq(capital.userId, userId));

          // Record the withdrawal transaction
          await tx.insert(transactions).values({
            userId,
            type: 'withdrawal',
            amount: netAmount, // Store net amount after fees
            isCompliant: true,
            description: `سحب بقيمة ${netAmount.toFixed(2)} USDT (بعد خصم رسوم ${fee.toFixed(2)} USDT) إلى المحفظة: ${walletAddress}`,
            createdAt: new Date(),
          });
        });

        return {
          success: true,
          message: `تم إنشاء طلب السحب! ستستلم ${netAmount.toFixed(2)} USDT بعد خصم الرسوم`,
          netAmount,
          fee,
        };
      } catch (error) {
        console.error('Error creating withdrawal:', error);
        throw new Error(error instanceof Error ? error.message : 'فشل في إنشاء طلب السحب');
      }
    }),

  getHistory: authenticatedProcedure
    .query(async ({ ctx }) => {
      try {
        const userId = ctx.user.id;
        const history = await db
          .select()
          .from(transactions)
          .where(and(
            eq(transactions.userId, userId),
            eq(transactions.type, 'withdrawal')
          ))
          .orderBy(transactions.createdAt);

        return history;
      } catch (error) {
        console.error('Error fetching withdrawal history:', error);
        throw new Error('فشل في جلب سجل السحوبات');
      }
    }),
});
