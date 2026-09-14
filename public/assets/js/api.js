/**
 * api.js - Lop goi API dung chung cho toan bo giao dien.
 * Tu dong dinh kem header "X-CSRF-Token" (lay tu cookie) cho moi yeu cau
 * lam thay doi du lieu (POST/PUT/DELETE/PATCH) de chong gia mao yeu cau
 * lien trang (CSRF) - xem giai thich chi tiet trong server.js.
 */
(function (global) {
    'use strict';

    async function apiFetch(url, options) {
        const opts = Object.assign({}, options || {});
        const method = (opts.method || 'GET').toUpperCase();
        opts.headers = Object.assign({}, opts.headers || {});
        opts.credentials = 'same-origin';

        if (method !== 'GET' && method !== 'HEAD') {
            const csrfToken = Utils.getCookie('csrfToken');
            if (csrfToken) opts.headers['X-CSRF-Token'] = csrfToken;
            if (opts.body && typeof opts.body === 'string' && !opts.headers['Content-Type']) {
                opts.headers['Content-Type'] = 'application/json';
            }
        }

        let response;
        try {
            response = await fetch(url, opts);
        } catch (networkError) {
            return { ok: false, status: 0, data: { error: 'Khong the ket noi den may chu. Vui long kiem tra mang.' } };
        }

        let data = null;
        try {
            data = await response.json();
        } catch {
            data = null;
        }

        return { ok: response.ok, status: response.status, data: data || {} };
    }

    function apiPost(url, body) {
        return apiFetch(url, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
    }
    function apiPut(url, body) {
        return apiFetch(url, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined });
    }
    function apiDelete(url) {
        return apiFetch(url, { method: 'DELETE' });
    }
    function apiGet(url) {
        return apiFetch(url, { method: 'GET' });
    }

    global.apiFetch = apiFetch;
    global.apiGet = apiGet;
    global.apiPost = apiPost;
    global.apiPut = apiPut;
    global.apiDelete = apiDelete;
})(window);
