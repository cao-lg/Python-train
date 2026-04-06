# 纯前端 Python 编程实训 OJ 平台 - 产品需求文档

## Overview
- **Summary**: 一个基于 Pyodide WebAssembly 的纯前端 Python 编程实训在线评测平台，支持用户注册登录、题目浏览、代码编辑、自动判题和成绩统计，可部署到 Cloudflare Pages。
- **Purpose**: 提供一个轻量级、无需后端服务器的编程实训平台，适合教育场景和个人练习，支持大规模题库。
- **Target Users**: 学生、编程爱好者、教师。

## Goals
- 实现纯前端架构，使用 Pyodide 进行 Python 代码判题
- 支持 1 万题以上的大规模题库，采用分片加载策略
- 提供完整的用户系统和题目管理功能
- 响应式设计，支持手机等移动设备
- 纯静态部署，可直接部署到 Cloudflare Pages

## Non-Goals (Out of Scope)
- 后端服务器依赖
- 实时排行榜功能
- 题目难度动态调整
- 社区讨论功能
- 多语言支持（仅支持 Python）

## Background & Context
- 传统 OJ 平台通常需要后端服务器和数据库支持，部署和维护成本较高
- Pyodide 提供了在浏览器中运行 Python 代码的能力，使得纯前端判题成为可能
- LiteSQL (sql.js) 提供了浏览器内的 SQL 数据库功能，可用于本地存储用户数据和题目信息
- Cloudflare Pages 提供了免费的静态网站托管服务，适合部署纯前端应用

## Functional Requirements
- **FR-1**: 用户注册、登录和个人中心功能
- **FR-2**: 题目浏览、分页、搜索、筛选和难度分类
- **FR-3**: 代码编辑器（支持 Python 语法高亮）
- **FR-4**: 单元测试风格自动判题（AC/WA/CE/RE/TLE）
- **FR-5**: 提交记录和 AC 统计
- **FR-6**: 题目分片加载，按分类存储和按需加载

## Non-Functional Requirements
- **NFR-1**: 响应式设计，支持手机等移动设备
- **NFR-2**: 性能优化，支持 1 万题以上题库的流畅加载
- **NFR-3**: 安全性，本地存储用户数据和题目信息
- **NFR-4**: 可部署性，纯静态部署到 Cloudflare Pages

## Constraints
- **Technical**: 纯前端实现，使用 Pyodide WebAssembly 判题，LiteSQL 存储
- **Business**: 无后端依赖，零服务器成本
- **Dependencies**: Pyodide, sql.js, 前端框架（如原生 JavaScript 或轻量级框架）

## Assumptions
- 用户浏览器支持 WebAssembly
- 用户设备有足够的本地存储空间存储题目和用户数据
- 题目数量虽多，但每个题目文件大小合理，不会超出浏览器内存限制

## Acceptance Criteria

### AC-1: 用户注册登录功能
- **Given**: 用户访问平台
- **When**: 用户输入注册信息并提交
- **Then**: 系统创建用户账户并存储到本地数据库
- **Verification**: `programmatic`

### AC-2: 题目浏览和筛选
- **Given**: 用户进入题目列表页
- **When**: 用户选择分类或输入搜索关键词
- **Then**: 系统显示对应分类的题目或搜索结果
- **Verification**: `programmatic`

### AC-3: 代码编辑器功能
- **Given**: 用户进入题目详情页
- **When**: 用户在编辑器中编写 Python 代码
- **Then**: 系统提供语法高亮和基本编辑功能
- **Verification**: `human-judgment`

### AC-4: 自动判题功能
- **Given**: 用户提交代码
- **When**: 系统使用 Pyodide 执行代码并进行单元测试
- **Then**: 系统返回判题结果（AC/WA/CE/RE/TLE）
- **Verification**: `programmatic`

### AC-5: 提交记录和统计
- **Given**: 用户完成代码提交
- **When**: 系统记录提交结果
- **Then**: 系统在用户中心显示提交记录和 AC 统计
- **Verification**: `programmatic`

### AC-6: 题目分片加载
- **Given**: 用户访问平台
- **When**: 用户进入特定分类
- **Then**: 系统按需加载该分类的题目到本地数据库
- **Verification**: `programmatic`

### AC-7: 响应式设计
- **Given**: 用户在不同设备上访问平台
- **When**: 用户调整浏览器窗口大小或在移动设备上打开
- **Then**: 系统界面自适应不同屏幕尺寸
- **Verification**: `human-judgment`

### AC-8: 部署到 Cloudflare Pages
- **Given**: 开发完成的代码
- **When**: 部署到 Cloudflare Pages
- **Then**: 平台可正常访问和使用
- **Verification**: `programmatic`

## Open Questions
- [ ] 如何优化大型题库的加载性能？
- [ ] 如何处理 Pyodide 执行时间限制？
- [ ] 如何确保本地存储的数据安全性？
- [ ] 如何实现题目难度的合理划分？