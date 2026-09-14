(function () {
    'use strict';

    async function loadOverview() {
        const { ok, data } = await apiGet('/api/admin/overview');
        if (!ok) return;
        const o = data.overview;
        const grid = document.getElementById('statGrid');
        const stats = [
            { label: 'Nguoi dung', value: o.userCount },
            { label: 'Tong so quiz', value: o.quizCount },
            { label: 'Quiz cong khai', value: o.publicQuizCount },
            { label: 'IP dang bi chan', value: o.blockedIpCount },
            { label: 'Luot lam bai', value: o.resultCount }
        ];
        grid.innerHTML = stats.map(s => `
            <div class="stat-card"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>
        `).join('');
    }

    async function loadBlockedIps() {
        const { ok, data } = await apiGet('/api/admin/blocked-ips');
        const body = document.getElementById('blockedIpsBody');
        if (!ok) { body.innerHTML = '<tr><td colspan="5">Khong the tai danh sach.</td></tr>'; return; }
        if (data.items.length === 0) { body.innerHTML = '<tr><td colspan="5">Chua co dia chi IP nao bi chan.</td></tr>'; return; }

        body.innerHTML = '';
        data.items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-family:monospace"></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            `;
            tr.children[0].textContent = item.ip;
            tr.children[1].textContent = item.reason || '--';
            tr.children[2].textContent = Utils.formatDateTime(item.blockedAt);
            tr.children[3].textContent = item.blockedBy || '--';
            const unblockBtn = document.createElement('button');
            unblockBtn.className = 'btn btn-outline btn-sm';
            unblockBtn.textContent = 'Mo chan';
            unblockBtn.addEventListener('click', async () => {
                unblockBtn.disabled = true;
                const res = await apiDelete(`/api/admin/blocked-ips/${encodeURIComponent(item.ip)}`);
                if (res.ok) { showToast('Da mo chan.', 'success'); loadBlockedIps(); loadOverview(); }
                else { showToast(res.data.error || 'Khong the mo chan.', 'error'); unblockBtn.disabled = false; }
            });
            tr.children[4].appendChild(unblockBtn);
            body.appendChild(tr);
        });
    }

    document.getElementById('blockIpBtn').addEventListener('click', async () => {
        const ip = document.getElementById('blockIpInput').value.trim();
        const reason = document.getElementById('blockReasonInput').value.trim();
        if (!ip) { showToast('Vui long nhap dia chi IP.', 'error'); return; }

        const btn = document.getElementById('blockIpBtn');
        btn.disabled = true;
        const { ok, data } = await apiPost('/api/admin/blocked-ips', { ip, reason });
        btn.disabled = false;

        if (ok) {
            showToast('Da chan dia chi IP.', 'success');
            document.getElementById('blockIpInput').value = '';
            document.getElementById('blockReasonInput').value = '';
            loadBlockedIps();
            loadOverview();
        } else {
            showToast(data.error || 'Khong the chan IP.', 'error');
        }
    });

    async function loadDeviceLogs() {
        const { ok, data } = await apiGet('/api/admin/device-logs');
        const body = document.getElementById('deviceLogsBody');
        if (!ok) { body.innerHTML = '<tr><td colspan="4">Khong the tai nhat ky.</td></tr>'; return; }
        if (data.logs.length === 0) { body.innerHTML = '<tr><td colspan="4">Chua co nhat ky nao.</td></tr>'; return; }

        body.innerHTML = data.logs.slice(0, 200).map(log => `
            <tr>
                <td>${Utils.escapeHtml(Utils.formatDateTime(log.timestamp))}</td>
                <td class="log-action-badge">${Utils.escapeHtml(log.action)}</td>
                <td style="font-family:monospace">${Utils.escapeHtml(log.ip)}</td>
                <td>${Utils.escapeHtml(log.deviceType)} - ${Utils.escapeHtml(log.os)} - ${Utils.escapeHtml(log.browser)}</td>
            </tr>
        `).join('');
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const user = await Nav.requireAuthOrRedirect();
        if (!user) return;
        if (user.role !== 'admin') {
            document.getElementById('deniedState').style.display = 'block';
            return;
        }
        document.getElementById('adminShell').style.display = 'block';
        loadOverview();
        loadBlockedIps();
        loadDeviceLogs();
    });
})();
