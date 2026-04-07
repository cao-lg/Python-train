// 基于题目类型的评分系统 - 工业级实现

const TypeBasedScoring = {
    // 题目类型定义
    PROBLEM_TYPES: {
        STDIO: 'STDIO',           // 标准输出型
        FUNCTION: 'FUNCTION',     // 函数调用型
        CLASS: 'CLASS',           // 类实现型
        EXCEPTION: 'EXCEPTION',   // 异常判断型
        SYNTAX_STRUCT: 'SYNTAX_STRUCT', // 代码结构检查型
        PROJECT: 'PROJECT'        // 综合大题型
    },

    // 自动识别题目类型
    autoDetectType(code) {
        code = code.trim();
        
        // 检查类定义
        if (code.includes('class ')) {
            return this.PROBLEM_TYPES.CLASS;
        }
        
        // 检查函数定义且无 input/print
        if (code.includes('def ') && 
            !code.includes('input(') && 
            !code.includes('print(')) {
            return this.PROBLEM_TYPES.FUNCTION;
        }
        
        // 检查异常抛出
        if (code.includes('raise ')) {
            return this.PROBLEM_TYPES.EXCEPTION;
        }
        
        // 检查输入输出
        if (code.includes('input(') || code.includes('print(')) {
            return this.PROBLEM_TYPES.STDIO;
        }
        
        // 默认类型
        return this.PROBLEM_TYPES.STDIO;
    },

    // 标准输出型评分 (STDIO)
    async scoreSTDIO(code, problem) {
        const startTime = Date.now();
        let result = {
            type: this.PROBLEM_TYPES.STDIO,
            totalScore: 0,
            breakdown: {
                syntax: { score: 10, max: 10, label: '语法正确' },
                runtime: { score: 10, max: 10, label: '运行稳定' },
                testCases: { score: 80, max: 80, label: '测试用例' }
            },
            testResults: [],
            passedCount: 0,
            totalCount: 0,
            runTimeMs: 0
        };

        try {
            await window.engine.initPyodide();
            
            const testCases = [
                ...(problem.test_cases || []),
                ...(problem.hidden_test_cases || [])
            ];
            
            result.totalCount = testCases.length;
            
            for (const [index, testCase] of testCases.entries()) {
                try {
                    const caseResult = await window.engine.executeCodeWithInput(
                        code, 
                        testCase.input || '',
                        5000
                    );
                    
                    const actual = window.engine.normalizeOutput(caseResult.stdout);
                    const expected = window.engine.normalizeOutput(testCase.output || testCase.expected);
                    const isPassed = window.engine.compareOutput(actual, expected);
                    
                    result.testResults.push({
                        index,
                        input: testCase.input,
                        expected: testCase.output || testCase.expected,
                        actual: caseResult.stdout,
                        isPassed,
                        error: null
                    });
                    
                    if (isPassed) {
                        result.passedCount++;
                    }
                    
                } catch (error) {
                    result.testResults.push({
                        index,
                        input: testCase.input,
                        expected: testCase.output || testCase.expected,
                        actual: '',
                        isPassed: false,
                        error: error.message
                    });
                }
            }
            
            // 计算得分
            const syntaxScore = 10; // 能到这里说明语法正确
            const runtimeScore = result.testResults.some(r => r.error) ? 0 : 10;
            const testScore = result.totalCount > 0 ? 
                Math.round((result.passedCount / result.totalCount) * 80) : 0;
            
            result.breakdown.syntax.score = syntaxScore;
            result.breakdown.runtime.score = runtimeScore;
            result.breakdown.testCases.score = testScore;
            result.totalScore = syntaxScore + runtimeScore + testScore;
            
        } catch (error) {
            console.error('STDIO 评分失败:', error);
            result.breakdown.syntax.score = 0;
            result.breakdown.runtime.score = 0;
            result.breakdown.testCases.score = 0;
            result.totalScore = 0;
        }
        
        result.runTimeMs = Date.now() - startTime;
        return result;
    },

    // 函数调用型评分 (FUNCTION)
    async scoreFUNCTION(code, problem) {
        const startTime = Date.now();
        let result = {
            type: this.PROBLEM_TYPES.FUNCTION,
            totalScore: 0,
            breakdown: {
                functionExists: { score: 20, max: 20, label: '函数存在' },
                callable: { score: 20, max: 20, label: '可调用' },
                testCases: { score: 60, max: 60, label: '测试用例' }
            },
            testResults: [],
            passedCount: 0,
            totalCount: 0,
            runTimeMs: 0
        };

        try {
            await window.engine.initPyodide();
            
            // 提取函数名（从题目或代码中）
            let functionName = problem.function_name;
            if (!functionName) {
                // 从代码中提取函数名
                const match = code.match(/def\s+(\w+)\s*\(/);
                if (match) {
                    functionName = match[1];
                } else {
                    throw new Error('未找到函数定义');
                }
            }
            
            // 加载学生代码
            await pyodide.runPythonAsync(`
# 加载学生代码
${code}
`);
            
            // 检查函数是否存在
            const functionExists = await pyodide.runPythonAsync(`
import builtins
'${functionName}' in dir() or '${functionName}' in dir(builtins)
`);
            
            if (!functionExists) {
                throw new Error(`函数 ${functionName} 未定义`);
            }
            
            result.breakdown.functionExists.score = 20;
            
            // 执行测试用例
            const testCases = problem.test_cases || [];
            result.totalCount = testCases.length;
            
            for (const [index, testCase] of testCases.entries()) {
                try {
                    // 构建函数调用代码
                    const args = testCase.input ? testCase.input.split(',').map(arg => arg.trim()).join(', ') : '';
                    const callCode = `${functionName}(${args})`;
                    
                    const actual = await pyodide.runPythonAsync(callCode);
                    const expected = testCase.output || testCase.expected;
                    
                    // 比较结果
                    let isPassed = false;
                    if (typeof actual === typeof expected) {
                        if (typeof actual === 'number') {
                            isPassed = Math.abs(actual - expected) < 1e-6;
                        } else {
                            isPassed = String(actual) === String(expected);
                        }
                    }
                    
                    result.testResults.push({
                        index,
                        input: testCase.input,
                        expected: expected,
                        actual: String(actual),
                        isPassed,
                        error: null
                    });
                    
                    if (isPassed) {
                        result.passedCount++;
                    }
                    
                } catch (error) {
                    result.testResults.push({
                        index,
                        input: testCase.input,
                        expected: testCase.output || testCase.expected,
                        actual: '',
                        isPassed: false,
                        error: error.message
                    });
                }
            }
            
            // 计算得分
            const callableScore = result.testResults.some(r => r.error) ? 0 : 20;
            const testScore = result.totalCount > 0 ? 
                Math.round((result.passedCount / result.totalCount) * 60) : 0;
            
            result.breakdown.callable.score = callableScore;
            result.breakdown.testCases.score = testScore;
            result.totalScore = 20 + callableScore + testScore;
            
        } catch (error) {
            console.error('FUNCTION 评分失败:', error);
            result.breakdown.functionExists.score = 0;
            result.breakdown.callable.score = 0;
            result.breakdown.testCases.score = 0;
            result.totalScore = 0;
        }
        
        result.runTimeMs = Date.now() - startTime;
        return result;
    },

    // 类实现型评分 (CLASS)
    async scoreCLASS(code, problem) {
        const startTime = Date.now();
        let result = {
            type: this.PROBLEM_TYPES.CLASS,
            totalScore: 0,
            breakdown: {
                classExists: { score: 10, max: 10, label: '类定义存在' },
                methods: { score: 20, max: 20, label: '方法齐全' },
                instantiable: { score: 20, max: 20, label: '实例化正常' },
                functionality: { score: 50, max: 50, label: '功能正确' }
            },
            testResults: [],
            passedCount: 0,
            totalCount: 0,
            runTimeMs: 0
        };

        try {
            await window.engine.initPyodide();
            
            // 提取类名
            let className = problem.class_name;
            if (!className) {
                const match = code.match(/class\s+(\w+)/);
                if (match) {
                    className = match[1];
                } else {
                    throw new Error('未找到类定义');
                }
            }
            
            // 加载学生代码
            await pyodide.runPythonAsync(`
# 加载学生代码
${code}
`);
            
            // 检查类是否存在
            const classExists = await pyodide.runPythonAsync(`
'${className}' in dir()
`);
            
            if (!classExists) {
                throw new Error(`类 ${className} 未定义`);
            }
            
            result.breakdown.classExists.score = 10;
            
            // 检查方法
            const requiredMethods = problem.required_methods || [];
            let methodScore = 20;
            for (const method of requiredMethods) {
                const methodExists = await pyodide.runPythonAsync(`
import inspect
hasattr(${className}, '${method}') and inspect.ismethoddescriptor(getattr(${className}, '${method}'))
`);
                if (!methodExists) {
                    methodScore -= 20 / requiredMethods.length;
                }
            }
            result.breakdown.methods.score = Math.max(0, Math.round(methodScore));
            
            // 实例化测试
            try {
                await pyodide.runPythonAsync(`
s = ${className}()`);
                result.breakdown.instantiable.score = 20;
            } catch (error) {
                result.breakdown.instantiable.score = 0;
            }
            
            // 功能测试
            const testCases = problem.test_cases || [];
            result.totalCount = testCases.length;
            
            for (const [index, testCase] of testCases.entries()) {
                try {
                    // 执行测试代码
                    const testCode = `
s = ${className}()
${testCase.test_code}
`;
                    const actual = await pyodide.runPythonAsync(testCode);
                    const expected = testCase.expected;
                    
                    const isPassed = String(actual) === String(expected);
                    
                    result.testResults.push({
                        index,
                        testCode: testCase.test_code,
                        expected: expected,
                        actual: String(actual),
                        isPassed,
                        error: null
                    });
                    
                    if (isPassed) {
                        result.passedCount++;
                    }
                    
                } catch (error) {
                    result.testResults.push({
                        index,
                        testCode: testCase.test_code,
                        expected: testCase.expected,
                        actual: '',
                        isPassed: false,
                        error: error.message
                    });
                }
            }
            
            // 计算功能得分
            const functionalityScore = result.totalCount > 0 ? 
                Math.round((result.passedCount / result.totalCount) * 50) : 0;
            result.breakdown.functionality.score = functionalityScore;
            
            result.totalScore = 
                result.breakdown.classExists.score +
                result.breakdown.methods.score +
                result.breakdown.instantiable.score +
                functionalityScore;
            
        } catch (error) {
            console.error('CLASS 评分失败:', error);
            result.totalScore = 0;
        }
        
        result.runTimeMs = Date.now() - startTime;
        return result;
    },

    // 异常判断型评分 (EXCEPTION)
    async scoreEXCEPTION(code, problem) {
        const startTime = Date.now();
        let result = {
            type: this.PROBLEM_TYPES.EXCEPTION,
            totalScore: 0,
            breakdown: {
                syntax: { score: 20, max: 20, label: '语法正确' },
                exceptionType: { score: 40, max: 40, label: '异常类型正确' },
                exceptionMessage: { score: 40, max: 40, label: '异常信息正确' }
            },
            testResults: [],
            passedCount: 0,
            totalCount: 0,
            runTimeMs: 0
        };

        try {
            await window.engine.initPyodide();
            
            // 加载学生代码
            await pyodide.runPythonAsync(`
# 加载学生代码
${code}
`);
            
            result.breakdown.syntax.score = 20;
            
            // 执行测试用例
            const testCases = problem.test_cases || [];
            result.totalCount = testCases.length;
            
            for (const [index, testCase] of testCases.entries()) {
                try {
                    // 执行可能触发异常的代码
                    await pyodide.runPythonAsync(testCase.test_code);
                    // 如果没有抛出异常，测试失败
                    result.testResults.push({
                        index,
                        testCode: testCase.test_code,
                        expectedException: testCase.exception_type,
                        expectedMessage: testCase.exception_message,
                        actualException: 'None',
                        actualMessage: 'No exception raised',
                        isPassed: false,
                        error: '未抛出异常'
                    });
                } catch (error) {
                    // 检查异常类型和信息
                    const actualException = error.name;
                    const actualMessage = error.message;
                    const expectedException = testCase.exception_type;
                    const expectedMessage = testCase.exception_message;
                    
                    const isTypeCorrect = actualException === expectedException;
                    const isMessageCorrect = expectedMessage ? 
                        actualMessage.includes(expectedMessage) : true;
                    const isPassed = isTypeCorrect && isMessageCorrect;
                    
                    result.testResults.push({
                        index,
                        testCode: testCase.test_code,
                        expectedException: expectedException,
                        expectedMessage: expectedMessage,
                        actualException: actualException,
                        actualMessage: actualMessage,
                        isPassed,
                        error: null
                    });
                    
                    if (isPassed) {
                        result.passedCount++;
                    }
                }
            }
            
            // 计算得分
            if (result.totalCount > 0) {
                const typeScore = Math.round((result.passedCount / result.totalCount) * 40);
                const messageScore = Math.round((result.passedCount / result.totalCount) * 40);
                result.breakdown.exceptionType.score = typeScore;
                result.breakdown.exceptionMessage.score = messageScore;
                result.totalScore = 20 + typeScore + messageScore;
            }
            
        } catch (error) {
            console.error('EXCEPTION 评分失败:', error);
            result.breakdown.syntax.score = 0;
            result.totalScore = 0;
        }
        
        result.runTimeMs = Date.now() - startTime;
        return result;
    },

    // 代码结构检查型评分 (SYNTAX_STRUCT)
    async scoreSYNTAX_STRUCT(code, problem) {
        const startTime = Date.now();
        let result = {
            type: this.PROBLEM_TYPES.SYNTAX_STRUCT,
            totalScore: 0,
            breakdown: {
                syntax: { score: 20, max: 20, label: '语法正确' },
                structure: { score: 30, max: 30, label: '结构符合要求' },
                functionality: { score: 50, max: 50, label: '功能正确' }
            },
            structureChecks: [],
            testResults: [],
            passedCount: 0,
            totalCount: 0,
            runTimeMs: 0
        };

        try {
            await window.engine.initPyodide();
            
            // 检查语法
            try {
                await pyodide.runPythonAsync(`
# 语法检查
import ast
ast.parse('''${code.replace(/'''/g, "\'\'\'")}''')
`);
                result.breakdown.syntax.score = 20;
            } catch (error) {
                result.breakdown.syntax.score = 0;
                throw error;
            }
            
            // 结构检查
            const requiredStructures = problem.required_structures || [];
            const forbiddenStructures = problem.forbidden_structures || [];
            
            let structureScore = 30;
            
            for (const structure of requiredStructures) {
                const found = code.includes(structure);
                result.structureChecks.push({
                    type: 'required',
                    structure: structure,
                    found: found
                });
                if (!found) {
                    structureScore -= 30 / requiredStructures.length;
                }
            }
            
            for (const structure of forbiddenStructures) {
                const found = code.includes(structure);
                result.structureChecks.push({
                    type: 'forbidden',
                    structure: structure,
                    found: found
                });
                if (found) {
                    structureScore -= 30 / forbiddenStructures.length;
                }
            }
            
            result.breakdown.structure.score = Math.max(0, Math.round(structureScore));
            
            // 功能测试
            const testCases = problem.test_cases || [];
            result.totalCount = testCases.length;
            
            for (const [index, testCase] of testCases.entries()) {
                try {
                    const caseResult = await window.engine.executeCodeWithInput(
                        code, 
                        testCase.input || '',
                        5000
                    );
                    
                    const actual = window.engine.normalizeOutput(caseResult.stdout);
                    const expected = window.engine.normalizeOutput(testCase.output || testCase.expected);
                    const isPassed = window.engine.compareOutput(actual, expected);
                    
                    result.testResults.push({
                        index,
                        input: testCase.input,
                        expected: testCase.output || testCase.expected,
                        actual: caseResult.stdout,
                        isPassed,
                        error: null
                    });
                    
                    if (isPassed) {
                        result.passedCount++;
                    }
                    
                } catch (error) {
                    result.testResults.push({
                        index,
                        input: testCase.input,
                        expected: testCase.output || testCase.expected,
                        actual: '',
                        isPassed: false,
                        error: error.message
                    });
                }
            }
            
            // 计算功能得分
            const functionalityScore = result.totalCount > 0 ? 
                Math.round((result.passedCount / result.totalCount) * 50) : 0;
            result.breakdown.functionality.score = functionalityScore;
            
            result.totalScore = 
                result.breakdown.syntax.score +
                result.breakdown.structure.score +
                functionalityScore;
            
        } catch (error) {
            console.error('SYNTAX_STRUCT 评分失败:', error);
            result.breakdown.syntax.score = 0;
            result.totalScore = 0;
        }
        
        result.runTimeMs = Date.now() - startTime;
        return result;
    },

    // 综合大题型评分 (PROJECT)
    async scorePROJECT(code, problem) {
        const startTime = Date.now();
        let result = {
            type: this.PROBLEM_TYPES.PROJECT,
            totalScore: 0,
            breakdown: {
                output: { score: 30, max: 30, label: '输出正确' },
                functions: { score: 20, max: 20, label: '函数完整' },
                classes: { score: 20, max: 20, label: '类规范' },
                files: { score: 15, max: 15, label: '文件内容' },
                stability: { score: 15, max: 15, label: '运行稳定' }
            },
            testResults: [],
            passedCount: 0,
            totalCount: 0,
            runTimeMs: 0
        };

        try {
            await window.engine.initPyodide();
            
            // 加载学生代码
            await pyodide.runPythonAsync(`
# 加载学生代码
${code}
`);
            
            // 输出测试
            const outputTestCases = problem.output_test_cases || [];
            let outputScore = 30;
            
            for (const testCase of outputTestCases) {
                try {
                    const caseResult = await window.engine.executeCodeWithInput(
                        code, 
                        testCase.input || '',
                        10000
                    );
                    
                    const actual = window.engine.normalizeOutput(caseResult.stdout);
                    const expected = window.engine.normalizeOutput(testCase.output || testCase.expected);
                    const isPassed = window.engine.compareOutput(actual, expected);
                    
                    result.testResults.push({
                        type: 'output',
                        input: testCase.input,
                        expected: testCase.output || testCase.expected,
                        actual: caseResult.stdout,
                        isPassed,
                        error: null
                    });
                    
                    if (!isPassed) {
                        outputScore -= 30 / outputTestCases.length;
                    }
                    
                } catch (error) {
                    result.testResults.push({
                        type: 'output',
                        input: testCase.input,
                        expected: testCase.output || testCase.expected,
                        actual: '',
                        isPassed: false,
                        error: error.message
                    });
                    outputScore -= 30 / outputTestCases.length;
                }
            }
            
            result.breakdown.output.score = Math.max(0, Math.round(outputScore));
            
            // 函数检查
            const requiredFunctions = problem.required_functions || [];
            let functionScore = 20;
            
            for (const func of requiredFunctions) {
                const exists = await pyodide.runPythonAsync(`
'${func}' in dir()
`);
                if (!exists) {
                    functionScore -= 20 / requiredFunctions.length;
                }
            }
            
            result.breakdown.functions.score = Math.max(0, Math.round(functionScore));
            
            // 类检查
            const requiredClasses = problem.required_classes || [];
            let classScore = 20;
            
            for (const cls of requiredClasses) {
                const exists = await pyodide.runPythonAsync(`
'${cls}' in dir()
`);
                if (!exists) {
                    classScore -= 20 / requiredClasses.length;
                }
            }
            
            result.breakdown.classes.score = Math.max(0, Math.round(classScore));
            
            // 文件检查（Pyodide 虚拟文件系统）
            const requiredFiles = problem.required_files || [];
            let fileScore = 15;
            
            for (const file of requiredFiles) {
                const exists = await pyodide.runPythonAsync(`
import os
os.path.exists('${file}')
`);
                if (!exists) {
                    fileScore -= 15 / requiredFiles.length;
                }
            }
            
            result.breakdown.files.score = Math.max(0, Math.round(fileScore));
            
            // 稳定性检查
            let stabilityScore = 15;
            try {
                // 运行完整程序
                await pyodide.runPythonAsync(code);
            } catch (error) {
                stabilityScore = 0;
            }
            
            result.breakdown.stability.score = stabilityScore;
            
            // 计算总分
            result.totalScore = 
                result.breakdown.output.score +
                result.breakdown.functions.score +
                result.breakdown.classes.score +
                result.breakdown.files.score +
                result.breakdown.stability.score;
            
        } catch (error) {
            console.error('PROJECT 评分失败:', error);
            result.totalScore = 0;
        }
        
        result.runTimeMs = Date.now() - startTime;
        return result;
    },

    // 主评分函数
    async score(code, problem) {
        const problemType = problem.type || this.autoDetectType(code);
        
        console.log(`开始评分 - 类型: ${problemType}`);
        
        switch (problemType) {
            case this.PROBLEM_TYPES.STDIO:
                return await this.scoreSTDIO(code, problem);
            case this.PROBLEM_TYPES.FUNCTION:
                return await this.scoreFUNCTION(code, problem);
            case this.PROBLEM_TYPES.CLASS:
                return await this.scoreCLASS(code, problem);
            case this.PROBLEM_TYPES.EXCEPTION:
                return await this.scoreEXCEPTION(code, problem);
            case this.PROBLEM_TYPES.SYNTAX_STRUCT:
                return await this.scoreSYNTAX_STRUCT(code, problem);
            case this.PROBLEM_TYPES.PROJECT:
                return await this.scorePROJECT(code, problem);
            default:
                // 默认使用 STDIO 评分
                return await this.scoreSTDIO(code, problem);
        }
    },

    // 生成评分报告
    generateReport(scoringResult) {
        const totalScore = scoringResult.totalScore;
        let grade;
        
        if (totalScore >= 90) grade = 'A+';
        else if (totalScore >= 80) grade = 'A';
        else if (totalScore >= 70) grade = 'B';
        else if (totalScore >= 60) grade = 'C';
        else grade = 'D';
        
        return {
            totalScore,
            maxScore: 100,
            grade,
            type: scoringResult.type,
            breakdown: scoringResult.breakdown,
            testResults: scoringResult.testResults,
            runTimeMs: scoringResult.runTimeMs,
            structureChecks: scoringResult.structureChecks
        };
    }
};

// 暴露到全局
window.TypeBasedScoring = TypeBasedScoring;
