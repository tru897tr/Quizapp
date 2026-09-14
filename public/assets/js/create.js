(function () {
    'use strict';

    const questionsList = document.getElementById('questionsList');
    const isPublicToggle = document.getElementById('isPublicToggle');
    const visibilityWrap = document.getElementById('visibilityToggleWrap');
    const visibilityIcon = document.getElementById('visibilityIcon');
    const visibilityLabel = document.getElementById('visibilityLabel');

    function updateVisibilityUI() {
        const isPublic = isPublicToggle.checked;
        visibilityWrap.classList.toggle('is-public', isPublic);
        visibilityIcon.innerHTML = Icon(isPublic ? 'globe' : 'lock');
        visibilityLabel.textContent = isPublic ? 'Cong khai' : 'Rieng tu';
    }

    isPublicToggle.addEventListener('change', updateVisibilityUI);

    document.getElementById('addQuestionBtn').addEventListener('click', () => {
        const card = QuizEditor.addQuestion('', null);
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.querySelector('.question-input').focus();
    });

    document.getElementById('saveQuizBtn').addEventListener('click', async () => {
        const title = document.getElementById('quizTitle').value;
        const error = QuizEditor.validate(title);
        if (error) { showToast(error, 'error'); return; }

        const btn = document.getElementById('saveQuizBtn');
        btn.disabled = true;
        const { ok, data } = await apiPost('/api/quiz/create', {
            title: title.trim(),
            questions: QuizEditor.getQuestions(),
            isPublic: isPublicToggle.checked
        });
        btn.disabled = false;

        if (ok) {
            showToast('Tao quiz thanh cong!', 'success');
            setTimeout(() => { window.location.href = '/myactivities'; }, 700);
        } else {
            showToast(data.error || 'Khong the tao quiz.', 'error');
        }
    });

    document.addEventListener('DOMContentLoaded', async () => {
        const user = await Nav.requireAuthOrRedirect();
        if (!user) return;
        QuizEditor.init(questionsList);
        QuizEditor.addQuestion('', null);
        updateVisibilityUI();
    });
})();
