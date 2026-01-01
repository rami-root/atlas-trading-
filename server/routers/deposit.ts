import { authenticatedProcedure, router } from '../trpc/trpc';
import { db } from '../db';
import { deposits } from '../schema';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

export const depositRouter = router({
  create: authenticatedProcedure
    .input(z.object({
      amount: z.string().transform((val) => parseFloat(val)),
      walletAddress: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { amount, walletAddress } = input;
        const userId = ctx.user.id;

        if (amount <= 0) {
          throw new Error('المبلغ يجب أن يكون أكبر من صفر');
        }

        // Create deposit request (pending status)
        await db.insert(deposits).values({
          userId,
          amount,
          walletAddress,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          success: true,
          message: `تم إنشاء طلب إيداع بقيمة ${amount} USDT. في انتظار موافقة الأدمن`,
        };
      } catch (error) {
        console.error('Error creating deposit:', error);
        throw new Error(error instanceof Error ? error.message : 'فشل في إنشاء طلب الإيداع');
      }
    }),

  getHistory: authenticatedProcedure
    .query(async ({ ctx }) => {
      try {
        const userId = ctx.user.id;
        const history = await db
          .select()
          .from(deposits)
          .where(eq(deposits.userId, userId))
          .orderBy(deposits.createdAt);

        return history;
      } catch (error) {
        console.error('Error fetching deposit history:', error);
        throw new Error('فشل في جلب سجل الإيداعات');
      }
    }),
});
