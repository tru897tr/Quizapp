require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === 'true';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Debug logging middleware
if (DEBUG) {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const RESET_TOKENS_FILE = path.join(DATA_DIR, 'reset_tokens.json');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const files = [
            { path: USERS_FILE, default: {} },
            { path: SESSIONS_FILE, default: {} },
            { path: RESULTS_FILE, default: [] },
            { path: RESET_TOKENS_FILE, default: {} }
        ];
        for (const file of files) {
            try {
                await fs.access(file.path);
            } catch {
                await fs.writeFile(file.path, JSON.stringify(file.default, null, 2));
            }
        }
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

async function readJSON(filepath, defaultValue = {}) {
    try {
        const data = await fs.readFile(filepath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (DEBUG) console.error(`Error reading ${filepath}:`, error);
        return defaultValue;
    }
}

async function writeJSON(filepath, data) {
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    if (DEBUG) console.log(`Written to ${filepath}`);
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

async function authenticate(req, res, next) {
    const token = req.cookies.accessToken || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Chưa đăng nhập' });
    }
    const sessions = await readJSON(SESSIONS_FILE, {});
    const session = sessions[token];
    if (!session || session.expiresAt < Date.now()) {
        res.clearCookie('accessToken');
        return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn' });
    }
    req.userId = session.userId;
    req.username = session.username;
    req.token = token;
    next();
}

// Debug endpoint
app.get('/api/debug', async (req, res) => {
    if (!DEBUG) {
        return res.status(403).json({ error: 'Debug mode is disabled' });
    }
    const users = await readJSON(USERS_FILE, {});
    const sessions = await readJSON(SESSIONS_FILE, {});
    const results = await readJSON(RESULTS_FILE, []);
    const resetTokens = await readJSON(RESET_TOKENS_FILE, {});
    
    res.json({
        users: Object.keys(users).map(u => ({
            username: u,
            email: users[u].email,
            id: users[u].id
        })),
        sessionsCount: Object.keys(sessions).length,
        resultsCount: results.length,
        resetTokensCount: Object.keys(resetTokens).length,
        env: {
            emailConfigured: !!process.env.EMAIL_USER,
            baseUrl: process.env.BASE_URL || 'http://localhost:3000'
        }
    });
});

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, fullname, email } = req.body;
        if (!username || !password || !fullname || !email) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
        }
        if (username.length < 3) {
            return res.status(400).json({ error: 'Tên đăng nhập phải có ít nhất 3 ký tự' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }
        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Email không hợp lệ' });
        }
        
        const users = await readJSON(USERS_FILE, {});
        
        if (users[username]) {
            return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
        }
        
        const emailExists = Object.values(users).some(u => u.email === email);
        if (emailExists) {
            return res.status(400).json({ error: 'Email đã được sử dụng' });
        }
        
        const userId = crypto.randomBytes(16).toString('hex');
        users[username] = {
            id: userId,
            username,
            fullname,
            email,
            password: hashPassword(password),
            createdAt: Date.now()
        };
        
        await writeJSON(USERS_FILE, users);
        if (DEBUG) console.log(`New user registered: ${username}, email: ${email}, id: ${userId}`);
        
        res.json({ success: true, message: 'Đăng ký thành công! Vui lòng đăng nhập.' });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
        }
        
        const users = await readJSON(USERS_FILE, {});
        const user = users[username];
        
        if (!user || user.password !== hashPassword(password)) {
            return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        }
        
        const token = generateToken();
        const sessions = await readJSON(SESSIONS_FILE, {});
        const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
        
        sessions[token] = {
            userId: user.id,
            username: user.username,
            fullname: user.fullname,
            expiresAt
        };
        
        await writeJSON(SESSIONS_FILE, sessions);
        
        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });
        
        if (DEBUG) console.log(`User logged in: ${username}`);
        
        res.json({
            success: true,
            token,
            user: { username: user.username, fullname: user.fullname }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Verify
app.get('/api/verify', authenticate, async (req, res) => {
    res.json({ success: true, user: { username: req.username } });
});

// Logout
app.post('/api/logout', authenticate, async (req, res) => {
    try {
        const sessions = await readJSON(SESSIONS_FILE, {});
        delete sessions[req.token];
        await writeJSON(SESSIONS_FILE, sessions);
        res.clearCookie('accessToken');
        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Forgot Password - FIXED
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (DEBUG) console.log(`Forgot password request for email: ${email}`);
        
        if (!email || !validateEmail(email)) {
            return res.status(400).json({ error: 'Email không hợp lệ' });
        }
        
        const users = await readJSON(USERS_FILE, {});
        const user = Object.values(users).find(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (DEBUG) {
            console.log(`Available emails:`, Object.values(users).map(u => u.email));
            console.log(`User found:`, user ? 'Yes' : 'No');
        }
        
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản với email này' });
        }
        
        const resetToken = generateToken();
        const resetTokens = await readJSON(RESET_TOKENS_FILE, {});
        
        resetTokens[user.id] = {
            token: resetToken,
            userId: user.id,
            username: user.username,
            email: user.email,
            expiresAt: Date.now() + (60 * 60 * 1000)
        };
        
        await writeJSON(RESET_TOKENS_FILE, resetTokens);
        
        const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
        const resetUrl = `${baseUrl}/oauth/resetpassword/${user.id}/${resetToken}`;
        
        if (DEBUG) console.log(`Reset URL: ${resetUrl}`);
        
        const mailOptions = {
            from: `"Quiz Master" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🔐 Đặt lại mật khẩu - Quiz Master',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f7fa;">
    <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1);">
        <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:40px 30px;text-align:center;">
            <div style="width:60px;height:60px;background:white;border-radius:12px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:32px;">🎓</div>
            <h1 style="color:white;margin:0;font-size:28px;font-weight:700;">Đặt lại mật khẩu</h1>
        </div>
        <div style="padding:40px 30px;">
            <p style="font-size:18px;color:#1e293b;margin-bottom:20px;font-weight:600;">Xin chào <strong>${user.fullname}</strong>,</p>
            <p style="color:#64748b;line-height:1.6;margin-bottom:30px;font-size:15px;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${user.username}</strong> của bạn.</p>
            <p style="color:#64748b;line-height:1.6;margin-bottom:30px;font-size:15px;">Để tiếp tục, vui lòng nhấn vào nút bên dưới:</p>
            <div style="text-align:center;margin:40px 0;">
                <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:white;padding:16px 48px;text-decoration:none;border-radius:12px;font-weight:600;font-size:16px;box-shadow:0 4px 16px rgba(99,102,241,0.4);">Nhấn vào đây để đặt lại mật khẩu</a>
            </div>
            <div style="background:#f8fafc;border-left:4px solid #6366f1;padding:16px;border-radius:8px;margin:20px 0;">
                <p style="margin:0;color:#64748b;font-size:14px;">⏱️ Link này sẽ hết hạn sau <strong>1 giờ</strong> vì lý do bảo mật.</p>
            </div>
            <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:8px;margin:20px 0;">
                <p style="margin:0;color:#92400e;font-size:14px;"><strong>⚠️ Lưu ý bảo mật:</strong> Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Không chia sẻ link này với bất kỳ ai.</p>
            </div>
        </div>
        <div style="background:#f8fafc;padding:30px;text-align:center;color:#94a3b8;font-size:13px;border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 10px 0;"><strong>Quiz Master</strong> - Tạo trò chơi câu hỏi trắc nghiệm dành cho bạn</p>
            <p style="margin:0;">© 2024 Quiz Master. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
            `
        };
        
        await transporter.sendMail(mailOptions);
        if (DEBUG) console.log(`Reset email sent to: ${email}`);
        
        res.json({ success: true, message: 'Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư của bạn.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Không thể gửi email. Vui lòng thử lại sau.' });
    }
});

// Reset Password
app.post('/api/reset-password', async (req, res) => {
    try {
        const { userId, token, newPassword } = req.body;
        
        if (DEBUG) console.log(`Reset password attempt - userId: ${userId}`);
        
        if (!userId || !token || !newPassword) {
            return res.status(400).json({ error: 'Thiếu thông tin' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }
        
        const resetTokens = await readJSON(RESET_TOKENS_FILE, {});
        const resetData = resetTokens[userId];
        
        if (!resetData || resetData.token !== token) {
            return res.status(400).json({ error: 'Link đặt lại mật khẩu không hợp lệ' });
        }
        if (resetData.expiresAt < Date.now()) {
            delete resetTokens[userId];
            await writeJSON(RESET_TOKENS_FILE, resetTokens);
            return res.status(400).json({ error: 'Link đã hết hạn. Vui lòng yêu cầu lại.' });
        }
        
        const users = await readJSON(USERS_FILE, {});
        if (users[resetData.username]) {
            users[resetData.username].password = hashPassword(newPassword);
            await writeJSON(USERS_FILE, users);
        }
        
        delete resetTokens[userId];
        await writeJSON(RESET_TOKENS_FILE, resetTokens);
        
        const sessions = await readJSON(SESSIONS_FILE, {});
        const newSessions = {};
        for (const [sessToken, sessData] of Object.entries(sessions)) {
            if (sessData.username !== resetData.username) {
                newSessions[sessToken] = sessData;
            }
        }
        await writeJSON(SESSIONS_FILE, newSessions);
        
        if (DEBUG) console.log(`Password reset successful for user: ${resetData.username}`);
        
        res.json({ success: true, message: 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Save result
app.post('/api/save-result', authenticate, async (req, res) => {
    try {
        const { totalTime, avgTime, fastestTime, slowestTime } = req.body;
        const results = await readJSON(RESULTS_FILE, []);
        results.push({
            username: req.username,
            totalTime,
            avgTime,
            fastestTime,
            slowestTime,
            completedAt: Date.now()
        });
        await writeJSON(RESULTS_FILE, results);
        res.json({ success: true });
    } catch (error) {
        console.error('Save result error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Get results
app.get('/api/results', authenticate, async (req, res) => {
    try {
        const results = await readJSON(RESULTS_FILE, []);
        const userResults = results.filter(r => r.username === req.username);
        res.json({ success: true, results: userResults });
    } catch (error) {
        console.error('Get results error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const results = await readJSON(RESULTS_FILE, []);
        const bestTimes = {};
        results.forEach(r => {
            if (!bestTimes[r.username] || r.totalTime < bestTimes[r.username].totalTime) {
                bestTimes[r.username] = r;
            }
        });
        const leaderboard = Object.values(bestTimes)
            .sort((a, b) => a.totalTime - b.totalTime)
            .slice(0, 10);
        res.json({ success: true, leaderboard });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/quiz', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
});

app.get('/oauth/resetpassword/:userId/:token', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

async function startServer() {
    await ensureDataDir();
    app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log(`📧 Email: ${process.env.EMAIL_USER ? 'Configured ✓' : 'Not configured ✗'}`);
        console.log(`🐛 Debug mode: ${DEBUG ? 'ON' : 'OFF'}`);
        if (DEBUG) console.log(`   Debug endpoint: http://localhost:${PORT}/api/debug`);
    });
}

startServer();
