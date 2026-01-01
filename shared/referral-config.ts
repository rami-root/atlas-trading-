// إعدادات نظام مكافآت الإحالة

export const REFERRAL_LEVELS = {
  EMP1: {
    level: 1,
    percentage: 7, // 7%
    name: 'EMP-1',
    description: 'مكافأة على الإحالة المباشرة'
  },
  EMP2: {
    level: 2,
    percentage: 2, // 2%
    name: 'EMP-2',
    description: 'مكافأة على إحالات المستوى الثاني'
  },
  EMP3: {
    level: 3,
    percentage: 1, // 1%
    name: 'EMP-3',
    description: 'مكافأة على إحالات المستوى الثالث'
  }
};

// جدول المكافآت حسب المبلغ
export const REFERRAL_REWARDS_TABLE = [
  {
    amount: 30,
    emp1: 2.10,
    emp2: 0.60,
    emp3: 0.30
  },
  {
    amount: 50,
    emp1: 3.50,
    emp2: 1.0,
    emp3: 0.50
  },
  {
    amount: 80,
    emp1: 5.60,
    emp2: 1.60,
    emp3: 0.80
  },
  {
    amount: 100,
    emp1: 7.0,
    emp2: 2.0,
    emp3: 1.0
  },
  {
    amount: 150,
    emp1: 10.50,
    emp2: 3.0,
    emp3: 1.50
  },
  {
    amount: 200,
    emp1: 14.0,
    emp2: 4.0,
    emp3: 2.0
  }
];

// حساب المكافأة بناءً على المبلغ والمستوى
export function calculateReferralReward(amount: number, level: 1 | 2 | 3): number {
  // إيجاد الشريحة المناسبة
  let reward = 0;
  
  for (const tier of REFERRAL_REWARDS_TABLE) {
    if (amount >= tier.amount) {
      if (level === 1) reward = tier.emp1;
      else if (level === 2) reward = tier.emp2;
      else if (level === 3) reward = tier.emp3;
    } else {
      break;
    }
  }
  
  // إذا كان المبلغ أكبر من أعلى شريحة، نحسب بالنسبة المئوية
  if (amount > 200) {
    const percentage = level === 1 ? 7 : level === 2 ? 2 : 1;
    reward = (amount * percentage) / 100;
  }
  
  return reward;
}

// الحصول على نسبة المكافأة حسب المستوى
export function getReferralPercentage(level: 1 | 2 | 3): number {
  if (level === 1) return REFERRAL_LEVELS.EMP1.percentage;
  if (level === 2) return REFERRAL_LEVELS.EMP2.percentage;
  if (level === 3) return REFERRAL_LEVELS.EMP3.percentage;
  return 0;
}

// الحصول على اسم المستوى
export function getReferralLevelName(level: 1 | 2 | 3): string {
  if (level === 1) return REFERRAL_LEVELS.EMP1.name;
  if (level === 2) return REFERRAL_LEVELS.EMP2.name;
  if (level === 3) return REFERRAL_LEVELS.EMP3.name;
  return '';
}
