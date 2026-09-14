(function () {
    'use strict';

    function showMessage(text, type) {
        const msg = document.getElementById('message');
        msg.textContent = text;
        msg.className = 'message show ' + type;
    }
    function hideMessage() {
        document.getElementById('message').className = 'message';
    }

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(targetTab + 'Form').classList.add('active');
            hideMessage();
        });
    });

    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            btn.innerHTML = Icon(showing ? 'eye' : 'eye-off');
        });
    });

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessage();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        const formData = new FormData(e.target);
        const { ok, data } = await apiPost('/api/login', Object.fromEntries(formData));
        submitBtn.disabled = false;
        if (ok) {
            showMessage('Dang nhap thanh cong! Dang chuyen huong...', 'success');
            setTimeout(() => { window.location.href = '/'; }, 700);
        } else {
            showMessage(data.error || 'Dang nhap that bai.', 'error');
        }
    });

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessage();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        const formData = new FormData(e.target);
        const { ok, data } = await apiPost('/api/register', Object.fromEntries(formData));
        submitBtn.disabled = false;
        if (ok) {
            showMessage(data.message || 'Dang ky thanh cong!', 'success');
            e.target.reset();
            setTimeout(() => document.querySelector('.tab[data-tab="login"]').click(), 1600);
        } else {
            showMessage(data.error || 'Dang ky that bai.', 'error');
        }
    });

    const forgotModal = document.getElementById('forgotPasswordModal');
    document.getElementById('forgotPasswordBtn').addEventListener('click', () => forgotModal.classList.add('show'));
    document.getElementById('forgotCancelBtn').addEventListener('click', () => {
        forgotModal.classList.remove('show');
        document.getElementById('forgotEmail').value = '';
    });

    document.getElementById('forgotSubmitBtn').addEventListener('click', async () => {
        const email = document.getElementById('forgotEmail').value.trim();
        if (!email) { showToast('Vui long nhap email', 'error'); return; }
        const btn = document.getElementById('forgotSubmitBtn');
        btn.disabled = true;
        const { ok, data } = await apiPost('/api/forgot-password', { email });
        btn.disabled = false;
        if (ok) {
            showToast(data.message, 'success');
            forgotModal.classList.remove('show');
            document.getElementById('forgotEmail').value = '';
        } else {
            showToast(data.error || 'Khong the gui yeu cau.', 'error');
        }
    });

    window.addEventListener('DOMContentLoaded', async () => {
        const res = await apiGet('/api/verify');
        if (res.ok) window.location.href = '/';
    });
})();
