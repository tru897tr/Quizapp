window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/verify');
        if (!response.ok) {
            window.location.href = '/login';
            return;
        }
        const result = await response.json();
        document.getElementById('userDisplay').textContent = result.user.username;
        loadQuizzes();
    } catch (error) {
        window.location.href = '/login';
    }
});

async function loadQuizzes() {
    try {
        const response = await fetch('/api/quiz/my-activities');
        const result = await response.json();
        
        if (result.success) {
            renderQuizzes(result.quizzes);
        }
    } catch (error) {
        console.error('Error loading quizzes:', error);
    }
}

function renderQuizzes(quizzes) {
    const grid = document.getElementById('quizGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (quizzes.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    
    grid.innerHTML = '';
    
    quizzes.forEach(quiz => {
        const card = document.createElement('div');
        card.className = 'quiz-card';
        card.onclick = () => openQuiz(quiz.id, quiz.title);
        
        const date = new Date(quiz.createdAt);
        const dateStr = date.toLocaleDateString('vi-VN');
        
        card.innerHTML = `
            <div class="quiz-card-header">
                <div>
                    <h3 class="quiz-card-title">${escapeHtml(quiz.title)}</h3>
                    <div class="quiz-card-meta">
                        <span>📝 ${quiz.questionCount} câu hỏi</span>
                        <span>📅 ${dateStr}</span>
                    </div>
                </div>
            </div>
            <div class="quiz-status ${quiz.isPublic ? 'public' : 'private'}">
                ${quiz.isPublic ? '🌐 Công khai' : '🔒 Riêng tư'}
            </div>
            <div class="quiz-actions">
                <button class="menu-trigger" onclick="toggleMenu(event, ${quiz.id})">⋮</button>
                <div class="dropdown-menu" id="menu-${quiz.id}">
                    <button onclick="openInNewTab(event, ${quiz.id}, '${escapeHtml(quiz.title).replace(/'/g, "\\'")}')">🔗 Mở trong tab mới</button>
                    <button onclick="editTitle(event, ${quiz.id})">✏️ Chỉnh sửa tiêu đề</button>
                    <button onclick="editQuiz(event, ${quiz.id})">📝 Chỉnh sửa câu hỏi</button>
                    <button onclick="duplicateQuiz(event, ${quiz.id})">📋 Nhân đôi</button>
                    <button onclick="toggleVisibility(event, ${quiz.id}, ${quiz.isPublic})">
                        ${quiz.isPublic ? '🔒 Chuyển riêng tư' : '🌐 Chuyển công khai'}
                    </button>
                    <button onclick="shareQuiz(event, ${quiz.id}, ${quiz.isPublic})" ${quiz.isPublic ? '' : 'disabled style="opacity:0.5;cursor:not-allowed"'}>
                        📤 Chia sẻ
                    </button>
                    <button class="danger" onclick="deleteQuiz(event, ${quiz.id})">🗑️ Xóa</button>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleMenu(event, quizId) {
    event.stopPropagation();
    const menu = document.getElementById('menu-' + quizId);
    const allMenus = document.querySelectorAll('.dropdown-menu');
    allMenus.forEach(m => {
        if (m !== menu) m.classList.remove('show');
    });
    menu.classList.toggle('show');
}

document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
});

function openQuiz(quizId, title) {
    const safeTitle = encodeURIComponent(title);
    window.location.href = `/quiz/${quizId}/${safeTitle}`;
}

function openInNewTab(event, quizId, title) {
    event.stopPropagation();
    const safeTitle = encodeURIComponent(title);
    window.open(`/quiz/${quizId}/${safeTitle}`, '_blank');
}

function editQuiz(event, quizId) {
    event.stopPropagation();
    window.location.href = `/create/edit/${quizId}`;
}

async function editTitle(event, quizId) {
    event.stopPropagation();
    const newTitle = prompt('Nhập tiêu đề mới:');
    if (!newTitle || !newTitle.trim()) return;
    
    try {
        const response = await fetch(`/api/quiz/${quizId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle.trim() })
        });
        
        const result = await response.json();
        if (result.success) {
            loadQuizzes();
        } else {
            alert(result.error);
        }
    } catch (error) {
        alert('Lỗi kết nối');
    }
}

async function duplicateQuiz(event, quizId) {
    event.stopPropagation();
    if (!confirm('Bạn có chắc muốn nhân đôi quiz này?')) return;
    
    try {
        const response = await fetch(`/api/quiz/${quizId}/duplicate`, {
            method: 'POST'
        });
        
        const result = await response.json();
        if (result.success) {
            loadQuizzes();
        } else {
            alert(result.error);
        }
    } catch (error) {
        alert('Lỗi kết nối');
    }
}

async function toggleVisibility(event, quizId, currentPublic) {
    event.stopPropagation();
    const newStatus = !currentPublic;
    const action = newStatus ? 'công khai' : 'riêng tư';
    
    if (!confirm(`Bạn có chắc muốn chuyển quiz sang chế độ ${action}?`)) return;
    
    try {
        const response = await fetch(`/api/quiz/${quizId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isPublic: newStatus })
        });
        
        const result = await response.json();
        if (result.success) {
            loadQuizzes();
        } else {
            alert(result.error);
        }
    } catch (error) {
        alert('Lỗi kết nối');
    }
}

function shareQuiz(event, quizId, isPublic) {
    event.stopPropagation();
    if (!isPublic) {
        alert('Quiz phải ở chế độ công khai mới có thể chia sẻ');
        return;
    }
    const shareUrl = window.location.origin + '/share/quiz/' + quizId;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('Đã sao chép link chia sẻ!\n' + shareUrl);
        }).catch(() => {
            prompt('Link chia sẻ:', shareUrl);
        });
    } else {
        prompt('Link chia sẻ:', shareUrl);
    }
}

async function deleteQuiz(event, quizId) {
    event.stopPropagation();
    if (!confirm('Bạn có chắc muốn xóa quiz này? Hành động này không thể hoàn tác!')) return;
    
    try {
        const response = await fetch(`/api/quiz/${quizId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            loadQuizzes();
        } else {
            alert(result.error);
        }
    } catch (error) {
        alert('Lỗi kết nối');
    }
}
