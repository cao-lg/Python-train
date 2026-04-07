// Python 判题引擎 - 基于 Pyodide（Assert 单元测试风格）

let pyodide = null;

// 初始化 Pyodide
async function initPyodide() {
    if (!pyodide) {
        try {
            pyodide = await loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
            });
            console.log('Pyodide 初始化成功');
        } catch (error) {
            console.error('Pyodide 初始化失败:', error);
            throw error;
        }
    }
    return pyodide;
}

// 标准化输出（去空格、换行、大小写）
function normalizeOutput(output) {
    if (!output) return '';
    return output.toString()
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim()
        .toLowerCase();
}

// 执行 Python 代码并捕获输出
async function executeCode(code, timeout = 5000) {
    await initPyodide();
    
    return new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject({ type: 'TLE', message: '执行超时（超过5秒）' });
        }, timeout);
        
        try {
            const setupCode = `
import sys
from io import StringIO

old_stdout = sys.stdout
old_stderr = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()
`;
            
            const cleanupCode = `
stdout_output = sys.stdout.getvalue()
stderr_output = sys.stderr.getvalue()
sys.stdout = old_stdout
sys.stderr = old_stderr
(stdout_output, stderr_output)
`;
            
            const result = await pyodide.runPythonAsync(setupCode + code + '\n' + cleanupCode);
            
            clearTimeout(timeoutId);
            resolve({
                stdout: result[0],
                stderr: result[1]
            });
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'PythonError') {
                if (error.message.includes('SyntaxError')) {
                    reject({ type: 'CE', message: '语法错误: ' + error.message });
                } else if (error.message.includes('AssertionError')) {
                    reject({ type: 'WA', message: '答案错误: ' + error.message });
                } else {
                    reject({ type: 'RE', message: '运行错误: ' + error.message });
                }
            } else {
                reject({ type: 'RE', message: '未知错误: ' + error.message });
            }
        }
    });
}

// 使用 Assert 风格判题
async function judgeWithAssert(code, problem) {
    try {
        await initPyodide();
        
        const testCases = [
            ...(problem.test_cases || []),
            ...(problem.hidden_test_cases || [])
        ];
        
        if (testCases.length === 0) {
            testCases.push({
                input: problem.sample_input || '',
                expected: problem.sample_output || ''
            });
        }
        
        let allPassed = true;
        let failedTest = null;
        
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            
            const testCode = `
# 用户代码
${code}

# 测试用例 ${i + 1}
import sys
from io import StringIO

test_input = """${testCase.input.replace(/"/g, '\\"')}"""
expected_output = """${testCase.expected.replace(/"/g, '\\"')}"""

sys.stdin = StringIO(test_input)
sys.stdout = StringIO()

try:
    exec("""${code.replace(/"/g, '\\"')}""")
    actual_output = sys.stdout.getvalue()
    
    def normalize(s):
        if not s:
            return ''
        return s.replace('\r\n', '\n').replace('\r', '\n').strip()
    
    def float_close(a, b, rel_tol=1e-6, abs_tol=1e-9):
        try:
            a_float = float(a)
            b_float = float(b)
            return abs(a_float - b_float) <= max(rel_tol * max(abs(a_float), abs(b_float)), abs_tol)
        except:
            return False
    
    def compare_output(actual, expected):
        actual_norm = normalize(actual)
        expected_norm = normalize(expected)
        
        if actual_norm == expected_norm:
            return True
        
        if float_close(actual_norm, expected_norm):
            return True
        
        return False
    
    assert compare_output(actual_output, expected_output), \
        f"测试用例 {i + 1} 失败\n期望: {repr(expected_output)}\n实际: {repr(actual_output)}"
        
finally:
    sys.stdin = sys.__stdin__
    sys.stdout = sys.__stdout__
`;
            
            try {
                await executeCode(testCode, 5000);
            } catch (error) {
                allPassed = false;
                failedTest = {
                    index: i + 1,
                    ...error
                };
                break;
            }
        }
        
        if (allPassed) {
            return {
                result: 'AC',
                message: '✅ 通过所有测试用例！'
            };
        } else {
            return failedTest;
        }
    } catch (error) {
        console.error('判题失败:', error);
        return {
            type: 'ERROR',
            message: '判题过程出错: ' + error.message
        };
    }
}

// 兼容旧接口
async function judge(code, problemId) {
    const problem = await db.problemDB.findById(problemId);
    if (!problem) {
        return { result: 'ERROR', message: '题目不存在' };
    }
    
    const result = await judgeWithAssert(code, problem);
    return {
        result: result.type || result.result || 'ERROR',
        message: result.message
    };
}

// 初始化
window.addEventListener('DOMContentLoaded', async function() {
    try {
        await initPyodide();
    } catch (error) {
        console.error('Pyodide 初始化失败:', error);
    }
});

// 暴露判题引擎函数
window.engine = {
    initPyodide,
    executeCode,
    judgeWithAssert,
    judge,
    normalizeOutput
};