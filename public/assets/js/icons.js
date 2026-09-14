/**
 * icons.js
 * ----------------------------------------------------------------------
 * Bo icon SVG dung chung cho toan bo ung dung - thay the hoan toan cho
 * emoji. Moi icon la mot chuoi SVG "inline" (khong can tai file rieng,
 * khong co do tre tai anh, tu dong doi mau theo CSS "currentColor").
 *
 * Cach dung:
 *   Icon('home')                    -> tra ve chuoi SVG (dua vao innerHTML)
 *   Icon('home', 'icon-lg')         -> them class CSS "icon-lg" vao <svg>
 *   initPageIcons()                 -> tim moi the co [data-icon="ten"]
 *                                      trong trang va thay bang SVG tuong ung
 * ----------------------------------------------------------------------
 */
(function (global) {
    'use strict';

    const ICONS = {
        home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1v-9"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        'plus-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
        book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/>',
        logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
        close: '<path d="M18 6 6 18M6 6l12 12"/>',
        lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
        'lock-open': '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.4-2.1"/>',
        globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
        bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
        chart: '<path d="M4 20V10M12 20V4M20 20v-7"/><path d="M2 20h20"/>',
        play: '<path d="M7 4.5v15l13-7.5-13-7.5z"/>',
        'external-link': '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
        copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
        trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
        share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8 15.8 6.2M8.2 13.2l7.6 4.6"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
        'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
        'alert-triangle': '<path d="M10.3 3.9 1.9 18a1 1 0 0 0 .9 1.5h18.4a1 1 0 0 0 .9-1.5L13.7 3.9a1 1 0 0 0-1.7 0z"/><path d="M12 9v4"/><circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none"/>',
        trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 5H4.5A1.5 1.5 0 0 0 3 6.5 4 4 0 0 0 7 10.4"/><path d="M16 5h3.5A1.5 1.5 0 0 1 21 6.5 4 4 0 0 1 17 10.4"/><path d="M12 13v3"/><path d="M8.5 20.5h7"/><path d="M9.5 16.5h5l.7 4h-6.4z"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
        shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/>',
        'shield-check': '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
        'eye-off': '<path d="M3 3l18 18"/><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a13.4 13.4 0 0 1-3 3.9M6.2 6.2C3.7 7.9 2 12 2 12s3.5 7 10 7a10.6 10.6 0 0 0 4.2-.9"/><path d="M9.5 9.8a3 3 0 0 0 4.2 4.2"/>',
        'arrow-left': '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>',
        'arrow-right': '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/>',
        mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
        key: '<circle cx="8" cy="15" r="4"/><path d="M11 12 20 3"/><path d="M17 6l3 3M14 9l2.5 2.5"/>',
        expand: '<path d="M8 3H4v4M16 3h4v4M8 21H4v-4M16 21h4v-4"/>',
        shrink: '<path d="M4 9h4V5M4 9l5-5M20 9h-4V5M20 9l-5-5M4 15h4v4M4 15l5 5M20 15h-4v4M20 15l-5 5"/>',
        'dots-vertical': '<circle cx="12" cy="5" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.3" fill="currentColor" stroke="none"/>',
        'chevron-down': '<path d="m6 9 6 6 6-6"/>',
        refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
        flag: '<path d="M5 3v18"/><path d="M5 4h11l-2 4 2 4H5"/>',
        smartphone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
        monitor: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
        tablet: '<rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M11 19h2"/>',
        wifi: '<path d="M2 8.5a16 16 0 0 1 20 0"/><path d="M5.5 12.5a11 11 0 0 1 13 0"/><path d="M9 16.5a6 6 0 0 1 6 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none"/>',
        upload: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
        list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none"/>',
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
        medal: '<circle cx="12" cy="15" r="6"/><path d="M9.5 9.5 7 3h3l2 5M14.5 9.5 17 3h-3l-2 5"/><path d="M12 12v6"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
        calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18"/>'
    };

    function Icon(name, extraClass) {
        const body = ICONS[name];
        if (!body) return '';
        const cls = 'icon' + (extraClass ? ' ' + extraClass : '');
        return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
    }

    function initPageIcons(root) {
        const scope = root || document;
        scope.querySelectorAll('[data-icon]').forEach(el => {
            const name = el.getAttribute('data-icon');
            const cls = el.getAttribute('data-icon-class') || '';
            if (ICONS[name]) el.innerHTML = Icon(name, cls);
        });
    }

    global.Icon = Icon;
    global.initPageIcons = initPageIcons;

    document.addEventListener('DOMContentLoaded', () => initPageIcons());
})(window);
