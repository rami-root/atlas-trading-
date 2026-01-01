import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'تم تجاوز عدد المحاولات المسموحة. يرجى المحاولة بعد 15 دقيقة',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for API endpoints
 * Prevents API abuse
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'تم تجاوز عدد الطلبات المسموحة. يرجى المحاولة لاحقاً',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for withdrawal requests
 * Prevents rapid withdrawal attempts
 */
export const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 withdrawal requests per hour
  message: 'تم تجاوز عدد طلبات السحب المسموحة. يرجى المحاولة بعد ساعة',
  standardHeaders: true,
  legacyHeaders: false,
});
