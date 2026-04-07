// Python 判题引擎 - 基于 Pyodide

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

// 标准化输出
function normalizeOutput(output) {
    if (!output) return '';
    return output.toString()
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();
}

// 浮点数比较
function floatClose(a, b, relTol = 1e-6, absTol = 1e-9) {
    try {
        const aFloat = parseFloat(a);
        const bFloat = parseFloat(b);
        if (isNaN(aFloat) || isNaN(bFloat)) return false;
        return Math.abs(aFloat - bFloat) <= Math.max(relTol * Math.max(Math.abs(aFloat), Math.abs(bFloat)), absTol);
    } catch {
        return false;
    }
}

// 比较输出
function compareOutput(actual, expected) {
    const actualNorm = normalizeOutput(actual);
    const expectedNorm = normalizeOutput(expected);
    
    if (actualNorm === expectedNorm) {
        return true;
    }
    
    if (floatClose(actualNorm, expectedNorm)) {
        return true;
    }
    
    return false;
}

// 执行 Python 代码并捕获输出
async function executeCodeWithInput(code, testInput, timeout = 5000) {
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
old_stdin = sys.stdin

sys.stdin = StringIO("""${(testInput || '').replace(/"/g, '\\"')}""")
sys.stdout = StringIO()
sys.stderr = StringIO()
`;
            
            const cleanupCode = `
stdout_output = sys.stdout.getvalue()
stderr_output = sys.stderr.getvalue()
sys.stdout = old_stdout
sys.stderr = old_stderr
sys.stdin = old_stdin
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
                } else {
                    reject({ type: 'RE', message: '运行错误: ' + error.message });
                }
            } else {
                reject({ type: 'RE', message: '未知错误: ' + error.message });
            }
        }
    });
}

// 执行 Python 代码（不带输入）
async function executeCode(code, timeout = 5000) {
    return await executeCodeWithInput(code, '', timeout);
}

// 判题主函数
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
        
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            const testInput = testCase.input || '';
            const expectedOutput = testCase.output || testCase.expected || '';
            
            try {
                const result = await executeCodeWithInput(code, testInput, 5000);
                
                if (result.stderr) {
                    return {
                        type: 'RE',
                        message: '运行错误: ' + result.stderr,
                        expected: expectedOutput,
                        actual: result.stdout || ''
                    };
                }
                
                const actualOutput = result.stdout || '';
                
                if (!compareOutput(actualOutput, expectedOutput)) {
                    return {
                        type: 'WA',
                        message: `测试用例 ${i + 1} 失败`,
                        expected: expectedOutput,
                        actual: actualOutput
                    };
                }
            } catch (error) {
                return {
                    type: error.type || 'WA',
                    message: error.message || `测试用例 ${i + 1} 失败`,
                    expected: expectedOutput,
                    actual: ''
                };
            }
        }
        
        return {
            result: 'AC',
            message: '✅ 通过所有测试用例！'
        };
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
    const problem = await window.db.problemDB.findById(problemId);
    if (!problem) {
        return { result: 'ERROR', message: '题目不存在' };
    }
    
    const result = await judgeWithAssert(code, problem);
    return {
        result: result.type || result.result || 'ERROR',
        message: result.message,
        expected: result.expected,
        actual: result.actual
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
    executeCodeWithInput,
    judgeWithAssert,
    judge,
    normalizeOutput,
    compareOutput,
    floatClose
};
