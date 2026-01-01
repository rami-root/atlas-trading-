# دليل نشر تطبيق Atlas Trading

## معلومات التطبيق
- **الاسم**: Atlas Trading
- **النوع**: منصة تداول عملات رقمية
- **التقنيات**: React + TypeScript + Vite + Express + PostgreSQL/SQLite

## الميزات الحية
✅ أسعار العملات تتحدث كل 3 ثواني
✅ تأثيرات بصرية عند تغير الأسعار
✅ مؤشر "مباشر" مع نقطة نابضة
✅ دعم 18+ عملة رقمية

## متطلبات النشر
- Node.js 18+
- PostgreSQL أو SQLite
- متغيرات البيئة المطلوبة في `.env`

## خطوات النشر

### 1. بناء التطبيق
```bash
npm install
npm run build
```

### 2. إعداد قاعدة البيانات
```bash
npm run db:push
```

### 3. تشغيل الإنتاج
```bash
npm start
```

## معلومات تسجيل الدخول الافتراضية
- **البريد الإلكتروني**: admin@atlas.com
- **كلمة المرور**: admin123

## الرابط المؤقت
https://5173-iq253zrnl45q6fb0eq48k-c9d9f051.us2.manus.computer

## ملاحظات
- التطبيق يستخدم CoinGecko API للأسعار الحية
- يدعم SQLite للتطوير و PostgreSQL للإنتاج
- جميع الأخطاء تم تصحيحها
