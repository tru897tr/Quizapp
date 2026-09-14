(function () {
    'use strict';

    function getQuizIdFromUrl() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        // dang URL: /share/quiz/:id
        return parts[2];
    }

    function slugify(title) {
        return String(title)
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || 'quiz';
    }

    async function init() {
        const quizId = getQuizIdFromUrl();
        const { ok, data } = await apiGet(`/api/quiz/${quizId}`);
        document.getElementById('loadingState').style.display = 'none';

        if (!ok) {
            document.getElementById('notFoundState').style.display = 'block';
            return;
        }

        const quiz = data.quiz;
        document.getElementById('content').style.display = 'block';
        document.getElementById('quizTitle').textContent = quiz.title;
        document.getElementById('quizAuthor').textContent = quiz.author;
        document.getElementById('quizQuestionCount').textContent = `${quiz.questionCount} cau hoi`;

        const playUrl = `/quiz/${quiz.id}/${slugify(quiz.title)}`;
        document.getElementById('playBtn').href = playUrl;

        document.getElementById('copyLinkBtn').addEventListener('click', async () => {
            const fullUrl = window.location.origin + playUrl;
            try {
                await navigator.clipboard.writeText(fullUrl);
                showToast('Da sao chep lien ket!', 'success');
            } catch {
                showToast('Khong the sao chep tu dong. Vui long sao chep thu cong.', 'warning');
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
