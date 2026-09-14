/**
 * utils.js - Cac ham tien ich dung chung cho toan bo giao dien.
 * Quan trong nhat la escapeHtml(): moi du lieu do NGUOI DUNG nhap (tieu de
 * quiz, noi dung cau hoi, dap an, ten hien thi...) BAT BUOC phai di qua
 * ham nay truoc khi chen vao innerHTML, de tranh loi bao mat XSS (chen ma
 * doc hai thong qua noi dung quiz).
 */
(function (global) {
    'use strict';

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text === undefined || text === null ? '' : String(text);
        return div.innerHTML;
    }

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : null;
    }

    function formatDate(timestamp) {
        if (!timestamp) return '';
        try {
            return new Date(timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return '';
        }
    }

    function formatDateTime(timestamp) {
        if (!timestamp) return '';
        try {
            return new Date(timestamp).toLocaleString('vi-VN');
        } catch {
            return '';
        }
    }

    // Chuyen so giay thanh dinh dang mm:ss de hien thi dong ho / ket qua.
    function formatDuration(totalSeconds) {
        const seconds = Math.max(0, Math.round(totalSeconds || 0));
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function optionLabel(index) {
        return String.fromCharCode(65 + index);
    }

    global.Utils = { escapeHtml, getCookie, formatDate, formatDateTime, formatDuration, optionLabel };
})(window);
