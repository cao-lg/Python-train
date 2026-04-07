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

// 执行带断言的 Python 代码
async function executeCodeWithAssert(code, testCase, timeout = 5000) {
    await initPyodide();
    
    return new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject({ type: 'TLE', message: '执行超时（超过5秒）' });
        }, timeout);
        
        try {
            // 构建测试代码
            let testCode = '';
            
            // 如果有输入，设置标准输入
            if (testCase.input) {
                testCode += `
import sys
from io import StringIO
old_stdin = sys.stdin
sys.stdin = StringIO("""${testCase.input.replace(/"/g, '\\"')}""")
`;
            }
            
            // 添加用户代码
            testCode += code;
            
            // 添加断言代码
            if (testCase.validator) {
                // 使用自定义验证器
                testCode += `\n${testCase.validator}`;
            } else if (testCase.expected) {
                // 检测硬编码输出
                const expectedNormalized = normalizeOutput(testCase.expected);
                const codeLower = code.toLowerCase();
                
                // 检查代码中是否直接包含预期输出
                if (codeLower.includes(expectedNormalized.toLowerCase())) {
                    reject({ 
                        type: 'WA', 
                        message: '硬编码输出错误: 代码中直接包含了预期输出，而不是通过计算得到结果。请修改代码，通过正确的计算逻辑生成输出。' 
                    });
                    return;
                }
                
                // 使用默认输出验证
                testCode += `
import sys
from io import StringIO
old_stdout = sys.stdout
sys.stdout = StringIO()

# 重新执行用户代码以捕获输出
${code}

actual_output = sys.stdout.getvalue()
sys.stdout = old_stdout

expected_output = """${testCase.expected.replace(/"/g, '\\"')}"""

# 标准化输出进行比较
def normalize_output(output):
    if not output:
        return ''
    return output.strip()

actual_normalized = normalize_output(actual_output)
expected_normalized = normalize_output(expected_output)

# 浮点数比较
def float_close(a, b, rel_tol=1e-6, abs_tol=1e-9):
    try:
        a_float = float(a)
        b_float = float(b)
        if a_float != a_float or b_float != b_float:  # 检查 NaN
            return False
        return abs(a_float - b_float) <= max(rel_tol * max(abs(a_float), abs(b_float)), abs_tol)
    except:
        return False

# 执行断言
if actual_normalized == expected_normalized:
    pass
elif float_close(actual_normalized, expected_normalized):
    pass
else:
    raise AssertionError(f"输出不匹配: 期望 '{expected_normalized}', 实际 '{actual_normalized}'")
`;
            }
            
            // 清理代码
            if (testCase.input) {
                testCode += `\nsys.stdin = old_stdin\n`;
            }
            
            // 执行测试代码
            await pyodide.runPythonAsync(testCode);
            
            clearTimeout(timeoutId);
            resolve({ success: true });
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'PythonError') {
                if (error.message.includes('SyntaxError')) {
                    reject({ type: 'CE', message: '语法错误: ' + error.message });
                } else if (error.message.includes('AssertionError')) {
                    reject({ type: 'WA', message: '断言失败: ' + error.message });
                } else {
                    reject({ type: 'RE', message: '运行错误: ' + error.message });
                }
            } else {
                reject({ type: 'RE', message: '未知错误: ' + error.message });
            }
        }
    });
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
            
            try {
                await executeCodeWithAssert(code, testCase, 5000);
            } catch (error) {
                return {
                    type: error.type || 'WA',
                    message: error.message || `测试用例 ${i + 1} 失败`,
                    expected: testCase.output || testCase.expected || '',
                    actual: ''
                };
            }
        }
        
        // 生成动态测试用例（如果问题配置了生成器）
        if (problem.dynamic_test_generator) {
            try {
                await initPyodide();
                
                // 执行动态测试生成器
                const generatorCode = `
${problem.dynamic_test_generator}

# 生成测试用例
test_cases = generate_tests()

# 执行每个动态生成的测试用例
for i, test_case in enumerate(test_cases):
    # 准备测试环境
    import sys
    from io import StringIO
    
    old_stdin = sys.stdin
    old_stdout = sys.stdout
    
    # 设置输入
    if 'input' in test_case:
        sys.stdin = StringIO(test_case['input'])
    
    # 捕获输出
    sys.stdout = StringIO()
    
    # 执行用户代码
    ${code}
    
    # 恢复标准流
    actual_output = sys.stdout.getvalue()
    sys.stdout = old_stdout
    if 'input' in test_case:
        sys.stdin = old_stdin
    
    # 验证结果
    if 'validator' in test_case:
        # 使用自定义验证器
        locals()['actual_output'] = actual_output
        exec(test_case['validator'])
    elif 'expected' in test_case:
        # 标准输出验证
        def normalize_output(output):
            if not output:
                return ''
            return output.strip()
        
        def float_close(a, b, rel_tol=1e-6, abs_tol=1e-9):
            try:
                a_float = float(a)
                b_float = float(b)
                if a_float != a_float or b_float != b_float:  # 检查 NaN
                    return False
                return abs(a_float - b_float) <= max(rel_tol * max(abs(a_float), abs(b_float)), abs_tol)
            except:
                return False
        
        actual_normalized = normalize_output(actual_output)
        expected_normalized = normalize_output(test_case['expected'])
        
        # 检查硬编码输出
        import re
        code_lower = """${code.toLowerCase().replace(/"/g, '\\"')}"""
        if expected_normalized.lower() in code_lower:
            raise AssertionError(f"动态测试用例 {i + 1} 失败: 硬编码输出错误 - 代码中直接包含了预期输出，而不是通过计算得到结果")
        
        if actual_normalized != expected_normalized and not float_close(actual_normalized, expected_normalized):
            raise AssertionError(f"动态测试用例 {i + 1} 失败: 期望 '{expected_normalized}', 实际 '{actual_normalized}'")
`;
                
                await pyodide.runPythonAsync(generatorCode);
            } catch (error) {
                if (error.name === 'PythonError' && error.message.includes('AssertionError')) {
                    return {
                        type: 'WA',
                        message: '动态测试用例失败: ' + error.message,
                        expected: '',
                        actual: ''
                    };
                }
                // 动态测试生成失败不影响整体结果，继续执行
                console.warn('动态测试生成失败:', error);
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
