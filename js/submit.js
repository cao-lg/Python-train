// 代码提交功能

let currentProblemId = null;
let editor = null;

// 初始化提交功能
function initSubmit() {
    console.log('initSubmit开始执行');
    
    const submitBtn = document.getElementById('submit-btn');
    const runBtn = document.getElementById('run-btn');
    const copyBtn = document.getElementById('copy-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resultDisplay = document.getElementById('result-display');
    const consoleText = document.getElementById('console-text');
    
    console.log('元素检查:', {
        submitBtn,
        runBtn,
        copyBtn,
        resetBtn,
        resultDisplay,
        consoleText
    });
    
    // 获取题目 ID
    const urlParams = new URLSearchParams(window.location.search);
    currentProblemId = urlParams.get('id');
    
    console.log('当前题目ID:', currentProblemId);
    
    // 初始化 CodeMirror 编辑器
    const container = document.getElementById('code-editor-container');
    if (container) {
        editor = CodeMirror(container, {
            mode: 'python',
            theme: 'default',
            lineNumbers: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            lineWrapping: true,
            autofocus: true,
            placeholder: '请输入 Python 代码...'
        });
        
        // 设置编辑器高度
        editor.setSize('100%', '300px');
        
        // 当窗口大小改变时，重新调整编辑器高度
        window.addEventListener('resize', function() {
            if (editor) {
                const container = document.querySelector('.editor-wrapper');
                if (container) {
                    editor.setSize('100%', container.clientHeight + 'px');
                }
            }
        });
        
        // 延迟设置一次高度，确保容器大小已计算完成
        setTimeout(function() {
            if (editor) {
                const container = document.querySelector('.editor-wrapper');
                if (container) {
                    editor.setSize('100%', container.clientHeight + 'px');
                }
            }
        }, 100);
        
        // 根据主题切换编辑器主题
        const updateEditorTheme = () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            editor.setOption('theme', isDark ? 'dracula' : 'default');
        };
        
        // 监听主题变化
        const observer = new MutationObserver(updateEditorTheme);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
        
        // 初始化主题
        updateEditorTheme();
        
        console.log('CodeMirror 编辑器初始化完成');
        
        // 暴露编辑器到 window 对象
        window.editor = editor;
        
        // 编辑器内容变化时自动保存
        editor.on('change', function() {
            if (currentProblemId) {
                saveDraft(currentProblemId, editor.getValue());
            }
        });
    }
    
    // 加载草稿
    if (currentProblemId) {
        loadDraft(currentProblemId);
    }
    
    if (runBtn) {
        console.log('绑定运行按钮事件');
        runBtn.addEventListener('click', async function() {
            console.log('运行按钮被点击');
            await handleRun();
        });
    }
    
    if (submitBtn) {
        console.log('绑定提交按钮事件');
        submitBtn.addEventListener('click', async function() {
            console.log('提交按钮被点击');
            await handleSubmit();
        });
    }
    
    if (copyBtn) {
        copyBtn.addEventListener('click', function() {
            handleCopy();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            handleReset();
        });
    }
    
    console.log('initSubmit执行完成');
}

// 保存草稿
function saveDraft(problemId, code) {
    try {
        const drafts = JSON.parse(localStorage.getItem('code_drafts') || '{}');
        drafts[problemId] = {
            code: code,
            savedAt: Date.now()
        };
        localStorage.setItem('code_drafts', JSON.stringify(drafts));
    } catch (error) {
        console.error('保存草稿失败:', error);
    }
}

// 加载草稿
function loadDraft(problemId) {
    try {
        const drafts = JSON.parse(localStorage.getItem('code_drafts') || '{}');
        const draft = drafts[problemId];
        
        if (draft && draft.code && editor) {
            editor.setValue(draft.code);
        }
    } catch (error) {
        console.error('加载草稿失败:', error);
    }
}

// 处理运行代码
async function handleRun() {
    console.log('handleRun 函数开始执行');
    
    const consoleText = document.getElementById('console-text');
    
    console.log('元素获取:', { consoleText, editor });
    
    if (!consoleText || !editor) {
        console.error('缺少必要的DOM元素或编辑器');
        return;
    }
    
    const code = editor.getValue().trim();
    console.log('获取到的代码:', code);
    
    if (!code) {
        consoleText.textContent = '请输入代码';
        return;
    }
    
    // 显示运行中
    consoleText.textContent = '运行中...';
    console.log('已设置控制台为\"运行中...\"');
    
    try {
        console.log('检查 engine 对象:', window.engine);
        
        // 检查 engine 是否加载
        if (!window.engine || !window.engine.initPyodide || !window.engine.executeCode) {
            throw new Error('判题引擎未加载');
        }
        
        console.log('开始初始化 Pyodide');
        await window.engine.initPyodide();
        console.log('Pyodide 初始化完成');
        
        // 获取题目以获取样例输入
        let sampleInput = '';
        if (currentProblemId) {
            const problem = await window.db.problemDB.findById(currentProblemId);
            if (problem) {
                sampleInput = problem.sample_input;
            }
        }
        
        console.log('开始执行代码');
        // 运行代码
        const result = await window.engine.executeCode(code, 5000);
        console.log('代码执行完成，结果:', result);
        
        // 显示输出
        if (result.stdout) {
            consoleText.textContent = result.stdout;
        } else if (result.stderr) {
            consoleText.textContent = `Error: ${result.stderr}`;
        } else {
            consoleText.textContent = '没有输出';
        }
        console.log('已更新控制台输出');
    } catch (error) {
        console.error('运行代码失败:', error);
        consoleText.textContent = '运行失败: ' + error.message;
    }
    
    console.log('handleRun 函数执行结束');
}

// 处理代码提交
async function handleSubmit() {
    const resultDisplay = document.getElementById('result-display');
    const submitBtn = document.getElementById('submit-btn');
    
    if (!resultDisplay || !submitBtn || !editor) return;
    
    // 获取代码和题目 ID
    const code = editor.getValue().trim();
    
    if (!code) {
        resultDisplay.innerHTML = '<div class="error">请输入代码</div>';
        return;
    }
    
    if (!currentProblemId) {
        resultDisplay.innerHTML = '<div class="error">题目 ID 不存在</div>';
        return;
    }
    
    // 检查用户登录状态
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        resultDisplay.innerHTML = '<div class="error">请先登录</div>';
        return;
    }
    
    // 显示加载中
    submitBtn.disabled = true;
    resultDisplay.innerHTML = '<div class="loading">判题中...</div>';
    
    try {
        // 检查 engine 是否加载
        if (!window.engine || !window.engine.judge) {
            throw new Error('判题引擎未加载');
        }
        
        // 调用判题引擎
        const judgeResult = await window.engine.judge(code, currentProblemId);
        
        // 显示结果
        displayResult(judgeResult, resultDisplay);
        
        // 存储提交记录
        await window.db.submissionDB.create(currentUser.id, currentProblemId, code, judgeResult.result);
        
    } catch (error) {
        console.error('提交失败:', error);
        resultDisplay.innerHTML = '<div class="error">提交失败，请重试</div>';
    } finally {
        submitBtn.disabled = false;
    }
}

// 标准化输出
function normalizeOutput(output) {
    return output
        .trim()
        .replace(/\r\n/g, '\n')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

// 显示判题结果
function displayResult(result, container) {
    let html = '';
    
    switch (result.result) {
        case 'AC':
            html = '<div class="result AC">✅ 通过！</div>';
            break;
        case 'WA':
            html = `
                <div class="result WA">❌ 答案错误</div>
                <div class="expected-output">
                    <strong>期望输出:</strong>
                    <pre>${result.expected}</pre>
                </div>
                <div class="actual-output">
                    <strong>实际输出:</strong>
                    <pre>${result.actual}</pre>
                </div>
            `;
            break;
        case 'CE':
            html = `
                <div class="result CE">⚠️ 语法错误</div>
                <div class="error-message">${result.message}</div>
            `;
            break;
        case 'RE':
            html = `
                <div class="result RE">🚨 运行异常</div>
                <div class="error-message">${result.message}</div>
            `;
            break;
        case 'TLE':
            html = '<div class="result TLE">⏰ 执行超时</div>';
            break;
        default:
            html = `<div class="result ERROR">${result.message}</div>`;
    }
    
    container.innerHTML = html;
}

// 处理复制代码
function handleCopy() {
    if (!editor) return;
    
    const code = editor.getValue();
    navigator.clipboard.writeText(code).then(() => {
        showMessage('代码已复制到剪贴板');
    }).catch(err => {
        console.error('复制失败:', err);
        showMessage('复制失败');
    });
}

// 处理重置代码
function handleReset() {
    const resultDisplay = document.getElementById('result-display');
    const consoleText = document.getElementById('console-text');
    
    if (editor) {
        editor.setValue('');
    }
    
    if (resultDisplay) {
        resultDisplay.innerHTML = '提交结果将在此显示';
    }
    
    if (consoleText) {
        consoleText.textContent = '';
    }
    
    // 清除草稿
    if (currentProblemId) {
        try {
            const drafts = JSON.parse(localStorage.getItem('code_drafts') || '{}');
            delete drafts[currentProblemId];
            localStorage.setItem('code_drafts', JSON.stringify(drafts));
        } catch (error) {
            console.error('清除草稿失败:', error);
        }
    }
}

// 显示消息
function showMessage(message) {
    // 创建消息元素
    const messageElement = document.createElement('div');
    messageElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: var(--accent-primary);
        color: #fff;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    messageElement.textContent = message;
    
    // 添加动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(messageElement);
    
    // 3秒后移除
    setTimeout(() => {
        messageElement.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            messageElement.remove();
            style.remove();
        }, 300);
    }, 3000);
}

// 初始化
function initSubmitOnLoad() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSubmit);
    } else {
        initSubmit();
    }
}

// 立即执行初始化
initSubmitOnLoad();

// 暴露提交功能
window.submit = {
    initSubmit,
    handleSubmit,
    handleRun,
    handleCopy,
    handleReset,
    displayResult
};
