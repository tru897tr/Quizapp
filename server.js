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
const QUIZZES_FILE = path.join(DATA_DIR, 'quizzes.json');

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

if (DEBUG) {
    app.use(async (req, res, next) => {
        const logData = {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.get('user-agent')
        };
        console.log('[' + new Date().toISOString() + '] ' + req.method + ' ' + req.path);
        await sendDiscordLog('Request: ' + req.method + ' ' + req.path, logData);
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
            { path: RESET_TOKENS_FILE, default: {} },
            { path: QUIZZES_FILE, default: { nextId: 1, quizzes: {} } }
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
        if (DEBUG) console.error('Error reading ' + filepath + ':', error);
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

async function generateUserId() {
    const users = await readJSON(USERS_FILE, {});
    const existingIds = Object.values(users).map(u => parseInt(u.id)).filter(id => !isNaN(id));
    if (existingIds.length === 0) return '1';
    const maxId = Math.max(...existingIds);
    return String(maxId + 1);
}

async function authenticate(req, res, next) {
    const token = req.cookies.accessToken || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
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
        const userId = await generateUserId();
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
        await sendDiscordLog('✅ Login successful', { username });
        res.json({
            success: true,
            token,
            user: { username: user.username, fullname: user.fullname }
        });
    } catch (error) {
        console.error('Login error:', error);
        await sendDiscordLog('❌ Login error', { error: error.message });
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
        await sendDiscordLog('🚪 Logout', { username: req.username });
        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

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
        resetTokens[resetToken] = {
            userId: user.id,
            username: user.username,
            email: user.email,
            expiresAt: Date.now() + (5 * 60 * 1000)
        };
        await writeJSON(RESET_TOKENS_FILE, resetTokens);
        const baseUrl = process.env.BASE_URL || 'http://localhost:' + PORT;
        const resetUrl = baseUrl + '/oauth/resetpassword/' + resetToken;
        await sendDiscordLog('🔗 Reset URL generated', { user: user.username, resetUrl });
        const mailOptions = {
            from: '"Quiz Master" <' + process.env.EMAIL_USER + '>',
            to: email,
            subject: '🔐 Đặt lại mật khẩu - Quiz Master',
            html: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;background:#f5f7fa;margin:0;padding:40px 20px"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1)"><div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:40px;text-align:center"><div style="font-size:48px;margin-bottom:16px">🎓</div><h1 style="color:white;margin:0;font-size:28px">Đặt lại mật khẩu</h1></div><div style="padding:40px"><p style="color:#64748b;line-height:1.6;margin-bottom:20px">Xin chào <strong>' + user.fullname + '</strong>,</p><p style="color:#64748b;line-height:1.6;margin-bottom:30px">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>' + user.username + '</strong>.</p><div style="text-align:center;margin:30px 0"><a href="' + resetUrl + '" style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:white;padding:16px 48px;text-decoration:none;border-radius:12px;font-weight:600">Đặt lại mật khẩu</a></div><div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:8px;color:#92400e;font-size:14px"><strong>⏱️ QUAN TRỌNG:</strong> Link này chỉ có hiệu lực trong <strong>5 phút</strong>.</div></div><div style="background:#f8fafc;padding:30px;text-align:center;color:#94a3b8;font-size:13px;border-top:1px solid #e2e8f0"><p><strong>Quiz Master</strong></p><p>© 2024 Quiz Master</p></div></div></body></html>'
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

app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        await sendDiscordLog('🔄 Reset password attempt', { token: token?.substring(0, 8) + '...' });
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Thiếu thông tin' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }
        const resetTokens = await readJSON(RESET_TOKENS_FILE, {});
        const resetData = resetTokens[token];
        if (!resetData) {
            await sendDiscordLog('❌ Invalid reset token', { token });
            return res.status(400).json({ error: 'Link không hợp lệ' });
        }
        if (resetData.expiresAt < Date.now()) {
            delete resetTokens[token];
            await writeJSON(RESET_TOKENS_FILE, resetTokens);
            await sendDiscordLog('❌ Reset token expired', { token });
            return res.status(400).json({ error: 'Link đã hết hạn (5 phút)' });
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
        await sendDiscordLog('✅ Password reset successful', { username: resetData.username });
        res.json({ success: true, message: 'Mật khẩu đã được đặt lại thành công' });
    } catch (error) {
        console.error('Reset password error:', error);
        await sendDiscordLog('❌ Reset password error', { error: error.message });
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// ==================== QUIZ MANAGEMENT APIs ====================

app.post('/api/quiz/create', authenticate, async (req, res) => {
    try {
        const { title, questions, isPublic } = req.body;
        
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Vui lòng nhập tiêu đề' });
        }
        
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Vui lòng thêm ít nhất một câu hỏi' });
        }
        
        // Validate questions
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
        await sendDiscordLog('✅ Quiz created', { quizId, title, author: req.username });
        
        res.json({ success: true, quizId, message: 'Tạo quiz thành công!' });
    } catch (error) {
        console.error('Create quiz error:', error);
        await sendDiscordLog('❌ Create quiz error', { error: error.message });
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
        console.error('Get my activities error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

app.get('/api/quiz/:id', async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        const quizzesData = await readJSON(QUIZZES_FILE, { nextId: 1, quizzes: {} });
        const quiz = quizzesData.quizzes[quizId];
        
        if (!quiz) {
            return res.status(404).json({ error: 'Không tìm thấy quiz' });
        }
        
        // Check authentication
        const token = req.cookies.accessToken || req.headers.authorization?.replace('Bearer ', '');
        const sessions = await readJSON(SESSIONS_FILE, {});
        const session = token ? sessions[token] : null;
        const isOwner = session && session.userId === quiz.authorId;
        
        if (!quiz.isPublic && !isOwner) {
            return res.status(404).json({ error: 'Không tìm thấy quiz' });
        }
        
        // Return quiz without showing correct answers
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
        console.error('Get quiz error:', error);
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
        console.error('Check answer error:', error);
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
        
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Vui lòng nhập tiêu đề' });
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
        }
        
        quiz.title = title.trim();
        if (questions) quiz.questions = questions;
        if (typeof isPublic === 'boolean') quiz.isPublic = isPublic;
        quiz.updatedAt = Date.now();
        
        quizzesData.quizzes[quizId] = quiz;
        await writeJSON(QUIZZES_FILE, quizzesData);
        
        await sendDiscordLog('✅ Quiz updated', { quizId, title });
        
        res.json({ success: true, message: 'Cập nhật quiz thành công!' });
    } catch (error) {
        console.error('Update quiz error:', error);
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
        
        await sendDiscordLog('🗑️ Quiz deleted', { quizId, title: quiz.title });
        
        res.json({ success: true, message: 'Xóa quiz thành công!' });
    } catch (error) {
        console.error('Delete quiz error:', error);
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
        
        await sendDiscordLog('✅ Quiz duplicated', { originalId: quizId, newId: newQuizId });
        
        res.json({ success: true, quizId: newQuizId, message: 'Nhân đôi quiz thành công!' });
    } catch (error) {
        console.error('Duplicate quiz error:', error);
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
        await sendDiscordLog('🎯 Quiz completed', { username: req.username, quizId });
        res.json({ success: true });
    } catch (error) {
        console.error('Save result error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

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

// ==================== ROUTES ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
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
        await sendDiscordLog('🔐 OAuth login via token', { username: sessions[token].username });
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

async function startServer() {
    await ensureDataDir();
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
        console.log('🚀 Server: http://localhost:' + PORT);
        console.log('🐛 Debug: ' + (DEBUG ? 'ON' : 'OFF'));
        console.log('📊 Discord webhook: ' + (DISCORD_WEBHOOK ? 'Configured ✓' : 'Not configured'));
    });
}

startServer();
