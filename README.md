# 番薯

简体中文 | [English](#english)

## 简介

番薯是一个基于 Flask 的物联网智能体管理平台，支持配置管理、模型集成、飞书机器人集成等功能。

## 功能特性

- **配置版本管理**：支持配置的备份、恢复和版本管理
- **智能体管理**：创建、编辑、删除智能体配置
- **模型集成**：支持多种 AI 模型提供商（OpenAI、Claude、DeepSeek 等）
- **飞书集成**：集成飞书机器人，支持消息推送
- **系统备份**：支持小龙虾（OpenClaw）和番薯（rlzclaw）配置的备份
- **用户认证**：安全的登录认证系统

## 技术栈

- **后端**：Flask (Python 3.12)
- **前端**：Bootstrap 5, Vanilla JavaScript
- **数据存储**：JSON 文件

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 配置

1. 复制配置文件（可选）：

```bash
cp config/agents.json.example config/agents.json
```

1. 运行应用：

```bash
# 开发模式
python app.py

# 服务器模式
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 访问

打开浏览器访问：`http://localhost:5000`

默认登录凭据：

- 用户名：`fango`
- 密码：`fanshu@2026`

首次登录需要修改密码。

## 项目结构

```
rlzclaw/
├── app.py              # 主应用文件
├── requirements.txt    # Python 依赖
├── config/            # 配置文件目录
│   ├── agents.json
│   ├── feishu_channels.json
│   └── model_providers.json
├── locale/            # 国际化文件
│   ├── en.json
│   ├── zh-CN.json
│   └── zh-TW.json
├── static/            # 静态资源
│   ├── css/
│   └── js/
└── templates/         # HTML 模板
    ├── index.html
    └── login.html
```

## 系统备份功能

### 小龙虾备份

备份 OpenClaw 安装目录，包括：

- `/home/ubuntu/openclaw-main`
- `/home/ubuntu/.openclaw`
- 系统服务文件

### 番薯备份

备份 rlzclaw 配置目录。

备份文件保存在 `/home/ubuntu/backups` 目录。

## 安全说明

- 密码使用 MD5 加密存储
- 首次登录强制要求修改密码
- 所有 API 需要登录认证

## 许可证

MIT License - 请查看 [LICENSE](LICENSE) 文件。

***

## English

### Introduction

rlzclaw is a Flask-based IoT agent management platform with support for configuration management, model integration, and Feishu bot integration.

### Features

- Configuration version management with backup and restore
- Agent management (create, edit, delete)
- Multi-model provider support (OpenAI, Claude, DeepSeek, etc.)
- Feishu bot integration for message推送
- System backup for both OpenClaw and rlzclaw configurations
- Secure user authentication

### Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
python app.py
```

Access at: `http://localhost:5000`

Default credentials:

- Username: `fango`
- Password: `fanshu@2026`

### License

MIT License - See [LICENSE](LICENSE) file.
