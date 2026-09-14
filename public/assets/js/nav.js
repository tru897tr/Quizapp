/**
 * nav.js - Dieu khien sidebar (menu truot), trang thai dang nhap tren
 * header/sidebar va hien/an muc "Quan tri" theo vai tro. Dung chung cho
 * moi trang co bo khung dieu huong, thay the cac doan <script> lap lai
 * truoc day trong tung file HTML (giup Content-Security-Policy chat hon
 * vi khong con script noi tuyen).
 */
(function () {
    'use strict';

    function openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (!sidebar) return;
        sidebar.classList.add('open');
        if (overlay) overlay.classList.add('show');
        document.body.classList.add('no-scroll');
    }

    function closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (!sidebar) return;
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
        document.body.classList.remove('no-scroll');
    }

    async function logout() {
        if (!confirm('Ban co chac muon dang xuat?')) return;
        await apiPost('/api/logout');
        window.location.href = '/';
    }

    function setActiveMenuItem() {
        const currentPath = window.location.pathname;
        document.querySelectorAll('.sidebar-menu a[href]').forEach(item => {
            const href = item.getAttribute('href');
            if (href === currentPath || (href !== '/' && currentPath.startsWith(href))) {
                item.classList.add('active-menu-item');
            }
        });
    }

    function renderHeaderUser(user) {
        const menu = document.getElementById('userMenu');
        if (!menu) return;
        if (user) {
            menu.innerHTML = `<div class="user-info">${Icon('user')}<span></span></div>`;
            menu.querySelector('.user-info span').textContent = user.username;
        } else {
            menu.innerHTML = `<a href="/login" class="btn btn-primary btn-sm">Dang nhap</a>`;
        }
    }

    function toggleSidebarAuthLinks(isLoggedIn, role) {
        const loginLink = document.getElementById('sidebarLogin');
        const logoutLink = document.getElementById('sidebarLogout');
        const adminLink = document.getElementById('sidebarAdmin');
        if (loginLink) loginLink.style.display = isLoggedIn ? 'none' : 'flex';
        if (logoutLink) logoutLink.style.display = isLoggedIn ? 'flex' : 'none';
        if (adminLink) adminLink.style.display = isLoggedIn && role === 'admin' ? 'flex' : 'none';
    }

    async function initAuthState() {
        try {
            const res = await apiGet('/api/verify');
            if (res.ok) {
                renderHeaderUser(res.data.user);
                toggleSidebarAuthLinks(true, res.data.user.role);
                document.querySelectorAll('[data-user-display]').forEach(el => { el.textContent = res.data.user.username; });
                document.body.classList.add('is-authenticated');
                return res.data.user;
            }
        } catch { /* bo qua, coi nhu chua dang nhap */ }
        renderHeaderUser(null);
        toggleSidebarAuthLinks(false, null);
        return null;
    }

    // Bat buoc phai dang nhap moi duoc xem trang - dung cho cac trang rieng
    // tu nhu Tao quiz, Sua quiz, Danh sach cua toi, Cai dat...
    async function requireAuthOrRedirect() {
        const user = await initAuthState();
        if (!user) {
            window.location.href = '/login';
            return null;
        }
        return user;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const menuToggle = document.getElementById('menuToggle');
        const closeSidebarBtn = document.getElementById('closeSidebarBtn');
        const overlay = document.getElementById('sidebarOverlay');
        const logoutBtn = document.getElementById('sidebarLogout');

        if (menuToggle) menuToggle.addEventListener('click', openSidebar);
        if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
        if (overlay) overlay.addEventListener('click', closeSidebar);
        if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); logout(); });

        setActiveMenuItem();
        // Tu dong kiem tra trang thai dang nhap cho MOI trang co nhung file
        // nay (tru khi trang do se tu goi requireAuthOrRedirect() rieng,
        // viec goi them lan nua khong gay hai gi ca). Lam nhu vay de tranh
        // phai viet <script> noi tuyen trong tung file HTML - giup Chinh
        // sach bao mat noi dung (CSP) co the chan toan bo script noi tuyen
        // ma khong lam hong chuc nang hien thi trang thai dang nhap.
        if (!document.body.hasAttribute('data-skip-auto-auth')) {
            initAuthState();
        }
    });

    window.Nav = { openSidebar, closeSidebar, logout, initAuthState, requireAuthOrRedirect };
})();
