(function () {
    'use strict';

    function getQuizIdFromUrl() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1];
    }

    const quizId = getQuizIdFromUrl();
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
        const { ok, data } = await apiPut(`/api/quiz/${quizId}`, {
            title: title.trim(),
            questions: QuizEditor.getQuestions(),
            isPublic: isPublicToggle.checked
        });
        btn.disabled = false;

        if (ok) {
            showToast('Da luu thay doi!', 'success');
        } else {
            showToast(data.error || 'Khong the luu quiz.', 'error');
        }
    });

    const deleteModal = document.getElementById('deleteConfirmModal');
    document.getElementById('deleteQuizBtn').addEventListener('click', () => deleteModal.classList.add('show'));
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => deleteModal.classList.remove('show'));
    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
        const btn = document.getElementById('confirmDeleteBtn');
        btn.disabled = true;
        const { ok, data } = await apiDelete(`/api/quiz/${quizId}`);
        btn.disabled = false;
        if (ok) {
            showToast('Da xoa quiz.', 'success');
            setTimeout(() => { window.location.href = '/myactivities'; }, 600);
        } else {
            showToast(data.error || 'Khong the xoa quiz.', 'error');
            deleteModal.classList.remove('show');
        }
    });

    async function loadQuiz() {
        const { ok, data } = await apiFetch(`/api/quiz/${quizId}`, { headers: { 'X-Request-Full-Data': 'true' } });

        if (!ok) {
            showToast(data.error || 'Khong the tai quiz nay.', 'error');
            setTimeout(() => { window.location.href = '/myactivities'; }, 1200);
            return;
        }

        const quiz = data.quiz;
        if (!quiz.isOwner) {
            showToast('Ban khong co quyen chinh sua quiz nay.', 'error');
            setTimeout(() => { window.location.href = '/myactivities'; }, 1200);
            return;
        }

        document.getElementById('quizTitle').value = quiz.title;
        isPublicToggle.checked = !!quiz.isPublic;
        updateVisibilityUI();
        QuizEditor.init(questionsList);
        QuizEditor.loadQuestions(quiz.questions);

        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('editShell').style.display = 'block';
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const user = await Nav.requireAuthOrRedirect();
        if (!user) return;
        loadQuiz();
    });
})();
