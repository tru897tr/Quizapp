/**
 * toast.js - Thong bao noi (toast) o goc man hinh. Da bo toan bo emoji,
 * chuyen sang dung icon SVG (xem icons.js).
 */
(function () {
    'use strict';

    class ToastManager {
        constructor() {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
            this.toasts = [];
        }

        show(message, type, duration) {
            type = type || 'info';
            duration = duration || 4500;

            if (this.toasts.length >= 4) this.remove(this.toasts[0]);

            const iconName = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' }[type] || 'info';

            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                <div class="toast-icon">${Icon(iconName)}</div>
                <div class="toast-message">${Utils.escapeHtml(message)}</div>
                <button class="toast-close" type="button" aria-label="Dong thong bao">${Icon('close')}</button>
            `;

            this.container.appendChild(toast);
            this.toasts.push(toast);

            toast.querySelector('.toast-close').addEventListener('click', (e) => {
                e.stopPropagation();
                this.remove(toast);
            });

            const timer = setTimeout(() => this.remove(toast), duration);
            toast._timer = timer;
        }

        remove(toast) {
            if (!toast || !toast.parentNode) return;
            clearTimeout(toast._timer);
            toast.classList.add('removing');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
                const index = this.toasts.indexOf(toast);
                if (index > -1) this.toasts.splice(index, 1);
            }, 250);
        }
    }

    window.toast = new ToastManager();
    window.showToast = (msg, type) => window.toast.show(msg, type);
})();
