#!/bin/bash

# Create quiz.js with all quiz logic
cat > public/js/quiz.js << 'EOFQUIZ'
const questions = [
    { id: 1, question: "Python sử dụng gì để xác định khối lệnh?", options: ["Khoảng trắng thụt đầu dòng", "Dấu ngoặc nhọn {}", "Dấu chấm phẩy ;", "Dấu gạch ngang –"], correct: 0 },
    { id: 2, question: "Lệnh nào dùng để in dữ liệu ra màn hình?", options: ["echo()", "output()", "print()", "show()"], correct: 2 },
    { id: 3, question: "Đoạn mã if 5 > 3: cần điều gì để tránh lỗi?", options: ["Thụt đầu dòng phía sau", "Đóng ngoặc ; ở cuối", "Đặt dấu {} bao quanh", "Viết thêm dấu nháy \"\""], correct: 0 },
    { id: 4, question: "Câu lệnh nào tạo vòng lặp 5 lần?", options: ["for i in range(0, 6)", "for i in range(5)", "for i in 1..5", "loop (5)"], correct: 1 },
    { id: 5, question: "Trong Python, biến dùng để làm gì?", options: ["Lưu trữ dữ liệu tạm thời", "Chứa mã lệnh Python", "Lưu hình ảnh và file", "Tạo thư mục mới"], correct: 0 }
];

let currentQuestion = 0;
let startTime = Date.now();
let timerInterval;
let questionStartTime = Date.now();
let timePerQuestion = [];
let userAnswers = {};
let shuffledQuestions = [];

function initializeQuestions() {
    shuffledQuestions = questions.map(q => {
        const indices = [0, 1, 2, 3];
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const shuffledOptions = indices.map(i => q.options[i]);
        const newCorrectIndex = indices.indexOf(q.correct);
        return { ...q, options: shuffledOptions, correct: newCorrectIndex };
    });
}

function startTimer() {
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('timer').textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }, 1000);
}

function displayQuestion() {
    const q = shuffledQuestions[currentQuestion];
    const userAnswer = userAnswers[currentQuestion];
    document.getElementById('currentQ').textContent = currentQuestion + 1;
    document.getElementById('totalQ').textContent = questions.length;
    document.getElementById('progress').style.width = ((currentQuestion) / questions.length) * 100 + '%';
    let optionsHTML = '';
    for (let idx = 0; idx < q.options.length; idx++) {
        let classes = 'option';
        let clickable = true;
        if (userAnswer !== undefined) {
            if (idx === q.correct) classes += ' correct';
            if (userAnswer.wrongAttempts && userAnswer.wrongAttempts.includes(idx)) classes += ' wrong';
            if (userAnswer.correctAnswer !== undefined) { classes += ' disabled'; clickable = false; }
        }
        const onclickAttr = clickable ? 'onclick="checkAnswer(' + idx + ')"' : '';
        optionsHTML += '<div class="' + classes + '" ' + onclickAttr + '><div class="option-label">' + String.fromCharCode(65 + idx) + '</div><div>' + q.options[idx] + '</div></div>';
    }
    const isAnswered = userAnswer && userAnswer.correctAnswer !== undefined;
    const prevDisabled = currentQuestion === 0 ? 'disabled' : '';
    const nextDisabled = !isAnswered ? 'disabled' : '';
    document.getElementById('quizArea').innerHTML = '<div class="question-card"><div class="question-text">' + q.question + '</div><div class="options-grid">' + optionsHTML + '</div><div class="quiz-navigation"><button class="nav-button prev" onclick="prevQuestion()" ' + prevDisabled + '>← Quay lại</button><button class="nav-button next" onclick="nextQuestion()" ' + nextDisabled + '>Tiếp tục →</button></div></div>';
}

function checkAnswer(selected) {
    const q = shuffledQuestions[currentQuestion];
    const userAnswer = userAnswers[currentQuestion] || { wrongAttempts: [] };
    if (userAnswer.correctAnswer !== undefined) return;
    if (userAnswer.wrongAttempts.includes(selected)) return;
    const options = document.querySelectorAll('.option');
    if (selected === q.correct) {
        options[selected].classList.add('correct');
        const questionTime = Math.floor((Date.now() - questionStartTime) / 1000);
        timePerQuestion[currentQuestion] = questionTime;
        userAnswers[currentQuestion] = { ...userAnswer, correctAnswer: selected };
        options.forEach(opt => opt.classList.add('disabled'));
        document.querySelector('.nav-button.next').disabled = false;
    } else {
        options[selected].classList.add('wrong');
        userAnswer.wrongAttempts.push(selected);
        userAnswers[currentQuestion] = userAnswer;
        options[selected].style.pointerEvents = 'none';
    }
}

function prevQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        displayQuestion();
    }
}

function nextQuestion() {
    if (currentQuestion < questions.length - 1) {
        currentQuestion++;
        questionStartTime = Date.now();
        displayQuestion();
    } else {
        showResults();
    }
}

async function showResults() {
    clearInterval(timerInterval);
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;
    const validTimes = timePerQuestion.filter(t => t !== undefined);
    const avgTime = validTimes.length > 0 ? Math.floor(validTimes.reduce((a, b) => a + b, 0) / validTimes.length) : 0;
    const fastestTime = validTimes.length > 0 ? Math.min(...validTimes) : 0;
    const slowestTime = validTimes.length > 0 ? Math.max(...validTimes) : 0;
    try {
        await fetch('/api/save-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ totalTime, avgTime, fastestTime, slowestTime })
        });
    } catch (error) {}
    document.getElementById('quizStats').style.display = 'none';
    document.querySelector('.progress-bar').style.display = 'none';
    document.getElementById('quizArea').innerHTML = '<div class="result-screen"><div class="result-icon">🏆</div><h1 class="result-title">Chúc mừng!</h1><p>Bạn đã hoàn thành bài trắc nghiệm</p><div class="result-time">' + minutes + ':' + String(seconds).padStart(2, '0') + '</div><div class="result-stats"><div class="result-stat"><div class="result-stat-label">Thời gian trung bình</div><div class="result-stat-value">' + avgTime + 's</div></div><div class="result-stat"><div class="result-stat-label">Câu nhanh nhất</div><div class="result-stat-value">' + fastestTime + 's</div></div><div class="result-stat"><div class="result-stat-label">Câu chậm nhất</div><div class="result-stat-value">' + slowestTime + 's</div></div></div><div class="result-buttons"><button class="btn btn-primary" onclick="location.reload()">Làm lại</button><button class="btn btn-secondary" onclick="window.location.href=\'/\'">Về trang chủ</button></div></div>';
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        document.body.classList.add('fullscreen-mode');
    } else {
        document.exitFullscreen();
        document.body.classList.remove('fullscreen-mode');
    }
}

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        document.body.classList.remove('fullscreen-mode');
    }
});

function quit() {
    if (confirm('Bạn có chắc muốn thoát? Tiến độ sẽ không được lưu.')) {
        window.location.href = '/';
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/verify');
        if (!response.ok) {
            window.location.href = '/login';
            return;
        }
        const result = await response.json();
        document.getElementById('username').textContent = result.user.username;
        initializeQuestions();
        displayQuestion();
        startTimer();
    } catch (error) {
        window.location.href = '/login';
    }
});
EOFQUIZ

# Create reset-password.html
cat > public/reset-password.html << 'EOFRESET'
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Đặt lại mật khẩu - Quiz Master</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/style.css">
    <link rel="stylesheet" href="/css/auth.css">
</head>
<body class="auth-page">
    <div class="auth-container">
        <div class="auth-card">
            <div class="auth-header">
                <div class="logo">
                    <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
                        <rect width="32" height="32" rx="8" fill="#6366f1"/>
                        <path d="M16 8L22 12V20L16 24L10 20V12L16 8Z" fill="white"/>
                    </svg>
                </div>
                <h1>Đặt lại mật khẩu</h1>
                <p>Nhập mật khẩu mới của bạn</p>
            </div>
            <div id="message" class="message"></div>
            <form id="resetForm" class="auth-form active">
                <div class="form-group">
                    <label class="form-label">Mật khẩu mới</label>
                    <input type="password" class="form-input" id="newPassword" minlength="6" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Xác nhận mật khẩu</label>
                    <input type="password" class="form-input" id="confirmPassword" minlength="6" required>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Đặt lại mật khẩu</button>
            </form>
            <div class="auth-footer">
                <a href="/login" class="link-button">← Quay lại đăng nhập</a>
            </div>
        </div>
    </div>
    <script>
        function showMessage(text, type) {
            const msg = document.getElementById('message');
            msg.textContent = text;
            msg.className = 'message ' + type + ' show';
        }
        document.getElementById('resetForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            if (newPassword !== confirmPassword) {
                showMessage('Mật khẩu xác nhận không khớp', 'error');
                return;
            }
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            if (!token) {
                showMessage('Link không hợp lệ', 'error');
                return;
            }
            try {
                const response = await fetch('/api/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, newPassword })
                });
                const result = await response.json();
                if (result.success) {
                    showMessage(result.message, 'success');
                    setTimeout(() => window.location.href = '/login', 2000);
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                showMessage('Lỗi kết nối', 'error');
            }
        });
    </script>
</body>
</html>
EOFRESET

# Create 404.html
cat > public/404.html << 'EOF404'
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - Not Found</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/style.css">
    <style>
        .error-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
        }
        .error-content h1 {
            font-size: 120px;
            font-weight: 700;
            color: var(--primary);
            margin: 0;
        }
        .error-content h2 {
            font-size: 32px;
            margin: 20px 0;
        }
        .error-content p {
            color: var(--gray);
            margin-bottom: 32px;
        }
    </style>
</head>
<body>
    <div class="error-page">
        <div class="error-content">
            <h1>404</h1>
            <h2>Trang không tồn tại</h2>
            <p>Xin lỗi, trang bạn tìm kiếm không tồn tại hoặc đã bị xóa.</p>
            <a href="/" class="btn btn-primary">Về trang chủ</a>
        </div>
    </div>
</body>
</html>
EOF404

# Create .gitignore
cat > .gitignore << 'EOFGIT'
node_modules/
data/*.json
.env
*.log
.DS_Store
EOFGIT

# Create README
cat > README.md << 'EOFREADME'
# Quiz Master - Hệ thống trắc nghiệm Python

## Tính năng

✅ Đăng ký/Đăng nhập với email
✅ Quên mật khẩu & Reset qua email
✅ 35 câu hỏi Python với xáo trộn đáp án
✅ Tracking thời gian chi tiết
✅ Bảng xếp hạng
✅ Chế độ toàn màn hình
✅ Cookie & Access Token (7 ngày)
✅ Responsive design

## Cài đặt

1. Clone/Download project
2. Copy `.env.example` thành `.env` và cấu hình email
3. Chạy: `npm install`
4. Chạy: `npm start`
5. Truy cập: http://localhost:3000

## Cấu hình Email

Để sử dụng tính năng reset password, bạn cần:

1. Tạo App Password từ Google Account
2. Cập nhật EMAIL_USER và EMAIL_PASS trong file .env

## Deploy lên Render

1. Push code lên GitHub
2. Tạo Web Service trên Render.com
3. Thêm Environment Variables:
   - EMAIL_USER=your@gmail.com
   - EMAIL_PASS=your-app-password
   - BASE_URL=https://your-app.onrender.com
4. Deploy!

## Cấu trúc

```
quiz-app/
├── server.js          # Express server
├── package.json       
├── .env.example       
├── public/            
│   ├── css/          
│   ├── js/           
│   ├── home.html     # Trang chủ
│   ├── login.html    # Đăng nhập/ký
│   ├── quiz.html     # Trang quiz
│   ├── reset-password.html
│   └── 404.html      
└── data/             # JSON storage
```

## License

MIT
EOFREADME

echo "All files created successfully!"
