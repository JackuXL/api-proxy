# api-proxy
一个轻量级的 AI API 代理服务器，支持 OpenAI 兼容接口。基于 Vercel serverless functions 构建。
 

# AI API 代理服务

一个轻量级的 AI API 代理服务器，支持 OpenAI 兼容接口。基于 Vercel serverless functions 构建。

## 特性

- 🚀 基于 Vercel 快速部署
- 🔒 安全的 API 密钥处理
- 💡 兼容 OpenAI API
- 🌐 全球边缘网络
- ⚡ Serverless 架构

## 部署指南

### 前置要求

- GitHub 账号
- Vercel 账号
- OpenAI API 密钥（或其他 AI 服务的 API 密钥）

### 一键部署

[![使用 Vercel 部署](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sigazen/api-proxy)

### 手动部署步骤

1. Fork 这个仓库
2. 在 Vercel 创建新项目
3. 连接你 Fork 的仓库
4. 设置环境变量：
   - `API_KEY`：你的 AI 服务 API 密钥
   - `BASE_URL`：AI API 的基础 URL（默认：https://api.openai.com）
5. 点击部署！

## 使用方法

部署完成后，只需要将原始 API 基础 URL 替换为你的 Vercel 部署 URL 即可使用：

```bash
# 原始 OpenAI API 请求
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-3.5-turbo"}'

# 使用代理后的请求
curl https://你的部署域名.vercel.app/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-3.5-turbo"}'
```

## 环境变量

| 变量名      | 描述              | 默认值                 |
|------------|------------------|----------------------|
| `API_KEY`  | AI 服务的 API 密钥 | 必填                  |
| `BASE_URL` | AI API 的基础 URL  | https://api.openai.com |
