(function () {
    'use strict';

    function roleLabel(role) { return role === 'admin' ? 'Quan tri vien' : 'Nguoi dung'; }

    async function loadProfile() {
        const { ok, data } = await apiGet('/api/profile');
        if (!ok) { showToast(data.error || 'Khong the tai thong tin tai khoan.', 'error'); return; }
        const p = data.profile;
        document.getElementById('avatarInitial').textContent = p.fullname.charAt(0).toUpperCase();
        document.getElementById('profileFullname').textContent = p.fullname;
        document.getElementById('profileUsername').textContent = '@' + p.username;
        document.getElementById('profileEmail').textContent = p.email;
        document.getElementById('profileCreatedAt').textContent = Utils.formatDate(p.createdAt);
        document.getElementById('profileRole').textContent = roleLabel(p.role);
        if (p.role === 'admin') document.getElementById('adminCard').style.display = 'block';
    }

    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const msg = document.getElementById('changePasswordMessage');
        msg.className = 'message';

        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        const { ok, data } = await apiPost('/api/change-password', { currentPassword, newPassword });
        btn.disabled = false;

        msg.textContent = ok ? data.message : (data.error || 'Khong the doi mat khau.');
        msg.className = 'message show ' + (ok ? 'success' : 'error');
        if (ok) e.target.reset();
    });

    function sessionIconName(device) {
        if (/dien thoai/i.test(device)) return 'smartphone';
        if (/may tinh bang/i.test(device)) return 'tablet';
        return 'monitor';
    }

    async function loadSessions() {
        const { ok, data } = await apiGet('/api/sessions');
        const list = document.getElementById('sessionsList');
        if (!ok) { list.innerHTML = '<p style="color:var(--gray-500);font-size:14px">Khong the tai danh sach phien dang nhap.</p>'; return; }

        list.innerHTML = '';
        data.sessions.forEach(s => {
            const row = document.createElement('div');
            row.className = 'session-row';
            row.innerHTML = `
                <div class="session-icon">${Icon(sessionIconName(s.device))}</div>
                <div class="session-details">
                    <div class="session-device"></div>
                    <div class="session-meta"></div>
                </div>
                <div class="session-actions"></div>
            `;
            row.querySelector('.session-device').textContent = s.device + (s.current ? ' (Thiet bi hien tai)' : '');
            row.querySelector('.session-meta').textContent = `${s.browser} - IP ${s.ip} - Dang nhap ${Utils.formatDateTime(s.createdAt)}`;

            if (!s.current) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-outline btn-sm';
                btn.textContent = 'Dang xuat';
                btn.addEventListener('click', async () => {
                    btn.disabled = true;
                    const res = await apiPost(`/api/sessions/${s.sessionId}/revoke`);
                    if (res.ok) { showToast('Da dang xuat phien do.', 'success'); loadSessions(); }
                    else { showToast(res.data.error || 'Khong the dang xuat.', 'error'); btn.disabled = false; }
                });
                row.querySelector('.session-actions').appendChild(btn);
            } else {
                row.querySelector('.session-actions').innerHTML = '<span class="badge badge-success">Hien tai</span>';
            }
            list.appendChild(row);
        });
    }

    document.getElementById('logoutAllBtn').addEventListener('click', async () => {
        if (!confirm('Dang xuat khoi tat ca thiet bi, ke ca thiet bi nay?')) return;
        await apiPost('/api/logout-all');
        window.location.href = '/login';
    });

    async function loadResults() {
        const { ok, data } = await apiGet('/api/results');
        const wrap = document.getElementById('resultsTableWrap');
        if (!ok) { wrap.innerHTML = '<p style="color:var(--gray-500);font-size:14px">Khong the tai lich su ket qua.</p>'; return; }

        if (data.results.length === 0) {
            wrap.innerHTML = '<p style="color:var(--gray-500);font-size:14px">Ban chua hoan thanh quiz nao.</p>';
            return;
        }

        const rows = data.results.slice(0, 10).map(r => `
            <tr>
                <td></td>
                <td>${Utils.formatDuration(r.totalTime)}</td>
                <td>${Utils.formatDateTime(r.completedAt)}</td>
            </tr>
        `).join('');

        wrap.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Quiz</th><th>Thoi gian</th><th>Ngay lam</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        wrap.querySelectorAll('tbody tr').forEach((tr, idx) => {
            tr.children[0].textContent = data.results[idx].quizTitle;
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const user = await Nav.requireAuthOrRedirect();
        if (!user) return;
        loadProfile();
        loadSessions();
        loadResults();
    });
})();
