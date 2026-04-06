// 本地存储数据库管理

// 初始化数据库
function initDB() {
    console.log('本地存储数据库初始化成功');
    return Promise.resolve();
}

// 用户数据库操作
const userDB = {
    async create(username, password) {
        try {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            // 检查用户名是否已存在
            if (users.some(user => user.username === username)) {
                return false;
            }
            // 创建新用户
            const newUser = {
                id: Date.now(),
                username,
                password,
                created_at: new Date().toISOString()
            };
            users.push(newUser);
            localStorage.setItem('users', JSON.stringify(users));
            return true;
        } catch (error) {
            console.error('创建用户失败:', error);
            return false;
        }
    },
    
    async findByUsername(username) {
        try {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            return users.find(user => user.username === username);
        } catch (error) {
            console.error('查找用户失败:', error);
            return null;
        }
    },
    
    async findById(id) {
        try {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            return users.find(user => user.id === parseInt(id));
        } catch (error) {
            console.error('查找用户失败:', error);
            return null;
        }
    }
};

// 题目数据库操作
const problemDB = {
    async create(problem) {
        try {
            const problems = JSON.parse(localStorage.getItem('problems') || '[]');
            // 检查题目是否已存在
            if (!problems.some(p => p.id === problem.id)) {
                problems.push(problem);
                localStorage.setItem('problems', JSON.stringify(problems));
            }
            return true;
        } catch (error) {
            console.error('创建题目失败:', error);
            return false;
        }
    },
    
    async findById(id) {
        try {
            const problems = JSON.parse(localStorage.getItem('problems') || '[]');
            return problems.find(p => p.id === parseInt(id));
        } catch (error) {
            console.error('查找题目失败:', error);
            return null;
        }
    },
    
    async findAll() {
        try {
            return JSON.parse(localStorage.getItem('problems') || '[]');
        } catch (error) {
            console.error('获取题目列表失败:', error);
            return [];
        }
    },
    
    async findByCategory(category) {
        try {
            const problems = JSON.parse(localStorage.getItem('problems') || '[]');
            return problems.filter(p => p.category === category);
        } catch (error) {
            console.error('按分类查找题目失败:', error);
            return [];
        }
    }
};

// 提交记录数据库操作
const submissionDB = {
    async create(user_id, problem_id, code, result) {
        try {
            const submissions = JSON.parse(localStorage.getItem('submissions') || '[]');
            const newSubmission = {
                id: Date.now(),
                user_id,
                problem_id,
                code,
                result,
                created_at: new Date().toISOString()
            };
            submissions.push(newSubmission);
            localStorage.setItem('submissions', JSON.stringify(submissions));
            return true;
        } catch (error) {
            console.error('创建提交记录失败:', error);
            return false;
        }
    },
    
    async findByUser(user_id) {
        try {
            const submissions = JSON.parse(localStorage.getItem('submissions') || '[]');
            return submissions
                .filter(s => s.user_id === user_id)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } catch (error) {
            console.error('获取用户提交记录失败:', error);
            return [];
        }
    },
    
    async findByProblem(problem_id) {
        try {
            const submissions = JSON.parse(localStorage.getItem('submissions') || '[]');
            return submissions
                .filter(s => s.problem_id === problem_id)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } catch (error) {
            console.error('获取题目提交记录失败:', error);
            return [];
        }
    },
    
    async getUserSubmissions(user_id, page = 1, pageSize = 10) {
        try {
            const submissions = JSON.parse(localStorage.getItem('submissions') || '[]');
            const userSubmissions = submissions
                .filter(s => s.user_id === user_id)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            const start = (page - 1) * pageSize;
            const end = start + pageSize;
            const paginatedSubmissions = userSubmissions.slice(start, end);
            
            // 为每个提交记录添加题目信息
            const problems = JSON.parse(localStorage.getItem('problems') || '[]');
            const submissionsWithTitle = paginatedSubmissions.map(submission => {
                const problem = problems.find(p => p.id === submission.problem_id);
                return {
                    ...submission,
                    title: problem ? problem.title : '题目不存在'
                };
            });
            
            return {
                submissions: submissionsWithTitle,
                total: userSubmissions.length,
                page,
                pageSize
            };
        } catch (error) {
            console.error('获取用户提交记录失败:', error);
            return {
                submissions: [],
                total: 0,
                page: 1,
                pageSize: 10
            };
        }
    }
};

// 成绩数据库操作
const scoreDB = {
    async update(user_id, problem_id, ac) {
        try {
            const scores = JSON.parse(localStorage.getItem('scores') || '[]');
            const existingScoreIndex = scores.findIndex(
                s => s.user_id === user_id && s.problem_id === problem_id
            );
            
            if (existingScoreIndex !== -1) {
                scores[existingScoreIndex].ac = ac;
            } else {
                scores.push({
                    id: Date.now(),
                    user_id,
                    problem_id,
                    ac
                });
            }
            
            localStorage.setItem('scores', JSON.stringify(scores));
            return true;
        } catch (error) {
            console.error('更新成绩失败:', error);
            return false;
        }
    },
    
    async getScore(user_id) {
        try {
            const scores = JSON.parse(localStorage.getItem('scores') || '[]');
            return scores.filter(s => s.user_id === user_id);
        } catch (error) {
            console.error('获取成绩失败:', error);
            return [];
        }
    },
    
    async getACCount(user_id) {
        try {
            const scores = JSON.parse(localStorage.getItem('scores') || '[]');
            return scores.filter(s => s.user_id === user_id && s.ac).length;
        } catch (error) {
            console.error('获取 AC 数量失败:', error);
            return 0;
        }
    },
    
    async getSubmissionCount(user_id) {
        try {
            const submissions = JSON.parse(localStorage.getItem('submissions') || '[]');
            return submissions.filter(s => s.user_id === user_id).length;
        } catch (error) {
            console.error('获取提交数量失败:', error);
            return 0;
        }
    }
};

// 初始化数据库
initDB().then(() => {
    console.log('数据库初始化成功');
}).catch(error => {
    console.error('数据库初始化失败:', error);
});

// 暴露数据库操作
window.db = {
    init: initDB,
    initDB,
    userDB,
    problemDB,
    submissionDB,
    scoreDB
};