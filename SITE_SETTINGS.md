# إعدادات الموقع الشاملة - Atlas Trading

## 🔧 إعدادات البيئة (.env)

```env
# قاعدة البيانات
DATABASE_URL=file:./sqlite.db
DB_TYPE=sqlite

# السيرفر
PORT=5173
HOST=0.0.0.0
NODE_ENV=development

# الأمان
SESSION_SECRET=your-secret-key-here
JWT_SECRET=your-jwt-secret-here
COOKIE_NAME=atlas_session

# API الخارجية
COINGECKO_API_URL=https://api.coingecko.com/api/v3
```

## 💰 إعدادات الرصيد الافتراضي

### الرصيد الأولي للحسابات الجديدة
```typescript
// الموقع: client/src/lib/trpc-adapter.ts
const getDefaultState = (): StoredState => ({
  feeding: 0,          // رصيد التمويل
  balance: 0,          // الرصيد الإجمالي
  netProfits: 0,       // صافي الأرباح
  // ...
});
```

### فرض الرصيد الصفري لجميع المستخدمين
```typescript
// الموقع: client/src/lib/trpc-adapter.ts (السطر 309-312)
// Force all accounts to start with 0 balance
feeding: 0,
netProfits: 0,
balance: 0,
```

## 📊 إعدادات التداول

### الموقع: `client/src/lib/trpc-adapter.ts`

```typescript
tradingSettings: {
  allowedSymbol: 'BTC/USDT',      // العملة المسموحة
  allowedDuration: 60,             // المدة المسموحة (بالثواني)
  allowedType: 'call',             // نوع العقد المسموح
  profitPercentage: '3.00',        // نسبة الربح
  isActive: 1,                     // تفعيل التداول (1 = مفعل، 0 = معطل)
  tradingMode: 'classic',          // وضع التداول (classic أو normal)
  dailyWinLimitEnabled: 0,         // تفعيل حد الربح اليومي
  maxWinsPerDay: 1,                // الحد الأقصى للأرباح اليومية
}
```

### تعديل إعدادات التداول:
يمكن تعديل هذه الإعدادات من:
1. **لوحة تحكم المسؤول** → التحكم في التداول
2. **الكود مباشرة** في `client/src/lib/trpc-adapter.ts`

## 💱 إعدادات الأسعار الحية

### تحديث الأسعار
```typescript
// الموقع: client/src/pages/Trading.tsx (السطر 39)
const interval = setInterval(() => {
  refetch();
}, 3000);  // التحديث كل 3 ثواني
```

### العملات المدعومة
```typescript
// الموقع: client/src/lib/trpc-adapter.ts
const COINGECKO_ASSETS = [
  { symbol: 'BTC/USDT', name: 'Bitcoin', id: 'bitcoin' },
  { symbol: 'ETH/USDT', name: 'Ethereum', id: 'ethereum' },
  { symbol: 'USDT/USDT', name: 'Tether', id: 'tether' },
  { symbol: 'BNB/USDT', name: 'BNB', id: 'binancecoin' },
  { symbol: 'XRP/USDT', name: 'XRP', id: 'ripple' },
  // ... المزيد (18 عملة إجمالاً)
];
```

### الأسعار الاحتياطية (Fallback)
```typescript
const DEFAULT_CRYPTO_PRICES = [
  { symbol: 'BTC/USDT', name: 'Bitcoin', price: 45230, change24h: 2.5 },
  { symbol: 'ETH/USDT', name: 'Ethereum', price: 2450, change24h: 1.8 },
  // ...
];
```

## 👥 إعدادات المستخدمين الافتراضيين

```typescript
// الموقع: client/src/lib/trpc-adapter.ts
users: [
  { 
    id: 1, 
    name: 'Admin', 
    email: 'admin@atlas.com',
    password: 'admin123',  // يجب تشفيرها في الإنتاج
    balance: 0, 
    role: 'admin', 
    createdAt: new Date().toISOString(), 
    referralEarnings: 0 
  },
  { 
    id: 2, 
    name: 'User', 
    email: 'user@example.com', 
    balance: 0, 
    role: 'user', 
    createdAt: new Date().toISOString(), 
    referralEarnings: 0 
  },
]
```

## 💸 إعدادات الإيداع والسحب

### رسوم السحب
```typescript
// الموقع: يمكن إضافتها في server/routers/wallet.ts
const WITHDRAWAL_FEE_PERCENTAGE = 2;  // 2%
const MIN_WITHDRAWAL = 10;            // الحد الأدنى للسحب
const MAX_WITHDRAWAL = 10000;         // الحد الأقصى للسحب
```

### الحد الأدنى للإيداع
```typescript
const MIN_DEPOSIT = 10;               // الحد الأدنى للإيداع
```

## 🎯 إعدادات الاستثمار

### خطط الاستثمار الافتراضية
يمكن إضافتها في `server/routers/investment.ts`:

```typescript
const INVESTMENT_PLANS = [
  {
    id: 1,
    name: 'الخطة الأساسية',
    minAmount: 100,
    maxAmount: 1000,
    dailyRate: 1.5,      // 1.5% يومياً
    duration: 30,        // 30 يوم
  },
  {
    id: 2,
    name: 'الخطة المتقدمة',
    minAmount: 1000,
    maxAmount: 5000,
    dailyRate: 2.0,      // 2% يومياً
    duration: 60,        // 60 يوم
  },
  {
    id: 3,
    name: 'الخطة الاحترافية',
    minAmount: 5000,
    maxAmount: 50000,
    dailyRate: 2.5,      // 2.5% يومياً
    duration: 90,        // 90 يوم
  },
];
```

## 🔐 إعدادات الأمان

### مدة الجلسة
```typescript
// الموقع: server/_core/index.ts
const SESSION_DURATION = 24 * 60 * 60 * 1000;  // 24 ساعة
```

### تشفير كلمات المرور
```typescript
// يُنصح باستخدام bcrypt
import bcrypt from 'bcrypt';
const SALT_ROUNDS = 10;
```

## 🌐 إعدادات الخادم (Vite)

### الموقع: `vite.config.ts`

```typescript
export default defineConfig({
  server: {
    host: '0.0.0.0',           // السماح بالوصول الخارجي
    port: 5173,                 // المنفذ
    strictPort: false,
    allowedHosts: ['.manus.computer'],  // النطاقات المسموحة
  },
  // ...
});
```

## 📱 إعدادات الواجهة

### الألوان الرئيسية
```css
/* الموقع: client/src/index.css */
:root {
  --primary: #2563eb;        /* الأزرق الأساسي */
  --success: #10b981;        /* الأخضر للنجاح */
  --danger: #ef4444;         /* الأحمر للخطر */
  --warning: #f59e0b;        /* البرتقالي للتحذير */
}
```

### اللغة الافتراضية
```typescript
// الموقع: client/src/App.tsx
const DEFAULT_LANGUAGE = 'ar';  // العربية
const TEXT_DIRECTION = 'rtl';   // من اليمين لليسار
```

## 🗄️ إعدادات قاعدة البيانات

### SQLite (التطوير)
```env
DATABASE_URL=file:./sqlite.db
```

### PostgreSQL (الإنتاج)
```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

### MySQL (الإنتاج)
```env
DATABASE_URL=mysql://user:password@host:3306/database
```

## 📧 إعدادات البريد الإلكتروني (اختياري)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@atlas-trading.com
```

## 🔔 إعدادات الإشعارات

```typescript
// يمكن إضافتها في المستقبل
const NOTIFICATION_SETTINGS = {
  emailNotifications: true,
  pushNotifications: false,
  smsNotifications: false,
};
```

## 📊 إعدادات التقارير والإحصائيات

```typescript
// الموقع: server/routers/admin.ts
const REPORT_SETTINGS = {
  enableLogs: true,              // تفعيل السجلات
  enableViolations: true,        // تفعيل تتبع المخالفات
  logRetentionDays: 90,          // الاحتفاظ بالسجلات لمدة 90 يوم
};
```

## 🎨 إعدادات التخصيص

### شعار الموقع
```typescript
// الموقع: public/
// استبدل الملفات التالية:
- logo.png
- favicon.ico
- btc-neon.png
```

### اسم الموقع
```typescript
// الموقع: client/index.html
<title>Atlas Trading</title>
```

## 🚀 إعدادات النشر

### Vercel
```json
// الموقع: vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install"
}
```

### Render.com
```yaml
# render.yaml
services:
  - type: web
    name: atlas-trading
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm run dev
```

## 🔄 إعدادات التحديث التلقائي

### Hot Module Replacement (HMR)
```typescript
// مفعل افتراضياً في وضع التطوير
// الموقع: vite.config.ts
server: {
  hmr: true,
}
```

## 📝 ملاحظات مهمة

### تغيير الإعدادات في الإنتاج:
1. ✅ غيّر `SESSION_SECRET` و `JWT_SECRET`
2. ✅ استخدم قاعدة بيانات حقيقية (PostgreSQL/MySQL)
3. ✅ فعّل HTTPS
4. ✅ شفّر كلمات المرور
5. ✅ أضف rate limiting
6. ✅ فعّل CORS بشكل صحيح

### الأمان:
- ⚠️ لا تحفظ كلمات المرور بنص صريح
- ⚠️ لا تشارك مفاتيح API في الكود
- ⚠️ استخدم متغيرات البيئة للمعلومات الحساسة

## 📞 الدعم

للمساعدة أو الاستفسارات، راجع:
- ملف `README.md`
- ملف `DEPLOYMENT.md`
- ملف `QUICK_DEPLOY.md`

---

**ملاحظة**: هذا الملف يحتوي على جميع الإعدادات القابلة للتخصيص في الموقع. يمكنك تعديل أي إعداد حسب احتياجاتك.
