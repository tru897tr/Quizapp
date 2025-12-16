require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// File paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const RESET_TOKENS_FILE = path.join(DATA_DIR, 'reset_tokens.json');

// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Utility functions
async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        // Initialize files if they don't exist
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

// Middleware xác thực
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

// =========================
// API Routes
// =========================

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, fullname, email } = req.body;

        // Validation
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

        // Check username exists
        if (users[username]) {
            return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
        }

        // Check email exists
        const emailExists = Object.values(users).some(u => u.email === email);
        if (emailExists) {
            return res.status(400).json({ error: 'Email đã được sử dụng' });
        }

        users[username] = {
            id: Date.now().toString(),
            username,
            fullname,
            email,
            password: hashPassword(password),
            createdAt: Date.now()
        };

        await writeJSON(USERS_FILE, users);

        res.json({ 
            success: true, 
            message: 'Đăng ký thành công! Vui lòng đăng nhập.' 
        });
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

        const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

        sessions[token] = {
            userId: user.id,
            username: user.username,
            fullname: user.fullname,
            expiresAt
        };

        await writeJSON(SESSIONS_FILE, sessions);

        // Set cookie
        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'lax'
        });

        res.json({
            success: true,
            token,
            user: {
                username: user.username,
                fullname: user.fullname
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Verify session
app.get('/api/verify', authenticate, async (req, res) => {
    res.json({
        success: true,
        user: {
            username: req.username
        }
    });
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

// Forgot Password - Request Reset
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !validateEmail(email)) {
            return res.status(400).json({ error: 'Email không hợp lệ' });
        }

        const users = await readJSON(USERS_FILE, {});
        const user = Object.values(users).find(u => u.email === email);

        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản với email này' });
        }

        // Generate reset token
        const resetToken = generateToken();
        const resetTokens = await readJSON(RESET_TOKENS_FILE, {});

        resetTokens[resetToken] = {
            username: user.username,
            email: user.email,
            expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
        };

        await writeJSON(RESET_TOKENS_FILE, resetTokens);

        // Send email
        const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Đặt lại mật khẩu - Quiz App',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #7e22ce;">Đặt lại mật khẩu</h2>
                    <p>Xin chào <strong>${user.fullname}</strong>,</p>
                    <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản <strong>${user.username}</strong>.</p>
                    <p>Vui lòng click vào nút bên dưới để đặt lại mật khẩu:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="background: linear-gradient(135deg, #7e22ce, #3b82f6); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block;">
                            Đặt lại mật khẩu
                        </a>
                    </div>
                    <p>Hoặc copy link sau vào trình duyệt:</p>
                    <p style="background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all;">
                        ${resetUrl}
                    </p>
                    <p style="color: #666; font-size: 0.9em;">Link này sẽ hết hạn sau 1 giờ.</p>
                    <p style="color: #666; font-size: 0.9em;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                    <p style="color: #999; font-size: 0.8em; text-align: center;">
                        © 2024 Quiz App. All rights reserved.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({ 
            success: true, 
            message: 'Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư của bạn.' 
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Không thể gửi email. Vui lòng thử lại sau.' });
    }
});

// Reset Password
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
            return res.status(400).json({ error: 'Link đặt lại mật khẩu không hợp lệ' });
        }

        if (resetData.expiresAt < Date.now()) {
            delete resetTokens[token];
            await writeJSON(RESET_TOKENS_FILE, resetTokens);
            return res.status(400).json({ error: 'Link đã hết hạn. Vui lòng yêu cầu lại.' });
        }

        // Update password
        const users = await readJSON(USERS_FILE, {});
        if (users[resetData.username]) {
            users[resetData.username].password = hashPassword(newPassword);
            await writeJSON(USERS_FILE, users);
        }

        // Remove used token
        delete resetTokens[token];
        await writeJSON(RESET_TOKENS_FILE, resetTokens);

        // Clear all sessions for this user
        const sessions = await readJSON(SESSIONS_FILE, {});
        const newSessions = {};
        for (const [sessToken, sessData] of Object.entries(sessions)) {
            if (sessData.username !== resetData.username) {
                newSessions[sessToken] = sessData;
            }
        }
        await writeJSON(SESSIONS_FILE, newSessions);

        res.json({ 
            success: true, 
            message: 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.' 
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Save quiz result
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

// Get user results
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

// Get leaderboard (top 10)
app.get('/api/leaderboard', async (req, res) => {
    try {
        const results = await readJSON(RESULTS_FILE, []);
        
        // Group by username and get best time
        const bestTimes = {};
        results.forEach(r => {
            if (!bestTimes[r.username] || r.totalTime < bestTimes[r.username].totalTime) {
                bestTimes[r.username] = r;
            }
        });

        // Sort and get top 10
        const leaderboard = Object.values(bestTimes)
            .sort((a, b) => a.totalTime - b.totalTime)
            .slice(0, 10);

        res.json({ success: true, leaderboard });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// =========================
// Page Routes
// =========================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/quiz', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
});

app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Initialize and start server
async function startServer() {
    await ensureDataDir();
    
    app.listen(PORT, () => {
        console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
        console.log(`📧 Email service: ${process.env.EMAIL_USER ? 'Configured ✓' : 'Not configured ✗'}`);
    });
}

startServer();
