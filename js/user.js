// 用户系统功能

// 初始化用户系统
function initUserSystem() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleLogin();
        });
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleRegister();
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            handleLogout();
        });
    }
    
    // 检查登录状态
    checkLoginStatus();
}

// 检查登录状态
async function checkLoginStatus() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const loginRegister = document.getElementById('login-register');
    const userInfo = document.getElementById('user-info');
    
    if (currentUser) {
        // 显示用户信息
        if (loginRegister) loginRegister.style.display = 'none';
        if (userInfo) userInfo.style.display = 'block';
        
        // 加载用户统计数据
        await loadUserStats(currentUser.id);
        // 加载提交历史
        await loadSubmissionHistory(currentUser.id);
    } else {
        // 显示登录/注册表单
        if (loginRegister) loginRegister.style.display = 'block';
        if (userInfo) userInfo.style.display = 'none';
    }
}

// 处理登录
async function handleLogin() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        alert('请输入用户名和密码');
        return;
    }
    
    try {
        // 查找用户
        const user = await db.userDB.findByUsername(username);
        
        if (!user) {
            alert('用户不存在');
            return;
        }
        
        // 验证密码（实际项目中应该使用加密）
        if (user.password !== password) {
            alert('密码错误');
            return;
        }
        
        // 存储用户信息
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        // 刷新页面
        window.location.reload();
    } catch (error) {
        console.error('登录失败:', error);
        alert('登录失败，请重试');
    }
}

// 处理注册
async function handleRegister() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    if (!username || !password || !confirmPassword) {
        alert('请填写所有字段');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('两次输入的密码不一致');
        return;
    }
    
    try {
        // 检查用户是否已存在
        const existingUser = await db.userDB.findByUsername(username);
        if (existingUser) {
            alert('用户名已存在');
            return;
        }
        
        // 创建用户
        const success = await db.userDB.create(username, password);
        if (success) {
            alert('注册成功，请登录');
            // 清空表单
            document.getElementById('register-form').reset();
        } else {
            alert('注册失败，请重试');
        }
    } catch (error) {
        console.error('注册失败:', error);
        alert('注册失败，请重试');
    }
}

// 处理退出登录
function handleLogout() {
    localStorage.removeItem('currentUser');
    window.location.reload();
}

// 加载用户统计数据
async function loadUserStats(userId) {
    try {
        const acCount = await db.scoreDB.getACCount(userId);
        const submissionCount = await db.scoreDB.getSubmissionCount(userId);
        const acRate = submissionCount > 0 ? (acCount / submissionCount * 100).toFixed(2) : 0;
        
        document.getElementById('username').textContent = JSON.parse(localStorage.getItem('currentUser')).username;
        document.getElementById('ac-count').textContent = acCount;
        document.getElementById('submit-count').textContent = submissionCount;
        document.getElementById('ac-rate').textContent = `${acRate}%`;
    } catch (error) {
        console.error('加载用户统计数据失败:', error);
    }
}

// 加载提交历史
async function loadSubmissionHistory(userId, page = 1) {
    try {
        const result = await db.submissionDB.getUserSubmissions(userId, page, 10);
        const submissions = result.submissions;
        const submissionList = document.getElementById('submission-list');
        
        if (submissions.length === 0) {
            submissionList.innerHTML = '<div class="no-submissions">暂无提交记录</div>';
        } else {
            submissionList.innerHTML = submissions.map(submission => `
                <div class="submission-item">
                    <div class="submission-info">
                        <div class="problem-title">${submission.title}</div>
                        <div class="submission-time">${new Date(submission.created_at).toLocaleString()}</div>
                    </div>
                    <div class="submission-result ${submission.result}">${submission.result}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('加载提交历史失败:', error);
        document.getElementById('submission-list').innerHTML = '<div class="error">加载失败，请重试</div>';
    }
}

// 初始化
window.addEventListener('DOMContentLoaded', function() {
    initUserSystem();
});

// 暴露用户系统功能
window.user = {
    initUserSystem,
    checkLoginStatus,
    handleLogin,
    handleRegister,
    handleLogout,
    loadUserStats,
    loadSubmissionHistory
};