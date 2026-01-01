import axios from 'axios';

const MOCK_STATE_KEY = 'atlas_mock_state_v1';

// إنشاء Axios instance
export const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_BASE_URL
    ? String((import.meta as any).env.VITE_API_BASE_URL).trim().replace(/\/$/, '')
    : '',
  headers: {
    'Content-Type': 'application/json',
  },
});

const makeResponse = (config: any, data: any, status = 200) => {
  return {
    data,
    status,
    statusText: String(status),
    headers: {},
    config,
    request: {},
  };
};

const loadMockState = (): any => {
  try {
    const raw = localStorage.getItem(MOCK_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveMockState = (state: any) => {
  localStorage.setItem(MOCK_STATE_KEY, JSON.stringify(state));
};

const ensureMockState = (): any => {
  const existing = loadMockState();
  if (existing && typeof existing === 'object') {
    // Ensure an admin record exists with the expected email (backward compatibility)
    const users = Array.isArray((existing as any).users) ? (existing as any).users : [];
    const hasAdminAtlas = users.some((u: any) => String(u?.email ?? '').toLowerCase() === 'admin@atlas.com');
    if (!hasAdminAtlas) {
      const now = new Date().toISOString();
      const maxId = users.reduce((m: number, u: any) => Math.max(m, Number(u?.id) || 0), 0);
      users.push({
        id: maxId + 1,
        name: 'Admin',
        email: 'admin@atlas.com',
        balance: 0,
        role: 'admin',
        createdAt: now,
        referralCode: 'ATLAS123',
        referralEarnings: 0,
      });
      (existing as any).users = users;
      saveMockState(existing);
    }
    return existing;
  }
  const now = new Date().toISOString();
  const fresh = {
    feeding: 0,
    balance: 0,
    netProfits: 0,
    deposits: [],
    withdrawals: [],
    contracts: [],
    investments: [],
    users: [
      { id: 1, name: 'Admin', email: 'admin@atlas.com', balance: 0, role: 'admin', createdAt: now, referralCode: 'ATLAS123', referralEarnings: 0 },
      { id: 2, name: 'User', email: 'user@example.com', balance: 0, role: 'user', createdAt: now, referralCode: 'ATLASUSER', referralEarnings: 0 },
    ],
    tradingSettings: {
      allowedSymbol: 'BTC/USDT',
      allowedDuration: 60,
      allowedType: 'call',
      profitPercentage: '3.00',
      isActive: 1,
      tradingMode: 'classic',
      dailyWinLimitEnabled: 0,
      maxWinsPerDay: 1,
    },
    adminLogs: [],
    violations: [],
  };
  saveMockState(fresh);
  return fresh;
};

const genReferralCode = () => `ATLAS${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const findUserByToken = (token: string | null) => {
  if (!token) return null;
  if (token === 'mock_admin_token') {
    const state = ensureMockState();
    return (state.users || []).find((u: any) => String(u.email).toLowerCase() === 'admin@atlas.com') || null;
  }
  // Backward compatibility with older mock token format
  if (token === 'mock_user_token') {
    const state = ensureMockState();
    return (state.users || []).find((u: any) => Number(u.id) === 2) || null;
  }
  const m = /^mock_user_token_(\d+)$/.exec(token);
  if (!m) return null;
  const userId = Number(m[1]);
  const state = ensureMockState();
  return (state.users || []).find((u: any) => Number(u.id) === userId) || null;
};

const getMockUserForToken = (token: string | null) => {
  return findUserByToken(token);
};

// إضافة interceptor لإرسال token مع كل طلب
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (!import.meta.env.DEV) {
      return config;
    }

    const url = String(config.url ?? '');
    if (url === '/api/auth/login') {
      config.adapter = async (cfg: any) => {
        let body: any = cfg?.data;
        if (cfg?.data && typeof cfg.data === 'string') {
          try {
            body = JSON.parse(cfg.data);
          } catch {
            body = {};
          }
        }

        const email = String(body?.email ?? '').trim();
        const password = String(body?.password ?? '');

        const normalized = email.toLowerCase();
        if ((normalized === 'admin@gmail.com' || normalized === 'admin@example.com' || normalized === 'admin@atlas.com' || normalized === 'admin') && password) {
          return makeResponse(cfg, {
            token: 'mock_admin_token',
            user: getMockUserForToken('mock_admin_token'),
          });
        }

        if (email && password) {
          const state = ensureMockState();
          let user = (state.users || []).find((u: any) => String(u.email).toLowerCase() === normalized && String(u.role) !== 'admin');

          // If user doesn't exist in the mock state, auto-create it to avoid login failures in DEV.
          if (!user) {
            const nextId = (state.users || []).reduce((m: number, u: any) => Math.max(m, Number(u.id) || 0), 0) + 1;
            let newReferralCode = genReferralCode();
            while ((state.users || []).some((u: any) => u.referralCode === newReferralCode)) {
              newReferralCode = genReferralCode();
            }

            user = {
              id: nextId,
              name: normalized.split('@')[0] || 'User',
              email: normalized,
              role: 'user',
              balance: 0,
              referralCode: newReferralCode,
              referralEarnings: 0,
              createdAt: new Date().toISOString(),
            };

            state.users = [...(state.users || []), user];
            saveMockState(state);
          }

          return makeResponse(cfg, {
            token: `mock_user_token_${user.id}`,
            user,
          });
        }

        return Promise.reject({ response: { status: 400, data: { error: 'Invalid credentials' } } });
      };
    }

    if (url === '/api/auth/register') {
      config.adapter = async (cfg: any) => {
        const body = (cfg?.data && typeof cfg.data === 'string') ? JSON.parse(cfg.data) : cfg?.data;
        const email = String(body?.email ?? '');
        const password = String(body?.password ?? '');
        const name = String(body?.name ?? 'User');
        const referralCode = String(body?.referralCode ?? '').trim();

        if (!email || !password) {
          return Promise.reject({ response: { status: 400, data: { error: 'Invalid registration data' } } });
        }

        const normalized = email.trim().toLowerCase();
        const state = ensureMockState();
        const exists = (state.users || []).some((u: any) => String(u.email).toLowerCase() === normalized);
        if (exists) {
          return Promise.reject({ response: { status: 409, data: { error: 'Email already exists' } } });
        }

        const nextId = (state.users || []).reduce((m: number, u: any) => Math.max(m, Number(u.id) || 0), 0) + 1;
        let newReferralCode = genReferralCode();
        while ((state.users || []).some((u: any) => u.referralCode === newReferralCode)) {
          newReferralCode = genReferralCode();
        }

        const newUser = {
          id: nextId,
          name,
          email: normalized,
          role: 'user',
          balance: 0,
          referralCode: newReferralCode,
          referredBy: referralCode || undefined,
          referralEarnings: 0,
          createdAt: new Date().toISOString(),
        };

        state.users = [...(state.users || []), newUser];
        saveMockState(state);

        return makeResponse(cfg, {
          token: `mock_user_token_${newUser.id}`,
          user: newUser,
        });
      };
    }

    if (url === '/api/auth/me') {
      config.adapter = async (cfg: any) => {
        const rawAuth = String(cfg?.headers?.Authorization ?? '');
        const bearerToken = rawAuth.startsWith('Bearer ') ? rawAuth.slice('Bearer '.length) : null;
        const user = getMockUserForToken(bearerToken);
        if (!user) {
          return Promise.reject({ response: { status: 401, data: { error: 'Unauthorized' } } });
        }
        return makeResponse(cfg, { user });
      };
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// إضافة interceptor للتعامل مع الأخطاء
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // إزالة token وإعادة التوجيه لصفحة تسجيل الدخول
      localStorage.removeItem('auth_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
