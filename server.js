require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === 'true';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || '';

// Logging function with Discord webhook
function log(message, data = null) {
    const timestamp = new Date().toISOString();
    if (DEBUG) {
        console.log(`[${timestamp}] ${message}`);
        if (data) {
            console.log('Data:', JSON.stringify(data, null, 2));
        }
    }
    
    // Send to Discord if webhook configured and DEBUG is enabled
    if (DISCORD_WEBHOOK && DEBUG) {
        sendDiscordLog(message, data);
    }
}

function logError(message, error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR: ${message}`);
    if (error) {
        console.error('Error details:', error.message);
        if (DEBUG && error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
    
    // Always send errors to Discord if webhook configured
    if (DISCORD_WEBHOOK) {
        sendDiscordLog(`❌ ERROR: ${message}`, error ? { error: error.message } : null);
    }
}

function sendDiscordLog(message, data = null) {
    if (!DISCORD_WEBHOOK) return;
    
    try {
        const payload = {
            embeds: [{
                title: '📊 Quiz Master Log',
                description: message.substring(0, 2000),
                color: message.includes('ERROR') ? 15158332 : 3447003,
                fields: data ? [{
                    name: 'Details',
                    value: '```json\n' + JSON.stringify(data, null, 2).substring(0, 900) + '\n```'
                }] : [],
                timestamp: new Date().toISOString()
            }]
        };
        
        const webhookData = JSON.stringify(payload);
        const url = new URL(DISCORD_WEBHOOK);
        
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(webhookData)
            },
            timeout: 5000
        };
        
        const req = https.request(options, (res) => {
            if (res.statusCode !== 204 && DEBUG) {
                console.error(`Discord webhook failed: ${res.statusCode}`);
            }
        });
        
        req.on('error', (e) => {
            if (DEBUG) {
                console.error('Discord webhook error:', e.message);
            }
        });
        
        req.on('timeout', () => {
            req.destroy();
            if (DEBUG) {
                console.error('Discord webhook timeout');
            }
        });
        
        req.write(webhookData);
        req.end();
    } catch (error) {
        if (DEBUG) {
            console.error('Discord webhook exception:', error.message);
        }
    }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const RESET_TOKENS_FILE = path.join(DATA_DIR, 'reset_tokens.json');
const QUIZZES_FILE = path.join(DATA_DIR, 'quizzes.json');
const BLOCKED_DEVICES_FILE = path.join(DATA_DIR, 'blocked_devices.json');
const DEVICE_LOGS_FILE = path.join(DATA_DIR, 'device_logs.json');

let transporter = null;
let emailEnabled = false;

// Device detection utility
function getDeviceInfo(req) {
    const userAgent = req.get('user-agent') || '';
    const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown').split(',')[0].trim();
    
    let deviceType = 'Unknown';
    let os = 'Unknown';
    let browser = 'Unknown';
    
    // Detect device type
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
        deviceType = 'Mobile';
    } else if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
        deviceType = 'Tablet';
    } else {
        deviceType = 'Desktop';
    }
    
    // Detect OS
    if (/windows/i.test(userAgent)) os = 'Windows';
    else if (/android/i.test(userAgent)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
    else if (/mac/i.test(userAgent)) os = 'macOS';
    else if (/linux/i.test(userAgent)) os = 'Linux';
    
    // Detect browser
    if (/chrome/i.test(userAgent) && !/edge|edg/i.test(userAgent)) browser = 'Chrome';
    else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
    else if (/firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/edge|edg/i.test(userAgent)) browser = 'Edge';
    else if (/opera|opr/i.test(userAgent)) browser = 'Opera';
    
    return {
        ip: ip.replace('::ffff:', ''),
        userAgent,
        deviceType,
        os,
        browser,
        timestamp: Date.now()
    };
}

// Check if device is blocked
async function isDeviceBlocked(deviceInfo) {
    try {
        const blockedDevices = await readJSON(BLOCKED_DEVICES_FILE, []);
        return blockedDevices.some(blocked => 
            blocked.ip === deviceInfo.ip
        );
    } catch (error) {
        return false;
    }
}

// Log device access
async function logDeviceAccess(req, action, additionalInfo = {}) {
    try {
        const deviceInfo = getDeviceInfo(req);
        const logs = await readJSON(DEVICE_LOGS_FILE, []);
        
        const logEntry = {
            ...deviceInfo,
            action,
            ...additionalInfo,
            timestamp: Date.now()
        };
        
        logs.push(logEntry);
        
        // Keep only last 1000 logs
        if (logs.length > 1000) {
            logs.splice(0, logs.length - 1000);
        }
        
        await writeJSON(DEVICE_LOGS_FILE, logs);
        
        // Send to Discord only in DEBUG mode
        if (DEBUG) {
            log(`📱 Device Access: ${action}`, {
                ip: deviceInfo.ip,
                device: `${deviceInfo.deviceType} - ${deviceInfo.os}`,
                browser: deviceInfo.browser,
                action,
                ...additionalInfo
            });
        }
    } catch (error) {
        if (DEBUG) {
            logError('Failed to log device access', error);
        }
    }
}

// Middleware to check blocked devices - CRITICAL: Must exclude /blocked route
async function checkBlockedDevice(req, res, next) {
    // Skip blocking check for blocked page and device info API
    if (req.path === '/blocked' || req.path === '/api/device-info') {
        return next();
    }
    
    const deviceInfo = getDeviceInfo(req);
    const blocked = await isDeviceBlocked(deviceInfo);
    
    if (blocked) {
        if (DEBUG) {
            log('🚫 Blocked device attempted access', deviceInfo);
        }
        return res.redirect('/blocked');
    }
    
    next();
}

async function initializeEmailTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('⚠ Email not configured - password reset will be disabled');
        console.log('  Please set EMAIL_USER and EMAIL_PASS in .env file');
        emailEnabled = false;
        return false;
    }
    
    try {
        // Create transporter with optimized settings for Gmail
        transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // Use STARTTLS
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            connectionTimeout: 30000, // 30 seconds
            greetingTimeout: 30000,
            socketTimeout: 30000,
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            tls: {
                rejectUnauthorized: true,
                minVersion: 'TLSv1.2'
            },
            logger: DEBUG,
            debug: DEBUG
        });
        
        // Try to verify with longer timeout
        console.log('Connecting to Gmail SMTP server...');
        await Promise.race([
            transporter.verify(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000)
            )
        ]);
        
        console.log('✓ Email service connected successfully');
        console.log(`  Using: ${process.env.EMAIL_USER}`);
        emailEnabled = true;
        return true;
    } catch (error) {
        console.log('⚠ Email verification failed - password reset will be disabled');
        console.log('  Reason:', error.message);
        if (error.code) {
            console.log('  Error code:', error.code);
        }
        console.log('  Troubleshooting:');
        console.log('    1. Check EMAIL_USER is correct Gmail address');
        console.log('    2. Check EMAIL_PASS is App Password (not regular password)');
        console.log('    3. Enable 2-Step Verification in Google Account');
        console.log('    4. Create App Password at: https://myaccount.google.com/apppasswords');
        console.log('    5. Check network/firewall allows SMTP connections');
        transporter = null;
        emailEnabled = false;
        return false;
    }
}

async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        const files = [
            { path: USERS_FILE, default: {} },
            { path: SESSIONS_FILE, default: {} },
            { path: RESULTS_FILE, default: [] },
            { path: RESET_TOKENS_FILE, default: {} },
            { path: QUIZZES_FILE, default: { nextId: 1, quizzes: {} } },
            { path: BLOCKED_DEVICES_FILE, default: [] },
            { path: DEVICE_LOGS_FILE, default: [] }
        ];
        
        for (const file of files) {
            try {
                await fs.access(file.path);
            } catch {
                await fs.writeFile(file.path, JSON.stringify(file.default, null, 2));
                log(`File created: ${path.basename(file.path)}`);
            }
        }
    } catch (error) {
        logError('Error creating data directory', error);
        throw error;
    }
}

async function readJSON(filepath, defaultValue = {}) {
    try {
        const data = await fs.readFile(filepath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return defaultValue;
    }
}

async function writeJSON(filepath, data) {
    try {
        await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    } catch (error) {
        logError(`Error writing ${path.basename(filepath)}`, error);
        throw error;
    }
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

async function generateUserId() {
    const users = await readJSON(USERS_FILE, {});
    const existingIds = Object.values(users).map(u => parseInt(u.id)).filter(id => !isNaN(id));
    if (existingIds.length === 0) return '1';
    const maxId = Math.max(...existingIds);
    return String(maxId + 1);
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

// Apply device blocking check to all routes EXCEPT /blocked
app.use(checkBlockedDevice);

// Device info logging middleware - only in DEBUG mode
if (DEBUG) {
    app.use((req, res, next) => {
        const deviceInfo = getDeviceInfo(req);
        log(`${req.method} ${req.path}`, {
            ip: deviceInfo.ip,
            device: `${deviceInfo.deviceType} - ${deviceInfo.os}`,
            browser: deviceInfo.browser
        });
        next();
    });
}

// ==================== DEVICE MANAGEMENT APIs ====================

// Get device info - no auth required for blocked page
app.get('/api/device-info', async (req, res) => {
    try {
        const deviceInfo = getDeviceInfo(req);
        await logDeviceAccess(req, 'device-info-request');
        res.json({ success: true, device: deviceInfo });
    } catch (error) {
        logError('Get device info error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Block device API - requires auth
app.post('/api/block-device', authenticate, async (req, res) => {
    try {
        const { ip, reason } = req.body;
        
        if (!ip) {
            return res.status(400).json({ error: 'Cần IP address' });
        }
        
        const blockedDevices = await readJSON(BLOCKED_DEVICES_FILE, []);
        
        // Check if already blocked
        const alreadyBlocked = blockedDevices.some(d => d.ip === ip);
        if (alreadyBlocked) {
            return res.status(400).json({ error: 'Thiết bị đã bị chặn' });
        }
        
        const blockInfo = {
            ip: ip,
            reason: reason || 'Không rõ lý do',
            blockedAt: Date.now(),
            blockedBy: req.username
        };
        
        blockedDevices.push(blockInfo);
        await writeJSON(BLOCKED_DEVICES_FILE, blockedDevices);
        
        log('🚫 Device blocked', blockInfo);
        
        res.json({ success: true, message: 'Đã chặn thiết bị', blockedDevice: blockInfo });
    } catch (error) {
        logError('Block device error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Get blocked devices list - requires auth
app.get('/api/blocked-devices', authenticate, async (req, res) => {
    try {
        const blockedDevices = await readJSON(BLOCKED_DEVICES_FILE, []);
        res.json({ success: true, devices: blockedDevices });
    } catch (error) {
        logError('Get blocked devices error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Unblock device - requires auth
app.post('/api/unblock-device', authenticate, async (req, res) => {
    try {
        const { ip } = req.body;
        
        const blockedDevices = await readJSON(BLOCKED_DEVICES_FILE, []);
        const filtered = blockedDevices.filter(d => d.ip !== ip);
        
        await writeJSON(BLOCKED_DEVICES_FILE, filtered);
        
        log('✅ Device unblocked', { ip });
        
        res.json({ success: true, message: 'Đã bỏ chặn thiết bị' });
    } catch (error) {
        logError('Unblock device error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Get device logs - requires auth
app.get('/api/device-logs', authenticate, async (req, res) => {
    try {
        const logs = await readJSON(DEVICE_LOGS_FILE, []);
        res.json({ success: true, logs: logs.slice(-100).reverse() });
    } catch (error) {
        logError('Get device logs error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// ==================== AUTH APIs ====================

app.post('/api/register', async (req, res) => {
    try {
        const { username, password, fullname, email } = req.body;
        await logDeviceAccess(req, 'register-attempt', { username, email });
        
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
        
        const emailExists = Object.values(users).some(u => u.email.toLowerCase() === email.toLowerCase());
        if (emailExists) {
            return res.status(400).json({ error: 'Email đã được sử dụng' });
        }
        
        const userId = await generateUserId();
        const deviceInfo = getDeviceInfo(req);
        
        users[username] = {
            id: userId,
            username,
            fullname,
            email: email.toLowerCase(),
            password: hashPassword(password),
            createdAt: Date.now(),
            registeredFrom: deviceInfo
        };
        
        await writeJSON(USERS_FILE, users);
        log('✅ Register successful', { username, userId });
        
        res.json({ success: true, message: 'Đăng ký thành công! Vui lòng đăng nhập.' });
    } catch (error) {
        logError('Register error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        await logDeviceAccess(req, 'login-attempt', { username });
        
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
        const deviceInfo = getDeviceInfo(req);
        
        sessions[token] = {
            userId: user.id,
            username: user.username,
            fullname: user.fullname,
            expiresAt,
            deviceInfo
        };
        
        await writeJSON(SESSIONS_FILE, sessions);
        
        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });
        
        log('✅ Login successful', { username, device: `${deviceInfo.deviceType} - ${deviceInfo.os}` });
        
        res.json({
            success: true,
            token,
            user: { username: user.username, fullname: user.fullname }
        });
    } catch (error) {
        logError('Login error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

app.get('/api/verify', authenticate, async (req, res) => {
    res.json({ success: true, user: { username: req.username, userId: req.userId } });
});

app.post('/api/logout', authenticate, async (req, res) => {
    try {
        const sessions = await readJSON(SESSIONS_FILE, {});
        delete sessions[req.token];
        await writeJSON(SESSIONS_FILE, sessions);
        res.clearCookie('accessToken');
        await logDeviceAccess(req, 'logout', { username: req.username });
        res.json({ success: true });
    } catch (error) {
        logError('Logout error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        await logDeviceAccess(req, 'forgot-password-request', { email });
        
        if (!email || !validateEmail(email)) {
            return res.status(400).json({ error: 'Email không hợp lệ' });
        }
        
        if (!emailEnabled || !transporter) {
            return res.status(503).json({ 
                error: 'Dịch vụ email chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
                emailDisabled: true
            });
        }
        
        const users = await readJSON(USERS_FILE, {});
        const user = Object.values(users).find(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản với email này' });
        }
        
        const resetToken = generateToken();
        const resetTokens = await readJSON(RESET_TOKENS_FILE, {});
        
        resetTokens[resetToken] = {
            userId: user.id,
            username: user.username,
            email: user.email,
            expiresAt: Date.now() + (5 * 60 * 1000)
        };
        
        await writeJSON(RESET_TOKENS_FILE, resetTokens);
        
        const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
        const resetUrl = `${baseUrl}/oauth/resetpassword/${resetToken}`;
        
        const mailOptions = {
            from: `"Quiz Master" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🔐 Đặt lại mật khẩu - Quiz Master',
            html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f7fa;margin:0;padding:40px 20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1)">
<div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:40px;text-align:center">
<h1 style="color:white;margin:0;font-size:28px">🔐 Đặt lại mật khẩu</h1>
</div>
<div style="padding:40px">
<p>Xin chào <strong>${user.fullname}</strong>,</p>
<p>Link đặt lại mật khẩu:</p>
<div style="text-align:center;margin:30px 0">
<a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:16px 48px;text-decoration:none;border-radius:12px;font-weight:600">Đặt lại mật khẩu</a>
</div>
<p style="color:#92400e;background:#fef3c7;padding:16px;border-radius:8px;border-left:4px solid #f59e0b">
<strong>⏱️ QUAN TRỌNG:</strong> Link chỉ có hiệu lực trong <strong>5 phút</strong>.
</p>
</div>
</div>
</body>
</html>`
        };
        
        await transporter.sendMail(mailOptions);
        log('📧 Reset email sent', { to: email });
        
        res.json({ success: true, message: 'Email đã được gửi. Link có hiệu lực 5 phút.' });
    } catch (error) {
        logError('Forgot password error', error);
        res.status(500).json({ error: 'Không thể gửi email. Vui lòng thử lại sau.' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Thiếu thông tin' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }
        
        const resetTokens = await readJSON(RESET_TOKENS_FILE, {});
        const resetData = resetTokens[token];
        
        if (!resetData) {
            return res.status(400).json({ error: 'Link không hợp lệ' });
        }
        
        if (resetData.expiresAt < Date.now()) {
            delete resetTokens[token];
            await writeJSON(RESET_TOKENS_FILE, resetTokens);
            return res.status(400).json({ error: 'Link đã hết hạn' });
        }
        
        const users = await readJSON(USERS_FILE, {});
        if (users[resetData.username]) {
            users[resetData.username].password = hashPassword(newPassword);
            await writeJSON(USERS_FILE, users);
        }
        
        delete resetTokens[token];
        await writeJSON(RESET_TOKENS_FILE, resetTokens);
        
        const sessions = await readJSON(SESSIONS_FILE, {});
        const newSessions = {};
        for (const [sessToken, sessData] of Object.entries(sessions)) {
            if (sessData.username !== resetData.username) {
                newSessions[sessToken] = sessData;
            }
        }
        await writeJSON(SESSIONS_FILE, newSessions);
        
        log('✅ Password reset successful', { username: resetData.username });
        
        res.json({ success: true, message: 'Mật khẩu đã được đặt lại thành công' });
    } catch (error) {
        logError('Reset password error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// ==================== QUIZ MANAGEMENT APIs ====================

app.post('/api/quiz/create', authenticate, async (req, res) => {
    try {
        const { title, questions, isPublic } = req.body;
        await logDeviceAccess(req, 'quiz-create', { title, username: req.username });
        
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Vui lòng nhập tiêu đề' });
        }
        
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Vui lòng thêm ít nhất một câu hỏi' });
        }
        
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.question || !q.question.trim()) {
                return res.status(400).json({ error: `Câu hỏi ${i + 1}: Vui lòng nhập nội dung câu hỏi` });
            }
            if (!q.options || q.options.length < 2) {
                return res.status(400).json({ error: `Câu hỏi ${i + 1}: Cần ít nhất 2 đáp án` });
            }
            for (let j = 0; j < q.options.length; j++) {
                if (!q.options[j].text || !q.options[j].text.trim()) {
                    return res.status(400).json({ error: `Câu hỏi ${i + 1}: Đáp án ${String.fromCharCode(65 + j)} không được để trống` });
                }
            }
            const correctCount = q.options.filter(o => o.isCorrect).length;
            if (correctCount !== 1) {
                return res.status(400).json({ error: `Câu hỏi ${i + 1}: Phải chọn đúng 1 đáp án đúng` });
            }
        }
        
        const quizzesData = await readJSON(QUIZZES_FILE, { nextId: 1, quizzes: {} });
        const quizId = quizzesData.nextId;
        
        const quiz = {
            id: quizId,
            title: title.trim(),
            author: req.username,
            authorId: req.userId,
            questions: questions,
            isPublic: isPublic === true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        quizzesData.quizzes[quizId] = quiz;
        quizzesData.nextId = quizId + 1;
        
        await writeJSON(QUIZZES_FILE, quizzesData);
        log('✅ Quiz created', { quizId, title });
        
        res.json({ success: true, quizId, message: 'Tạo quiz thành công!' });
    } catch (error) {
        logError('Create quiz error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

app.get('/api/quiz/my-activities', authenticate, async (req, res) => {
    try {
        const quizzesData = await readJSON(QUIZZES_FILE, { nextId: 1, quizzes: {} });
        const myQuizzes = Object.values(quizzesData.quizzes)
            .filter(q => q.authorId === req.userId)
            .sort((a, b) => b.createdAt - a.createdAt)
            .map(q => ({
                id: q.id,
                title: q.title,
                questionCount: q.questions.length,
                isPublic: q.isPublic,
                createdAt: q.createdAt,
                updatedAt: q.updatedAt
            }));
        
        res.json({ success: true, quizzes: myQuizzes });
    } catch (error) {
        logError('Get my activities error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

app.get('/api/quiz/:id', async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        await logDeviceAccess(req, 'quiz-view', { quizId });
        
        const quizzesData = await readJSON(QUIZZES_FILE, { nextId: 1, quizzes: {} });
        const quiz = quizzesData.quizzes[quizId];
        
        if (!quiz) {
            return res.status(404).json({ error: 'Không tìm thấy quiz' });
        }
        
        const token = req.cookies.accessToken || req.headers.authorization?.replace('Bearer ', '');
        const sessions = await readJSON(SESSIONS_FILE, {});
        const session = token ? sessions[token] : null;
        const isOwner = session && session.userId === quiz.authorId;
        
        if (!quiz.isPublic && !isOwner) {
            return res.status(404).json({ error: 'Không tìm thấy quiz' });
        }
        
        if (req.headers['x-request-full-data'] === 'true' && isOwner) {
            return res.json({ success: true, quiz: quiz });
        }
        
        const safeQuiz = {
            id: quiz.id,
            title: quiz.title,
            author: quiz.author,
            questionCount: quiz.questions.length,
            isPublic: quiz.isPublic,
            isOwner: isOwner,
            questions: quiz.questions.map((q, idx) => ({
                index: idx,
                question: q.question,
                options: q.options.map(o => ({ text: o.text }))
            }))
        };
        
        res.json({ success: true, quiz: safeQuiz });
    } catch (error) {
        logError('Get quiz error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

app.post('/api/quiz/:id/check-answer', async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        const { questionIndex, selectedOption } = req.body;
        
        const quizzesData = await readJSON(QUIZZES_FILE, { nextId: 1, quizzes: {} });
        const quiz = quizzesData.quizzes[quizId];
        
        if (!quiz) {
            return res.status(404).json({ error: 'Không tìm thấy quiz' });
        }
        
        const question = quiz.questions[questionIndex];
        if (!question) {
            return res.status(400).json({ error: 'Câu hỏi không hợp lệ' });
        }
        
        const isCorrect = question.options[selectedOption]?.isCorrect === true;
        const correctIndex = question.options.findIndex(o => o.isCorrect);
        
        res.json({ 
            success: true, 
            isCorrect,
            correctIndex
        });
    } catch (error) {
        logError('Check answer error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

app.put('/api/quiz/:id', authenticate, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        const { title, questions, isPublic } = req.body;
        
        const quizzesData = await readJSON(QUIZZES_FILE, { nextId: 1, quizzes: {} });
        const quiz = quizzesData.quizzes[quizId];
        
        if (!quiz) {
            return res.status(404).json({ error: 'Không tìm thấy quiz' });
        }
        
        if (quiz.authorId !== req.userId) {
            return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa quiz này' });
        }
        
        if (title && title.trim()) {
            quiz.title = title.trim();
        }
        
        if (questions && Array.isArray(questions)) {
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                if (!q.question || !q.question.trim()) {
                    return res.status(400).json({ error: `Câu hỏi ${i + 1}: Vui lòng nhập nội dung câu hỏi` });
                }
                if (!q.options || q.options.length < 2) {
                    return res.status(400).json({ error: `Câu hỏi ${i + 1}: Cần ít nhất 2 đáp án` });
                }
                const correctCount = q.options.filter(o => o.isCorrect).length;
                if (correctCount !== 1) {
                    return res.status(400).json({ error: `Câu hỏi ${i + 1}: Phải chọn đúng 1 đáp án đúng` });
                }
            }
            quiz.questions = questions;
        }
        
        if (typeof isPublic === 'boolean') {
            quiz.isPublic = isPublic;
        }
        
        quiz.updatedAt = Date.now();
        
        quizzesData.quizzes[quizId] = quiz;
        await writeJSON(QUIZZES_FILE, quizzesData);
        
        log('✅ Quiz updated', { quizId });
        
        res.json({ success: true, message: 'Cập nhật quiz thành công!' });
    } catch (error) {
        logError('Update quiz error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

app.delete('/api/quiz/:id', authenticate, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        
        const quizzesData = await readJSON(QUIZZES_FILE, { nextId: 1, quizzes: {} });
        const quiz = quizzesData.quizzes[quizId];
        
        if (!quiz) {
            return res.status(404).json({ error: 'Không tìm thấy quiz' });
        }
        
        if (quiz.authorId !== req.userId) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa quiz này' });
        }
        
        delete quizzesData.quizzes[quizId];
        await writeJSON(QUIZZES_FILE, quizzesData);
        
        log('🗑️ Quiz deleted', { quizId });
        
        res.json({ success: true, message: 'Xóa quiz thành công!' });
    } catch (error) {
        logError('Delete quiz error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

app.post('/api/quiz/:id/duplicate', authenticate, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        
        const quizzesData = await readJSON(QUIZZES_FILE, { nextId: 1, quizzes: {} });
        const originalQuiz = quizzesData.quizzes[quizId];
        
        if (!originalQuiz) {
            return res.status(404).json({ error: 'Không tìm thấy quiz' });
        }
        
        if (originalQuiz.authorId !== req.userId) {
            return res.status(403).json({ error: 'Bạn không có quyền nhân đôi quiz này' });
        }
        
        const newQuizId = quizzesData.nextId;
        const newQuiz = {
            ...originalQuiz,
            id: newQuizId,
            title: originalQuiz.title + ' (Bản sao)',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        quizzesData.quizzes[newQuizId] = newQuiz;
        quizzesData.nextId = newQuizId + 1;
        
        await writeJSON(QUIZZES_FILE, quizzesData);
        
        log('📋 Quiz duplicated', { originalId: quizId, newId: newQuizId });
        
        res.json({ success: true, quizId: newQuizId, message: 'Nhân đôi quiz thành công!' });
    } catch (error) {
        logError('Duplicate quiz error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

app.post('/api/save-result', authenticate, async (req, res) => {
    try {
        const { quizId, totalTime, avgTime, fastestTime, slowestTime } = req.body;
        
        const results = await readJSON(RESULTS_FILE, []);
        results.push({
            username: req.username,
            quizId: quizId || 'default',
            totalTime,
            avgTime,
            fastestTime,
            slowestTime,
            completedAt: Date.now()
        });
        
        await writeJSON(RESULTS_FILE, results);
        log('📊 Result saved', { username: req.username, totalTime });
        
        res.json({ success: true });
    } catch (error) {
        logError('Save result error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

app.get('/api/results', authenticate, async (req, res) => {
    try {
        const results = await readJSON(RESULTS_FILE, []);
        const userResults = results.filter(r => r.username === req.username);
        res.json({ success: true, results: userResults });
    } catch (error) {
        logError('Get results error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

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
        logError('Get leaderboard error', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// ==================== ROUTES ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/blocked', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'blocked.html'));
});

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
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});

app.get('/create', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'create.html'));
});

app.get('/myactivities', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'myactivities.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/create/edit/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'edit.html'));
});

app.get('/quiz/:id/:title?', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
});

app.get('/share/quiz/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'share.html'));
});

app.get('/oauth/resetpassword/:token', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ==================== SERVER START ====================

async function startServer() {
    try {
        console.log('🚀 Starting Quiz Master Server...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        await ensureDataDir();
        console.log('✓ Data directory initialized');
        
        await initializeEmailTransporter();
        
        app.listen(PORT, () => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`✓ Server running on port ${PORT}`);
            console.log(`✓ Debug mode: ${DEBUG ? 'ON' : 'OFF'}`);
            console.log(`✓ Discord webhook: ${DISCORD_WEBHOOK ? 'ENABLED' : 'DISABLED'}`);
            console.log(`✓ Email service: ${emailEnabled ? 'ENABLED' : 'DISABLED'}`);
            console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎉 Quiz Master is ready!');
            
            if (DISCORD_WEBHOOK && DEBUG) {
                sendDiscordLog('✅ Quiz Master Server Started', {
                    port: PORT,
                    environment: process.env.NODE_ENV || 'development',
                    debug: DEBUG,
                    email: emailEnabled ? 'enabled' : 'disabled'
                });
            }
        });
    } catch (error) {
        logError('Failed to start server', error);
        process.exit(1);
    }
}

startServer();
