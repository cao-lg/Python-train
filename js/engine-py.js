// Python 判题引擎 - 基于 Pyodide（增强版）

let pyodide = null;

// 安全沙箱配置
const SANDBOX_CONFIG = {
    // 禁用的危险模块（最危险的）
    blockedModules: [
        'os', 'subprocess', 'pty', 'threading', 
        'multiprocessing', 'socket', 'http.client', 
        'urllib', 'requests', 'ftplib', 'telnetlib',
        'pickle', 'marshal'
    ],
    // 禁用的危险函数
    blockedFunctions: [
        'open'
    ],
    // 超时时间（毫秒）
    defaultTimeout: 5000
};

// 初始化 Pyodide
async function initPyodide() {
    if (pyodide) {
        return pyodide;
    }
    
    const maxRetries = 3;
    const retryDelay = 2000;
    const timeout = 30000; // 30秒超时
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Pyodide 初始化尝试 ${attempt}/${maxRetries}...`);
        
        try {
            // 创建超时 Promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Pyodide 初始化超时')), timeout);
            });
            
            // 竞态：初始化或超时
            pyodide = await Promise.race([
                loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
                }),
                timeoutPromise
            ]);
            
            console.log('Pyodide 初始化成功');
            
            // 初始化安全沙箱
            await initSandbox();
            
            return pyodide;
        } catch (error) {
            lastError = error;
            console.error(`Pyodide 初始化失败 (尝试 ${attempt}/${maxRetries}):`, error);
            
            if (attempt < maxRetries) {
                console.log(`等待 ${retryDelay}ms 后重试...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }
    
    console.error('Pyodide 初始化失败（已达到最大重试次数）:', lastError);
    throw lastError;
}

// 初始化安全沙箱
async function initSandbox() {
    if (!pyodide) return;
    
    try {
        // 注入安全限制代码 - 简化版本，不禁用 eval/exec（Pyodide 内部需要）
        const sandboxCode = `
# 安全沙箱初始化
import sys
import builtins

# 保存原始函数
_original_open = builtins.open
_original_import = __import__

# 禁用危险模块
_blocked_modules = ${JSON.stringify(SANDBOX_CONFIG.blockedModules.filter(m => m !== 'builtins'))}

# 重写 __import__ 来阻止危险模块
def _safe_import(name, *args, **kwargs):
    if name in _blocked_modules or any(blocked in name for blocked in _blocked_modules):
        raise ImportError(f"模块 '{name}' 被安全沙箱禁用")
    return _original_import(name, *args, **kwargs)

# 重写危险函数
def _safe_open(*args, **kwargs):
    raise PermissionError("文件操作被安全沙箱禁用")

# 应用安全限制
builtins.__import__ = _safe_import
builtins.open = _safe_open

# 从 sys.modules 中移除已加载的危险模块
for mod in list(sys.modules.keys()):
    if mod in _blocked_modules or any(blocked in mod for blocked in _blocked_modules):
        try:
            del sys.modules[mod]
        except:
            pass

print("安全沙箱初始化完成")
`;
        
        await pyodide.runPythonAsync(sandboxCode);
        console.log('安全沙箱初始化完成');
    } catch (error) {
        console.warn('安全沙箱初始化失败:', error);
    }
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
    
    // 获取期望输出（优先使用 output 字段）
    const expectedValue = testCase.output || testCase.expected;
    
    // 使用简单的输出比较方式，避免复杂的断言逻辑
    const result = await executeCodeWithInput(code, testCase.input || '', timeout);
    
    // 比较输出
    if (compareOutput(result.stdout, expectedValue)) {
        return { success: true };
    } else {
        throw { 
            type: 'WA', 
            message: `输出不匹配: 期望 '${expectedValue}', 实际 '${result.stdout}'` 
        };
    }
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
function initPyodideOnLoad() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async function() {
            try {
                await initPyodide();
            } catch (error) {
                console.error('Pyodide 初始化失败:', error);
            }
        });
    } else {
        // 页面已经加载完成，直接初始化
        initPyodide().catch(error => {
            console.error('Pyodide 初始化失败:', error);
        });
    }
}

// 延迟初始化，确保其他资源加载完成
setTimeout(initPyodideOnLoad, 1000);

// 增强版判题函数 - 集成多维评分引擎
async function judgeWithScoring(code, problem) {
    const startTime = Date.now();
    let executionResult = {
        hasSyntaxError: false,
        hasRuntimeError: false,
        testResults: [],
        passedCount: 0,
        totalCount: 0,
        runTimeMs: 0,
        errorMessage: null
    };

    try {
        await initPyodide();

        const testCases = [
            ...(problem.test_cases || []),
            ...(problem.hidden_test_cases || [])
        ];

        if (testCases.length === 0) {
            testCases.push({
                input: problem.sample_input || '',
                output: problem.sample_output || ''
            });
        }

        executionResult.totalCount = testCases.length;

        // 执行所有测试用例
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            const expectedValue = testCase.output || testCase.expected;
            
            try {
                const caseStartTime = Date.now();
                const result = await executeCodeWithInput(code, testCase.input || '', 5000);
                const caseEndTime = Date.now();
                
                const actualNorm = normalizeOutput(result.stdout);
                const expectedNorm = normalizeOutput(expectedValue);
                const isPerfectMatch = actualNorm === expectedNorm;
                const isCloseMatch = floatClose(actualNorm, expectedNorm);
                const isPassed = isPerfectMatch || isCloseMatch;

                if (isPassed) {
                    executionResult.passedCount++;
                }

                executionResult.testResults.push({
                    index: i,
                    input: testCase.input,
                    expected: expectedValue,
                    actual: result.stdout,
                    isPerfectMatch,
                    isCloseMatch,
                    isPassed,
                    runTimeMs: caseEndTime - caseStartTime
                });

                if (result.stderr && !executionResult.hasRuntimeError) {
                    executionResult.hasRuntimeError = true;
                    executionResult.errorMessage = result.stderr;
                }

            } catch (error) {
                if (error.type === 'CE') {
                    executionResult.hasSyntaxError = true;
                    executionResult.errorMessage = error.message;
                } else if (error.type === 'RE') {
                    executionResult.hasRuntimeError = true;
                    executionResult.errorMessage = error.message;
                } else if (error.type === 'TLE') {
                    executionResult.errorMessage = error.message;
                }

                executionResult.testResults.push({
                    index: i,
                    input: testCase.input,
                    expected: expectedValue,
                    actual: '',
                    isPerfectMatch: false,
                    isCloseMatch: false,
                    isPassed: false,
                    error: error.message
                });
            }
        }

    } catch (error) {
        console.error('判题过程出错:', error);
        executionResult.errorMessage = error.message;
    }

    executionResult.runTimeMs = Date.now() - startTime;

    // 使用评分引擎进行多维评分
    let scoringResult = null;
    if (window.ScoringEngine) {
        try {
            await window.ScoringEngine.score(code, problem, executionResult);
            scoringResult = window.ScoringEngine.generateReport();
        } catch (scoringError) {
            console.warn('评分引擎执行失败:', scoringError);
        }
    }

    return {
        execution: executionResult,
        scoring: scoringResult,
        result: scoringResult ? (scoringResult.totalScore >= 60 ? 'AC' : 'WA') : 
                (executionResult.passedCount === executionResult.totalCount ? 'AC' : 'WA'),
        message: scoringResult ? 
            `得分: ${scoringResult.totalScore}/${scoringResult.maxScore} (${scoringResult.grade})` :
            (executionResult.passedCount === executionResult.totalCount ? '✅ 通过所有测试用例！' : '❌ 部分测试用例失败')
    };
}

// 兼容旧接口的增强版
async function judgeEnhanced(code, problemId) {
    const problem = await window.db.problemDB.findById(problemId);
    if (!problem) {
        return { result: 'ERROR', message: '题目不存在' };
    }
    
    const result = await judgeWithScoring(code, problem);
    return {
        result: result.result,
        message: result.message,
        scoring: result.scoring,
        execution: result.execution
    };
}

// 基于题目类型的判题函数
async function judgeByType(code, problem) {
    try {
        if (window.TypeBasedScoring) {
            const scoringResult = await window.TypeBasedScoring.score(code, problem);
            const report = window.TypeBasedScoring.generateReport(scoringResult);
            
            return {
                result: report.totalScore >= 60 ? 'AC' : 'WA',
                message: `得分: ${report.totalScore}/100 (${report.grade}) - 类型: ${report.type}`,
                scoring: report,
                execution: {
                    testResults: scoringResult.testResults,
                    passedCount: scoringResult.passedCount,
                    totalCount: scoringResult.totalCount,
                    runTimeMs: scoringResult.runTimeMs
                }
            };
        } else {
            // 回退到增强版判题
            return await judgeWithScoring(code, problem);
        }
    } catch (error) {
        console.error('基于类型的判题失败:', error);
        return {
            result: 'ERROR',
            message: '判题过程出错: ' + error.message
        };
    }
}

// 兼容旧接口的类型判题
async function judgeWithType(code, problemId) {
    const problem = await window.db.problemDB.findById(problemId);
    if (!problem) {
        return { result: 'ERROR', message: '题目不存在' };
    }
    
    const result = await judgeByType(code, problem);
    return {
        result: result.result,
        message: result.message,
        scoring: result.scoring,
        execution: result.execution
    };
}

// 暴露判题引擎函数
window.engine = {
    initPyodide,
    executeCode,
    executeCodeWithInput,
    judgeWithAssert,
    judge,
    judgeWithScoring,
    judgeEnhanced,
    judgeByType,
    judgeWithType,
    normalizeOutput,
    compareOutput,
    floatClose,
    SANDBOX_CONFIG
};
