import { adminProcedure, router } from '../trpc/trpc';
import { db } from '../db';
import { deposits, capital, transactions, users } from '../schema';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { calculateReferralReward } from '../../shared/referral-config';

export const adminRouter = router({
  // Get all deposits with user info
  deposits: adminProcedure
    .query(async () => {
      try {
        const result = await db
          .select({
            id: deposits.id,
            userId: deposits.userId,
            amount: deposits.amount,
            walletAddress: deposits.walletAddress,
            status: deposits.status,
            rejectionReason: deposits.rejectionReason,
            createdAt: deposits.createdAt,
            userName: users.username,
            userEmail: users.email,
          })
          .from(deposits)
          .leftJoin(users, eq(deposits.userId, users.id))
          .orderBy(desc(deposits.createdAt));

        return result;
      } catch (error) {
        console.error('Error fetching admin deposits:', error);
        throw new Error('فشل في جلب قائمة الإيداعات');
      }
    }),

  // Approve deposit
  approveDeposit: adminProcedure
    .input(z.object({
      depositId: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        const { depositId } = input;

        // Get deposit details
        const deposit = await db
          .select()
          .from(deposits)
          .where(eq(deposits.id, depositId))
          .limit(1);

        if (deposit.length === 0) {
          throw new Error('طلب الإيداع غير موجود');
        }

        const depositData = deposit[0];

        if (depositData.status !== 'pending') {
          throw new Error('تم معالجة هذا الطلب بالفعل');
        }

        // Update deposit status
        await db
          .update(deposits)
          .set({
            status: 'confirmed',
            updatedAt: new Date(),
          })
          .where(eq(deposits.id, depositId));

        // Add funds to user's capital
        const userCapital = await db
          .select()
          .from(capital)
          .where(eq(capital.userId, depositData.userId))
          .limit(1);

        if (userCapital.length === 0) {
          // Create new capital record
          await db.insert(capital).values({
            userId: depositData.userId,
            funding: depositData.amount,
            profitBuffer: 0.00,
            availableCapital: depositData.amount,
            updatedAt: new Date(),
          });
        } else {
          // Update existing capital
          const currentCapital = userCapital[0];
          const newFunding = currentCapital.funding + depositData.amount;
          const newAvailableCapital = newFunding + currentCapital.profitBuffer;

          await db
            .update(capital)
            .set({
              funding: newFunding,
              availableCapital: newAvailableCapital,
              updatedAt: new Date(),
            })
            .where(eq(capital.userId, depositData.userId));
        }

        // Record transaction
        await db.insert(transactions).values({
          userId: depositData.userId,
          type: 'deposit',
          amount: depositData.amount,
          isCompliant: true,
          description: `إيداع مؤكد بقيمة ${depositData.amount} USDT`,
          createdAt: new Date(),
        });

        // Process referral rewards (3 levels)
        const depositor = await db
          .select()
          .from(users)
          .where(eq(users.id, depositData.userId))
          .limit(1);

        if (depositor.length > 0 && depositor[0].referredBy) {
          // Level 1 - EMP-1 (7%)
          const level1User = await db
            .select()
            .from(users)
            .where(eq(users.referralCode, depositor[0].referredBy))
            .limit(1);

          if (level1User.length > 0) {
            const level1Reward = calculateReferralReward(depositData.amount, 1);
            
            // Add reward to level 1 user
            const level1Capital = await db
              .select()
              .from(capital)
              .where(eq(capital.userId, level1User[0].id))
              .limit(1);

            if (level1Capital.length === 0) {
              await db.insert(capital).values({
                userId: level1User[0].id,
                funding: 0,
                profitBuffer: level1Reward,
                availableCapital: level1Reward,
                updatedAt: new Date(),
              });
            } else {
              const newProfitBuffer = level1Capital[0].profitBuffer + level1Reward;
              const newAvailableCapital = level1Capital[0].funding + newProfitBuffer;
              
              await db
                .update(capital)
                .set({
                  profitBuffer: newProfitBuffer,
                  availableCapital: newAvailableCapital,
                  updatedAt: new Date(),
                })
                .where(eq(capital.userId, level1User[0].id));
            }

            // Record transaction
            await db.insert(transactions).values({
              userId: level1User[0].id,
              type: 'referral_commission',
              amount: level1Reward,
              isCompliant: true,
              description: `مكافأة EMP-1 (7%) من إيداع ${depositData.amount} USDT`,
              createdAt: new Date(),
            });

            // Level 2 - EMP-2 (2%)
            if (level1User[0].referredBy) {
              const level2User = await db
                .select()
                .from(users)
                .where(eq(users.referralCode, level1User[0].referredBy))
                .limit(1);

              if (level2User.length > 0) {
                const level2Reward = calculateReferralReward(depositData.amount, 2);
                
                const level2Capital = await db
                  .select()
                  .from(capital)
                  .where(eq(capital.userId, level2User[0].id))
                  .limit(1);

                if (level2Capital.length === 0) {
                  await db.insert(capital).values({
                    userId: level2User[0].id,
                    funding: 0,
                    profitBuffer: level2Reward,
                    availableCapital: level2Reward,
                    updatedAt: new Date(),
                  });
                } else {
                  const newProfitBuffer = level2Capital[0].profitBuffer + level2Reward;
                  const newAvailableCapital = level2Capital[0].funding + newProfitBuffer;
                  
                  await db
                    .update(capital)
                    .set({
                      profitBuffer: newProfitBuffer,
                      availableCapital: newAvailableCapital,
                      updatedAt: new Date(),
                    })
                    .where(eq(capital.userId, level2User[0].id));
                }

                await db.insert(transactions).values({
                  userId: level2User[0].id,
                  type: 'referral_commission',
                  amount: level2Reward,
                  isCompliant: true,
                  description: `مكافأة EMP-2 (2%) من إيداع ${depositData.amount} USDT`,
                  createdAt: new Date(),
                });

                // Level 3 - EMP-3 (1%)
                if (level2User[0].referredBy) {
                  const level3User = await db
                    .select()
                    .from(users)
                    .where(eq(users.referralCode, level2User[0].referredBy))
                    .limit(1);

                  if (level3User.length > 0) {
                    const level3Reward = calculateReferralReward(depositData.amount, 3);
                    
                    const level3Capital = await db
                      .select()
                                          .from(capital)
                      .where(eq(capital.userId, level3User[0].id))
                      .limit(1);

                    if (level3Capital.length === 0) {
                      await db.insert(capital).values({
                        userId: level3User[0].id,
                        funding: 0,
                        profitBuffer: level3Reward,
                        availableCapital: level3Reward,
                        updatedAt: new Date(),
                      });
                    } else {
                      const newProfitBuffer = level3Capital[0].profitBuffer + level3Reward;
                      const newAvailableCapital = level3Capital[0].funding + newProfitBuffer;
                      
                      await db
                        .update(capital)
                        .set({
                          profitBuffer: newProfitBuffer,
                          availableCapital: newAvailableCapital,
                          updatedAt: new Date(),
                        })
                        .where(eq(capital.userId, level3User[0].id));
                    }

                    await db.insert(transactions).values({
                      userId: level3User[0].id,
                      type: 'referral_commission',
                      amount: level3Reward,
                      isCompliant: true,
                      description: `مكافأة EMP-3 (1%) من إيداع ${depositData.amount} USDT`,
                      createdAt: new Date(),
                    });
                  }
                }
              }
            }
          }
        }

        return {
          success: true,
          message: 'تم الموافقة على الإيداع بنجاح',
        };
      } catch (error) {
        console.error('Error approving deposit:', error);
        throw new Error(error instanceof Error ? error.message : 'فشل في الموافقة على الإيداع');
      }
    }),

  // Reject deposit
  rejectDeposit: adminProcedure
    .input(z.object({
      depositId: z.number(),
      reason: z.string().min(1, 'سبب الرفض مطلوب'),
    }))
    .mutation(async ({ input }) => {
      try {
        const { depositId, reason } = input;

        // Get deposit details
        const deposit = await db
          .select()
          .from(deposits)
          .where(eq(deposits.id, depositId))
          .limit(1);

        if (deposit.length === 0) {
          throw new Error('طلب الإيداع غير موجود');
        }

        if (deposit[0].status !== 'pending') {
          throw new Error('تم معالجة هذا الطلب بالفعل');
        }

        // Update deposit status
        await db
          .update(deposits)
          .set({
            status: 'failed',
            rejectionReason: reason,
            updatedAt: new Date(),
          })
          .where(eq(deposits.id, depositId));

        return {
          success: true,
          message: 'تم رفض الإيداع',
        };
      } catch (error) {
        console.error('Error rejecting deposit:', error);
        throw new Error(error instanceof Error ? error.message : 'فشل في رفض الإيداع');
      }
    }),

  // Get all users with capital information
  users: adminProcedure
    .query(async () => {
      try {
        const allUsers = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
          })
          .from(users)
          .orderBy(users.createdAt);

        const usersWithCapital = await Promise.all(
          allUsers.map(async (user) => {
            const userCapital = await db
              .select()
              .from(capital)
              .where(eq(capital.userId, user.id))
              .limit(1);

            const capitalData = userCapital[0] || {
              funding: 0,
              profitBuffer: 0,
              availableCapital: 0,
            };

            return {
              id: user.id,
              name: user.username,
              email: user.email,
              role: user.role,
              totalBalance: capitalData.funding + capitalData.profitBuffer,
              totalDeposits: capitalData.funding,
              netProfits: capitalData.profitBuffer,
              availableBalance: capitalData.availableCapital,
              funding: capitalData.funding,
              profitBuffer: capitalData.profitBuffer,
            };
          })
        );

        return usersWithCapital;
      } catch (error) {
        console.error('Error fetching users:', error);
        throw new Error('فشل في جلب قائمة المستخدمين');
      }
    }),

  // Update user balance (add or deduct)
  updateBalance: adminProcedure
    .input(z.object({
      userId: z.string(),
      amount: z.string().transform((val) => parseFloat(val)),
      type: z.enum(['add', 'deduct']),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const { userId, amount, type, reason } = input;

        if (amount <= 0) {
          throw new Error('المبلغ يجب أن يكون أكبر من صفر');
        }

        // Get user capital
        const userCapital = await db
          .select()
          .from(capital)
          .where(eq(capital.userId, userId))
          .limit(1);

        if (userCapital.length === 0) {
          // Create new capital record if doesn't exist
          await db.insert(capital).values({
            userId,
            funding: type === 'add' ? amount : 0,
            profitBuffer: 0,
            availableCapital: type === 'add' ? amount : 0,
            updatedAt: new Date(),
          });

          // Record transaction
          await db.insert(transactions).values({
            userId,
            type: type === 'add' ? 'admin_add' : 'admin_deduct',
            amount,
            isCompliant: true,
            description: reason || `${type === 'add' ? 'إضافة رصيد' : 'خصم رصيد'} من قبل الأدمن: ${amount} USDT`,
            createdAt: new Date(),
          });

          return {
            success: true,
            message: `تم ${type === 'add' ? 'إضافة' : 'خصم'} الرصيد بنجاح`,
          };
        }

        const currentCapital = userCapital[0];
        let newFunding = currentCapital.funding;
        let newProfitBuffer = currentCapital.profitBuffer;

        if (type === 'add') {
          // Add to funding
          newFunding += amount;
        } else {
          // Deduct: first from profitBuffer, then from funding
          if (currentCapital.profitBuffer >= amount) {
            newProfitBuffer -= amount;
          } else {
            const remainingDeduction = amount - currentCapital.profitBuffer;
            newProfitBuffer = 0;
            newFunding = Math.max(0, newFunding - remainingDeduction);
          }
        }

        const newAvailableCapital = newFunding + newProfitBuffer;

        // Update capital
        await db
          .update(capital)
          .set({
            funding: newFunding,
            profitBuffer: newProfitBuffer,
            availableCapital: newAvailableCapital,
            updatedAt: new Date(),
          })
          .where(eq(capital.userId, userId));

        // Record transaction
        await db.insert(transactions).values({
          userId,
          type: type === 'add' ? 'admin_add' : 'admin_deduct',
          amount,
          isCompliant: true,
          description: reason || `${type === 'add' ? 'إضافة رصيد' : 'خصم رصيد'} من قبل الأدمن: ${amount} USDT`,
          createdAt: new Date(),
        });

        return {
          success: true,
          message: `تم ${type === 'add' ? 'إضافة' : 'خصم'} الرصيد بنجاح`,
        };
      } catch (error) {
        console.error('Error updating balance:', error);
        throw new Error(error instanceof Error ? error.message : 'فشل في تحديث الرصيد');
      }
    }),

  // Reset user account (clear all capital)
  resetUserAccount: adminProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const { userId } = input;

        // Check if user exists
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (user.length === 0) {
          throw new Error('المستخدم غير موجود');
        }

        // Reset capital to zero
        const userCapital = await db
          .select()
          .from(capital)
          .where(eq(capital.userId, userId))
          .limit(1);

        if (userCapital.length > 0) {
          await db
            .update(capital)
            .set({
              funding: 0,
              profitBuffer: 0,
              availableCapital: 0,
              updatedAt: new Date(),
            })
            .where(eq(capital.userId, userId));
        } else {
          // Create zero capital record
          await db.insert(capital).values({
            userId,
            funding: 0,
            profitBuffer: 0,
            availableCapital: 0,
            updatedAt: new Date(),
          });
        }

        // Record transaction
        await db.insert(transactions).values({
          userId,
          type: 'admin_reset',
          amount: 0,
          isCompliant: true,
          description: 'تصفير حساب المستخدم من قبل الأدمن',
          createdAt: new Date(),
        });

        return {
          success: true,
          message: 'تم تصفير حساب المستخدم بنجاح',
        };
      } catch (error) {
        console.error('Error resetting user account:', error);
        throw new Error(error instanceof Error ? error.message : 'فشل في تصفير الحساب');
      }
    }),

  // Set user capital directly (set specific values)
  setUserCapital: adminProcedure
    .input(z.object({
      userId: z.string(),
      funding: z.number().min(0).optional(),
      profitBuffer: z.number().min(0).optional(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const { userId, funding, profitBuffer, reason } = input;

        // Check if user exists
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (user.length === 0) {
          throw new Error('المستخدم غير موجود');
        }

        const userCapital = await db
          .select()
          .from(capital)
          .where(eq(capital.userId, userId))
          .limit(1);

        const newFunding = funding !== undefined ? funding : (userCapital[0]?.funding || 0);
        const newProfitBuffer = profitBuffer !== undefined ? profitBuffer : (userCapital[0]?.profitBuffer || 0);
        const newAvailableCapital = newFunding + newProfitBuffer;

        if (userCapital.length === 0) {
          // Create new capital record
          await db.insert(capital).values({
            userId,
            funding: newFunding,
            profitBuffer: newProfitBuffer,
            availableCapital: newAvailableCapital,
            updatedAt: new Date(),
          });
        } else {
          // Update existing capital
          await db
            .update(capital)
            .set({
              funding: newFunding,
              profitBuffer: newProfitBuffer,
              availableCapital: newAvailableCapital,
              updatedAt: new Date(),
            })
            .where(eq(capital.userId, userId));
        }

        // Record transaction
        await db.insert(transactions).values({
          userId,
          type: 'admin_set_capital',
          amount: newAvailableCapital,
          isCompliant: true,
          description: reason || `تعيين رصيد محدد من قبل الأدمن - التغذية: ${newFunding}, الأرباح: ${newProfitBuffer}`,
          createdAt: new Date(),
        });

        return {
          success: true,
          message: 'تم تعيين رصيد المستخدم بنجاح',
        };
      } catch (error) {
        console.error('Error setting user capital:', error);
        throw new Error(error instanceof Error ? error.message : 'فشل في تعيين الرصيد');
      }
    }),

  // Get user transactions
  getUserTransactions: adminProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().optional().default(100),
    }))
    .query(async ({ input }) => {
      try {
        const { userId, limit } = input;

        const userTransactions = await db
          .select()
          .from(transactions)
          .where(eq(transactions.userId, userId))
          .orderBy(desc(transactions.createdAt))
          .limit(limit);

        return userTransactions;
      } catch (error) {
        console.error('Error fetching user transactions:', error);
        throw new Error('فشل في جلب معاملات المستخدم');
      }
    }),
});
