/**
 * 初始化主题
 * Initialize theme
 */
function initTheme() {
    // 从本地存储获取主题，默认为 auto / Get theme from local storage, default to auto
    const savedTheme = localStorage.getItem('theme') || 'auto';
    applyTheme(savedTheme);
    updateThemeButtons(savedTheme);
}

/**
 * 应用主题
 * Apply theme
 * @param {string} theme - 主题：'light', 'dark', 'auto' / Theme: 'light', 'dark', 'auto'
 */
function applyTheme(theme) {
    let effectiveTheme = theme;
    
    // 如果是 auto，根据系统偏好决定 / If auto, determine based on system preference
    if (theme === 'auto') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    // 设置 Bootstrap 主题属性 / Set Bootstrap theme attribute
    document.documentElement.setAttribute('data-bs-theme', effectiveTheme);
    
    // 添加或移除 dark-mode 类 / Add or remove dark-mode class
    if (effectiveTheme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    // 更新版本内容区域的样式 / Update version content area style
    const versionContent = document.querySelector('.version-content');
    if (versionContent) {
        if (effectiveTheme === 'dark') {
            versionContent.style.background = '#2b2b2b';
            versionContent.style.color = '#e0e0e0';
        } else {
            versionContent.style.background = '#f8f9fa';
            versionContent.style.color = '#212529';
        }
    }
}

/**
 * 更新主题按钮状态
 * Update theme button states
 * @param {string} theme - 当前主题 / Current theme
 */
function updateThemeButtons(theme) {
    ['light', 'dark', 'auto'].forEach(t => {
        const btn = document.getElementById('theme' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn) {
            // 切换 active 类 / Toggle active class
            btn.classList.toggle('active', t === theme);
        }
    });
}

/**
 * 设置主题
 * Set theme
 * @param {string} theme - 主题：'light', 'dark', 'auto' / Theme: 'light', 'dark', 'auto'
 */
function setTheme(theme) {
    // 保存到本地存储 / Save to local storage
    localStorage.setItem('theme', theme);
    
    // 应用主题 / Apply theme
    applyTheme(theme);
    
    // 更新按钮状态 / Update button states
    updateThemeButtons(theme);
}

// DOM 加载完成后初始化 / Initialize after DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    // 初始化主题 / Initialize theme
    initTheme();
    
    // 绑定主题按钮点击事件 / Bind theme button click events
    document.getElementById('themeLight')?.addEventListener('click', () => setTheme('light'));
    document.getElementById('themeDark')?.addEventListener('click', () => setTheme('dark'));
    document.getElementById('themeAuto')?.addEventListener('click', () => setTheme('auto'));
    
    // 监听系统主题变化 / Listen for system theme change
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        // 只有在 auto 模式下才响应 / Only respond in auto mode
        if (localStorage.getItem('theme') === 'auto') {
            applyTheme('auto');
        }
    });
});
