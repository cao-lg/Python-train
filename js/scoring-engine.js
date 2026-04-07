// 多维评分引擎 - 基于设计文档实现

const ScoringEngine = {
    // 评分配置
    config: {
        totalScore: 100,
        baseScore: 20,
        functionalityScore: 50,
        precisionScore: 10,
        styleScore: 10,
        efficiencyScore: 10
    },

    // 评分结果
    result: {
        totalScore: 0,
        baseScore: 0,
        functionalityScore: 0,
        precisionScore: 0,
        styleScore: 0,
        efficiencyScore: 0,
        details: {},
        suggestions: []
    },

    // 重置评分结果
    reset() {
        this.result = {
            totalScore: 0,
            baseScore: 0,
            functionalityScore: 0,
            precisionScore: 0,
            styleScore: 0,
            efficiencyScore: 0,
            details: {},
            suggestions: []
        };
    },

    // 1. 基础分评分（语法 + 可运行）
    scoreBase(hasSyntaxError, hasRuntimeError) {
        let score = 0;
        const details = {};

        if (!hasSyntaxError) {
            score += 10;
            details.syntax = { score: 10, max: 10, status: 'pass' };
        } else {
            details.syntax = { score: 0, max: 10, status: 'fail' };
        }

        if (!hasSyntaxError && !hasRuntimeError) {
            score += 10;
            details.runtime = { score: 10, max: 10, status: 'pass' };
        } else if (!hasSyntaxError && hasRuntimeError) {
            details.runtime = { score: 0, max: 10, status: 'fail' };
        } else {
            details.runtime = { score: 0, max: 10, status: 'fail' };
        }

        this.result.baseScore = score;
        this.result.details.base = details;
        return score;
    },

    // 2. 功能分评分（测试用例通过率）
    scoreFunctionality(passedCount, totalCount) {
        if (totalCount === 0) {
            this.result.functionalityScore = 0;
            this.result.details.functionality = { passed: 0, total: 0, score: 0, max: this.config.functionalityScore };
            return 0;
        }

        const ratio = passedCount / totalCount;
        const score = Math.round(ratio * this.config.functionalityScore);

        this.result.functionalityScore = score;
        this.result.details.functionality = {
            passed: passedCount,
            total: totalCount,
            ratio: ratio,
            score: score,
            max: this.config.functionalityScore
        };

        return score;
    },

    // 3. 精度分评分（浮点/文本容错）
    scorePrecision(testResults) {
        if (!testResults || testResults.length === 0) {
            this.result.precisionScore = 0;
            this.result.details.precision = { score: 0, max: this.config.precisionScore };
            return 0;
        }

        let perfectMatchCount = 0;
        let partialMatchCount = 0;

        for (const result of testResults) {
            if (result.isPerfectMatch) {
                perfectMatchCount++;
            } else if (result.isCloseMatch) {
                partialMatchCount++;
            }
        }

        const total = testResults.length;
        let score = 0;

        if (perfectMatchCount === total) {
            score = this.config.precisionScore;
        } else if (perfectMatchCount + partialMatchCount === total) {
            score = Math.round(this.config.precisionScore * 0.5);
        }

        this.result.precisionScore = score;
        this.result.details.precision = {
            perfectMatchCount,
            partialMatchCount,
            total,
            score,
            max: this.config.precisionScore
        };

        return score;
    },

    // 4. 代码规范分评分（PEP8 轻量检查）
    scoreStyle(code) {
        let score = this.config.styleScore;
        const issues = [];

        // 检查缩进
        const lines = code.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') continue;

            const leadingSpaces = line.match(/^ */)[0].length;
            if (leadingSpaces > 0 && leadingSpaces % 4 !== 0) {
                issues.push(`第 ${i + 1} 行：缩进不是 4 的倍数`);
                score -= 1;
            }
        }

        // 检查行长度
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].length > 79) {
                issues.push(`第 ${i + 1} 行：超过 79 个字符`);
                score -= 1;
            }
        }

        // 检查命名规范（简单检查）
        const variableMatches = code.match(/\b([a-z_][a-z0-9_]*)\s*=/gi);
        if (variableMatches) {
            for (const match of variableMatches) {
                const varName = match.split('=')[0].trim();
                if (varName.includes('__') && !varName.startsWith('__')) {
                    issues.push(`变量名 "${varName}" 包含双下划线`);
                    score -= 0.5;
                }
            }
        }

        // 检查是否有空行分隔代码块
        let hasTooManyEmptyLines = false;
        let consecutiveEmptyLines = 0;
        for (const line of lines) {
            if (line.trim() === '') {
                consecutiveEmptyLines++;
                if (consecutiveEmptyLines > 2) {
                    hasTooManyEmptyLines = true;
                    break;
                }
            } else {
                consecutiveEmptyLines = 0;
            }
        }
        if (hasTooManyEmptyLines) {
            issues.push('连续空行超过 2 行');
            score -= 1;
        }

        score = Math.max(0, Math.min(this.config.styleScore, score));
        this.result.styleScore = Math.round(score);
        this.result.details.style = {
            issues: issues,
            score: Math.round(score),
            max: this.config.styleScore
        };

        if (issues.length > 0) {
            this.result.suggestions.push('代码规范建议：' + issues.join('；'));
        }

        return Math.round(score);
    },

    // 5. 效率分评分（运行时间）
    scoreEfficiency(runTimeMs, thresholdMs = 1000) {
        let score = 0;

        if (runTimeMs <= thresholdMs * 0.5) {
            score = this.config.efficiencyScore;
        } else if (runTimeMs <= thresholdMs) {
            score = Math.round(this.config.efficiencyScore * 0.8);
        } else if (runTimeMs <= thresholdMs * 2) {
            score = Math.round(this.config.efficiencyScore * 0.5);
        } else if (runTimeMs <= thresholdMs * 3) {
            score = Math.round(this.config.efficiencyScore * 0.2);
        } else {
            score = 0;
        }

        this.result.efficiencyScore = score;
        this.result.details.efficiency = {
            runTimeMs,
            thresholdMs,
            score,
            max: this.config.efficiencyScore
        };

        return score;
    },

    // 计算总分
    calculateTotal() {
        this.result.totalScore = 
            this.result.baseScore +
            this.result.functionalityScore +
            this.result.precisionScore +
            this.result.styleScore +
            this.result.efficiencyScore;
        
        this.result.totalScore = Math.min(this.config.totalScore, Math.max(0, this.result.totalScore));
        return this.result.totalScore;
    },

    // 完整评分流程
    async score(code, problem, executionResult) {
        this.reset();

        const {
            hasSyntaxError,
            hasRuntimeError,
            testResults,
            passedCount,
            totalCount,
            runTimeMs
        } = executionResult;

        // 1. 基础分
        this.scoreBase(hasSyntaxError, hasRuntimeError);

        // 2. 功能分
        this.scoreFunctionality(passedCount, totalCount);

        // 3. 精度分
        this.scorePrecision(testResults);

        // 4. 代码规范分
        this.scoreStyle(code);

        // 5. 效率分
        this.scoreEfficiency(runTimeMs);

        // 计算总分
        this.calculateTotal();

        return this.result;
    },

    // 生成评分报告
    generateReport() {
        const r = this.result;
        return {
            totalScore: r.totalScore,
            maxScore: this.config.totalScore,
            breakdown: {
                base: { score: r.baseScore, max: this.config.baseScore, label: '基础分' },
                functionality: { score: r.functionalityScore, max: this.config.functionalityScore, label: '功能分' },
                precision: { score: r.precisionScore, max: this.config.precisionScore, label: '精度分' },
                style: { score: r.styleScore, max: this.config.styleScore, label: '规范分' },
                efficiency: { score: r.efficiencyScore, max: this.config.efficiencyScore, label: '效率分' }
            },
            details: r.details,
            suggestions: r.suggestions,
            grade: this.getGrade(r.totalScore)
        };
    },

    // 获取等级
    getGrade(score) {
        if (score >= 90) return 'A+';
        if (score >= 80) return 'A';
        if (score >= 70) return 'B';
        if (score >= 60) return 'C';
        return 'D';
    }
};

// 暴露到全局
window.ScoringEngine = ScoringEngine;
