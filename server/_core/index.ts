import 'dotenv/config';
import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from '../trpc/index';
import path from 'path';
import { createContext } from '../trpc/context';
import { runMigrations } from '../db/migrate';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { jwtVerify, SignJWT } from 'jose';

const app = express();
const port = process.env.PORT || 3000;

const jwtSecret = process.env.AUTH_JWT_SECRET;
if (!jwtSecret) {
  throw new Error('AUTH_JWT_SECRET environment variable is not set');
}
const jwtKey = new TextEncoder().encode(jwtSecret);

const adminEmail = process.env.ADMIN_EMAIL ? String(process.env.ADMIN_EMAIL).trim().toLowerCase() : '';
const adminPassword = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD) : '';

const COINGECKO_ASSETS: Array<{ symbol: string; name: string; id: string }> = [
  { symbol: 'BTC/USDT', name: 'Bitcoin', id: 'bitcoin' },
  { symbol: 'ETH/USDT', name: 'Ethereum', id: 'ethereum' },
  { symbol: 'USDT/USDT', name: 'Tether', id: 'tether' },
  { symbol: 'BNB/USDT', name: 'BNB', id: 'binancecoin' },
  { symbol: 'XRP/USDT', name: 'XRP', id: 'ripple' },
  { symbol: 'ADA/USDT', name: 'Cardano', id: 'cardano' },
  { symbol: 'SOL/USDT', name: 'Solana', id: 'solana' },
  { symbol: 'DOGE/USDT', name: 'Dogecoin', id: 'dogecoin' },
  { symbol: 'TRX/USDT', name: 'TRON', id: 'tron' },
  { symbol: 'TON/USDT', name: 'Toncoin', id: 'the-open-network' },
  { symbol: 'LTC/USDT', name: 'Litecoin', id: 'litecoin' },
  { symbol: 'BCH/USDT', name: 'Bitcoin Cash', id: 'bitcoin-cash' },
  { symbol: 'DOT/USDT', name: 'Polkadot', id: 'polkadot' },
  { symbol: 'MATIC/USDT', name: 'Polygon', id: 'polygon' },
  { symbol: 'AVAX/USDT', name: 'Avalanche', id: 'avalanche-2' },
  { symbol: 'SHIB/USDT', name: 'Shiba Inu', id: 'shiba-inu' },
  { symbol: 'LINK/USDT', name: 'Chainlink', id: 'chainlink' },
  { symbol: 'UNI/USDT', name: 'Uniswap', id: 'uniswap' },
  { symbol: 'ATOM/USDT', name: 'Cosmos', id: 'cosmos' },
  { symbol: 'XLM/USDT', name: 'Stellar', id: 'stellar' },
];

let pricesCache: any[] | null = null;
let pricesCacheAt = 0;
const PRICES_TTL_MS = 15000;

type TradingSettings = {
  allowedSymbol: string;
  allowedDuration: number;
  allowedType: 'call' | 'put';
  profitPercentage: string;
  isActive: 0 | 1;
  tradingMode: 'classic' | 'normal';
  dailyWinLimitEnabled: 0 | 1;
  maxWinsPerDay: number;
};

const defaultTradingSettings: TradingSettings = {
  allowedSymbol: 'BTC/USDT',
  allowedDuration: 60,
  allowedType: 'call',
  profitPercentage: '3.00',
  isActive: 1,
  tradingMode: 'classic',
  dailyWinLimitEnabled: 0,
  maxWinsPerDay: 1,
};

const readTradingSettings = async (): Promise<TradingSettings> => {
  try {
    const result = await db.execute(sql`
      SELECT
        allowed_symbol,
        allowed_duration,
        allowed_type,
        profit_percentage,
        is_active,
        trading_mode,
        daily_win_limit_enabled,
        max_wins_per_day
      FROM trading_settings
      WHERE id = 1
      LIMIT 1
    `);

    const row = (result as unknown as { rows?: any[] }).rows?.[0];
    if (!row) return defaultTradingSettings;

    return {
      allowedSymbol: String(row.allowed_symbol ?? defaultTradingSettings.allowedSymbol),
      allowedDuration: Number(row.allowed_duration ?? defaultTradingSettings.allowedDuration),
      allowedType: (row.allowed_type ?? defaultTradingSettings.allowedType) as 'call' | 'put',
      profitPercentage: String(row.profit_percentage ?? defaultTradingSettings.profitPercentage),
      isActive: Number(row.is_active ?? defaultTradingSettings.isActive) as 0 | 1,
      tradingMode: (row.trading_mode ?? defaultTradingSettings.tradingMode) as 'classic' | 'normal',
      dailyWinLimitEnabled: Number(
        row.daily_win_limit_enabled ?? defaultTradingSettings.dailyWinLimitEnabled
      ) as 0 | 1,
      maxWinsPerDay: Number(row.max_wins_per_day ?? defaultTradingSettings.maxWinsPerDay),
    };
  } catch {
    return defaultTradingSettings;
  }
};

const writeTradingSettings = async (settings: TradingSettings) => {
  await db.execute(sql`
    INSERT INTO trading_settings (
      id,
      allowed_symbol,
      allowed_duration,
      allowed_type,
      profit_percentage,
      is_active,
      trading_mode,
      daily_win_limit_enabled,
      max_wins_per_day,
      updated_at
    ) VALUES (
      1,
      ${settings.allowedSymbol},
      ${settings.allowedDuration},
      ${settings.allowedType},
      ${settings.profitPercentage},
      ${settings.isActive},
      ${settings.tradingMode},
      ${settings.dailyWinLimitEnabled},
      ${settings.maxWinsPerDay},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (id)
    DO UPDATE SET
      allowed_symbol = EXCLUDED.allowed_symbol,
      allowed_duration = EXCLUDED.allowed_duration,
      allowed_type = EXCLUDED.allowed_type,
      profit_percentage = EXCLUDED.profit_percentage,
      is_active = EXCLUDED.is_active,
      trading_mode = EXCLUDED.trading_mode,
      daily_win_limit_enabled = EXCLUDED.daily_win_limit_enabled,
      max_wins_per_day = EXCLUDED.max_wins_per_day,
      updated_at = CURRENT_TIMESTAMP
  `);
};

// Middleware for JSON parsing
app.use(express.json());

// Initialize database migrations on startup
let migrationsRun = false;
const initializeDatabase = async () => {
  if (!migrationsRun) {
    try {
      await runMigrations();
      migrationsRun = true;
    } catch (error) {
      console.error('Failed to run migrations:', error);
      // Don't crash the server, just log the error
    }
  }
};

// Run migrations before starting the server
initializeDatabase().catch(console.error);

const ensureAdminAccount = async () => {
  console.log('🔐 Checking admin account setup...');
  console.log('Admin Email:', adminEmail ? '✓ Set' : '✗ Not set');
  console.log('Admin Password:', adminPassword ? '✓ Set' : '✗ Not set');
  if (!adminEmail || !adminPassword) {
    console.log('⚠️  Admin account creation skipped: Missing credentials');
    return;
  }
  try {
    await initializeDatabase();
    
    // تحقق من وجود الحساب
    const normalizedEmail = adminEmail.toLowerCase();
    const result = await db.execute(sql`
      SELECT id, email FROM users WHERE email = ${normalizedEmail}
    `);
    
    const existingAdmin = (result as unknown as { rows?: any[] }).rows?.[0];
    if (existingAdmin) {
      console.log('✅ Admin account already exists!');
      console.log('   Email:', adminEmail);
      return;
    }
    
    // إنشاء حساب جديد
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const id = nanoid();
    const adminUsername = `admin_${adminEmail}`;
    
    // Generate unique referral code for admin (guaranteed unique)
    let adminReferralCode = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
      adminReferralCode = `ATLAS${nanoid(6).toUpperCase()}`;
      
      // Check if code already exists
      const existingCodeResult = await db.execute(sql`
        SELECT id FROM users WHERE referral_code = ${adminReferralCode} LIMIT 1
      `);
      const existingCode = (Array.isArray(existingCodeResult) ? existingCodeResult : [])[0];
      
      if (!existingCode) {
        isUnique = true;
      } else {
        attempts++;
      }
    }
    
    if (!isUnique || !adminReferralCode) {
      throw new Error('Failed to generate unique referral code for admin');
    }
    
    await db.execute(sql`
      INSERT INTO users (id, username, email, password_hash, role, referral_code)
      VALUES (${id}, ${adminUsername}, ${normalizedEmail}, ${passwordHash}, 'admin', ${adminReferralCode})
    `);
    console.log('✅ Admin account created successfully!');
    console.log('   Email:', adminEmail);
    console.log('   Username:', adminUsername);
    console.log('   Referral Code:', adminReferralCode);
  } catch (error) {
    console.error('Failed to ensure admin account:', error);
  }
};

ensureAdminAccount().catch(console.error);

// TRPC Middleware
app.use(
  '/api/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.post('/api/auth/register', async (req, res) => {
  const body = req.body as {
    name?: string;
    email?: string;
    password?: string;
    phoneNumber?: string;
    referralCode?: string;
  };

  const name = String(body?.name ?? '').trim();
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Invalid registration data' });
  }

  try {
    console.log('📝 Registration attempt:', { name, email });
    const passwordHash = await bcrypt.hash(password, 10);
    const id = nanoid();
    
    // Generate unique referral code (guaranteed unique)
    let newUserReferralCode = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
      newUserReferralCode = `ATLAS${nanoid(6).toUpperCase()}`;
      
      // Check if code already exists
      const existingCodeResult = await db.execute(sql`
        SELECT id FROM users WHERE referral_code = ${newUserReferralCode} LIMIT 1
      `);
      const existingCode = (Array.isArray(existingCodeResult) ? existingCodeResult : [])[0];
      
      if (!existingCode) {
        isUnique = true;
      } else {
        attempts++;
      }
    }
    
    if (!isUnique || !newUserReferralCode) {
      throw new Error('Failed to generate unique referral code');
    }
    
    console.log('🎫 Generated referral code:', newUserReferralCode);

    const tryInsert = async (username: string) => {
      try {
        await db.execute(sql`
          INSERT INTO users (id, username, email, password_hash, role, referral_code)
          VALUES (${id}, ${username}, ${email}, ${passwordHash}, 'user', ${newUserReferralCode})
        `);
        console.log('✅ User created successfully:', { id, username, email });
      } catch (e: any) {
        const msg = String(e?.message ?? '').toLowerCase();
        if (msg.includes('column') && msg.includes('role')) {
          await db.execute(sql`
            INSERT INTO users (id, username, email, password_hash, referral_code)
            VALUES (${id}, ${username}, ${email}, ${passwordHash}, ${newUserReferralCode})
          `);
          console.log('✅ User created successfully (fallback):', { id, username, email });
          return;
        }
        throw e;
      }
    };

    try {
      await tryInsert(name);
    } catch (e: any) {
      const msg = String(e?.message ?? '').toLowerCase();
      if (msg.includes('username') || msg.includes('users_username') || msg.includes('unique')) {
        const fallbackUsername = `${name}_${nanoid(6)}`;
        await tryInsert(fallbackUsername);
      } else {
        throw e;
      }
    }

    const token = await new SignJWT({ sub: id, email, role: 'user', name })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(jwtKey);

    // Save referredBy if provided
    if (body.referralCode) {
      try {
        await db.execute(sql`
          UPDATE users 
          SET referred_by = ${body.referralCode}
          WHERE id = ${id}
        `);
      } catch (e) {
        console.error('Failed to save referral code:', e);
      }
    }

    return res.status(200).json({
      token,
      user: {
        id: 2,
        name,
        email,
        role: 'user',
        balance: 0,
        referralCode: newUserReferralCode,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    const msg = String(error?.message ?? 'Registration failed');
    if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const body = req.body as { email?: string; password?: string };
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  console.log('🔐 Login attempt:', { email, passwordLength: password.length });

  if (!email || !password) {
    console.log('❌ Missing email or password');
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  try {
    let result: any;
    try {
      console.log('📝 Executing SQL query for email:', email);
      result = await db.execute(sql`
        SELECT id, username, email, password_hash, role
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `);
      console.log('📊 Query result:', result);
    } catch (e: any) {
      const msg = String(e?.message ?? '').toLowerCase();
      if (msg.includes('column') && msg.includes('role')) {
        result = await db.execute(sql`
          SELECT id, username, email, password_hash
          FROM users
          WHERE email = ${email}
          LIMIT 1
        `);
      } else {
        throw e;
      }
    }

    // Drizzle returns array directly, not { rows: [...] }
    const row = Array.isArray(result) ? result[0] : (result as unknown as { rows?: any[] }).rows?.[0];
    console.log('🔍 User found:', row ? 'Yes' : 'No');
    if (row) {
      console.log('👤 User data:', { id: row.id, email: row.email, username: row.username, role: row.role });
    }
    if (!row) {
      console.log('❌ User not found in database');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('🔑 Comparing password...');
    const ok = await bcrypt.compare(password, String(row.password_hash ?? ''));
    console.log('🔑 Password match:', ok);
    if (!ok) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const role = String(row.role ?? 'user');
    const token = await new SignJWT({ sub: String(row.id), email, role, name: String(row.username) })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(jwtKey);

    return res.status(200).json({
      token,
      user: {
        id: 2,
        name: String(row.username),
        email: String(row.email),
        role,
        balance: 0,
        referralCode: 'ATLAS123',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  const raw = String(req.headers.authorization ?? '');
  const token = raw.startsWith('Bearer ') ? raw.slice('Bearer '.length) : '';

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { payload } = await jwtVerify(token, jwtKey);
    const email = typeof payload.email === 'string' ? payload.email : null;
    const name = typeof payload.name === 'string' ? payload.name : null;
    const role = typeof payload.role === 'string' ? payload.role : 'user';

    return res.status(200).json({
      user: {
        id: 2,
        name,
        email,
        role,
        balance: 0,
        referralCode: 'ATLAS123',
      },
    });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/api/prices', async (req, res) => {
  try {
    if (pricesCache && Date.now() - pricesCacheAt < PRICES_TTL_MS) {
      return res.status(200).json({ prices: pricesCache, cached: true });
    }

    const ids = COINGECKO_ASSETS.map((a) => a.id).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`;
    const r = await fetch(url, { method: 'GET' });
    if (!r.ok) {
      return res.status(502).json({ error: 'Price fetch failed' });
    }
    const json = await r.json();
    const rows = COINGECKO_ASSETS.map((a) => {
      const item = (json as any)?.[a.id];
      const price = Number(item?.usd ?? 0);
      const change24h = Number(item?.usd_24h_change ?? 0);
      return {
        symbol: a.symbol,
        name: a.name,
        price,
        change24h,
      };
    });

    pricesCache = rows;
    pricesCacheAt = Date.now();
    return res.status(200).json({ prices: rows, cached: false });
  } catch {
    return res.status(500).json({ error: 'Price fetch failed' });
  }
});

// Get all users for admin
app.get('/api/admin/users', async (req, res) => {
  try {
    console.log('📊 Fetching all users for admin...');
    const result = await db.execute(sql`
      SELECT id, username, email, role, referral_code, referred_by, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    const users = (Array.isArray(result) ? result : []).map((user: any) => ({
      id: user.id,
      name: user.username,
      email: user.email,
      role: user.role || 'user',
      referralCode: user.referral_code,
      referredBy: user.referred_by,
      createdAt: user.created_at,
      totalBalance: '0.00',
      availableBalance: '0.00',
    }));
    
    console.log(`✅ Found ${users.length} users`);
    res.status(200).json(users);
  } catch (error: any) {
    console.error('❌ Failed to fetch users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/admin/trading-settings', async (req, res) => {
  const settings = await readTradingSettings();
  res.status(200).json(settings);
});

app.put('/api/admin/trading-settings', async (req, res) => {
  const body = req.body as Partial<TradingSettings>;
  const next: TradingSettings = {
    ...defaultTradingSettings,
    ...body,
    allowedSymbol: String(body.allowedSymbol ?? defaultTradingSettings.allowedSymbol),
    allowedDuration: Number(body.allowedDuration ?? defaultTradingSettings.allowedDuration),
    allowedType: (body.allowedType ?? defaultTradingSettings.allowedType) as 'call' | 'put',
    profitPercentage: String(body.profitPercentage ?? defaultTradingSettings.profitPercentage),
    isActive: (body.isActive ?? defaultTradingSettings.isActive) as 0 | 1,
    tradingMode: (body.tradingMode ?? defaultTradingSettings.tradingMode) as 'classic' | 'normal',
    dailyWinLimitEnabled: (body.dailyWinLimitEnabled ?? defaultTradingSettings.dailyWinLimitEnabled) as 0 | 1,
    maxWinsPerDay: Number(body.maxWinsPerDay ?? defaultTradingSettings.maxWinsPerDay),
  };
  try {
    await writeTradingSettings(next);
    res.status(200).json({ success: true, settings: next });
  } catch {
    res.status(500).json({ success: false });
  }
});

// Create deposit request
app.post('/api/deposits', async (req, res) => {
  try {
    const { userId, amount, walletAddress } = req.body;
    const depositId = nanoid();
    
    await db.execute(sql`
      INSERT INTO deposits (id, user_id, amount, wallet_address, status)
      VALUES (${depositId}, ${userId}, ${amount}, ${walletAddress || null}, 'pending')
    `);
    
    console.log(`✅ Deposit request created: ${depositId}`);
    res.status(201).json({ success: true, id: depositId });
  } catch (error: any) {
    console.error('❌ Failed to create deposit:', error);
    res.status(500).json({ error: 'Failed to create deposit' });
  }
});

// Create withdrawal request
app.post('/api/withdrawals', async (req, res) => {
  try {
    const { userId, amount, walletAddress } = req.body;
    const withdrawalId = nanoid();
    
    await db.execute(sql`
      INSERT INTO withdrawals (id, user_id, amount, wallet_address, status)
      VALUES (${withdrawalId}, ${userId}, ${amount}, ${walletAddress}, 'pending')
    `);
    
    console.log(`✅ Withdrawal request created: ${withdrawalId}`);
    res.status(201).json({ success: true, id: withdrawalId });
  } catch (error: any) {
    console.error('❌ Failed to create withdrawal:', error);
    res.status(500).json({ error: 'Failed to create withdrawal' });
  }
});

// Get pending deposits for admin
app.get('/api/admin/deposits', async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT d.*, u.username, u.email
      FROM deposits d
      JOIN users u ON d.user_id = u.id
      WHERE d.status = 'pending'
      ORDER BY d.created_at DESC
    `);
    
    const deposits = (Array.isArray(result) ? result : []).map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      userName: d.username,
      userEmail: d.email,
      amount: d.amount,
      walletAddress: d.wallet_address,
      status: d.status,
      createdAt: d.created_at,
    }));
    
    res.status(200).json(deposits);
  } catch (error: any) {
    console.error('❌ Failed to fetch deposits:', error);
    res.status(500).json({ error: 'Failed to fetch deposits' });
  }
});

// Get pending withdrawals for admin
app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT w.*, u.username, u.email
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
      WHERE w.status = 'pending'
      ORDER BY w.created_at DESC
    `);
    
    const withdrawals = (Array.isArray(result) ? result : []).map((w: any) => ({
      id: w.id,
      userId: w.user_id,
      userName: w.username,
      userEmail: w.email,
      amount: w.amount,
      walletAddress: w.wallet_address,
      status: w.status,
      createdAt: w.created_at,
    }));
    
    res.status(200).json(withdrawals);
  } catch (error: any) {
    console.error('❌ Failed to fetch withdrawals:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// Approve deposit
app.post('/api/admin/deposits/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get deposit details
    const depositResult = await db.execute(sql`
      SELECT * FROM deposits WHERE id = ${id}
    `);
    const deposit = (Array.isArray(depositResult) ? depositResult : [])[0];
    
    if (!deposit) {
      return res.status(404).json({ error: 'Deposit not found' });
    }
    
    if (deposit.status !== 'pending') {
      return res.status(400).json({ error: 'Deposit already processed' });
    }
    
    // Update deposit status
    await db.execute(sql`
      UPDATE deposits
      SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `);
    
    // Check if user capital exists
    const capitalResult = await db.execute(sql`
      SELECT * FROM capital WHERE user_id = ${deposit.user_id} LIMIT 1
    `);
    const existingCapital = (Array.isArray(capitalResult) ? capitalResult : [])[0];
    
    if (!existingCapital) {
      // Create new capital record
      await db.execute(sql`
        INSERT INTO capital (user_id, funding, profit_buffer, available_capital, updated_at)
        VALUES (${deposit.user_id}, ${deposit.amount}, 0, ${deposit.amount}, CURRENT_TIMESTAMP)
      `);
    } else {
      // Update existing capital
      const newFunding = parseFloat(existingCapital.funding) + parseFloat(deposit.amount);
      const newAvailableCapital = newFunding + parseFloat(existingCapital.profit_buffer);
      
      await db.execute(sql`
        UPDATE capital
        SET funding = ${newFunding},
            available_capital = ${newAvailableCapital},
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${deposit.user_id}
      `);
    }
    
    // Record transaction
    await db.execute(sql`
      INSERT INTO transactions (user_id, type, amount, is_compliant, description, created_at)
      VALUES (${deposit.user_id}, 'deposit', ${deposit.amount}, true, ${`إيداع مؤكد بقيمة ${deposit.amount} USDT`}, CURRENT_TIMESTAMP)
    `);
    
    console.log(`✅ Deposit ${id} approved, added ${deposit.amount} to user ${deposit.user_id}`);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('❌ Failed to approve deposit:', error);
    res.status(500).json({ error: 'Failed to approve deposit' });
  }
});

// Approve withdrawal
app.post('/api/admin/withdrawals/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get withdrawal details
    const withdrawalResult = await db.execute(sql`
      SELECT * FROM withdrawals WHERE id = ${id}
    `);
    const withdrawal = (Array.isArray(withdrawalResult) ? withdrawalResult : [])[0];
    
    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }
    
    // Update withdrawal status
    await db.execute(sql`
      UPDATE withdrawals
      SET status = 'approved', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `);
    
    // Update user capital (deduct from available_capital)
    await db.execute(sql`
      UPDATE capital
      SET available_capital = GREATEST(0, available_capital - ${withdrawal.amount}),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${withdrawal.user_id}
    `);
    
    console.log(`✅ Withdrawal ${id} approved, deducted ${withdrawal.amount} from user ${withdrawal.user_id}`);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('❌ Failed to approve withdrawal:', error);
    res.status(500).json({ error: 'Failed to approve withdrawal' });
  }
});

// Reject deposit
app.post('/api/admin/deposits/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    await db.execute(sql`
      UPDATE deposits
      SET status = 'rejected', rejection_reason = ${reason || null}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `);
    
    console.log(`✅ Deposit ${id} rejected`);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('❌ Failed to reject deposit:', error);
    res.status(500).json({ error: 'Failed to reject deposit' });
  }
});

// Reject withdrawal
app.post('/api/admin/withdrawals/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    await db.execute(sql`
      UPDATE withdrawals
      SET status = 'rejected', rejection_reason = ${reason || null}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `);
    
    console.log(`✅ Withdrawal ${id} rejected`);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('❌ Failed to reject withdrawal:', error);
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  }
});

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).send('Server is running');
});

// Serve static files from the client build directory
// Note: On Vercel, the path might be different, so we use a more robust way
const distPath = path.join(process.cwd(), 'dist/client');
app.use(express.static(distPath));

// Fallback route for React Router (must be after TRPC and static files)
app.get('*', (req, res) => {
  // If it's an API request that wasn't caught, return 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  // Otherwise, serve the index.html for the frontend
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(500).send('Frontend build not found. Please run build first.');
    }
  });
});

// Start the server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}

// Export app for Vercel
export default app;
