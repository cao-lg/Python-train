// 题目分片加载器

// 加载的分类缓存
const loadedCategories = new Set();

// 加载指定分类的题目
async function loadCategory(category) {
    // 检查是否已经加载过
    if (loadedCategories.has(category)) {
        console.log(`分类 ${category} 已经加载过`);
        return true;
    }
    
    try {
        // 构建正确的路径
        let basePath = '';
        if (window.location.pathname.includes('pages/')) {
            basePath = '../';
        }
        
        // 加载题目文件
        const response = await fetch(`${basePath}data/python/${category}.json`);
        if (!response.ok) {
            throw new Error(`加载 ${category} 分类题目失败`);
        }
        
        const problems = await response.json();
        
        // 存储到数据库
        for (const problem of problems) {
            await window.db.problemDB.create({
                id: problem.id,
                title: problem.title,
                description: problem.description,
                input: problem.input,
                output: problem.output,
                sample_input: problem.sample_input,
                sample_output: problem.sample_output,
                category: category,
                difficulty: problem.difficulty,
                test_cases: problem.test_cases,
                hidden_test_cases: problem.hidden_test_cases
            });
        }
        
        // 标记为已加载
        loadedCategories.add(category);
        console.log(`分类 ${category} 加载成功，共 ${problems.length} 题`);
        return true;
    } catch (error) {
        console.error(`加载分类 ${category} 失败:`, error);
        return false;
    }
}

// 加载所有分类的题目
async function loadAllCategories() {
    const categories = ['01-start', '02-variable', '03-input-output', '04-if', '05-loop', '06-string', '07-list', '08-dict', '09-function', '10-comprehensive'];
    const promises = categories.map(category => loadCategory(category));
    const results = await Promise.all(promises);
    return results.every(result => result);
}

// 初始化题目列表
async function initProblemsList() {
    // 获取 URL 参数
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category') || 'all';
    const difficulty = urlParams.get('difficulty') || 'all';
    const page = parseInt(urlParams.get('page')) || 1;
    
    // 如果指定了分类，加载该分类
    if (category !== 'all' && !loadedCategories.has(category)) {
        await loadCategory(category);
    } else if (category === 'all' && loadedCategories.size === 0) {
        // 如果是全部分类且没有加载过任何分类，加载所有分类
        await loadAllCategories();
    }
    
    // 加载题目列表
    await loadProblemsList(category, difficulty, page);
    
    // 绑定筛选事件
    bindFilterEvents();
}

// 加载题目列表
async function loadProblemsList(category = 'all', difficulty = 'all', page = 1) {
    const problemsList = document.getElementById('problems-list');
    const pageInfo = document.getElementById('page-info');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    
    if (!problemsList) return;
    
    // 显示加载中
    problemsList.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        // 检查数据库是否初始化
        if (!window.db || !window.db.problemDB) {
            throw new Error('数据库未初始化');
        }
        
        // 获取题目列表
        let problems = await window.db.problemDB.findAll();
        
        // 过滤分类
        if (category !== 'all') {
            problems = problems.filter(p => p.category === category);
        }
        
        // 过滤难度
        if (difficulty !== 'all') {
            problems = problems.filter(p => p.difficulty === difficulty);
        }
        
        // 分页
        const pageSize = 10;
        const total = problems.length;
        const totalPages = Math.ceil(total / pageSize);
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedProblems = problems.slice(start, end);
        
        // 更新页面信息
        pageInfo.textContent = `第 ${page} 页，共 ${totalPages} 页`;
        
        // 更新分页按钮状态
        prevPageBtn.disabled = page === 1;
        nextPageBtn.disabled = page === totalPages;
        
        // 生成题目列表
        if (paginatedProblems.length === 0) {
            problemsList.innerHTML = '<div class="no-problems">暂无题目</div>';
        } else {
            problemsList.innerHTML = paginatedProblems.map(problem => `
                <div class="problem-item">
                    <a href="detail.html?id=${problem.id}">${problem.title}</a>
                    <div class="problem-meta">
                        <span class="category">${problem.category}</span>
                        <span class="difficulty ${problem.difficulty}">${problem.difficulty}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('加载题目列表失败:', error);
        problemsList.innerHTML = '<div class="error">加载失败，请重试</div>';
    }
}

// 绑定筛选事件
function bindFilterEvents() {
    const categorySelect = document.getElementById('category-select');
    const difficultySelect = document.getElementById('difficulty-select');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    
    // 分类筛选
    if (categorySelect) {
        categorySelect.addEventListener('change', async function() {
            const category = this.value;
            const difficulty = difficultySelect.value;
            
            // 加载对应的分类
            if (category !== 'all') {
                await loadCategory(category);
            }
            
            // 更新 URL 参数
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.set('category', category);
            urlParams.set('difficulty', difficulty);
            urlParams.set('page', '1');
            window.history.replaceState({}, '', `?${urlParams.toString()}`);
            
            // 重新加载题目列表
            await loadProblemsList(category, difficulty, 1);
        });
    }
    
    // 难度筛选
    if (difficultySelect) {
        difficultySelect.addEventListener('change', async function() {
            const category = categorySelect.value;
            const difficulty = this.value;
            
            // 更新 URL 参数
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.set('category', category);
            urlParams.set('difficulty', difficulty);
            urlParams.set('page', '1');
            window.history.replaceState({}, '', `?${urlParams.toString()}`);
            
            // 重新加载题目列表
            await loadProblemsList(category, difficulty, 1);
        });
    }
    
    // 搜索
    if (searchBtn) {
        searchBtn.addEventListener('click', async function() {
            const keyword = searchInput.value.trim();
            if (keyword) {
                // 这里可以实现搜索功能
                alert('搜索功能开发中');
            }
        });
    }
    
    // 上一页
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', async function() {
            const urlParams = new URLSearchParams(window.location.search);
            const category = urlParams.get('category') || 'all';
            const difficulty = urlParams.get('difficulty') || 'all';
            const page = parseInt(urlParams.get('page')) || 1;
            
            if (page > 1) {
                const newPage = page - 1;
                urlParams.set('page', newPage.toString());
                window.history.replaceState({}, '', `?${urlParams.toString()}`);
                await loadProblemsList(category, difficulty, newPage);
            }
        });
    }
    
    // 下一页
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', async function() {
            const urlParams = new URLSearchParams(window.location.search);
            const category = urlParams.get('category') || 'all';
            const difficulty = urlParams.get('difficulty') || 'all';
            const page = parseInt(urlParams.get('page')) || 1;
            
            const newPage = page + 1;
            urlParams.set('page', newPage.toString());
            window.history.replaceState({}, '', `?${urlParams.toString()}`);
            await loadProblemsList(category, difficulty, newPage);
        });
    }
}

// 初始化题目详情
async function initProblemDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const problemId = urlParams.get('id');
    
    if (!problemId) {
        alert('题目 ID 不存在');
        window.location.href = 'problems.html';
        return;
    }
    
    try {
        // 检查数据库是否初始化
        if (!window.db || !window.db.problemDB) {
            throw new Error('数据库未初始化');
        }
        
        // 先尝试从数据库获取题目
        let problem = await window.db.problemDB.findById(problemId);
        
        // 如果题目不存在，尝试加载所有分类
        if (!problem) {
            console.log('题目不存在，尝试加载所有分类...');
            await loadAllCategories();
            // 再次尝试获取题目
            problem = await window.db.problemDB.findById(problemId);
        }
        
        if (!problem) {
            alert('题目不存在');
            window.location.href = 'problems.html';
            return;
        }
        
        // 调试：打印题目对象
        console.log('题目对象:', problem);
        
        // 调试：检查localStorage中的题目数据
        console.log('localStorage中的题目数据:', JSON.parse(localStorage.getItem('problems') || '[]'));
        
        // 等待DOM完全加载
        await new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
        
        // 调试：检查元素是否存在
        console.log('DOM状态:', document.readyState);
        console.log('document对象:', document);
        console.log('body元素:', document.body);
        
        // 尝试获取元素
        const titleEl = document.getElementById('problem-title');
        const categoryEl = document.getElementById('problem-category');
        const difficultyEl = document.getElementById('problem-difficulty');
        const descEl = document.getElementById('problem-desc');
        const inputTextEl = document.getElementById('problem-input-text');
        const outputTextEl = document.getElementById('problem-output-text');
        const sampleInputEl = document.getElementById('problem-sample-input');
        const sampleOutputEl = document.getElementById('problem-sample-output');
        
        console.log('元素获取结果:');
        console.log('titleEl:', titleEl);
        console.log('categoryEl:', categoryEl);
        console.log('difficultyEl:', difficultyEl);
        console.log('descEl:', descEl);
        console.log('inputTextEl:', inputTextEl);
        console.log('outputTextEl:', outputTextEl);
        console.log('sampleInputEl:', sampleInputEl);
        console.log('sampleOutputEl:', sampleOutputEl);
        
        // 填充题目信息
        console.log('开始填充题目信息');
        
        // 直接填充数据
        if (titleEl) titleEl.textContent = problem.title;
        if (categoryEl) categoryEl.textContent = problem.category;
        if (difficultyEl) difficultyEl.textContent = problem.difficulty;
        if (descEl) descEl.innerHTML = problem.description || '题目描述';
        if (inputTextEl) inputTextEl.innerHTML = problem.input || '输入格式';
        if (outputTextEl) outputTextEl.innerHTML = problem.output || '输出格式';
        if (sampleInputEl) sampleInputEl.textContent = problem.sample_input || '样例输入';
        if (sampleOutputEl) sampleOutputEl.textContent = problem.sample_output || '样例输出';
        
        console.log('填充完成');
        
        // 调试：打印填充后的值
        console.log('填充后的值:');
        if (titleEl) console.log('problem-title:', titleEl.textContent);
        if (categoryEl) console.log('problem-category:', categoryEl.textContent);
        if (difficultyEl) console.log('problem-difficulty:', difficultyEl.textContent);
        if (descEl) console.log('problem-desc:', descEl.textContent);
        if (inputTextEl) console.log('problem-input-text:', inputTextEl.textContent);
        if (outputTextEl) console.log('problem-output-text:', outputTextEl.textContent);
        if (sampleInputEl) console.log('problem-sample-input:', sampleInputEl.textContent);
        if (sampleOutputEl) console.log('problem-sample-output:', sampleOutputEl.textContent);
        
    } catch (error) {
        console.error('加载题目详情失败:', error);
        alert('加载题目详情失败');
    }
}

// 初始化函数
async function initializeLoader() {
    console.log('initializeLoader开始执行');
    
    // 等待DOM加载完成
    console.log('等待DOM加载完成，当前状态:', document.readyState);
    await new Promise(resolve => {
        if (document.readyState === 'loading') {
            console.log('DOM正在加载，等待DOMContentLoaded');
            document.addEventListener('DOMContentLoaded', () => {
                console.log('DOM加载完成');
                resolve();
            });
        } else {
            console.log('DOM已经加载完成');
            resolve();
        }
    });
    
    // 等待数据库初始化
    console.log('等待数据库初始化');
    await new Promise(resolve => {
        let checkCount = 0;
        const maxChecks = 20; // 最多检查20次（2秒）
        const checkDB = setInterval(() => {
            checkCount++;
            console.log(`检查数据库初始化状态 ${checkCount}/${maxChecks}:`, !!window.db);
            
            if (window.db) {
                console.log('数据库初始化成功');
                clearInterval(checkDB);
                resolve();
            } else if (checkCount >= maxChecks) {
                console.error('数据库初始化超时');
                clearInterval(checkDB);
                resolve(); // 超时后继续执行
            }
        }, 100);
    });
    
    // 根据当前页面初始化
    console.log('当前页面路径:', window.location.pathname);
    if (window.location.pathname.includes('problems')) {
        console.log('初始化题目列表');
        await initProblemsList();
    } else if (window.location.pathname.includes('detail')) {
        console.log('初始化题目详情');
        await initProblemDetail();
    } else {
        console.log('非题目相关页面，跳过初始化');
    }
    
    console.log('initializeLoader执行完成');
}

// 立即执行初始化
console.log('开始执行loader初始化');
initializeLoader();

// 暴露加载器函数
window.loader = {
    loadCategory,
    loadAllCategories,
    initProblemsList,
    initProblemDetail
};