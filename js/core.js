
// 核心初始化模块
const Core = {
    async init() {
        console.log('Python OJ 系统初始化中...');
        
        // 初始化数据库
        await db.init();
        
        // 初始化用户系统
        if (window.user) {
            await user.init();
        }
        
        // 初始化主题
        this.initTheme();
        
        console.log('初始化完成！');
    },
    
    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    },
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }
};

// 暴露全局对象
window.Core = Core;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await Core.init();
    } catch (error) {
        console.error('初始化失败:', error);
    }
});
