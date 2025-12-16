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
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const RESET_TOKENS_FILE = path.join(DATA_DIR, 'reset_tokens.json');

// Discord webhook helper
async function sendDiscordLog(message, data = null) {
    if (!DISCORD_WEBHOOK || !DEBUG) return;
    
    try {
        const payload = {
            embeds: [{
                title: '🐛 Debug Log',
                description: message,
                color: 3447003,
                timestamp: new Date().toISOString(),
                fields: data ? Object.keys(data).map(key => ({
                    name: key,
                    value: String(data[key]).substring(0, 1024),
                    inline: true
                })) : []
            }]
        };
        
        await fetch(DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Discord webhook error:', error);
    }
}

// Debug logging middleware
if (DEBUG) {
    app.use(async (req, res, next) => {
        const logData = {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.get('user-agent')
        };
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        await sendDiscordLog(`Request: ${req.method} ${req.path}`, logData);
        next();
    });
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    timeout: 10000,
    pool: true
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
        await sendDiscordLog('❌ Error creating data directory', { error: error.message });
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
    
    const debugInfo = {
        users: Object.keys(users).map(u => ({
            username: u,
            email: users[u].email,
            id: users[u].id
        })),
        sessionsCount: Object.keys(sessions).length,
        activeSessions: Object.keys(sessions).map(token => ({
            token: token.substring(0, 8) + '...',
            username: sessions[token].username,
            expiresAt: new Date(sessions[token].expiresAt).toISOString()
        })),
        resultsCount: results.length,
        resetTokensCount: Object.keys(resetTokens).length,
        resetTokens: Object.keys(resetTokens).map(token => ({
            token: token.substring(0, 8) + '...',
            username: resetTokens[token].username,
            expiresAt: new Date(resetTokens[token].expiresAt).toISOString()
        })),
        env: {
            emailConfigured: !!process.env.EMAIL_USER,
            emailUser: process.env.EMAIL_USER || 'not set',
            baseUrl: process.env.BASE_URL || `http://localhost:${PORT}`,
            discordWebhook: !!DISCORD_WEBHOOK
        }
    };
    
    await sendDiscordLog('📊 Debug info requested', {
        users: debugInfo.users.length,
        sessions: debugInfo.sessionsCount,
        results: debugInfo.resultsCount
    });
    
    res.json(debugInfo);
});

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, fullname, email } = req.body;
        
        await sendDiscordLog('📝 Register attempt', { username, email });
        
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
            await sendDiscordLog('❌ Register failed: username exists', { username });
            return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
        }
        
        const emailExists = Object.values(users).some(u => u.email.toLowerCase() === email.toLowerCase());
        if (emailExists) {
            await sendDiscordLog('❌ Register failed: email exists', { email });
            return res.status(400).json({ error: 'Email đã được sử dụng' });
        }
        
        const userId = crypto.randomBytes(16).toString('hex');
        users[username] = {
            id: userId,
            username,
            fullname,
            email: email.toLowerCase(),
            password: hashPassword(password),
            createdAt: Date.now()
        };
        
        await writeJSON(USERS_FILE, users);
        await sendDiscordLog('✅ Register successful', { username, userId });
        
        res.json({ success: true, message: 'Đăng ký thành công! Vui lòng đăng nhập.' });
    } catch (error) {
        console.error('Register error:', error);
        await sendDiscordLog('❌ Register error', { error: error.message });
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        await sendDiscordLog('🔐 Login attempt', { username });
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
        }
        
        const users = await readJSON(USERS_FILE, {});
        const user = users[username];
        
        if (!user || user.password !== hashPassword(password)) {
            await sendDiscordLog('❌ Login failed: invalid credentials', { username });
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
        
        await sendDiscordLog('✅ Login successful', { 
            username, 
            token: token.substring(0, 8) + '...',
            expiresAt: new Date(expiresAt).toISOString()
        });
        
        res.json({
            success: true,
            token,
            loginUrl: `/oauth/login/${token}`,
            user: { username: user.username, fullname: user.fullname }
        });
    } catch (error) {
        console.error('Login error:', error);
        await sendDiscordLog('❌ Login error', { error: error.message });
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
        
        await sendDiscordLog('🚪 Logout', { username: req.username });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Forgot Password
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        await sendDiscordLog('📧 Forgot password request', { email });
        
        if (!email || !validateEmail(email)) {
            return res.status(400).json({ error: 'Email không hợp lệ' });
        }
        
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            await sendDiscordLog('❌ Email not configured');
            return res.status(500).json({ error: 'Hệ thống email chưa được cấu hình' });
        }
        
        const users = await readJSON(USERS_FILE, {});
        const user = Object.values(users).find(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (!user) {
            await sendDiscordLog('❌ Email not found', { email });
            return res.status(404).json({ error: 'Không tìm thấy tài khoản với email này' });
        }
        
        const resetToken = generateToken();
        const resetTokens = await readJSON(RESET_TOKENS_FILE, {});
        
        resetTokens[user.id] = {
            token: resetToken,
            userId: user.id,
            username: user.username,
            email: user.email,
            expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
        };
        
        await writeJSON(RESET_TOKENS_FILE, resetTokens);
        
        const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
        const resetUrl = `${baseUrl}/oauth/resetpassword/${user.id}/${resetToken}`;
        
        await sendDiscordLog('🔗 Reset URL generated', { 
            user: user.username,
            resetUrl,
            expiresIn: '5 minutes'
        });
        
        const mailOptions = {
            from: `"Quiz Master" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🔐 Đặt lại mật khẩu - Quiz Master',
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f7fa}.container{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1)}.header{background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:40px 30px;text-align:center}.logo{width:60px;height:60px;background:white;border-radius:12px;margin:0 auto 20px;font-size:32px;line-height:60px}.header h1{color:white;margin:0;font-size:28px}.content{padding:40px 30px}.message{color:#64748b;line-height:1.6;margin-bottom:30px;font-size:15px}.btn{display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:white;padding:16px 48px;text-decoration:none;border-radius:12px;font-weight:600}.warning{background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:8px;margin:20px 0;color:#92400e;font-size:14px}.footer{background:#f8fafc;padding:30px;text-align:center;color:#94a3b8;font-size:13px;border-top:1px solid #e2e8f0}</style></head>
<body>
<div class="container">
<div class="header"><div class="logo">🎓</div><h1>Đặt lại mật khẩu</h1></div>
<div class="content">
<p class="message">Xin chào <strong>${user.fullname}</strong>,</p>
<p class="message">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${user.username}</strong>.</p>
<div style="text-align:center;margin:30px 0;"><a href="${resetUrl}" class="btn">Nhấn vào đây để đặt lại mật khẩu</a></div>
<div class="warning"><strong>⏱️ QUAN TRỌNG:</strong> Link này chỉ có hiệu lực trong <strong>5 phút</strong>.</div>
</div>
<div class="footer"><p><strong>Quiz Master</strong></p><p>© 2024 Quiz Master</p></div>
</div>
</body>
</html>
            `
        };
        
        try {
            await transporter.sendMail(mailOptions);
            await sendDiscordLog('✅ Reset email sent', { to: email });
            res.json({ success: true, message: 'Email đã được gửi. Link có hiệu lực 5 phút.' });
        } catch (emailError) {
            console.error('Email error:', emailError);
            await sendDiscordLog('❌ Email send failed', { error: emailError.message });
            return res.status(500).json({ 
                error: 'Không thể gửi email. Vui lòng kiểm tra cấu hình.',
                details: DEBUG ? emailError.message : undefined
            });
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        await sendDiscordLog('❌ Forgot password error', { error: error.message });
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Reset Password
app.post('/api/reset-password', async (req, res) => {
    try {
        const { userId, token, newPassword } = req.body;
        
        await sendDiscordLog('🔄 Reset password attempt', { userId, token: token?.substring(0, 8) + '...' });
        
        if (!userId || !token || !newPassword) {
            return res.status(400).json({ error: 'Thiếu thông tin' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }
        
        const resetTokens = await readJSON(RESET_TOKENS_FILE, {});
        const resetData = resetTokens[userId];
        
        if (!resetData || resetData.token !== token) {
            await sendDiscordLog('❌ Invalid reset token', { userId });
            return res.status(400).json({ error: 'Link không hợp lệ' });
        }
        if (resetData.expiresAt < Date.now()) {
            delete resetTokens[userId];
            await writeJSON(RESET_TOKENS_FILE, resetTokens);
            await sendDiscordLog('❌ Reset token expired', { userId });
            return res.status(400).json({ error: 'Link đã hết hạn (5 phút)' });
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
        
        await sendDiscordLog('✅ Password reset successful', { username: resetData.username });
        
        res.json({ success: true, message: 'Mật khẩu đã được đặt lại thành công' });
    } catch (error) {
        console.error('Reset password error:', error);
        await sendDiscordLog('❌ Reset password error', { error: error.message });
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
        
        await sendDiscordLog('🎯 Quiz completed', { 
            username: req.username,
            totalTime: `${Math.floor(totalTime/60)}:${String(totalTime%60).padStart(2,'0')}`
        });
        
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

// OAuth login page - với token
app.get('/oauth/login/:token', async (req, res) => {
    const { token } = req.params;
    const sessions = await readJSON(SESSIONS_FILE, {});
    
    if (sessions[token]) {
        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });
        await sendDiscordLog('🔐 OAuth login via token', { 
            username: sessions[token].username,
            token: token.substring(0, 8) + '...'
        });
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});

app.get('/quiz', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
});

// Reset password page - endpoint cũ
app.get('/oauth/resetpassword/:userId/:token', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

async function startServer() {
    await ensureDataDir();
    
    // Verify email
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
            await transporter.verify();
            console.log('📧 Email: Connected ✓');
            await sendDiscordLog('✅ Server started - Email connected');
        } catch (error) {
            console.error('📧 Email: Failed ✗');
            console.error('   Error:', error.message);
            await sendDiscordLog('❌ Server started - Email connection failed', { error: error.message });
        }
    } else {
        console.log('📧 Email: Not configured');
        await sendDiscordLog('⚠️ Server started - Email not configured');
    }
    
    app.listen(PORT, () => {
        console.log(`🚀 Server: http://localhost:${PORT}`);
        console.log(`🐛 Debug: ${DEBUG ? 'ON' : 'OFF'}`);
        console.log(`📊 Discord webhook: ${DISCORD_WEBHOOK ? 'Configured ✓' : 'Not configured'}`);
        if (DEBUG) console.log(`   Debug endpoint: http://localhost:${PORT}/api/debug`);
    });
}

startServer();
