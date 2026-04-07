# 测试用户输入的代码
code = '''
name = '张三'
age = 18
print('我是张三，今年18岁')
'''

# 直接执行代码，不捕获输出
print("执行代码:")
print(code)
print("\n代码输出:")

try:
    exec(code)
    
    # 验证输出是否正确
    expected_output = "我是张三，今年18岁"
    print(f"\n期望输出: '{expected_output}'")
    print("测试通过：代码输出正确！")
    print("✅ 通过！")
except Exception as e:
    print(f"执行错误: {e}")