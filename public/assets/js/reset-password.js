(function () {
    'use strict';

    function showMessage(text, type) {
        const msg = document.getElementById('message');
        msg.textContent = text;
        msg.className = 'message show ' + type;
    }

    function getTokenFromUrl() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1];
    }

    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            btn.innerHTML = Icon(showing ? 'eye' : 'eye-off');
        });
    });

    document.getElementById('resetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            showMessage('Mat khau nhap lai khong khop.', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showMessage('Mat khau phai co it nhat 6 ky tu.', 'error');
            return;
        }

        const token = getTokenFromUrl();
        const btn = document.getElementById('resetSubmitBtn');
        btn.disabled = true;
        const { ok, data } = await apiPost('/api/reset-password', { token, newPassword });
        btn.disabled = false;

        if (ok) {
            showMessage(data.message, 'success');
            setTimeout(() => { window.location.href = '/login'; }, 1600);
        } else {
            showMessage(data.error || 'Khong the dat lai mat khau.', 'error');
        }
    });
})();
