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
