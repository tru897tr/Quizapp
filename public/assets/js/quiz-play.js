/**
 * quiz-play.js - Logic lam bai quiz.
 *
 * CHONG GIAN LAN: File nay CHU DONG KHONG tu tinh diem/thoi gian de gui
 * len may chu. Moi lan chon dap an deu goi API "check-answer" va may chu
 * la noi duy nhat biet dap an dung; khi nop bai, thoi gian hien thi lay
 * tu chinh may chu tra ve (thong qua API "finish"), khong phai do trinh
 * duyet tu dem roi gui len. Bo dem hien thi tren giao dien (timerLabel)
 * chi mang tinh tham khao truc quan cho nguoi choi, khong anh huong ket
 * qua cuoi cung.
 */
(function () {
    'use strict';

    function getQuizIdFromUrl() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        // dang URL: /quiz/:id/:title?
        return parts[1];
    }

    const quizId = getQuizIdFromUrl();
    let quiz = null;
    let attemptId = null;
    let startedAt = null;
    let currentIndex = 0;
    let solvedCount = 0;
    let timerInterval = null;
    let hasWarnedTabSwitch = false;

    const els = {
        loading: document.getElementById('loadingState'),
        error: document.getElementById('errorState'),
        errorTitle: document.getElementById('errorTitle'),
        errorMessage: document.getElementById('errorMessage'),
        quizContainer: document.getElementById('quizContainer'),
        resultContainer: document.getElementById('resultContainer'),
        titleLabel: document.getElementById('quizTitleLabel'),
        timerLabel: document.getElementById('timerLabel'),
        progressFill: document.getElementById('progressFill'),
        progressLabel: document.getElementById('progressLabel'),
        questionText: document.getElementById('questionText'),
        optionsGrid: document.getElementById('optionsGrid'),
        nextBtn: document.getElementById('nextBtn'),
        finishBtn: document.getElementById('finishBtn')
    };

    function showError(title, message) {
        els.loading.style.display = 'none';
        els.error.style.display = 'block';
        els.errorTitle.textContent = title;
        els.errorMessage.textContent = message;
    }

    function startTimer() {
        timerInterval = setInterval(() => {
            const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
            els.timerLabel.textContent = Utils.formatDuration(elapsedSeconds);
        }, 500);
    }
    function stopTimer() { clearInterval(timerInterval); }

    function renderQuestion() {
        const q = quiz.questions[currentIndex];
        els.progressLabel.textContent = `Cau ${currentIndex + 1} / ${quiz.questions.length}`;
        els.progressFill.style.width = `${(currentIndex / quiz.questions.length) * 100}%`;
        els.questionText.textContent = q.question;
        els.nextBtn.style.display = 'none';
        els.finishBtn.style.display = 'none';

        els.optionsGrid.innerHTML = '';
        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'option-choice';
            btn.dataset.index = idx;
            btn.innerHTML = `
                <span class="option-badge">${Utils.optionLabel(idx)}</span>
                <span class="option-text"></span>
                <span class="option-result-icon"></span>
            `;
            btn.querySelector('.option-text').textContent = opt.text;
            btn.addEventListener('click', () => handleAnswerClick(btn, idx));
            els.optionsGrid.appendChild(btn);
        });
    }

    async function handleAnswerClick(btn, selectedOption) {
        if (btn.disabled) return;
        const buttons = Array.from(els.optionsGrid.children);
        buttons.forEach(b => b.disabled = true);

        const { ok, data } = await apiPost(`/api/quiz/${quizId}/check-answer`, {
            attemptId, questionIndex: currentIndex, selectedOption
        });

        if (!ok) {
            showToast(data.error || 'Khong the kiem tra dap an.', 'error');
            buttons.forEach(b => b.disabled = false);
            return;
        }

        if (data.isCorrect) {
            btn.classList.add('is-correct');
            btn.querySelector('.option-result-icon').innerHTML = Icon('check-circle');
            buttons.forEach(b => { if (b !== btn) b.classList.add('is-muted'); });
            solvedCount++;

            if (currentIndex < quiz.questions.length - 1) {
                els.nextBtn.style.display = 'inline-flex';
            } else {
                els.progressFill.style.width = '100%';
                els.finishBtn.style.display = 'inline-flex';
            }
        } else {
            btn.classList.add('is-wrong');
            btn.querySelector('.option-result-icon').innerHTML = Icon('x-circle');
            buttons.forEach(b => { if (b !== btn) b.disabled = false; });
            // giu nut da chon sai o trang thai disabled (khong cho chon lai chinh no)
        }
    }

    els.nextBtn.addEventListener('click', () => {
        currentIndex++;
        renderQuestion();
    });

    els.finishBtn.addEventListener('click', async () => {
        els.finishBtn.disabled = true;
        const { ok, data } = await apiPost(`/api/quiz/${quizId}/finish`, { attemptId });
        els.finishBtn.disabled = false;

        if (!ok) {
            showToast(data.error || 'Khong the nop bai.', 'error');
            return;
        }

        stopTimer();
        showResult(data.result);
    });

    function showResult(result) {
        els.quizContainer.style.display = 'none';
        els.resultContainer.style.display = 'block';
        document.getElementById('resultQuizTitle').textContent = quiz.title;
        document.getElementById('statTotal').textContent = Utils.formatDuration(result.totalTime);
        document.getElementById('statAvg').textContent = Utils.formatDuration(result.avgTime);
        document.getElementById('statFastest').textContent = Utils.formatDuration(result.fastestTime);
        document.getElementById('statSlowest').textContent = Utils.formatDuration(result.slowestTime);
        document.getElementById('leaderboardLink').href = `/leaderboard/${quizId}`;
    }

    document.getElementById('retryBtn').addEventListener('click', () => window.location.reload());

    document.addEventListener('visibilitychange', () => {
        if (document.hidden || hasWarnedTabSwitch || !attemptId) return;
        hasWarnedTabSwitch = true;
        showToast('Thoi gian van tiep tuc duoc tinh khi ban chuyen sang tab khac.', 'info');
    });

    async function init() {
        const verify = await apiGet('/api/verify');
        if (!verify.ok) {
            window.location.href = '/login';
            return;
        }

        const quizRes = await apiGet(`/api/quiz/${quizId}`);
        if (!quizRes.ok) {
            showError('Khong tim thay quiz', quizRes.data.error || 'Quiz nay khong ton tai hoac da bi xoa.');
            return;
        }
        quiz = quizRes.data.quiz;
        if (!quiz.questions || quiz.questions.length === 0) {
            showError('Quiz chua co cau hoi', 'Quiz nay hien chua co cau hoi nao.');
            return;
        }
        els.titleLabel.textContent = quiz.title;

        const startRes = await apiPost(`/api/quiz/${quizId}/start`);
        if (!startRes.ok) {
            showError('Khong the bat dau', startRes.data.error || 'Vui long thu lai sau.');
            return;
        }
        attemptId = startRes.data.attemptId;
        startedAt = startRes.data.startedAt;

        els.loading.style.display = 'none';
        els.quizContainer.style.display = 'block';
        startTimer();
        renderQuestion();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
