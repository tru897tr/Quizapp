/**
 * ============================================================================
 *  QUIZ MASTER - MAY CHU CHINH (server.js)
 * ============================================================================
 *  Da viet lai toan bo tu phien ban goc. Nhung thay doi quan trong nhat:
 *
 *  1) SUA LOI NGHIEM TRONG: Khi mo trang chinh sua (edit) mot quiz (ke ca
 *     quiz vua "Nhan doi"), API tra du lieu day du cho chu so huu nhung
 *     KHONG kem theo co "isOwner" -> giao dien luon hieu la "khong co
 *     quyen" va day nguoi dung ve trang danh sach. Loi nay xay ra cho MOI
 *     quiz chu khong rieng quiz nhan doi. Da sua trong route GET /api/quiz/:id.
 *
 *  2) CHONG GIAN LAN (anti-cheat):
 *     - Truoc day API "check-answer" luon tra ve chi so dap an dung (correctIndex)
 *       ke ca khi tra loi SAI -> chi can mo tab Network la biet dap an ma
 *       khong can bam chon. Gio day server CHI tiet lo dap an dung khi
 *       nguoi dung tra loi dung.
 *     - Truoc day thoi gian lam bai do TRINH DUYET tu tinh va gui len, ai
 *       cung co the mo Console va gia mao thoi gian = 0 giay de leo top
 *       bang xep hang. Gio day server tu quan ly "luot lam bai" (attempt)
 *       va tinh thoi gian dua tren dong ho CUA SERVER, khong tin bat ky
 *       con so nao tu trinh duyet gui len.
 *     - Bat buoc tra loi dung cau truoc moi duoc mo cau sau (chong nhay coc
 *       goi thang API de do tim dap an cau kho ma khong lam cac cau truoc).
 *
 *  3) BAO MAT (tuong tu "tuong lua" o muc ung dung):
 *     - Mat khau duoc bam (hash) bang scrypt + salt rieng cho tung nguoi
 *       dung (ban goc dung SHA-256 khong salt - rat de bi do bang bang
 *       cau vong "rainbow table").
 *     - Gioi han so lan goi API (rate limiting) cho cac endpoint nhay cam
 *       (dang nhap, dang ky, quen mat khau...) de chong do quet mat khau.
 *     - Tu dong tam khoa tai khoan sau nhieu lan dang nhap sai lien tiep.
 *     - Chong gia mao yeu cau lien trang (CSRF) bang co che "double submit
 *       cookie".
 *     - Bo sung cac tieu de bao mat HTTP (CSP, X-Frame-Options, HSTS...).
 *     - Phan quyen ro rang: chi TAI KHOAN QUAN TRI (admin) moi duoc xem
 *       nhat ky thiet bi hoac chan/mo chan dia chi IP. Ban goc cho phep
 *       BAT KY nguoi dung dang nhap nao cung goi duoc cac API nay -> lo
 *       thong tin IP cua tat ca moi nguoi va co the bi loi dung de chan
 *       nguoi khac.
 *     - Thu tu middleware duoc sap xep lai: kiem tra chan IP duoc dat
 *       TRUOC ca phan phuc vu file tinh (o ban goc, file tinh (CSS/JS)
 *       van duoc phuc vu ngay ca khi IP da bi chan do dat sai thu tu).
 *     - Chong XSS: moi du lieu do nguoi dung nhap (tieu de quiz, cau hoi,
 *       dap an, ten hien thi...) deu duoc ma hoa (escape) truoc khi chen
 *       vao giao dien thay vi chen thang HTML tho.
 *
 *  4) BO NHO DEM (cache) + luu tru: Toan bo du lieu (nguoi dung, quiz, ket
 *     qua...) duoc nap vao bo nho RAM ngay khi khoi dong de moi thao tac
 *     doc/ghi deu cuc nhanh (khong phai doc file o dia moi lan nhu ban
 *     goc), sau do duoc dong bo (ghi) xuong o dia theo hang doi rieng cho
 *     tung file de tranh ghi chong cheo lam hong du lieu khi co nhieu yeu
 *     cau cung luc (ban goc co the bi "mat du lieu" neu 2 nguoi luu quiz
 *     cung mot thoi diem).
 *
 *  5) Tinh nang con thieu da duoc bo sung: trang Bang xep hang theo tung
 *     quiz, trang Lich su ket qua, trang Cai dat day du (doi mat khau,
 *     quan ly phien dang nhap, dang xuat khoi tat ca thiet bi), trang
 *     Quan tri (Admin) rieng cho chan/mo chan IP va xem nhat ky.
 *
 *  Ghi chu ve trien khai tren Render: du an van dung file JSON lam noi
 *  luu du lieu (khong dung he quan tri co so du lieu rieng) de giu su
 *  don gian. O goi mien phi cua Render, o dia se bi XOA moi khi ban trien
 *  khai lai (redeploy) phien ban moi - day la gioi han cua nen tang chu
 *  khong phai loi cua ung dung. Neu can du lieu ton tai lau dai, hay dung
 *  tinh nang "Persistent Disk" (o dia ben vung) cua Render hoac chuyen
 *  sang mot co so du lieu that (PostgreSQL, MongoDB...).
 * ============================================================================
 */

'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const https = require('https');

const app = express();

// ============================================================================
// CAU HINH CHUNG
// ============================================================================

const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || '';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const SESSION_SECRET = process.env.SESSION_SECRET || 'quiz-master-default-secret-vui-long-doi-truoc-khi-chay-that';
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

if (!process.env.SESSION_SECRET && IS_PRODUCTION) {
    console.warn('[CANH BAO BAO MAT] Ban chua dat SESSION_SECRET trong moi truong production. Vui long dat bien nay trong file .env!');
}

// ============================================================================
// GHI LOG (console + Discord webhook tuy chon)
// ============================================================================

function log(message, data = null) {
    const timestamp = new Date().toISOString();
    if (DEBUG) {
        console.log(`[${timestamp}] ${message}`);
        if (data) console.log('Chi tiet:', JSON.stringify(data, null, 2));
    }
    if (DISCORD_WEBHOOK && DEBUG) sendDiscordLog(message, data);
}

function logError(message, error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] LOI: ${message}`);
    if (error) {
        console.error('Chi tiet loi:', error.message);
        if (DEBUG && error.stack) console.error('Stack trace:', error.stack);
    }
    if (DISCORD_WEBHOOK) sendDiscordLog(`[LOI] ${message}`, error ? { error: error.message } : null);
}

function sendDiscordLog(message, data = null) {
    if (!DISCORD_WEBHOOK) return;
    try {
        const payload = {
            embeds: [{
                title: 'Nhat ky Quiz Master',
                description: message.substring(0, 2000),
                color: message.includes('LOI') ? 15158332 : 3447003,
                fields: data ? [{
                    name: 'Chi tiet',
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
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(webhookData) },
            timeout: 5000
        };
        const req = https.request(options, (res) => {
            if (res.statusCode !== 204 && DEBUG) console.error(`Gui Discord webhook that bai: ${res.statusCode}`);
        });
        req.on('error', (e) => { if (DEBUG) console.error('Loi Discord webhook:', e.message); });
        req.on('timeout', () => { req.destroy(); });
        req.write(webhookData);
        req.end();
    } catch (error) {
        if (DEBUG) console.error('Ngoai le Discord webhook:', error.message);
    }
}

// ============================================================================
// LOP LUU TRU + BO NHO DEM (CACHE) TRONG RAM
// ============================================================================
// Toan bo "co so du lieu" JSON duoc nap het vao RAM khi khoi dong. Moi thao
// tac doc se lay thang tu RAM (rat nhanh, khong dung I/O dia). Moi thao tac
// ghi se cap nhat RAM ngay lap tuc (de cac yeu cau tiep theo thay du lieu moi
// nhat) roi xep hang dong bo xuong dia o che do nen (bat dong bo), moi file
// co hang doi rieng de khong bao gio co 2 lenh ghi cung luc vao 1 file.

const DATA_DIR = path.join(__dirname, 'data');

const FILES = {
    users: path.join(DATA_DIR, 'users.json'),
    sessions: path.join(DATA_DIR, 'sessions.json'),
    results: path.join(DATA_DIR, 'results.json'),
    resetTokens: path.join(DATA_DIR, 'reset_tokens.json'),
    quizzes: path.join(DATA_DIR, 'quizzes.json'),
    blockedIps: path.join(DATA_DIR, 'blocked_devices.json'),
    deviceLogs: path.join(DATA_DIR, 'device_logs.json'),
    attempts: path.join(DATA_DIR, 'attempts.json')
};

function defaultValueFor(key) {
    switch (key) {
        case 'quizzes': return { nextId: 1, quizzes: {} };
        case 'results': return [];
        case 'blockedIps': return [];
        case 'deviceLogs': return [];
        default: return {};
    }
}

const cache = {};
const writeQueues = {};

async function loadAllData() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    for (const key of Object.keys(FILES)) {
        try {
            const raw = await fs.readFile(FILES[key], 'utf8');
            cache[key] = JSON.parse(raw);
        } catch {
            cache[key] = defaultValueFor(key);
            await persist(key);
        }
    }
}

function persist(key) {
    const filePath = FILES[key];
    const payload = JSON.stringify(cache[key], null, 2);
    const previous = writeQueues[key] || Promise.resolve();
    const task = previous
        .then(() => fs.writeFile(filePath, payload))
        .catch(err => logError(`Khong the ghi file du lieu "${key}"`, err));
    writeQueues[key] = task;
    return task;
}

async function flushAllToDisk() {
    await Promise.all(Object.keys(FILES).map(persist));
}

// ============================================================================
// HAM TIEN ICH BAO MAT
// ============================================================================

// Bam mat khau bang scrypt (co san trong Node.js, khong can them thu vien
// ngoai) + salt ngau nhien rieng cho tung nguoi dung.
function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString('hex');
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
        });
    });
}

// Kiem tra mat khau. Ho tro ca dinh dang cu (sha256 khong salt) de tuong
// thich nguoc, va se bao hieu "legacy" de he thong tu nang cap sang scrypt
// ngay sau lan dang nhap thanh cong tiep theo.
function verifyPassword(password, stored) {
    return new Promise((resolve, reject) => {
        if (!stored) return resolve(false);
        if (!stored.startsWith('scrypt:')) {
            const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
            return resolve(legacyHash === stored ? 'legacy' : false);
        }
        const parts = stored.split(':');
        const salt = parts[1];
        const key = parts[2];
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) return reject(err);
            const keyBuffer = Buffer.from(key, 'hex');
            if (keyBuffer.length !== derivedKey.length) return resolve(false);
            resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
        });
    });
}

function generateToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

// Chi cho phep chu (khong dau), so va dau gach duoi, tu 3-20 ky tu. Viec
// gioi han bo ky tu nay vua tranh nham lan hien thi, vua giam nguy co chen
// ma HTML/script vao ten dang nhap (XSS).
function validateUsername(username) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(String(username || ''));
}

function validatePassword(password) {
    return typeof password === 'string' && password.length >= 6;
}

// Ma hoa cac ky tu dac biet cua HTML - dung khi chen du lieu nguoi dung vao
// noi dung email (phong khi ho dat ten day du chua ky tu dac biet).
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const raw = (forwarded ? String(forwarded).split(',')[0] : (req.connection?.remoteAddress || req.ip || 'unknown')).trim();
    return raw.replace('::ffff:', '');
}

function getDeviceInfo(req) {
    const userAgent = req.get('user-agent') || '';
    const ip = getClientIp(req);

    let deviceType = 'Desktop';
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) deviceType = 'Dien thoai';
    else if (/tablet|ipad|playbook|silk/i.test(userAgent)) deviceType = 'May tinh bang';

    let os = 'Khong ro';
    if (/windows/i.test(userAgent)) os = 'Windows';
    else if (/android/i.test(userAgent)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
    else if (/mac/i.test(userAgent)) os = 'macOS';
    else if (/linux/i.test(userAgent)) os = 'Linux';

    let browser = 'Khong ro';
    if (/edge|edg/i.test(userAgent)) browser = 'Edge';
    else if (/chrome/i.test(userAgent)) browser = 'Chrome';
    else if (/firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/safari/i.test(userAgent)) browser = 'Safari';
    else if (/opera|opr/i.test(userAgent)) browser = 'Opera';

    return { ip, userAgent, deviceType, os, browser, timestamp: Date.now() };
}

async function logDeviceAccess(req, action, extra = {}) {
    try {
        const deviceInfo = getDeviceInfo(req);
        const entry = { ...deviceInfo, action, ...extra, timestamp: Date.now() };
        cache.deviceLogs.push(entry);
        if (cache.deviceLogs.length > 1000) {
            cache.deviceLogs.splice(0, cache.deviceLogs.length - 1000);
        }
        await persist('deviceLogs');
    } catch (error) {
        if (DEBUG) logError('Khong the ghi nhat ky truy cap', error);
    }
}

function isIpBlocked(ip) {
    return cache.blockedIps.some(b => b.ip === ip);
}

// ============================================================================
// BO DEM CHONG DO QUET (rate limiting) - tu viet, khong can thu vien ngoai
// ============================================================================

function createRateLimiter({ windowMs, max, message }) {
    const hits = new Map();
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt < now) hits.delete(key);
        }
    }, Math.max(windowMs, 60000)).unref();

    return function rateLimiter(req, res, next) {
        const key = getClientIp(req);
        const now = Date.now();
        let entry = hits.get(key);
        if (!entry || entry.resetAt < now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }
        entry.count += 1;
        if (entry.count > max) {
            res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
            return res.status(429).json({ error: message || 'Ban thao tac qua nhanh. Vui long thu lai sau it phut.' });
        }
        next();
    };
}

const globalApiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 300,
    message: 'He thong dang nhan qua nhieu yeu cau tu ban. Vui long thu lai sau.'
});

const authLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: 30,
    message: 'Ban da thu qua nhieu lan. Vui long doi vai phut roi thu lai.'
});

const answerLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 180,
    message: 'Ban dang thao tac qua nhanh trong bai lam.'
});

// Tam khoa tai khoan sau nhieu lan dang nhap sai (chong do mat khau).
const loginFailTracker = new Map(); // username(lowercase) -> { count, lockedUntil, firstFailAt }
const LOGIN_FAIL_LIMIT = 8;
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

function getLoginLockStatus(usernameKey) {
    const entry = loginFailTracker.get(usernameKey);
    if (!entry) return { locked: false };
    if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
        return { locked: true, remainingMs: entry.lockedUntil - Date.now() };
    }
    return { locked: false };
}

function registerLoginFailure(usernameKey) {
    const now = Date.now();
    let entry = loginFailTracker.get(usernameKey);
    if (!entry || now - entry.firstFailAt > LOGIN_FAIL_WINDOW_MS) {
        entry = { count: 0, firstFailAt: now, lockedUntil: 0 };
    }
    entry.count += 1;
    if (entry.count >= LOGIN_FAIL_LIMIT) {
        entry.lockedUntil = now + LOGIN_LOCK_DURATION_MS;
    }
    loginFailTracker.set(usernameKey, entry);
}

function clearLoginFailures(usernameKey) {
    loginFailTracker.delete(usernameKey);
}

// "Tuong lua" don gian: tu dong chan IP neu dang nhap sai qua nhieu lan
// trong thoi gian ngan tren nhieu tai khoan khac nhau (dau hieu do quet).
const ipFailTracker = new Map();
const IP_AUTO_BLOCK_THRESHOLD = 40;
const IP_AUTO_BLOCK_WINDOW_MS = 15 * 60 * 1000;

async function registerIpAuthFailure(ip) {
    const now = Date.now();
    let entry = ipFailTracker.get(ip);
    if (!entry || now - entry.firstFailAt > IP_AUTO_BLOCK_WINDOW_MS) {
        entry = { count: 0, firstFailAt: now };
    }
    entry.count += 1;
    ipFailTracker.set(ip, entry);
    if (entry.count >= IP_AUTO_BLOCK_THRESHOLD && !isIpBlocked(ip)) {
        cache.blockedIps.push({
            ip,
            reason: 'Tu dong chan: qua nhieu lan xac thuc that bai trong thoi gian ngan (nghi van do quet mat khau)',
            blockedAt: Date.now(),
            blockedBy: 'he-thong-tu-dong'
        });
        await persist('blockedIps');
        log('Tuong lua: da tu dong chan IP nghi van do quet', { ip, count: entry.count });
    }
}

// ============================================================================
// CHONG GIA MAO YEU CAU LIEN TRANG (CSRF) - mau "double submit cookie"
// ============================================================================

const CSRF_COOKIE_NAME = 'csrfToken';

function ensureCsrfCookie(req, res, next) {
    let token = req.cookies[CSRF_COOKIE_NAME];
    if (!token) {
        token = generateToken(24);
        res.cookie(CSRF_COOKIE_NAME, token, {
            httpOnly: false, // JS phia client can doc duoc de gui lai qua header
            sameSite: 'lax',
            secure: IS_PRODUCTION,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        req.cookies[CSRF_COOKIE_NAME] = token;
    }
    next();
}

function verifyCsrf(req, res, next) {
    const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
    if (safeMethods.has(req.method)) return next();

    const cookieToken = req.cookies[CSRF_COOKIE_NAME];
    const headerToken = req.get('X-CSRF-Token');

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({ error: 'Yeu cau khong hop le hoac phien lam viec da cu. Vui long tai lai trang va thu lai.' });
    }
    next();
}

// ============================================================================
// TIEU DE BAO MAT HTTP
// ============================================================================

function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; " +
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
    );
    if (IS_PRODUCTION) {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    }
    next();
}

// ============================================================================
// MIDDLEWARE CHAN IP (phai dat TRUOC static & moi route khac)
// ============================================================================

async function checkBlockedIp(req, res, next) {
    if (req.path === '/blocked' || req.path === '/api/device-info' || req.path.startsWith('/assets/')) {
        return next();
    }
    const ip = getClientIp(req);
    if (isIpBlocked(ip)) {
        await logDeviceAccess(req, 'truy-cap-bi-chan');
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({ error: 'Dia chi IP cua ban da bi chan khoi he thong nay.' });
        }
        return res.redirect('/blocked');
    }
    next();
}

// ============================================================================
// KHOI TAO EXPRESS APP
// ============================================================================

app.disable('x-powered-by');
app.set('trust proxy', 1); // Render/Heroku... dat sau reverse proxy

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(securityHeaders);
app.use(ensureCsrfCookie);
app.use(checkBlockedIp);

if (DEBUG) {
    app.use((req, res, next) => {
        const info = getDeviceInfo(req);
        log(`${req.method} ${req.path}`, { ip: info.ip, device: `${info.deviceType} - ${info.os}`, browser: info.browser });
        next();
    });
}

app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), { maxAge: IS_PRODUCTION ? '1d' : 0 }));
app.use(express.static(path.join(__dirname, 'public'), { index: false, maxAge: IS_PRODUCTION ? '1h' : 0 }));

app.use('/api', globalApiLimiter);
app.use('/api', verifyCsrf);

// ============================================================================
// XAC THUC & PHAN QUYEN
// ============================================================================

async function authenticate(req, res, next) {
    const token = req.cookies.accessToken || (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Ban chua dang nhap.' });

    const session = cache.sessions[token];
    if (!session || session.expiresAt < Date.now()) {
        res.clearCookie('accessToken');
        return res.status(401).json({ error: 'Phien dang nhap da het han. Vui long dang nhap lai.' });
    }

    req.userId = session.userId;
    req.username = session.username;
    req.userRole = session.role || 'user';
    req.token = token;
    next();
}

function requireAdmin(req, res, next) {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Chi tai khoan Quan tri vien moi duoc thuc hien thao tac nay.' });
    }
    next();
}

function isAdminUsername(username) {
    return ADMIN_USERNAMES.includes(String(username || '').toLowerCase());
}

// ============================================================================
// DICH VU EMAIL (khong bat buoc)
// ============================================================================

let transporter = null;
let emailEnabled = false;

async function initializeEmailTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('- Email chua duoc cau hinh: tinh nang quen mat khau se bi tat.');
        emailEnabled = false;
        return false;
    }
    try {
        transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 15000,
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
            logger: false,
            debug: false
        });
        await Promise.race([
            transporter.verify(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Ket noi SMTP qua han (15 giay)')), 15000))
        ]);
        console.log(`- Dich vu email da san sang (${process.env.EMAIL_USER}).`);
        emailEnabled = true;
        return true;
    } catch (error) {
        console.log('- Khong the ket noi dich vu email - tinh nang quen mat khau se bi tat.');
        console.log('  Ly do:', error.message);
        transporter = null;
        emailEnabled = false;
        return false;
    }
}

// ============================================================================
// HAM HO TRO NGHIEP VU QUIZ
// ============================================================================

function nextQuizId() {
    return cache.quizzes.nextId;
}

function findQuiz(quizId) {
    return cache.quizzes.quizzes[quizId];
}

// Kiem tra du lieu cau hoi hop le - dung chung cho ca tao moi va cap nhat.
function validateQuestions(questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
        return 'Vui long them it nhat mot cau hoi.';
    }
    if (questions.length > 100) {
        return 'Moi quiz toi da 100 cau hoi.';
    }
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q || typeof q.question !== 'string' || !q.question.trim()) {
            return `Cau hoi ${i + 1}: vui long nhap noi dung cau hoi.`;
        }
        if (q.question.length > 1000) {
            return `Cau hoi ${i + 1}: noi dung qua dai (toi da 1000 ky tu).`;
        }
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
            return `Cau hoi ${i + 1}: can tu 2 den 6 dap an.`;
        }
        for (let j = 0; j < q.options.length; j++) {
            const opt = q.options[j];
            if (!opt || typeof opt.text !== 'string' || !opt.text.trim()) {
                return `Cau hoi ${i + 1}: dap an ${String.fromCharCode(65 + j)} khong duoc de trong.`;
            }
            if (opt.text.length > 500) {
                return `Cau hoi ${i + 1}: dap an ${String.fromCharCode(65 + j)} qua dai (toi da 500 ky tu).`;
            }
        }
        const correctCount = q.options.filter(o => o.isCorrect === true).length;
        if (correctCount !== 1) {
            return `Cau hoi ${i + 1}: phai chon dung 1 dap an dung.`;
        }
    }
    return null;
}

function sanitizeQuestionsForStorage(questions) {
    return questions.map(q => ({
        question: String(q.question).trim(),
        options: q.options.map(o => ({ text: String(o.text).trim(), isCorrect: o.isCorrect === true }))
    }));
}

function toPublicQuizSummary(quiz) {
    return {
        id: quiz.id,
        title: quiz.title,
        questionCount: quiz.questions.length,
        isPublic: quiz.isPublic,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt
    };
}

function cleanupOldAttempts() {
    const now = Date.now();
    const maxAgeMs = 24 * 60 * 60 * 1000;
    let changed = false;
    for (const [id, attempt] of Object.entries(cache.attempts)) {
        if (now - attempt.startedAt > maxAgeMs) {
            delete cache.attempts[id];
            changed = true;
        }
    }
    if (changed) persist('attempts');
}

// ============================================================================
// API: THONG TIN THIET BI (public - can cho trang /blocked)
// ============================================================================

app.get('/api/device-info', async (req, res) => {
    try {
        const deviceInfo = getDeviceInfo(req);
        res.json({ success: true, device: deviceInfo });
    } catch (error) {
        logError('Loi lay thong tin thiet bi', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

// ============================================================================
// API: QUAN TRI (CHI ADMIN) - chan/mo chan IP, xem nhat ky
// ============================================================================

app.get('/api/admin/overview', authenticate, requireAdmin, async (req, res) => {
    const userCount = Object.keys(cache.users).length;
    const quizCount = Object.keys(cache.quizzes.quizzes).length;
    const publicQuizCount = Object.values(cache.quizzes.quizzes).filter(q => q.isPublic).length;
    res.json({
        success: true,
        overview: {
            userCount,
            quizCount,
            publicQuizCount,
            blockedIpCount: cache.blockedIps.length,
            resultCount: cache.results.length
        }
    });
});

app.get('/api/admin/blocked-ips', authenticate, requireAdmin, async (req, res) => {
    res.json({ success: true, items: cache.blockedIps.slice().reverse() });
});

app.post('/api/admin/blocked-ips', authenticate, requireAdmin, async (req, res) => {
    try {
        const { ip, reason } = req.body || {};
        if (!ip || typeof ip !== 'string') {
            return res.status(400).json({ error: 'Vui long nhap dia chi IP can chan.' });
        }
        if (isIpBlocked(ip)) {
            return res.status(400).json({ error: 'Dia chi IP nay da bi chan truoc do.' });
        }
        const entry = { ip: ip.trim(), reason: (reason || 'Khong ro ly do').trim(), blockedAt: Date.now(), blockedBy: req.username };
        cache.blockedIps.push(entry);
        await persist('blockedIps');
        log('Quan tri vien da chan mot dia chi IP', entry);
        res.json({ success: true, message: 'Da chan dia chi IP.', item: entry });
    } catch (error) {
        logError('Loi chan IP', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.delete('/api/admin/blocked-ips/:ip', authenticate, requireAdmin, async (req, res) => {
    try {
        const ip = decodeURIComponent(req.params.ip);
        const before = cache.blockedIps.length;
        cache.blockedIps = cache.blockedIps.filter(b => b.ip !== ip);
        if (cache.blockedIps.length === before) {
            return res.status(404).json({ error: 'Khong tim thay dia chi IP nay trong danh sach chan.' });
        }
        await persist('blockedIps');
        log('Quan tri vien da mo chan mot dia chi IP', { ip, by: req.username });
        res.json({ success: true, message: 'Da mo chan dia chi IP.' });
    } catch (error) {
        logError('Loi mo chan IP', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.get('/api/admin/device-logs', authenticate, requireAdmin, async (req, res) => {
    res.json({ success: true, logs: cache.deviceLogs.slice(-200).reverse() });
});

// ============================================================================
// API: XAC THUC NGUOI DUNG (dang ky, dang nhap, quen mat khau...)
// ============================================================================

app.post('/api/register', authLimiter, async (req, res) => {
    try {
        const { username, password, fullname, email } = req.body || {};
        await logDeviceAccess(req, 'thu-dang-ky', { username, email });

        if (!username || !password || !fullname || !email) {
            return res.status(400).json({ error: 'Vui long dien day du thong tin.' });
        }
        if (!validateUsername(username)) {
            return res.status(400).json({ error: 'Ten dang nhap phai co 3-20 ky tu, chi gom chu cai khong dau, so va dau gach duoi (_).' });
        }
        if (!String(fullname).trim() || fullname.length > 100) {
            return res.status(400).json({ error: 'Ho va ten khong hop le.' });
        }
        if (!validatePassword(password)) {
            return res.status(400).json({ error: 'Mat khau phai co it nhat 6 ky tu.' });
        }
        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Email khong hop le.' });
        }

        const usernameKey = username.toLowerCase();
        const existing = Object.values(cache.users).find(u => u.username.toLowerCase() === usernameKey);
        if (existing) {
            return res.status(400).json({ error: 'Ten dang nhap da ton tai.' });
        }
        const emailExists = Object.values(cache.users).some(u => u.email.toLowerCase() === email.toLowerCase());
        if (emailExists) {
            return res.status(400).json({ error: 'Email nay da duoc su dung.' });
        }

        const existingIds = Object.values(cache.users).map(u => parseInt(u.id, 10)).filter(id => !isNaN(id));
        const userId = String(existingIds.length ? Math.max(...existingIds) + 1 : 1);
        const isFirstUser = Object.keys(cache.users).length === 0;
        const role = (isFirstUser || isAdminUsername(username)) ? 'admin' : 'user';

        const passwordHash = await hashPassword(password);
        const deviceInfo = getDeviceInfo(req);

        cache.users[username] = {
            id: userId,
            username,
            fullname: String(fullname).trim(),
            email: email.toLowerCase(),
            password: passwordHash,
            role,
            createdAt: Date.now(),
            registeredFrom: deviceInfo
        };
        await persist('users');

        log('Dang ky thanh cong', { username, userId, role });
        res.json({ success: true, message: 'Dang ky thanh cong! Vui long dang nhap.' });
    } catch (error) {
        logError('Loi dang ky', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.post('/api/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const ip = getClientIp(req);
        await logDeviceAccess(req, 'thu-dang-nhap', { username });

        if (!username || !password) {
            return res.status(400).json({ error: 'Vui long dien day du thong tin.' });
        }

        const usernameKey = String(username).toLowerCase();
        const lockStatus = getLoginLockStatus(usernameKey);
        if (lockStatus.locked) {
            const minutes = Math.ceil(lockStatus.remainingMs / 60000);
            return res.status(429).json({ error: `Tai khoan tam thoi bi khoa do dang nhap sai nhieu lan. Vui long thu lai sau khoang ${minutes} phut.` });
        }

        const user = cache.users[username] || Object.values(cache.users).find(u => u.username.toLowerCase() === usernameKey);
        const verifyResult = user ? await verifyPassword(password, user.password) : false;

        if (!user || !verifyResult) {
            registerLoginFailure(usernameKey);
            await registerIpAuthFailure(ip);
            return res.status(401).json({ error: 'Ten dang nhap hoac mat khau khong dung.' });
        }

        // Neu mat khau con o dinh dang cu (sha256), tu dong nang cap len scrypt.
        if (verifyResult === 'legacy') {
            user.password = await hashPassword(password);
            await persist('users');
        }

        clearLoginFailures(usernameKey);

        const role = isAdminUsername(user.username) ? 'admin' : (user.role || 'user');
        if (role !== user.role) { user.role = role; await persist('users'); }

        const token = generateToken();
        const sessionId = generateToken(8);
        const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
        const deviceInfo = getDeviceInfo(req);

        cache.sessions[token] = {
            sessionId,
            userId: user.id,
            username: user.username,
            fullname: user.fullname,
            role,
            createdAt: Date.now(),
            expiresAt,
            deviceInfo
        };
        await persist('sessions');

        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: IS_PRODUCTION,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });

        log('Dang nhap thanh cong', { username, device: `${deviceInfo.deviceType} - ${deviceInfo.os}` });
        res.json({ success: true, user: { username: user.username, fullname: user.fullname, role } });
    } catch (error) {
        logError('Loi dang nhap', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.get('/api/verify', authenticate, async (req, res) => {
    res.json({ success: true, user: { username: req.username, userId: req.userId, role: req.userRole } });
});

app.get('/api/profile', authenticate, async (req, res) => {
    const user = cache.users[req.username];
    if (!user) return res.status(404).json({ error: 'Khong tim thay tai khoan.' });
    res.json({
        success: true,
        profile: {
            username: user.username,
            fullname: user.fullname,
            email: user.email,
            role: req.userRole,
            createdAt: user.createdAt
        }
    });
});

app.post('/api/logout', authenticate, async (req, res) => {
    try {
        delete cache.sessions[req.token];
        await persist('sessions');
        res.clearCookie('accessToken');
        res.json({ success: true });
    } catch (error) {
        logError('Loi dang xuat', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.post('/api/logout-all', authenticate, async (req, res) => {
    try {
        for (const [token, session] of Object.entries(cache.sessions)) {
            if (session.userId === req.userId) delete cache.sessions[token];
        }
        await persist('sessions');
        res.clearCookie('accessToken');
        res.json({ success: true, message: 'Da dang xuat khoi tat ca thiet bi.' });
    } catch (error) {
        logError('Loi dang xuat toan bo', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.get('/api/sessions', authenticate, async (req, res) => {
    const list = Object.entries(cache.sessions)
        .filter(([, s]) => s.userId === req.userId)
        .map(([token, s]) => ({
            sessionId: s.sessionId,
            device: `${s.deviceInfo?.deviceType || 'Khong ro'} - ${s.deviceInfo?.os || ''}`.trim(),
            browser: s.deviceInfo?.browser || 'Khong ro',
            ip: s.deviceInfo?.ip || 'Khong ro',
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
            current: token === req.token
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
    res.json({ success: true, sessions: list });
});

app.post('/api/sessions/:sessionId/revoke', authenticate, async (req, res) => {
    const { sessionId } = req.params;
    let found = false;
    for (const [token, s] of Object.entries(cache.sessions)) {
        if (s.userId === req.userId && s.sessionId === sessionId) {
            delete cache.sessions[token];
            found = true;
        }
    }
    if (!found) return res.status(404).json({ error: 'Khong tim thay phien dang nhap nay.' });
    await persist('sessions');
    res.json({ success: true, message: 'Da dang xuat phien do.' });
});

app.post('/api/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Vui long dien day du thong tin.' });
        }
        if (!validatePassword(newPassword)) {
            return res.status(400).json({ error: 'Mat khau moi phai co it nhat 6 ky tu.' });
        }
        const user = cache.users[req.username];
        if (!user) return res.status(404).json({ error: 'Khong tim thay tai khoan.' });

        const ok = await verifyPassword(currentPassword, user.password);
        if (!ok) return res.status(401).json({ error: 'Mat khau hien tai khong dung.' });

        user.password = await hashPassword(newPassword);
        await persist('users');
        log('Doi mat khau thanh cong', { username: req.username });
        res.json({ success: true, message: 'Doi mat khau thanh cong.' });
    } catch (error) {
        logError('Loi doi mat khau', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.post('/api/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body || {};
        await logDeviceAccess(req, 'yeu-cau-quen-mat-khau', { email });

        if (!email || !validateEmail(email)) {
            return res.status(400).json({ error: 'Email khong hop le.' });
        }
        if (!emailEnabled || !transporter) {
            return res.status(503).json({ error: 'Dich vu email chua duoc cau hinh. Vui long lien he quan tri vien.', emailDisabled: true });
        }

        const user = Object.values(cache.users).find(u => u.email.toLowerCase() === email.toLowerCase());
        // Luon tra ve thong bao giong nhau du email co ton tai hay khong,
        // de tranh lo thong tin "email nay co dang ky hay chua" (user enumeration).
        const genericMessage = 'Neu email ton tai trong he thong, mot lien ket dat lai mat khau se duoc gui toi hop thu cua ban. Lien ket co hieu luc trong 5 phut.';

        if (!user) {
            return res.json({ success: true, message: genericMessage });
        }

        const resetToken = generateToken();
        cache.resetTokens[resetToken] = {
            userId: user.id,
            username: user.username,
            email: user.email,
            expiresAt: Date.now() + (5 * 60 * 1000)
        };
        await persist('resetTokens');

        const resetUrl = `${BASE_URL}/oauth/resetpassword/${resetToken}`;
        const safeName = escapeHtml(user.fullname);

        const mailOptions = {
            from: `"Quiz Master" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Dat lai mat khau - Quiz Master',
            html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f7fa;margin:0;padding:40px 20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1)">
<div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:40px;text-align:center">
<h1 style="color:white;margin:0;font-size:26px">Dat lai mat khau</h1>
</div>
<div style="padding:40px">
<p>Xin chao <strong>${safeName}</strong>,</p>
<p>Chung toi nhan duoc yeu cau dat lai mat khau cho tai khoan Quiz Master cua ban. Nhan vao nut ben duoi de tiep tuc:</p>
<div style="text-align:center;margin:30px 0">
<a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:16px 48px;text-decoration:none;border-radius:12px;font-weight:600">Dat lai mat khau</a>
</div>
<p style="color:#92400e;background:#fef3c7;padding:16px;border-radius:8px;border-left:4px solid #f59e0b">
<strong>Luu y:</strong> Lien ket chi co hieu luc trong <strong>5 phut</strong>. Neu ban khong yeu cau, vui long bo qua email nay.
</p>
</div>
</div>
</body></html>`
        };

        await transporter.sendMail(mailOptions);
        log('Da gui email dat lai mat khau', { to: email });
        res.json({ success: true, message: genericMessage });
    } catch (error) {
        logError('Loi quen mat khau', error);
        res.status(500).json({ error: 'Khong the gui email luc nay. Vui long thu lai sau.' });
    }
});

app.post('/api/reset-password', authLimiter, async (req, res) => {
    try {
        const { token, newPassword } = req.body || {};
        if (!token || !newPassword) return res.status(400).json({ error: 'Thieu thong tin.' });
        if (!validatePassword(newPassword)) return res.status(400).json({ error: 'Mat khau phai co it nhat 6 ky tu.' });

        const resetData = cache.resetTokens[token];
        if (!resetData) return res.status(400).json({ error: 'Lien ket khong hop le hoac da duoc su dung.' });

        if (resetData.expiresAt < Date.now()) {
            delete cache.resetTokens[token];
            await persist('resetTokens');
            return res.status(400).json({ error: 'Lien ket da het han. Vui long yeu cau lai.' });
        }

        const user = cache.users[resetData.username];
        if (user) {
            user.password = await hashPassword(newPassword);
            await persist('users');
        }

        delete cache.resetTokens[token];
        await persist('resetTokens');

        for (const [sessToken, sessData] of Object.entries(cache.sessions)) {
            if (sessData.username === resetData.username) delete cache.sessions[sessToken];
        }
        await persist('sessions');

        log('Dat lai mat khau thanh cong', { username: resetData.username });
        res.json({ success: true, message: 'Dat lai mat khau thanh cong. Vui long dang nhap lai.' });
    } catch (error) {
        logError('Loi dat lai mat khau', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

// ============================================================================
// API: QUAN LY QUIZ
// ============================================================================

app.post('/api/quiz/create', authenticate, async (req, res) => {
    try {
        const { title, questions, isPublic } = req.body || {};
        if (!title || !String(title).trim()) {
            return res.status(400).json({ error: 'Vui long nhap tieu de quiz.' });
        }
        if (String(title).length > 200) {
            return res.status(400).json({ error: 'Tieu de qua dai (toi da 200 ky tu).' });
        }
        const validationError = validateQuestions(questions);
        if (validationError) return res.status(400).json({ error: validationError });

        const quizId = nextQuizId();
        const quiz = {
            id: quizId,
            title: String(title).trim(),
            author: req.username,
            authorId: req.userId,
            questions: sanitizeQuestionsForStorage(questions),
            isPublic: isPublic === true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        cache.quizzes.quizzes[quizId] = quiz;
        cache.quizzes.nextId = quizId + 1;
        await persist('quizzes');

        log('Da tao quiz moi', { quizId, title: quiz.title, author: req.username });
        res.json({ success: true, quizId, message: 'Tao quiz thanh cong!' });
    } catch (error) {
        logError('Loi tao quiz', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.get('/api/quiz/my-activities', authenticate, async (req, res) => {
    try {
        const myQuizzes = Object.values(cache.quizzes.quizzes)
            .filter(q => q.authorId === req.userId)
            .sort((a, b) => b.createdAt - a.createdAt)
            .map(toPublicQuizSummary);
        res.json({ success: true, quizzes: myQuizzes });
    } catch (error) {
        logError('Loi lay danh sach quiz cua toi', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

// Lay thong tin 1 quiz. Neu nguoi goi la chu so huu VA gui header
// "X-Request-Full-Data: true" thi tra ve du lieu day du (bao gom dap an
// dung) de phuc vu man hinh chinh sua. QUAN TRONG: truong "isOwner" luon
// duoc dinh kem ro rang trong moi truong hop - day chinh la cho ma phien
// ban truoc thieu, khien man hinh Sua quiz luon bao "khong co quyen".
app.get('/api/quiz/:id', async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const quiz = findQuiz(quizId);
        if (!quiz) return res.status(404).json({ error: 'Khong tim thay quiz.' });

        const token = req.cookies.accessToken || (req.headers.authorization || '').replace('Bearer ', '');
        const session = token ? cache.sessions[token] : null;
        const isValidSession = session && session.expiresAt >= Date.now();
        const isOwner = Boolean(isValidSession && session.userId === quiz.authorId);

        if (!quiz.isPublic && !isOwner) {
            return res.status(404).json({ error: 'Khong tim thay quiz.' });
        }

        if (req.get('X-Request-Full-Data') === 'true' && isOwner) {
            return res.json({
                success: true,
                quiz: { ...quiz, isOwner: true }
            });
        }

        const safeQuiz = {
            id: quiz.id,
            title: quiz.title,
            author: quiz.author,
            questionCount: quiz.questions.length,
            isPublic: quiz.isPublic,
            isOwner,
            questions: quiz.questions.map((q, idx) => ({
                index: idx,
                question: q.question,
                options: q.options.map(o => ({ text: o.text }))
            }))
        };
        res.json({ success: true, quiz: safeQuiz });
    } catch (error) {
        logError('Loi lay thong tin quiz', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.put('/api/quiz/:id', authenticate, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const { title, questions, isPublic } = req.body || {};
        const quiz = findQuiz(quizId);

        if (!quiz) return res.status(404).json({ error: 'Khong tim thay quiz.' });
        if (quiz.authorId !== req.userId) {
            return res.status(403).json({ error: 'Ban khong co quyen chinh sua quiz nay.' });
        }

        if (title !== undefined) {
            if (!String(title).trim()) return res.status(400).json({ error: 'Tieu de khong duoc de trong.' });
            if (String(title).length > 200) return res.status(400).json({ error: 'Tieu de qua dai (toi da 200 ky tu).' });
            quiz.title = String(title).trim();
        }

        if (questions !== undefined) {
            const validationError = validateQuestions(questions);
            if (validationError) return res.status(400).json({ error: validationError });
            quiz.questions = sanitizeQuestionsForStorage(questions);
        }

        if (typeof isPublic === 'boolean') {
            quiz.isPublic = isPublic;
        }

        quiz.updatedAt = Date.now();
        await persist('quizzes');

        log('Da cap nhat quiz', { quizId });
        res.json({ success: true, message: 'Cap nhat quiz thanh cong!' });
    } catch (error) {
        logError('Loi cap nhat quiz', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.delete('/api/quiz/:id', authenticate, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const quiz = findQuiz(quizId);
        if (!quiz) return res.status(404).json({ error: 'Khong tim thay quiz.' });
        if (quiz.authorId !== req.userId) {
            return res.status(403).json({ error: 'Ban khong co quyen xoa quiz nay.' });
        }
        delete cache.quizzes.quizzes[quizId];
        await persist('quizzes');
        log('Da xoa quiz', { quizId });
        res.json({ success: true, message: 'Xoa quiz thanh cong!' });
    } catch (error) {
        logError('Loi xoa quiz', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.post('/api/quiz/:id/duplicate', authenticate, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const originalQuiz = findQuiz(quizId);
        if (!originalQuiz) return res.status(404).json({ error: 'Khong tim thay quiz.' });
        if (originalQuiz.authorId !== req.userId) {
            return res.status(403).json({ error: 'Ban khong co quyen nhan doi quiz nay.' });
        }

        const newQuizId = nextQuizId();
        const newQuiz = {
            ...originalQuiz,
            id: newQuizId,
            title: originalQuiz.title + ' (Ban sao)',
            // Ban sao luon o che do rieng tu ban dau de chu quiz tu xem lai
            // truoc khi quyet dinh cong khai - tranh vo tinh cong khai noi
            // dung con dang chinh sua.
            isPublic: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        cache.quizzes.quizzes[newQuizId] = newQuiz;
        cache.quizzes.nextId = newQuizId + 1;
        await persist('quizzes');

        log('Da nhan doi quiz', { originalId: quizId, newId: newQuizId });
        res.json({ success: true, quizId: newQuizId, message: 'Nhan doi quiz thanh cong!' });
    } catch (error) {
        logError('Loi nhan doi quiz', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

// ----------------------------------------------------------------------------
// CHONG GIAN LAN: he thong "luot lam bai" (attempt) do SERVER quan ly
// ----------------------------------------------------------------------------

app.post('/api/quiz/:id/start', authenticate, answerLimiter, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const quiz = findQuiz(quizId);
        if (!quiz) return res.status(404).json({ error: 'Khong tim thay quiz.' });

        const isOwner = quiz.authorId === req.userId;
        if (!quiz.isPublic && !isOwner) return res.status(404).json({ error: 'Khong tim thay quiz.' });
        if (quiz.questions.length === 0) return res.status(400).json({ error: 'Quiz nay chua co cau hoi nao.' });

        const attemptId = generateToken(16);
        cache.attempts[attemptId] = {
            attemptId,
            quizId,
            userId: req.userId,
            username: req.username,
            startedAt: Date.now(),
            answers: {},
            finished: false
        };
        await persist('attempts');
        cleanupOldAttempts();

        res.json({ success: true, attemptId, startedAt: cache.attempts[attemptId].startedAt });
    } catch (error) {
        logError('Loi bat dau luot lam bai', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.post('/api/quiz/:id/check-answer', authenticate, answerLimiter, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const { attemptId, questionIndex, selectedOption } = req.body || {};

        const quiz = findQuiz(quizId);
        if (!quiz) return res.status(404).json({ error: 'Khong tim thay quiz.' });

        const attempt = cache.attempts[attemptId];
        if (!attempt || attempt.quizId !== quizId || attempt.userId !== req.userId) {
            return res.status(400).json({ error: 'Luot lam bai khong hop le. Vui long tai lai trang de bat dau lai.' });
        }
        if (attempt.finished) {
            return res.status(400).json({ error: 'Luot lam bai nay da hoan thanh.' });
        }

        const question = quiz.questions[questionIndex];
        if (!question || typeof selectedOption !== 'number') {
            return res.status(400).json({ error: 'Du lieu cau tra loi khong hop le.' });
        }

        // Bat buoc tra loi dung tuan tu: phai giai xong cau truoc do moi
        // duoc phep gui dap an cho cau hien tai (chong goi thang API de do
        // dap an cua mot cau bat ky ma khong lam cac cau truoc).
        if (questionIndex > 0 && !attempt.answers[questionIndex - 1]?.solved) {
            return res.status(400).json({ error: 'Ban can tra loi dung cac cau truoc do.' });
        }

        let answerState = attempt.answers[questionIndex];
        if (!answerState) {
            answerState = { wrongAttempts: [], solved: false, solvedAt: null };
            attempt.answers[questionIndex] = answerState;
        }

        if (answerState.solved) {
            return res.json({ success: true, isCorrect: true, alreadySolved: true });
        }

        const correctIndex = question.options.findIndex(o => o.isCorrect);
        const isCorrect = selectedOption === correctIndex;

        if (isCorrect) {
            answerState.solved = true;
            answerState.solvedAt = Date.now();
            await persist('attempts');
            return res.json({ success: true, isCorrect: true, correctIndex });
        }

        if (!answerState.wrongAttempts.includes(selectedOption)) {
            answerState.wrongAttempts.push(selectedOption);
            await persist('attempts');
        }
        // QUAN TRONG: KHONG tra ve correctIndex khi tra loi sai, tranh lo dap
        // an qua API truoc khi nguoi dung thuc su tra loi dung.
        return res.json({ success: true, isCorrect: false });
    } catch (error) {
        logError('Loi kiem tra dap an', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.post('/api/quiz/:id/finish', authenticate, answerLimiter, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const { attemptId } = req.body || {};

        const quiz = findQuiz(quizId);
        if (!quiz) return res.status(404).json({ error: 'Khong tim thay quiz.' });

        const attempt = cache.attempts[attemptId];
        if (!attempt || attempt.quizId !== quizId || attempt.userId !== req.userId) {
            return res.status(400).json({ error: 'Luot lam bai khong hop le.' });
        }
        if (attempt.finished) {
            return res.status(400).json({ error: 'Luot lam bai nay da duoc nop truoc do.' });
        }

        const totalQuestions = quiz.questions.length;
        for (let i = 0; i < totalQuestions; i++) {
            if (!attempt.answers[i]?.solved) {
                return res.status(400).json({ error: 'Ban can hoan thanh tat ca cac cau hoi truoc khi nop bai.' });
            }
        }

        // Toan bo thoi gian deu tinh tu dong ho CUA SERVER (khong tin du
        // lieu thoi gian tu trinh duyet), nen khong the gia mao qua Console.
        const perQuestionMs = [];
        let previousTs = attempt.startedAt;
        for (let i = 0; i < totalQuestions; i++) {
            const solvedAt = attempt.answers[i].solvedAt;
            perQuestionMs.push(Math.max(0, solvedAt - previousTs));
            previousTs = solvedAt;
        }

        const totalTimeMs = previousTs - attempt.startedAt;
        const avgMs = perQuestionMs.reduce((a, b) => a + b, 0) / perQuestionMs.length;
        const fastestMs = Math.min(...perQuestionMs);
        const slowestMs = Math.max(...perQuestionMs);

        const toSeconds = ms => Math.round(ms / 1000);

        attempt.finished = true;
        attempt.finishedAt = Date.now();
        await persist('attempts');

        const result = {
            resultId: generateToken(8),
            username: req.username,
            userId: req.userId,
            quizId,
            quizTitle: quiz.title,
            totalTime: toSeconds(totalTimeMs),
            avgTime: toSeconds(avgMs),
            fastestTime: toSeconds(fastestMs),
            slowestTime: toSeconds(slowestMs),
            questionCount: totalQuestions,
            completedAt: Date.now(),
            attemptId
        };
        cache.results.push(result);
        await persist('results');

        log('Da hoan thanh bai lam', { username: req.username, quizId, totalTime: result.totalTime });
        res.json({ success: true, result });
    } catch (error) {
        logError('Loi nop bai', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.get('/api/quiz/:id/leaderboard', async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const quiz = findQuiz(quizId);
        if (!quiz) return res.status(404).json({ error: 'Khong tim thay quiz.' });

        const token = req.cookies.accessToken || (req.headers.authorization || '').replace('Bearer ', '');
        const session = token ? cache.sessions[token] : null;
        const isValidSession = session && session.expiresAt >= Date.now();
        const isOwner = Boolean(isValidSession && session.userId === quiz.authorId);

        if (!quiz.isPublic && !isOwner) return res.status(404).json({ error: 'Khong tim thay quiz.' });

        const quizResults = cache.results.filter(r => r.quizId === quizId);
        const bestByUser = new Map();
        for (const r of quizResults) {
            const existing = bestByUser.get(r.userId);
            if (!existing || r.totalTime < existing.totalTime) bestByUser.set(r.userId, r);
        }

        const ranking = Array.from(bestByUser.values())
            .sort((a, b) => a.totalTime - b.totalTime)
            .slice(0, 20)
            .map((r, idx) => ({
                rank: idx + 1,
                username: r.username,
                totalTime: r.totalTime,
                avgTime: r.avgTime,
                completedAt: r.completedAt
            }));

        let yourBest = null;
        if (isValidSession) {
            const mine = bestByUser.get(session.userId);
            if (mine) {
                const rank = Array.from(bestByUser.values())
                    .sort((a, b) => a.totalTime - b.totalTime)
                    .findIndex(r => r.userId === session.userId) + 1;
                yourBest = { totalTime: mine.totalTime, avgTime: mine.avgTime, rank };
            }
        }

        res.json({ success: true, quizTitle: quiz.title, ranking, yourBest });
    } catch (error) {
        logError('Loi lay bang xep hang', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

app.get('/api/results', authenticate, async (req, res) => {
    try {
        const results = cache.results
            .filter(r => r.userId === req.userId || r.username === req.username)
            .sort((a, b) => b.completedAt - a.completedAt)
            .slice(0, 100);
        res.json({ success: true, results });
    } catch (error) {
        logError('Loi lay ket qua', error);
        res.status(500).json({ error: 'Loi may chu.' });
    }
});

// ============================================================================
// CAC TRANG (PAGE ROUTES)
// ============================================================================

function sendPage(fileName) {
    return (req, res) => res.sendFile(path.join(__dirname, 'public', fileName));
}

app.get('/', sendPage('home.html'));
app.get('/login', sendPage('login.html'));
app.get('/blocked', sendPage('blocked.html'));
app.get('/create', sendPage('create.html'));
app.get('/myactivities', sendPage('myactivities.html'));
app.get('/settings', sendPage('settings.html'));
app.get('/admin', sendPage('admin.html'));
app.get('/create/edit/:id', sendPage('edit.html'));
app.get('/quiz/:id/:title?', sendPage('quiz.html'));
app.get('/leaderboard/:id', sendPage('leaderboard.html'));
app.get('/share/quiz/:id', sendPage('share.html'));
app.get('/oauth/resetpassword/:token', sendPage('reset-password.html'));

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ============================================================================
// KHOI DONG MAY CHU
// ============================================================================

async function startServer() {
    try {
        console.log('===================================================');
        console.log(' Dang khoi dong Quiz Master...');
        console.log('===================================================');

        await loadAllData();
        console.log('- Da nap du lieu vao bo nho dem (cache).');

        await initializeEmailTransporter();

        app.listen(PORT, () => {
            console.log('===================================================');
            console.log(`- May chu dang chay tai cong: ${PORT}`);
            console.log(`- Che do Debug: ${DEBUG ? 'BAT' : 'TAT'}`);
            console.log(`- Moi truong: ${process.env.NODE_ENV || 'development'}`);
            console.log(`- Dich vu Email: ${emailEnabled ? 'BAT' : 'TAT'}`);
            console.log(`- Discord webhook: ${DISCORD_WEBHOOK ? 'BAT' : 'TAT'}`);
            console.log('===================================================');
            console.log(' Quiz Master da san sang!');
        });
    } catch (error) {
        logError('Khong the khoi dong may chu', error);
        process.exit(1);
    }
}

let shuttingDown = false;
async function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\nNhan tin hieu ${signal}, dang luu du lieu tu bo nho dem xuong o dia...`);
    try {
        await flushAllToDisk();
        console.log('Da luu xong du lieu. Thoat chuong trinh.');
    } catch (error) {
        console.error('Loi khi luu du lieu truoc khi thoat:', error.message);
    } finally {
        process.exit(0);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
