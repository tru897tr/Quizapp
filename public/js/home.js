async function checkAuth() {
    try {
        const response = await fetch('/api/verify');
        if (response.ok) {
            const result = await response.json();
            showUserMenu(result.user.username);
        } else {
            showLoginButton();
        }
    } catch (error) {
        showLoginButton();
    }
}

function showUserMenu(username) {
    const menu = document.getElementById('userMenu');
    menu.innerHTML = '<div class="user-menu"><button class="user-button" onclick="toggleUserDropdown()">👤 ' + username + '</button><div class="user-dropdown" id="userDropdown"><a href="/quiz">Làm bài quiz</a><button onclick="logout()">Đăng xuất</button></div></div>';
}

function showLoginButton() {
    const menu = document.getElementById('userMenu');
    menu.innerHTML = '<a href="/login" class="btn btn-primary">Đăng nhập</a>';
}

function toggleUserDropdown() {
    document.getElementById('userDropdown').classList.toggle('show');
}

async function startQuiz() {
    try {
        const response = await fetch('/api/verify');
        if (response.ok) {
            window.location.href = '/quiz';
        } else {
            window.location.href = '/login';
        }
    } catch (error) {
        window.location.href = '/login';
    }
}

function showLeaderboard() {
    document.getElementById('leaderboardSection').style.display = 'block';
    loadLeaderboard();
}

function hideLeaderboard() {
    document.getElementById('leaderboardSection').style.display = 'none';
}

async function loadLeaderboard() {
    const content = document.getElementById('leaderboardContent');
    content.innerHTML = '<div class="loading">Đang tải...</div>';
    try {
        const response = await fetch('/api/leaderboard');
        const result = await response.json();
        if (result.success && result.leaderboard.length > 0) {
            let html = '<div class="leaderboard-list">';
            result.leaderboard.forEach((item, index) => {
                const rank = index + 1;
                let rankClass = '';
                if (rank === 1) rankClass = 'gold';
                else if (rank === 2) rankClass = 'silver';
                else if (rank === 3) rankClass = 'bronze';
                const minutes = Math.floor(item.totalTime / 60);
                const seconds = item.totalTime % 60;
                html += '<div class="leaderboard-item"><div class="leaderboard-rank ' + rankClass + '">#' + rank + '</div><div class="leaderboard-user">' + item.username + '</div><div class="leaderboard-time">' + minutes + ':' + String(seconds).padStart(2, '0') + '</div></div>';
            });
            html += '</div>';
            content.innerHTML = html;
        } else {
            content.innerHTML = '<div class="loading">Chưa có dữ liệu</div>';
        }
    } catch (error) {
        content.innerHTML = '<div class="loading">Lỗi tải dữ liệu</div>';
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (error) {}
    window.location.reload();
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) dropdown.classList.remove('show');
    }
});

window.addEventListener('DOMContentLoaded', checkAuth);
