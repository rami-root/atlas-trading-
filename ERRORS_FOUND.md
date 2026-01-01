# قائمة الأخطاء المكتشفة

## 1. client/src/const.ts:1
**المشكلة**: استيراد من `@shared/const` لكن المجلد `shared` غير موجود
**الحل**: إنشاء الملف المفقود أو إزالة الاستيراد وتعريف الثوابت محلياً

## 2. client/src/pages/Contracts.tsx:52
**المشكلة**: خطأ في النوع - `contract.type` 
**الحل**: التحقق من تعريف النوع في schema

## 3. client/src/pages/InvestmentDetail.tsx:19
**المشكلة**: استخدام `useState` بدون استيراد
**الحل**: إضافة `import { useState } from "react";` في السطر الأول

## 4. client/src/pages/Investments.tsx:28
**المشكلة**: خطأ في النوع
**الحل**: التحقق من تعريف النوع

## 5. client/src/pages/MyInvestments.tsx:96
**المشكلة**: خطأ في النوع
**الحل**: التحقق من تعريف النوع

## 6. client/src/pages/Trading.tsx:90
**المشكلة**: خطأ في النوع
**الحل**: التحقق من تعريف النوع

## 7. client/src/pages/UserManagement.tsx:37
**المشكلة**: خطأ في النوع
**الحل**: التحقق من تعريف النوع

## 8. client/src/pages/admin/Deposits.tsx:71
**المشكلة**: خطأ في النوع
**الحل**: التحقق من تعريف النوع

## 9. client/src/pages/admin/Logs.tsx:55
**المشكلة**: خطأ في النوع
**الحل**: التحقق من تعريف النوع

## 10. client/src/pages/admin/ViolationsReport.tsx:205
**المشكلة**: خطأ في النوع
**الحل**: التحقق من تعريف النوع

## 11. client/src/pages/admin/Withdrawals.tsx:73
**المشكلة**: خطأ في النوع
**الحل**: التحقق من تعريف النوع

## 12. server/routers/capital.ts:101
**المشكلة**: `isCompliant` يتوقع `boolean` لكن يتم تمرير `number` (0 أو 1)
**الحل**: تغيير `1` إلى `true` و `0` إلى `false`

## 13. server/routers/capital.ts:161
**المشكلة**: نفس المشكلة السابقة
**الحل**: تغيير `1` إلى `true` و `0` إلى `false`
