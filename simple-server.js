import express from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const app = express();
app.use(express.json());

// Mock database
const users = [];
const deposits = [];
const withdrawals = [];

// Create admin user
const createAdmin = async () => {
  const adminExists = users.find(u => u.email === 'admin@atlas.com');
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    users.push({
      id: nanoid(),
      username: 'admin',
      email: 'admin@atlas.com',
      password_hash: hashedPassword,
      role: 'admin',
      balance: 0
    });
    console.log('Admin user created: admin@atlas.com / admin123');
  }
  
  // Create some test users with deposits
  const testUsers = [
    { username: 'user1', email: 'user1@example.com', balance: 0 },
    { username: 'user2', email: 'user2@example.com', balance: 0 },
    { username: 'user3', email: 'user3@example.com', balance: 0 }
  ];
  
  for (const testUser of testUsers) {
    const existingUser = users.find(u => u.email === testUser.email);
    if (!existingUser) {
      const userId = nanoid();
      users.push({
        id: userId,
        username: testUser.username,
        email: testUser.email,
        password_hash: await bcrypt.hash('password123', 10),
        role: 'user',
        balance: testUser.balance
      });
      
      // Add pending deposits for test users
      if (testUser.username === 'user1' || testUser.username === 'user2') {
        deposits.push({
          id: deposits.length + 1,
          userId: userId,
          username: testUser.username,
          amount: testUser.username === 'user1' ? 100 : 200,
          status: 'pending',
          createdAt: new Date().toISOString(),
          method: 'bank_transfer'
        });
      }
    }
  }
};

createAdmin();

// Create deposit endpoint
app.post('/api/deposit/create', (req, res) => {
  const { amount, walletAddress } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'المبلغ غير صحيح' });
  }
  
  // Create new deposit
  const newDeposit = {
    id: deposits.length + 1,
    userId: 'user1', // Mock user ID
    username: 'user1',
    amount: amount,
    status: 'pending',
    createdAt: new Date().toISOString(),
    method: 'crypto',
    walletAddress: walletAddress || null
  };
  
  deposits.push(newDeposit);
  
  console.log(`New deposit created: ${amount} for user1`);
  res.json({ 
    success: true, 
    message: 'تم إنشاء طلب الإيداع بنجاح',
    id: newDeposit.id
  });
});
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  res.json({
    token: 'mock-jwt-token',
    user: {
      id: user.id,
      name: user.username,
      email: user.email,
      role: user.role,
      balance: 0,
      referralCode: 'ATLAS123'
    }
  });
});

// Mock admin stats
app.get('/api/admin/stats', (req, res) => {
  res.json({
    totalUsers: users.length,
    totalBalance: '10000.00',
    totalContracts: 150,
    pendingDeposits: 5,
    pendingWithdrawals: 3
  });
});

// Mock admin endpoints
app.get('/api/admin/users', (req, res) => {
  res.json({
    users: users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      balance: Math.random() * 1000,
      createdAt: new Date().toISOString()
    }))
  });
});

app.get('/api/admin/deposits', (req, res) => {
  res.json({ deposits });
});

// Approve deposit
app.post('/api/admin/approve-deposit', (req, res) => {
  const { depositId } = req.body;
  const deposit = deposits.find(d => d.id === depositId);
  
  if (deposit) {
    deposit.status = 'confirmed';  // Changed from 'approved' to 'confirmed'
    
    // Add amount to user's balance
    const user = users.find(u => u.id === deposit.userId);
    if (user) {
      user.balance += deposit.amount;
      console.log(`Added ${deposit.amount} to ${user.username}'s balance. New balance: ${user.balance}`);
    }
    
    console.log(`Approved deposit: ${depositId} for ${deposit.username}, amount: ${deposit.amount}`);
    res.json({ success: true, message: 'تم الموافقة على الإيداع' });
  } else {
    res.status(404).json({ success: false, message: 'الإيداع غير موجود' });
  }
});

// Reject deposit
app.post('/api/admin/reject-deposit', (req, res) => {
  const { depositId, reason } = req.body;
  const deposit = deposits.find(d => d.id === depositId);
  
  if (deposit) {
    deposit.status = 'failed';  // Changed from 'rejected' to 'failed'
    deposit.rejectReason = reason;
    console.log(`Rejected deposit: ${depositId} for ${deposit.username}, reason: ${reason}`);
    res.json({ success: true, message: 'تم رفض الإيداع' });
  } else {
    res.status(404).json({ success: false, message: 'الإيداع غير موجود' });
  }
});

app.get('/api/admin/withdrawals', (req, res) => {
  res.json({
    withdrawals: [
      { id: 1, userId: '1', amount: 50, status: 'pending', createdAt: new Date().toISOString() },
      { id: 2, userId: '2', amount: 100, status: 'approved', createdAt: new Date().toISOString() }
    ]
  });
});

app.get('/api/admin/logs', (req, res) => {
  res.json({
    logs: [
      { id: 1, action: 'login', userId: '1', timestamp: new Date().toISOString() },
      { id: 2, action: 'deposit', userId: '2', amount: 100, timestamp: new Date().toISOString() }
    ]
  });
});

app.get('/api/admin/violations', (req, res) => {
  res.json({
    violations: [
      { id: 1, userId: '1', type: 'suspicious_activity', description: 'Multiple failed logins', timestamp: new Date().toISOString() },
      { id: 2, userId: '2', type: 'trading_violation', description: 'Exceeded trading limit', timestamp: new Date().toISOString() }
    ]
  });
});

app.get('/api/admin/trading-settings', (req, res) => {
  res.json({
    allowedSymbol: 'BTC/USDT',
    allowedDuration: 60,
    allowedType: 'call',
    profitPercentage: '3.00',
    isActive: 1,
    tradingMode: 'classic',
    dailyWinLimitEnabled: 0,
    maxWinsPerDay: 1
  });
});

// Serve frontend
app.use(express.static('dist/client'));
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'dist/client' });
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`Mock server running on http://localhost:${PORT}`);
  console.log('Admin login: admin@atlas.com / admin123');
});
