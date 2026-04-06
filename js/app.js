
// 全局应用逻辑
let currentUser = null;

// 初始化应用
function initApp() {
    // 主题初始化由 core.js 处理
    // 检查用户登录状态
    checkLoginStatus();
    // 绑定导航事件
    bindNavigationEvents();
    // 绑定主题切换事件
    bindThemeToggle();
}

// 绑定主题切换事件
function bindThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            if (window.Core) {
                window.Core.toggleTheme();
                updateThemeButton();
            }
        });
        updateThemeButton();
    }
}

// 更新主题按钮图标
function updateThemeButton() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    }
}

// 检查用户登录状态
function checkLoginStatus() {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
        currentUser = JSON.parse(userData);
        updateUserLink();
    }
}

// 更新用户链接
function updateUserLink() {
    const userLink = document.getElementById('user-link');
    if (userLink) {
        if (currentUser) {
            userLink.textContent = currentUser.username;
        } else {
            userLink.textContent = '个人中心';
        }
    }
}

// 绑定导航事件
function bindNavigationEvents() {
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // 这里可以添加导航逻辑
        });
    });
}

// 显示消息
function showMessage(message, type = 'info') {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    document.body.appendChild(messageElement);
    
    setTimeout(() => {
        messageElement.remove();
    }, 3000);
}

// 跳转到题目详情页
function navigateToProblem(id) {
    window.location.href = `pages/detail.html?id=${id}`;
}

// 跳转到用户中心
function navigateToUser() {
    window.location.href = 'pages/user.html';
}

// 退出登录
function logout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    updateUserLink();
    showMessage('退出登录成功');
    window.location.href = 'index.html';
}

// 初始化应用
window.addEventListener('DOMContentLoaded', initApp);

// 暴露全局函数
window.app = {
    currentUser,
    checkLoginStatus,
    updateUserLink,
    showMessage,
    navigateToProblem,
    navigateToUser,
    logout
};
