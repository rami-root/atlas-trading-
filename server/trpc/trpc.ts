import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';

// Initialize tRPC
const t = initTRPC.context<Context>().create();

// Middleware to check if user is authenticated
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'يجب تسجيل الدخول أولاً',
    });
  }
  
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // user is guaranteed to be defined here
    },
  });
});

// Middleware to check if user is admin
const isAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'يجب تسجيل الدخول أولاً',
    });
  }
  
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'غير مصرح لك بالوصول إلى هذه الصفحة',
    });
  }
  
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Export tRPC procedures and middleware
export const router = t.router;
export const publicProcedure = t.procedure;
export const authenticatedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAdmin);
