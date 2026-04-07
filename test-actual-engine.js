// 测试实际的判题引擎代码

// 模拟问题数据
const testProblem = {
  id: "test-problem",
  title: "测试题目",
  sample_input: "2 3",
  sample_output: "5",
  test_cases: [
    {
      input: "1 1",
      expected: "2"
    },
    {
      input: "5 5",
      expected: "10"
    }
  ],
  dynamic_test_generator: `
def generate_tests():
    return [
        {"input": "3 4", "expected": "7"},
        {"input": "10 20", "expected": "30"}
    ]
`
};

// 测试用例1: 硬编码输出的代码
const hardcodedCode = `
print("5")
`;

// 测试用例2: 正确实现逻辑的代码
const correctCode = `
a, b = map(int, input().split())
print(a + b)
`;

// 测试用例3: 错误逻辑的代码
const wrongCode = `
a, b = map(int, input().split())
print(a - b)
`;

// 测试用例4: 语法错误的代码
const syntaxErrorCode = `
a, b = map(int, input().split()
print(a + b)
`;

// 测试用例5: 运行时错误的代码
const runtimeErrorcode = `
a, b = map(int, input().split())
print(a + c)
`;

// 测试用例6: 超时的代码
const timeoutCode = `
import time
time.sleep(6)
a, b = map(int, input().split())
print(a + b)
`;

// 执行测试
async function runTests() {
  console.log("开始测试实际判题引擎...");
  
  // 等待 Pyodide 初始化
  if (typeof window !== 'undefined' && window.engine) {
    try {
      await window.engine.initPyodide();
      console.log("Pyodide 初始化成功");
    } catch (error) {
      console.error("Pyodide 初始化失败:", error);
      return;
    }
  } else {
    console.error("判题引擎未加载");
    return;
  }
  
  // 测试1: 硬编码输出
  console.log("\n测试1: 硬编码输出");
  try {
    const result = await window.engine.judgeWithAssert(hardcodedCode, testProblem);
    console.log("结果:", result);
    if (result.type === "WA" && result.message.includes("硬编码输出错误")) {
      console.log("✅ 硬编码输出检测成功");
    } else {
      console.log("❌ 硬编码输出检测失败");
    }
  } catch (error) {
    console.error("测试1失败:", error);
  }
  
  // 测试2: 正确实现
  console.log("\n测试2: 正确实现");
  try {
    const result = await window.engine.judgeWithAssert(correctCode, testProblem);
    console.log("结果:", result);
    if (result.result === "AC") {
      console.log("✅ 正确代码通过测试");
    } else {
      console.log("❌ 正确代码未通过测试");
    }
  } catch (error) {
    console.error("测试2失败:", error);
  }
  
  // 测试3: 错误逻辑
  console.log("\n测试3: 错误逻辑");
  try {
    const result = await window.engine.judgeWithAssert(wrongCode, testProblem);
    console.log("结果:", result);
    if (result.type === "WA") {
      console.log("✅ 错误逻辑被正确检测");
    } else {
      console.log("❌ 错误逻辑未被检测");
    }
  } catch (error) {
    console.error("测试3失败:", error);
  }
  
  // 测试4: 语法错误
  console.log("\n测试4: 语法错误");
  try {
    const result = await window.engine.judgeWithAssert(syntaxErrorCode, testProblem);
    console.log("结果:", result);
    if (result.type === "CE") {
      console.log("✅ 语法错误被正确检测");
    } else {
      console.log("❌ 语法错误未被检测");
    }
  } catch (error) {
    console.error("测试4失败:", error);
  }
  
  // 测试5: 运行时错误
  console.log("\n测试5: 运行时错误");
  try {
    const result = await window.engine.judgeWithAssert(runtimeErrorcode, testProblem);
    console.log("结果:", result);
    if (result.type === "RE") {
      console.log("✅ 运行时错误被正确检测");
    } else {
      console.log("❌ 运行时错误未被检测");
    }
  } catch (error) {
    console.error("测试5失败:", error);
  }
  
  // 测试6: 性能测试（超时）
  console.log("\n测试6: 性能测试（超时）");
  try {
    const startTime = Date.now();
    const result = await window.engine.judgeWithAssert(timeoutCode, testProblem);
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log("结果:", result);
    console.log("执行时间:", duration, "ms");
    if (result.type === "TLE" && duration <= 5500) { // 允许500ms的误差
      console.log("✅ 超时检测成功，且执行时间在合理范围内");
    } else {
      console.log("❌ 超时检测失败或执行时间过长");
    }
  } catch (error) {
    console.error("测试6失败:", error);
  }
  
  // 测试7: 动态测试用例
  console.log("\n测试7: 动态测试用例");
  try {
    const result = await window.engine.judgeWithAssert(correctCode, testProblem);
    console.log("结果:", result);
    if (result.result === "AC") {
      console.log("✅ 动态测试用例执行成功");
    } else {
      console.log("❌ 动态测试用例执行失败");
    }
  } catch (error) {
    console.error("测试7失败:", error);
  }
  
  console.log("\n测试完成！");
}

// 运行测试
if (typeof window !== 'undefined') {
  // 在浏览器环境中运行
  window.runTests = runTests;
  console.log("测试脚本已加载，点击页面上的按钮开始测试");
} else {
  // 在Node.js环境中运行
  console.error("此测试脚本需要在浏览器环境中运行，因为它依赖于Pyodide");
}
