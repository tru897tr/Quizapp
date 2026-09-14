(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        try {
            const res = await fetch('/api/device-info');
            const data = await res.json();
            const d = data.device;
            document.getElementById('deviceInfoList').innerHTML = `
                <div class="device-info-row"><span>Dia chi IP</span><span>${Utils.escapeHtml(d.ip)}</span></div>
                <div class="device-info-row"><span>Loai thiet bi</span><span>${Utils.escapeHtml(d.deviceType)}</span></div>
                <div class="device-info-row"><span>He dieu hanh</span><span>${Utils.escapeHtml(d.os)}</span></div>
                <div class="device-info-row"><span>Trinh duyet</span><span>${Utils.escapeHtml(d.browser)}</span></div>
            `;
        } catch {
            document.getElementById('deviceInfoList').innerHTML = '<div class="device-info-row"><span>Khong the tai thong tin thiet bi.</span><span></span></div>';
        }
    });
})();
