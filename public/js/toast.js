class ToastManager {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
        this.toasts = [];
    }
    
    show(message, type = 'info', duration = 5000) {
        if (this.toasts.length >= 4) {
            const oldest = this.toasts[0];
            this.remove(oldest);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            'success': '✓',
            'error': '✗',
            'info': 'ℹ',
            'warning': '⚠'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close">×</button>
        `;
        
        this.container.appendChild(toast);
        this.toasts.push(toast);
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.remove(toast);
        };
        
        toast.onclick = () => this.remove(toast);
        
        const timer = setTimeout(() => this.remove(toast), duration);
        toast._timer = timer;
    }
    
    remove(toast) {
        if (!toast || !toast.parentNode) return;
        
        clearTimeout(toast._timer);
        toast.classList.add('removing');
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        }, 300);
    }
}

window.toast = new ToastManager();
window.showToast = (msg, type = 'info') => window.toast.show(msg, type);
