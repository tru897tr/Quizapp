(function () {
    'use strict';

    const quizGrid = document.getElementById('quizGrid');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const activitiesCount = document.getElementById('activitiesCount');
    const deleteModal = document.getElementById('deleteConfirmModal');
    let pendingDeleteId = null;
    let quizzesCache = [];

    function slugify(title) {
        return String(title)
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || 'quiz';
    }

    function renderCard(quiz) {
        const card = document.createElement('div');
        card.className = 'quiz-card';
        card.dataset.id = quiz.id;

        const safeTitle = Utils.escapeHtml(quiz.title);
        const visibilityBadge = quiz.isPublic
            ? `<span class="badge badge-success">${Icon('globe', 'icon-sm')} Cong khai</span>`
            : `<span class="badge badge-gray">${Icon('lock', 'icon-sm')} Rieng tu</span>`;

        card.innerHTML = `
            <div class="quiz-card-top">
                <h3 class="quiz-card-title">${safeTitle}</h3>
                <div class="dropdown">
                    <button type="button" class="icon-btn dropdown-trigger" aria-label="Tuy chon">${Icon('dots-vertical')}</button>
                    <div class="dropdown-menu">
                        <button type="button" data-action="edit">${Icon('edit', 'icon-sm')} Chinh sua</button>
                        <button type="button" data-action="duplicate">${Icon('copy', 'icon-sm')} Nhan doi</button>
                        <button type="button" data-action="share" ${quiz.isPublic ? '' : 'disabled'}>${Icon('share', 'icon-sm')} Chia se</button>
                        <button type="button" data-action="leaderboard">${Icon('trophy', 'icon-sm')} Bang xep hang</button>
                        <button type="button" data-action="delete" class="danger">${Icon('trash', 'icon-sm')} Xoa</button>
                    </div>
                </div>
            </div>
            <div class="quiz-card-meta">
                ${visibilityBadge}
                <span class="quiz-card-meta-item">${Icon('book', 'icon-sm')} ${quiz.questionCount} cau hoi</span>
                <span class="quiz-card-meta-item">${Icon('calendar', 'icon-sm')} ${Utils.formatDate(quiz.createdAt)}</span>
            </div>
            <div class="quiz-card-actions">
                <a href="/quiz/${quiz.id}/${slugify(quiz.title)}" class="btn btn-primary btn-sm">${Icon('play', 'icon-sm')} Lam bai</a>
            </div>
        `;
        return card;
    }

    async function loadQuizzes() {
        const { ok, data } = await apiGet('/api/quiz/my-activities');
        loadingState.style.display = 'none';

        if (!ok) {
            showToast(data.error || 'Khong the tai danh sach quiz.', 'error');
            return;
        }

        quizzesCache = data.quizzes;
        activitiesCount.textContent = quizzesCache.length ? `${quizzesCache.length} quiz` : '';

        if (quizzesCache.length === 0) {
            emptyState.style.display = 'block';
            quizGrid.innerHTML = '';
            return;
        }

        emptyState.style.display = 'none';
        quizGrid.innerHTML = '';
        quizzesCache.forEach(q => quizGrid.appendChild(renderCard(q)));
    }

    function closeAllDropdowns(except) {
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            if (menu !== except) menu.classList.remove('show');
        });
    }

    quizGrid.addEventListener('click', async (e) => {
        const trigger = e.target.closest('.dropdown-trigger');
        if (trigger) {
            const menu = trigger.parentElement.querySelector('.dropdown-menu');
            const willShow = !menu.classList.contains('show');
            closeAllDropdowns();
            menu.classList.toggle('show', willShow);
            return;
        }

        const actionBtn = e.target.closest('button[data-action]');
        if (!actionBtn) return;

        const card = e.target.closest('.quiz-card');
        const quizId = card.dataset.id;
        const action = actionBtn.dataset.action;
        closeAllDropdowns();

        if (action === 'edit') {
            window.location.href = `/create/edit/${quizId}`;
        } else if (action === 'duplicate') {
            const { ok, data } = await apiPost(`/api/quiz/${quizId}/duplicate`);
            if (ok) { showToast('Da nhan doi quiz!', 'success'); loadQuizzes(); }
            else showToast(data.error || 'Khong the nhan doi quiz.', 'error');
        } else if (action === 'share') {
            window.location.href = `/share/quiz/${quizId}`;
        } else if (action === 'leaderboard') {
            window.location.href = `/leaderboard/${quizId}`;
        } else if (action === 'delete') {
            pendingDeleteId = quizId;
            deleteModal.classList.add('show');
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) closeAllDropdowns();
    });

    document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
        deleteModal.classList.remove('show');
        pendingDeleteId = null;
    });

    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
        if (!pendingDeleteId) return;
        const btn = document.getElementById('confirmDeleteBtn');
        btn.disabled = true;
        const { ok, data } = await apiDelete(`/api/quiz/${pendingDeleteId}`);
        btn.disabled = false;
        deleteModal.classList.remove('show');
        if (ok) { showToast('Da xoa quiz.', 'success'); loadQuizzes(); }
        else showToast(data.error || 'Khong the xoa quiz.', 'error');
        pendingDeleteId = null;
    });

    document.addEventListener('DOMContentLoaded', async () => {
        const user = await Nav.requireAuthOrRedirect();
        if (!user) return;
        loadQuizzes();
    });
})();
