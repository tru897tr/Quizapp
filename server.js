const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// File paths
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

// Utility functions
async function ensureDataDir() {
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
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

// Session middleware
async function authenticate(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Không có token xác thực' });
    }

    const sessions = await readJSON(SESSIONS_FILE, {});
    const session = sessions[token];

    if (!session || session.expiresAt < Date.now()) {
        return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    req.userId = session.userId;
    req.username = session.username;
    next();
}

// API Routes

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, fullname } = req.body;

        if (!username || !password || !fullname) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'Tên đăng nhập phải có ít nhất 3 ký tự' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        const users = await readJSON(USERS_FILE, {});

        if (users[username]) {
            return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
        }

        users[username] = {
            id: Date.now().toString(),
            username,
            fullname,
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

        sessions[token] = {
            userId: user.id,
            username: user.username,
            fullname: user.fullname,
            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
        };

        await writeJSON(SESSIONS_FILE, sessions);

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
        const token = req.headers.authorization?.replace('Bearer ', '');
        const sessions = await readJSON(SESSIONS_FILE, {});
        
        delete sessions[token];
        await writeJSON(SESSIONS_FILE, sessions);

        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Save quiz result
app.post('/api/save-result', authenticate, async (req, res) => {
    try {
        const { totalTime, avgTime, fastestTime, slowestTime } = req.body;
        
        const resultsFile = path.join(__dirname, 'data', 'results.json');
        const results = await readJSON(resultsFile, []);

        results.push({
            username: req.username,
            totalTime,
            avgTime,
            fastestTime,
            slowestTime,
            completedAt: Date.now()
        });

        await writeJSON(resultsFile, results);

        res.json({ success: true });
    } catch (error) {
        console.error('Save result error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Get user results
app.get('/api/results', authenticate, async (req, res) => {
    try {
        const resultsFile = path.join(__dirname, 'data', 'results.json');
        const results = await readJSON(resultsFile, []);
        
        const userResults = results.filter(r => r.username === req.username);
        
        res.json({ success: true, results: userResults });
    } catch (error) {
        console.error('Get results error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Serve pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/quiz', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Initialize and start server
async function startServer() {
    await ensureDataDir();
    
    app.listen(PORT, () => {
        console.log(`Server đang chạy tại http://localhost:${PORT}`);
    });
}

startServer();
