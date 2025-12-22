let quiz = null;
let currentQuestion = 0;
let startTime = Date.now();
let timerInterval;
let questionStartTime = Date.now();
let timePerQuestion = [];
let userAnswers = {}; // Stores answer state for each question

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/verify');
        if (!response.ok) {
            window.location.href = '/login';
            return;
        }
        const result = await response.json();
        document.getElementById('username').textContent = result.user.username;
        
        const pathParts = window.location.pathname.split('/');
        const quizId = parseInt(pathParts[2]);
        
        if (isNaN(quizId)) {
            showToast('ID quiz không hợp lệ', 'error');
            window.location.href = '/';
            return;
        }
        
        await loadQuiz(quizId);
        startTimer();
        displayQuestion();
    } catch (error) {
        window.location.href = '/login';
    }
});

async function loadQuiz(quizId) {
    try {
        const response = await fetch(`/api/quiz/${quizId}`);
        const result = await response.json();
        
        if (!result.success) {
            showToast(result.error, 'error');
            window.location.href = '/';
            return;
        }
        
        quiz = result.quiz;
        document.getElementById('totalQ').textContent = quiz.questionCount;
    } catch (error) {
        showToast('Lỗi tải quiz', 'error');
        window.location.href = '/';
    }
}

function startTimer() {
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('timer').textContent = 
            String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }, 1000);
}

function displayQuestion() {
    const q = quiz.questions[currentQuestion];
    const userAnswer = userAnswers[currentQuestion];
    
    document.getElementById('currentQ').textContent = currentQuestion + 1;
    document.getElementById('progress').style.width = 
        ((currentQuestion) / quiz.questionCount) * 100 + '%';
    
    let optionsHTML = '';
    q.options.forEach((opt, idx) => {
        const label = String.fromCharCode(65 + idx);
        let classes = 'option';
        let clickable = true;
        
        if (userAnswer !== undefined) {
            // If user has answered this question
            if (userAnswer.isCorrect) {
                // Question answered correctly - show correct answer and disable all
                if (idx === userAnswer.correctIndex) {
                    classes += ' correct';
                }
                clickable = false;
                classes += ' disabled';
            } else {
                // Question not answered correctly yet - only show wrong attempts
                if (userAnswer.wrongAttempts.includes(idx)) {
                    classes += ' wrong';
                    clickable = false;
                }
                // Don't show correct answer until they get it right
            }
        }
        
        const onclickAttr = clickable ? `onclick="checkAnswer(${idx})"` : '';
        optionsHTML += `
            <div class="${classes}" ${onclickAttr}>
                <div class="option-label">${label}</div>
                <div>${opt.text}</div>
            </div>
        `;
    });
    
    const isAnswered = userAnswer && userAnswer.isCorrect === true;
    const prevDisabled = currentQuestion === 0 ? 'disabled' : '';
    const nextDisabled = !isAnswered ? 'disabled' : '';
    
    document.getElementById('quizArea').innerHTML = `
        <div class="question-card">
            <div class="question-text">${q.question}</div>
            <div class="options-grid">${optionsHTML}</div>
            <div class="quiz-navigation">
                <button class="nav-button prev" onclick="prevQuestion()" ${prevDisabled}>← Quay lại</button>
                <button class="nav-button next" onclick="nextQuestion()" ${nextDisabled}>Tiếp tục →</button>
            </div>
        </div>
    `;
}

async function checkAnswer(selected) {
    const q = quiz.questions[currentQuestion];
    let userAnswer = userAnswers[currentQuestion];
    
    // Initialize if first attempt
    if (!userAnswer) {
        userAnswer = {
            wrongAttempts: [],
            isCorrect: false,
            correctIndex: null
        };
        userAnswers[currentQuestion] = userAnswer;
    }
    
    // If already answered correctly, don't allow more clicks
    if (userAnswer.isCorrect) {
        return;
    }
    
    // If this option was already tried and wrong, don't allow clicking again
    if (userAnswer.wrongAttempts.includes(selected)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/quiz/${quiz.id}/check-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                questionIndex: currentQuestion,
                selectedOption: selected
            })
        });
        
        const result = await response.json();
        
        if (result.isCorrect) {
            // Correct answer!
            const questionTime = Math.floor((Date.now() - questionStartTime) / 1000);
            timePerQuestion[currentQuestion] = questionTime;
            
            userAnswers[currentQuestion] = {
                ...userAnswer,
                isCorrect: true,
                correctIndex: result.correctIndex
            };
            
            showToast('Chính xác! 🎉', 'success');
        } else {
            // Wrong answer - add to wrong attempts
            userAnswer.wrongAttempts.push(selected);
            userAnswer.correctIndex = result.correctIndex; // Store but don't show yet
            userAnswers[currentQuestion] = userAnswer;
            
            showToast('Sai rồi, thử lại nhé', 'error');
        }
        
        // Re-render to update UI
        displayQuestion();
    } catch (error) {
        showToast('Lỗi kiểm tra câu trả lời', 'error');
    }
}

function prevQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        displayQuestion();
    }
}

function nextQuestion() {
    if (currentQuestion < quiz.questionCount - 1) {
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
    const avgTime = validTimes.length > 0 
        ? Math.floor(validTimes.reduce((a, b) => a + b, 0) / validTimes.length) 
        : 0;
    const fastestTime = validTimes.length > 0 ? Math.min(...validTimes) : 0;
    const slowestTime = validTimes.length > 0 ? Math.max(...validTimes) : 0;
    
    try {
        await fetch('/api/save-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quizId: quiz.id,
                totalTime,
                avgTime,
                fastestTime,
                slowestTime
            })
        });
    } catch (error) {
        // Non-critical error
    }
    
    document.getElementById('quizStats').style.display = 'none';
    document.querySelector('.progress-bar').style.display = 'none';
    
    document.getElementById('quizArea').innerHTML = `
        <div class="result-screen">
            <div class="result-icon">🏆</div>
            <h1 class="result-title">Chúc mừng!</h1>
            <p style="font-size:18px;color:var(--gray);margin:0 0 20px 0;">
                Bạn đã hoàn thành bài trắc nghiệm
            </p>
            <div class="result-time">${minutes}:${String(seconds).padStart(2, '0')}</div>
            <div class="result-stats">
                <div class="result-stat">
                    <div class="result-stat-label">Trung bình</div>
                    <div class="result-stat-value">${avgTime}s</div>
                </div>
                <div class="result-stat">
                    <div class="result-stat-label">Nhanh nhất</div>
                    <div class="result-stat-value">${fastestTime}s</div>
                </div>
                <div class="result-stat">
                    <div class="result-stat-label">Chậm nhất</div>
                    <div class="result-stat-value">${slowestTime}s</div>
                </div>
                <div class="result-stat">
                    <div class="result-stat-label">Tổng câu</div>
                    <div class="result-stat-value">${quiz.questionCount}</div>
                </div>
            </div>
            <div class="result-buttons">
                <button class="btn btn-primary" onclick="location.reload()">🔄 Làm lại</button>
                <button class="btn btn-secondary" onclick="window.location.href='/'">🏠 Về trang chủ</button>
            </div>
        </div>
    `;
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            showToast('Không thể vào chế độ toàn màn hình', 'error');
        });
        document.body.classList.add('fullscreen-mode');
    } else {
        document.exitFullscreen();
        document.body.classList.remove('fullscreen-mode');
    }
}

function exitFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
}

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        document.body.classList.remove('fullscreen-mode');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.fullscreenElement) {
        exitFullscreen();
    }
});

function quit() {
    if (confirm('Bạn có chắc muốn thoát? Tiến độ sẽ không được lưu.')) {
        window.location.href = '/';
    }
}
