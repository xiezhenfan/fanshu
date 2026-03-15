// 当前语言 / Current language
let currentLang = localStorage.getItem('lang') || 'zh-CN';

// 国际化数据 / Localization data
let i18nData = {};

/**
 * 加载指定语言的国际化数据
 * Load localization data for specified language
 * @param {string} lang - 语言代码 / Language code
 */
async function loadLocale(lang) {
    try {
        const response = await fetch(`/api/locale/${lang}`);
        i18nData = await response.json();
        
        // 保存到本地存储 / Save to local storage
        localStorage.setItem('lang', lang);
        currentLang = lang;
        
        // 更新页面文本 / Update page text
        updatePageText();
        
        // 设置 HTML 语言属性 / Set HTML language attribute
        document.documentElement.lang = lang;
    } catch (error) {
        console.error('Failed to load locale:', error);
    }
}

/**
 * 获取翻译文本
 * Get translated text
 * @param {string} key - 翻译键，如 'common.save' / Translation key, e.g., 'common.save'
 * @returns {string} 翻译文本 / Translated text
 */
function t(key) {
    const keys = key.split('.');
    let value = i18nData;
    
    // 逐级查找 / Look up level by level
    for (const k of keys) {
        if (value && value[k]) {
            value = value[k];
        } else {
            // 未找到时返回键本身 / Return key itself if not found
            return key;
        }
    }
    return value;
}

/**
 * 更新页面上所有的文本
 * Update all text on the page
 */
function updatePageText() {
    // 更新带 data-i18n 属性的元素 / Update elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    
    // 更新带 data-i18n-placeholder 属性的占位符 / Update placeholders with data-i18n-placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}

/**
 * 获取当前语言
 * Get current language
 * @returns {string} 当前语言代码 / Current language code
 */
function getCurrentLang() {
    return currentLang;
}

// DOM 加载完成后初始化 / Initialize after DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    // 初始化语言选择器 / Initialize language selector
    const langSelect = document.getElementById('langSelect');
    if (langSelect) {
        langSelect.value = currentLang;
        
        // 监听语言变化 / Listen for language change
        langSelect.addEventListener('change', (e) => {
            loadLocale(e.target.value);
        });
    }
    
    // 加载当前语言 / Load current language
    loadLocale(currentLang);
});
