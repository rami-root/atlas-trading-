import { router } from './trpc';
import { userRouter } from '../routers/user';
import { capitalRouter } from '../routers/capital';
import { cryptoRouter } from '../routers/crypto';
import { depositRouter } from '../routers/deposit';
import { withdrawalRouter } from '../routers/withdrawal';
import { adminRouter } from '../routers/admin';
import { referralRouter } from '../routers/referral';

// Define the main application router
export const appRouter = router({
  user: userRouter,
  capital: capitalRouter,
  crypto: cryptoRouter,
  deposit: depositRouter,
  withdrawal: withdrawalRouter,
  admin: adminRouter,
  referral: referralRouter,
});

// Export type for the app router
export type AppRouter = typeof appRouter;
