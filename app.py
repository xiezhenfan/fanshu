# -*- coding: utf-8 -*-
"""
番薯焗龙虾 Web 应用
Flask 后端服务 - 对接 OpenClaw

OpenClaw Configuration Management Web Application
Flask Backend Service - Integrates with OpenClaw
"""

import os
import json
import subprocess
import glob
import shutil
import threading
import time
from datetime import datetime
import logging
from flask import Flask, render_template, request, jsonify, send_file, session, redirect, url_for
from functools import wraps
import hashlib

# 初始化 Flask 应用 / Initialize Flask application
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = 'fango-rlzclaw-secret-key-2026'

# 用户配置 / User configuration
DEFAULT_USERNAME = 'fango'
DEFAULT_PASSWORD_MD5 = hashlib.md5('fanshu@2026'.encode()).hexdigest()

users = {
    DEFAULT_USERNAME: {
        'password': DEFAULT_PASSWORD_MD5,
        'must_change_password': True,
        'created_at': datetime.now().isoformat()
    }
}

# 用户数据文件路径 / User data file path
USERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'users.json')

def load_users():
    """加载用户数据 / Load user data"""
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return users

def save_users(users_data):
    """保存用户数据 / Save user data"""
    with open(USERS_FILE, 'w') as f:
        json.dump(users_data, f, indent=2)

def login_required(f):
    """登录装饰器 / Login decorator"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            # 如果是 API 请求，返回 JSON / If API request, return JSON
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized', 'message': '请先登录'}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# 基础目录配置 / Base directory configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # 应用根目录 / Application root directory
CONFIG_DIR = os.path.join(BASE_DIR, 'config')          # 配置文件目录 / Configuration file directory
LOCALE_DIR = os.path.join(BASE_DIR, 'locale')           # 国际化文件目录 / Localization file directory

# OpenClaw 相关路径配置 / OpenClaw related path configuration
# 从环境变量读取，支持自定义安装位置，自动寻找 / Read from environment variables, support custom installation location, auto-discovery
def find_openclaw_dir():
    """自动寻找 OpenClaw 安装目录 / Auto-detect OpenClaw installation directory"""
    user_home = os.path.expanduser('~')
    possible_dirs = [
        os.environ.get('OPENCLAW_DIR', ''),
        os.path.join(user_home, 'openclaw-main'),
        os.path.join(user_home, 'openclaw'),
        os.path.expanduser('~/openclaw-main'),
        os.path.expanduser('~/openclaw'),
    ]
    for dir_path in possible_dirs:
        if dir_path and os.path.exists(dir_path) and os.path.isdir(dir_path):
            return dir_path
    return possible_dirs[1]  # 默认回退 / Default fallback

def find_openclaw_home():
    """自动寻找 OpenClaw 数据目录 / Auto-detect OpenClaw data directory"""
    user_home = os.path.expanduser('~')
    possible_dirs = [
        os.environ.get('OPENCLAW_HOME', ''),
        os.path.join(user_home, '.openclaw'),
        os.path.expanduser('~/.openclaw'),
    ]
    for dir_path in possible_dirs:
        if dir_path and os.path.exists(dir_path) and os.path.isdir(dir_path):
            return dir_path
    return possible_dirs[1]  # 默认回退 / Default fallback

OPENCLAW_HOME = find_openclaw_home()  # OpenClaw 数据目录 / OpenClaw data directory
OPENCLAW_DIR = find_openclaw_dir()     # OpenClaw 安装目录 / OpenClaw installation directory
OPENCLAW_CONFIG = os.path.join(OPENCLAW_HOME, 'openclaw.json')                        # OpenClaw 主配置文件 / OpenClaw main configuration file
OPENCLAW_STATE_DIR = OPENCLAW_HOME                                                      # 状态文件目录 / State file directory
OPENCLAW_VERSIONS_DIR = os.path.join(OPENCLAW_HOME, 'versions')                        # 版本备份目录 / Version backup directory

# 服务器命令配置文件 / Server command configuration file
SERVER_CONFIG_FILE = os.path.join(CONFIG_DIR, 'server_config.json')

def load_server_config():
    """加载服务器命令配置 / Load server command configuration"""
    default_config = {
        'gateway_service': 'openclaw-gateway',
        'config_service': 'openclaw-config',
        'commands': [
            {
                'id': 'restart_gateway',
                'command': 'sudo systemctl restart openclaw-gateway',
                'names': {'zh-CN': '重启网关', 'zh-TW': '重啟閘道', 'en': 'Restart Gateway'}
            },
            {
                'id': 'gateway_status',
                'command': 'sudo systemctl status openclaw-gateway',
                'names': {'zh-CN': '查看网关状态', 'zh-TW': '查看閘道狀態', 'en': 'Gateway Status'}
            }
        ]
    }
    if os.path.exists(SERVER_CONFIG_FILE):
        try:
            with open(SERVER_CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return default_config

# 模型厂商配置文件 / Model provider configuration file
MODEL_PROVIDERS_FILE = os.path.join(CONFIG_DIR, 'model_providers.json')
# 智能体模板配置文件 / Agent template configuration file
AGENT_TEMPLATES_FILE = os.path.join(CONFIG_DIR, 'agent_templates.json')
# 最大保留版本数 / Maximum number of versions to keep
MAX_VERSIONS = 20

def get_config_path(filename):
    """
    获取配置文件的完整路径
    Get the full path of a configuration file
    
    Args:
        filename (str): 配置文件名 / Configuration file name
        
    Returns:
        str: 配置文件的完整路径 / Full path of the configuration file
    """
    return os.path.join(CONFIG_DIR, filename)

def load_json_config(filename):
    """
    加载 JSON 格式的配置文件
    Load JSON format configuration file
    
    Args:
        filename (str): 配置文件名 / Configuration file name
        
    Returns:
        dict: 配置数据字典 / Configuration data dictionary
    """
    filepath = get_config_path(filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_json_config(filename, data):
    """
    保存数据到 JSON 配置文件
    Save data to JSON configuration file
    
    Args:
        filename (str): 配置文件名 / Configuration file name
        data (dict): 要保存的数据 / Data to save
    """
    filepath = get_config_path(filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def write_agent_md_files(agent_id, data):
    """
    将智能体配置写入对应的 Markdown 文件，遵循 OpenClaw 官方 Markdown 规范
    Write agent configuration to corresponding Markdown files, following OpenClaw official Markdown specifications
    
    Args:
        agent_id (str): 智能体 ID / Agent ID
        data (dict): 智能体配置数据 / Agent configuration data
    """
    if not agent_id:
        return
    
    try:
        # 智能体工作区目录 - 主智能体直接在workspace目录下 / Agent workspace directory - main agent directly under workspace
        if agent_id == 'main':
            workspace_dir = os.path.join(OPENCLAW_HOME, 'workspace')
        else:
            workspace_dir = os.path.join(OPENCLAW_HOME, 'workspace', 'agents', agent_id)
        if not os.path.exists(workspace_dir):
            os.makedirs(workspace_dir, exist_ok=True)
        
        # Markdown 文件映射：字段名 -> 文件名 / Markdown file mapping: field name -> filename
        md_files = {
            'IDENTITY.md': data.get('identity', ''),      # 身份与权限体系 / Identity and permission system
            'SKILL.md': data.get('skills', ''),            # 技能能力说明书 / Skill capabilities specification
            'SOUL.md': data.get('personality', ''),        # 核心人格与价值观 / Core personality and values
            'TOOLS.md': data.get('tools', ''),             # 工具集接入文档 / Tools integration document
            'USER.md': data.get('userProfile', '')         # 用户画像与交互规范 / User profile and interaction specification
        }
        
        # 写入各个 Markdown 文件 / Write each Markdown file
        for filename, content in md_files.items():
            filepath = os.path.join(workspace_dir, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content if content else '')
    except Exception as e:
        print(f'Warning: Failed to write agent md files: {e}')

def save_agent_archive(agent_id, data):
    """
    保存智能体存档文件
    Save agent archive file
    
    Args:
        agent_id (str): 智能体 ID / Agent ID
        data (dict): 智能体配置数据 / Agent configuration data
    """
    if not agent_id:
        return
    
    try:
        # 智能体工作区目录 - 主智能体直接在workspace目录下 / Agent workspace directory - main agent directly under workspace
        if agent_id == 'main':
            workspace_dir = os.path.join(OPENCLAW_HOME, 'workspace')
        else:
            workspace_dir = os.path.join(OPENCLAW_HOME, 'workspace', 'agents', agent_id)
        if not os.path.exists(workspace_dir):
            os.makedirs(workspace_dir, exist_ok=True)
        
        archive_file = os.path.join(workspace_dir, 'agent_archive.json')
        
        archive_data = {
            'identity': data.get('identity', ''),
            'skills': data.get('skills', ''),
            'personality': data.get('personality', ''),
            'tools': data.get('tools', ''),
            'userProfile': data.get('userProfile', ''),
            'updatedAt': datetime.now().isoformat()
        }
        
        with open(archive_file, 'w', encoding='utf-8') as f:
            json.dump(archive_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f'Warning: Failed to save agent archive: {e}')

def load_agent_archive(agent_id):
    """
    加载智能体存档文件
    Load agent archive file
    
    Args:
        agent_id (str): 智能体 ID / Agent ID
        
    Returns:
        dict: 存档数据 / Archive data
    """
    if not agent_id:
        return {}
    
    try:
        # 智能体工作区目录 - 主智能体直接在workspace目录下 / Agent workspace directory - main agent directly under workspace
        if agent_id == 'main':
            workspace_dir = os.path.join(OPENCLAW_HOME, 'workspace')
        else:
            workspace_dir = os.path.join(OPENCLAW_HOME, 'workspace', 'agents', agent_id)
        archive_file = os.path.join(workspace_dir, 'agent_archive.json')
        
        if os.path.exists(archive_file):
            with open(archive_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        
        # 兼容旧版本：尝试从 MD 文件读取 / Legacy support: try to read from MD files
        md_files = {
            'identity': 'IDENTITY.md',
            'skills': 'SKILL.md',
            'personality': 'SOUL.md',
            'tools': 'TOOLS.md',
            'userProfile': 'USER.md'
        }
        
        archive_data = {}
        for key, filename in md_files.items():
            filepath = os.path.join(workspace_dir, filename)
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    archive_data[key] = f.read()
        
        return archive_data
    except Exception as e:
        print(f'Warning: Failed to load agent archive: {e}')
        return {}

def load_locale(lang):
    """
    加载指定语言的国际化文件
    Load localization file for specified language
    
    Args:
        lang (str): 语言代码（如 'zh-CN', 'en'）/ Language code (e.g., 'zh-CN', 'en')
        
    Returns:
        dict: 国际化数据字典 / Localization data dictionary
    """
    filepath = os.path.join(LOCALE_DIR, f'{lang}.json')
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def load_openclaw_config():
    """
    加载 OpenClaw 主配置文件
    Load OpenClaw main configuration file
    
    Returns:
        dict: OpenClaw 配置数据 / OpenClaw configuration data
    """
    if os.path.exists(OPENCLAW_CONFIG):
        with open(OPENCLAW_CONFIG, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_openclaw_config(config, create_version=True, action='update'):
    """
    保存 OpenClaw 配置文件，可选创建版本备份
    Save OpenClaw configuration file, optionally create version backup
    
    Args:
        config (dict): 配置数据 / Configuration data
        create_version (bool): 是否创建版本备份 / Whether to create version backup
        action (str): 操作类型（'update', 'delete', 'restore'）/ Action type ('update', 'delete', 'restore')
    """
    # 确保版本目录存在 / Ensure version directory exists
    if not os.path.exists(OPENCLAW_VERSIONS_DIR):
        os.makedirs(OPENCLAW_VERSIONS_DIR)
    
    # 创建版本备份 / Create version backup
    if create_version and os.path.exists(OPENCLAW_CONFIG):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        version_file = os.path.join(OPENCLAW_VERSIONS_DIR, f'openclaw_{timestamp}.json')
        shutil.copy2(OPENCLAW_CONFIG, version_file)
        # 清理旧版本 / Clean up old versions
        cleanup_old_versions()
    
    # 保存新配置 / Save new configuration
    with open(OPENCLAW_CONFIG, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

def cleanup_old_versions():
    """
    清理超过最大数量的旧版本备份
    Clean up old version backups that exceed the maximum count
    """
    if not os.path.exists(OPENCLAW_VERSIONS_DIR):
        return
    
    # 获取所有版本文件并按修改时间排序 / Get all version files and sort by modification time
    versions = []
    for f in os.listdir(OPENCLAW_VERSIONS_DIR):
        if f.startswith('openclaw_') and f.endswith('.json'):
            filepath = os.path.join(OPENCLAW_VERSIONS_DIR, f)
            versions.append((filepath, os.path.getmtime(filepath)))
    
    # 从新到旧排序 / Sort from newest to oldest
    versions.sort(key=lambda x: x[1], reverse=True)
    
    # 删除超过最大数量的旧版本 / Delete old versions exceeding maximum count
    for filepath, _ in versions[MAX_VERSIONS:]:
        os.remove(filepath)

def get_version_list():
    """
    获取所有配置版本列表
    Get all configuration version list
    
    Returns:
        list: 版本信息列表，包含文件名、时间戳等 / Version info list containing filename, timestamp, etc.
    """
    if not os.path.exists(OPENCLAW_VERSIONS_DIR):
        return []
    
    versions = []
    for f in os.listdir(OPENCLAW_VERSIONS_DIR):
        if f.startswith('openclaw_') and f.endswith('.json'):
            filepath = os.path.join(OPENCLAW_VERSIONS_DIR, f)
            mtime = os.path.getmtime(filepath)
            timestamp_str = f.replace('openclaw_', '').replace('.json', '')
            try:
                # 解析时间戳并格式化显示 / Parse timestamp and format for display
                dt = datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
                display_time = dt.strftime('%Y-%m-%d %H:%M:%S')
            except:
                display_time = timestamp_str
            
            versions.append({
                'filename': f,
                'filepath': filepath,
                'timestamp': timestamp_str,
                'displayTime': display_time,
                'mtime': mtime
            })
    
    # 按时间从新到旧排序 / Sort by time from newest to oldest
    versions.sort(key=lambda x: x['mtime'], reverse=True)
    return versions

def load_model_providers_config():
    """
    加载模型厂商配置模板
    Load model provider configuration templates
    
    Returns:
        dict: 模型厂商配置数据 / Model provider configuration data
    """
    if os.path.exists(MODEL_PROVIDERS_FILE):
        with open(MODEL_PROVIDERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {'providers': {}, 'lastUpdated': '', 'version': '1.0'}

def save_model_providers_config(data):
    """
    保存模型厂商配置
    Save model provider configuration
    
    Args:
        data (dict): 模型厂商配置数据 / Model provider configuration data
    """
    data['lastUpdated'] = datetime.now().strftime('%Y-%m-%d')
    with open(MODEL_PROVIDERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_agent_templates_config():
    """
    加载智能体模板配置
    Load agent template configuration
    
    Returns:
        dict: 智能体模板数据 / Agent template data
    """
    if os.path.exists(AGENT_TEMPLATES_FILE):
        with open(AGENT_TEMPLATES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {'templates': [], 'lastUpdated': '', 'version': '1.0'}

def save_agent_templates_config(data):
    """
    保存智能体模板配置
    Save agent template configuration
    
    Args:
        data (dict): 智能体模板数据 / Agent template data
    """
    data['lastUpdated'] = datetime.now().strftime('%Y-%m-%d')
    with open(AGENT_TEMPLATES_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def run_openclaw_command(cmd_args, timeout=120):
    """
    执行 OpenClaw 命令
    Execute OpenClaw command
    
    Args:
        cmd_args (str): 命令参数 / Command arguments
        timeout (int): 超时时间（秒）/ Timeout in seconds
        
    Returns:
        dict: 执行结果，包含 success, stdout, stderr 等 / Execution result containing success, stdout, stderr, etc.
    """
    try:
        result = subprocess.run(
            f'source ~/.nvm/nvm.sh && openclaw {cmd_args}',
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            executable='/bin/bash'
        )
        success = result.returncode == 0
        return {'success': success, 'stdout': result.stdout, 'stderr': result.stderr, 'returncode': result.returncode}
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': 'Command timeout'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def get_agent_sessions_dir(agent_id):
    """
    获取智能体会话目录路径
    Get agent sessions directory path
    
    Args:
        agent_id (str): 智能体 ID / Agent ID
        
    Returns:
        str: 会话目录路径 / Sessions directory path
    """
    return os.path.join(OPENCLAW_STATE_DIR, 'agents', agent_id, 'sessions')

def parse_jsonl_session(filepath, limit=100):
    """
    解析 JSONL 格式的会话文件
    Parse JSONL format session file
    
    Args:
        filepath (str): 文件路径 / File path
        limit (int): 最多读取的消息数量 / Maximum number of messages to read
        
    Returns:
        list: 解析后的消息列表 / Parsed message list
    """
    messages = []
    if not os.path.exists(filepath):
        return messages
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            # 读取最后 limit 行 / Read last limit lines
            lines = f.readlines()[-limit:]
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    # 只处理消息类型的记录 / Only process message type records
                    if data.get('type') == 'message':
                        msg = data.get('message', {})
                        content = msg.get('content', [])
                        text_content = ''
                        
                        # 提取文本内容 / Extract text content
                        for item in content:
                            if isinstance(item, dict) and item.get('type') == 'text':
                                text_content = item.get('text', '')
                                break
                            elif isinstance(item, str):
                                text_content = item
                                break
                        
                        if text_content:
                            messages.append({
                                'id': data.get('id', ''),
                                'role': msg.get('role', 'user'),
                                'content': text_content,
                                'timestamp': data.get('timestamp', ''),
                                'parentId': data.get('parentId', '')
                            })
                except:
                    continue
    except Exception as e:
        print(f'Error reading session file: {e}')
    
    return messages

def get_latest_session_file(agent_id):
    """
    获取智能体最新的会话文件
    Get the latest session file for an agent
    
    Args:
        agent_id (str): 智能体 ID / Agent ID
        
    Returns:
        str: 最新会话文件路径，若无则返回 None / Latest session file path, None if not found
    """
    sessions_dir = get_agent_sessions_dir(agent_id)
    if not os.path.exists(sessions_dir):
        return None
    
    # 查找所有 JSONL 文件 / Find all JSONL files
    jsonl_files = glob.glob(os.path.join(sessions_dir, '*.jsonl'))
    if not jsonl_files:
        return None
    
    # 返回最新修改的文件 / Return the most recently modified file
    latest_file = max(jsonl_files, key=os.path.getmtime)
    return latest_file

def get_all_available_models(config):
    """
    从配置中获取所有可用的模型列表
    Get all available model list from configuration
    
    Args:
        config (dict): OpenClaw 配置 / OpenClaw configuration
        
    Returns:
        list: 模型信息列表 / Model info list
    """
    models = []
    providers = config.get('models', {}).get('providers', {})
    
    for provider_id, provider in providers.items():
        for model in provider.get('models', []):
            models.append({
                'id': f"{provider_id}/{model['id']}",
                'name': f"{provider.get('name', provider_id)} - {model.get('name', model['id'])}",
                'provider': provider_id,
                'modelId': model['id'],
                'context': model.get('context', 4096),
                'input': model.get('input', ['text'])
            })
    
    return models

# ==================== API 路由定义 / API Route Definitions ====================

@app.route('/api/locale/<lang>')
def get_locale(lang):
    """
    获取指定语言的国际化数据
    Get localization data for specified language
    
    Args:
        lang (str): 语言代码 / Language code
        
    Returns:
        JSON: 国际化数据 / Localization data
    """
    locale_data = load_locale(lang)
    return jsonify(locale_data)

@app.route('/login', methods=['GET', 'POST'])
def login():
    """登录页面 / Login page"""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        
        if not username or not password:
            return render_template('login.html', error='请输入用户名和密码')
        
        users_data = load_users()
        password_md5 = hashlib.md5(password.encode()).hexdigest()
        
        if username in users_data and users_data[username]['password'] == password_md5:
            session['username'] = username
            session['must_change_password'] = users_data[username].get('must_change_password', False)
            return redirect(url_for('index'))
        else:
            return render_template('login.html', error='用户名或密码错误')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    """登出 / Logout"""
    session.clear()
    return redirect(url_for('login'))

@app.route('/api/logo', methods=['POST'])
@login_required
def upload_logo():
    """上传Logo / Upload logo"""
    if 'logo' not in request.files:
        return jsonify({'success': False, 'error': '请选择图片文件'})
    
    file = request.files['logo']
    if file.filename == '':
        return jsonify({'success': False, 'error': '请选择图片文件'})
    
    # 检查文件类型 / Check file type
    allowed_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        return jsonify({'success': False, 'error': '仅支持 PNG, JPG, GIF, SVG, WEBP 格式'})
    
    # 保存文件 / Save file
    logo_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'img')
    os.makedirs(logo_dir, exist_ok=True)
    
    logo_path = os.path.join(logo_dir, 'logo' + ext)
    file.save(logo_path)
    
    return jsonify({'success': True, 'logo_url': f'/static/img/logo{ext}?t={int(time.time())}'})

@app.route('/api/logo', methods=['GET'])
def get_logo():
    """获取当前Logo / Get current logo"""
    logo_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'img')
    
    for ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']:
        logo_path = os.path.join(logo_dir, 'logo' + ext)
        if os.path.exists(logo_path):
            return jsonify({'success': True, 'logo_url': f'/static/img/logo{ext}'})
    
    return jsonify({'success': False, 'logo_url': None})

@app.route('/change-password', methods=['POST'])
def change_password():
    """修改密码 / Change password"""
    if 'username' not in session:
        return jsonify({'success': False, 'error': '未登录'}), 401
    
    current_password = request.form.get('current_password', '').strip()
    new_password = request.form.get('new_password', '').strip()
    confirm_password = request.form.get('confirm_password', '').strip()
    
    if not current_password or not new_password or not confirm_password:
        return jsonify({'success': False, 'error': '请填写所有字段'})
    
    if new_password != confirm_password:
        return jsonify({'success': False, 'error': '两次输入的密码不一致'})
    
    if len(new_password) < 6:
        return jsonify({'success': False, 'error': '密码长度至少6位'})
    
    users_data = load_users()
    username = session['username']
    
    # 验证当前密码 / Verify current password
    current_md5 = hashlib.md5(current_password.encode()).hexdigest()
    if users_data[username]['password'] != current_md5:
        return jsonify({'success': False, 'error': '当前密码错误'})
    
    # 更新密码 / Update password
    users_data[username]['password'] = hashlib.md5(new_password.encode()).hexdigest()
    users_data[username]['must_change_password'] = False
    save_users(users_data)
    
    session['must_change_password'] = False
    
    return jsonify({'success': True})

@app.route('/api/users', methods=['GET'])
@login_required
def list_users():
    """获取用户列表 / Get user list"""
    users_data = load_users()
    user_list = []
    for username, info in users_data.items():
        user_list.append({
            'username': username,
            'created_at': info.get('created_at', ''),
            'must_change_password': info.get('must_change_password', False)
        })
    return jsonify({'success': True, 'users': user_list})

@app.route('/api/users', methods=['POST'])
@login_required
def create_user():
    """创建新用户 / Create new user"""
    new_username = request.form.get('username', '').strip()
    new_password = request.form.get('password', '').strip()
    
    if not new_username or not new_password:
        return jsonify({'success': False, 'error': '请填写用户名和密码'})
    
    if len(new_password) < 6:
        return jsonify({'success': False, 'error': '密码长度至少6位'})
    
    users_data = load_users()
    
    if new_username in users_data:
        return jsonify({'success': False, 'error': '用户名已存在'})
    
    users_data[new_username] = {
        'password': hashlib.md5(new_password.encode()).hexdigest(),
        'must_change_password': False,
        'created_at': datetime.now().isoformat()
    }
    save_users(users_data)
    
    return jsonify({'success': True, 'message': f'用户 {new_username} 创建成功'})

@app.route('/api/users/<username>', methods=['DELETE'])
@login_required
def delete_user(username):
    """删除用户 / Delete user"""
    current_user = session['username']
    
    if username == current_user:
        return jsonify({'success': False, 'error': '不能删除当前登录用户'})
    
    users_data = load_users()
    
    if username not in users_data:
        return jsonify({'success': False, 'error': '用户不存在'})
    
    del users_data[username]
    save_users(users_data)
    
    return jsonify({'success': True, 'message': f'用户 {username} 已删除'})

@app.route('/check-login')
def check_login():
    """检查登录状态 / Check login status"""
    if 'username' not in session:
        return jsonify({'logged_in': False})
    return jsonify({
        'logged_in': True,
        'username': session['username'],
        'must_change_password': session.get('must_change_password', False)
    })

@app.route('/')
@login_required
def index():
    """
    渲染首页
    Render index page
    
    Returns:
        HTML: 首页模板 / Index template
    """
    return render_template('index.html', username=session.get('username', ''))

@app.route('/api/models/providers/all', methods=['GET'])
def get_all_model_providers():
    """
    获取所有模型厂商模板配置
    Get all model provider template configurations
    
    Returns:
        JSON: 模型厂商模板数据 / Model provider template data
    """
    config = load_model_providers_config()
    return jsonify(config.get('providers', {}))

@app.route('/api/models/providers/configured', methods=['GET'])
def get_configured_model_providers():
    """
    获取已配置的模型厂商列表
    Get configured model provider list
    
    Returns:
        JSON: 已配置的模型厂商列表 / Configured model provider list
    """
    config = load_openclaw_config()
    providers = config.get('models', {}).get('providers', {})
    result = []
    
    for provider_id, provider in providers.items():
        result.append({
            'id': provider_id,
            'name': provider.get('name', provider_id),
            'baseUrl': provider.get('baseUrl', ''),
            'api': provider.get('api', 'openai-completions'),
            'models': provider.get('models', []),
            'hasApiKey': bool(provider.get('apiKey', ''))
        })
    
    return jsonify(result)

@app.route('/api/models/providers/add', methods=['POST'])
def add_model_provider_to_openclaw():
    """
    添加模型厂商配置到 OpenClaw
    Add model provider configuration to OpenClaw
    
    Returns:
        JSON: 操作结果 / Operation result
    """
    data = request.get_json()
    provider_id = data.get('providerId', '').strip()
    api_key = data.get('apiKey', '').strip()
    selected_models = data.get('models', [])
    
    # 参数验证 / Parameter validation
    if not provider_id:
        return jsonify({'success': False, 'error': 'Provider ID is required'})
    if not api_key:
        return jsonify({'success': False, 'error': 'API Key is required'})
    
    # 加载厂商模板 / Load provider template
    providers_config = load_model_providers_config()
    provider_template = providers_config.get('providers', {}).get(provider_id, {})
    
    if not provider_template:
        return jsonify({'success': False, 'error': 'Provider not found in template'})
    
    # 更新 OpenClaw 配置 / Update OpenClaw configuration
    openclaw_config = load_openclaw_config()
    if 'models' not in openclaw_config:
        openclaw_config['models'] = {'providers': {}}
    if 'providers' not in openclaw_config['models']:
        openclaw_config['models']['providers'] = {}
    
    # 确定要添加的模型 / Determine models to add
    models_to_add = selected_models if selected_models else provider_template.get('models', [])
    
    # 保存厂商配置 / Save provider configuration
    openclaw_config['models']['providers'][provider_id] = {
        'name': provider_template.get('name', provider_id),
        'baseUrl': provider_template.get('baseUrl', ''),
        'apiKey': api_key,
        'api': provider_template.get('api', 'openai-completions'),
        'models': models_to_add
    }
    
    save_openclaw_config(openclaw_config)
    return jsonify({'success': True, 'message': 'Provider added successfully'})

@app.route('/api/models/providers/<provider_id>/update-key', methods=['POST'])
def update_provider_api_key(provider_id):
    """
    更新模型厂商的 API Key
    Update model provider API Key
    
    Args:
        provider_id (str): 厂商 ID / Provider ID
        
    Returns:
        JSON: 操作结果 / Operation result
    """
    data = request.get_json()
    api_key = data.get('apiKey', '').strip()
    
    if not api_key:
        return jsonify({'success': False, 'error': 'API Key is required'})
    
    openclaw_config = load_openclaw_config()
    providers = openclaw_config.get('models', {}).get('providers', {})
    
    if provider_id not in providers:
        return jsonify({'success': False, 'error': 'Provider not found'})
    
    openclaw_config['models']['providers'][provider_id]['apiKey'] = api_key
    save_openclaw_config(openclaw_config)
    return jsonify({'success': True})

@app.route('/api/models/providers/<provider_id>', methods=['DELETE'])
def delete_model_provider(provider_id):
    """
    删除模型厂商配置
    Delete model provider configuration
    
    Args:
        provider_id (str): 厂商 ID / Provider ID
        
    Returns:
        JSON: 操作结果 / Operation result
    """
    openclaw_config = load_openclaw_config()
    providers = openclaw_config.get('models', {}).get('providers', {})
    
    if provider_id in providers:
        del openclaw_config['models']['providers'][provider_id]
        save_openclaw_config(openclaw_config)
    
    return jsonify({'success': True})

@app.route('/api/models/available', methods=['GET'])
def get_available_models():
    """
    获取所有可用模型列表
    Get all available model list
    
    Returns:
        JSON: 模型列表 / Model list
    """
    config = load_openclaw_config()
    models = get_all_available_models(config)
    return jsonify(models)

@app.route('/api/feishu', methods=['GET'])
def get_feishu_channels():
    """
    获取飞书通道配置
    Get Feishu channel configuration
    
    Returns:
        JSON: 飞书通道列表 / Feishu channel list
    """
    config = load_openclaw_config()
    channels = []
    
    if 'channels' in config and 'feishu' in config['channels']:
        feishu = config['channels']['feishu']
        channels.append({
            'id': 'feishu-main',
            'name': '飞书通道',
            'appId': feishu.get('appId', ''),
            'appSecret': feishu.get('appSecret', ''),
            'verificationToken': feishu.get('verificationToken', ''),
            'enabled': feishu.get('enabled', True)
        })
    
    return jsonify(channels)

@app.route('/api/feishu', methods=['POST'])
def save_feishu_channel():
    """
    保存飞书通道配置
    Save Feishu channel configuration
    
    Returns:
        JSON: 操作结果 / Operation result
    """
    data = request.get_json()
    config = load_openclaw_config()
    
    if 'channels' not in config:
        config['channels'] = {}
    
    # 保存飞书配置 / Save Feishu configuration
    config['channels']['feishu'] = {
        'enabled': data.get('enabled', True),
        'appId': data.get('appId', ''),
        'appSecret': data.get('appSecret', ''),
        'verificationToken': data.get('verificationToken', ''),
        'domain': 'feishu',
        'connectionMode': 'websocket',
        'dmPolicy': 'open',
        'allowFrom': ['*'],
        'groupPolicy': 'open'
    }
    
    save_openclaw_config(config)
    return jsonify({'success': True, 'data': data})

@app.route('/api/feishu/<channel_id>', methods=['DELETE'])
def delete_feishu_channel(channel_id):
    """
    删除飞书通道配置（禁用）
    Delete Feishu channel configuration (disable)
    
    Args:
        channel_id (str): 通道 ID / Channel ID
        
    Returns:
        JSON: 操作结果 / Operation result
    """
    config = load_openclaw_config()
    if 'channels' in config and 'feishu' in config['channels']:
        config['channels']['feishu']['enabled'] = False
    save_openclaw_config(config)
    return jsonify({'success': True})

@app.route('/api/feishu/<channel_id>/toggle', methods=['POST'])
def toggle_feishu_channel(channel_id):
    """
    切换飞书通道启用状态
    Toggle Feishu channel enabled status
    
    Args:
        channel_id (str): 通道 ID / Channel ID
        
    Returns:
        JSON: 操作结果 / Operation result
    """
    config = load_openclaw_config()
    if 'channels' in config and 'feishu' in config['channels']:
        config['channels']['feishu']['enabled'] = not config['channels']['feishu'].get('enabled', True)
    save_openclaw_config(config)
    return jsonify({'success': True})

@app.route('/api/agents', methods=['GET'])
def get_agents():
    """
    获取智能体列表
    Get agent list
    
    Returns:
        JSON: 智能体列表 / Agent list
    """
    config = load_openclaw_config()
    agents = []
    
    # 获取默认模型 / Get default model
    defaults = config.get('agents', {}).get('defaults', {})
    default_model = defaults.get('model', {}).get('primary', '')
    
    providers_config = config.get('models', {}).get('providers', {})
    
    # 遍历智能体列表 / Iterate agent list
    agent_list = config.get('agents', {}).get('list', [])
    for ag in agent_list:
        agent_model = ag.get('model', {}).get('primary', default_model)
        provider_id = ''
        base_url = ''
        api_type = ''
        has_api_key = False
        pure_model_id = ''
        
        # 解析模型 ID / Parse model ID
        if agent_model and '/' in agent_model:
            provider_id = agent_model.split('/')[0]
            pure_model_id = agent_model.split('/')[1]
        elif agent_model:
            pure_model_id = agent_model
            # 查找模型所属的厂商 / Find provider for model
            for pid, provider in providers_config.items():
                for m in provider.get('models', []):
                    if m.get('id') == agent_model:
                        provider_id = pid
                        break
                if provider_id:
                    break
        else:
            pure_model_id = ''
        
        # 获取厂商信息 / Get provider info
        if provider_id and provider_id in providers_config:
            provider = providers_config[provider_id]
            base_url = provider.get('baseUrl', '')
            api_type = provider.get('api', '')
            has_api_key = bool(provider.get('apiKey', ''))
        
        # 从存档文件加载完整配置 / Load complete config from archive
        agent_id = ag.get('id', '')
        archive_data = load_agent_archive(agent_id) if agent_id else {}
        
        agents.append({
            'id': ag.get('id', ''),
            'name': ag.get('name', ag.get('id', 'Unnamed')),
            'modelId': pure_model_id,
            'fullModelId': agent_model,
            'providerId': provider_id,
            'baseUrl': base_url,
            'apiType': api_type,
            'hasApiKey': has_api_key,
            'identity': archive_data.get('identity', ''),
            'skills': archive_data.get('skills', ''),
            'personality': archive_data.get('personality', ''),
            'tools': archive_data.get('tools', ''),
            'userProfile': archive_data.get('userProfile', ''),
            'subagents': ag.get('subagents', {})
        })
    
    return jsonify(agents)

@app.route('/api/agents', methods=['POST'])
def save_agent():
    """
    保存智能体配置
    Save agent configuration
    
    Returns:
        JSON: 操作结果 / Operation result
    """
    data = request.get_json()
    config = load_openclaw_config()
    
    # 确保配置结构存在 / Ensure configuration structure exists
    if 'agents' not in config:
        config['agents'] = {'list': []}
    if 'list' not in config['agents']:
        config['agents']['list'] = []
    
    provider_id = data.get('providerId', '')
    model_id = data.get('modelId', '')
    base_url = data.get('baseUrl', '')
    api_type = data.get('apiType', '')
    api_key = data.get('apiKey', '')
    
    existing_providers = config.get('models', {}).get('providers', {})
    use_existing_model = False
    
    # 检查是否使用已有模型配置 / Check if using existing model configuration
    if provider_id and provider_id in existing_providers:
        existing_provider = existing_providers[provider_id]
        if not api_key and existing_provider.get('apiKey'):
            use_existing_model = True
            api_key = existing_provider.get('apiKey')
            base_url = base_url or existing_provider.get('baseUrl', '')
            api_type = api_type or existing_provider.get('api', '')
    
    # 如果提供了新的 API Key，更新厂商配置 / If new API Key is provided, update provider configuration
    if provider_id and api_key and not use_existing_model:
        if 'models' not in config:
            config['models'] = {'providers': {}}
        if 'providers' not in config['models']:
            config['models']['providers'] = {}
        
        providers_config = load_model_providers_config()
        provider_template = providers_config.get('providers', {}).get(provider_id, {})
        
        existing_provider = config['models']['providers'].get(provider_id, {})
        existing_models = existing_provider.get('models', [])
        
        # 添加模型到厂商配置 / Add model to provider configuration
        model_info = None
        if provider_template.get('models'):
            for m in provider_template['models']:
                if m.get('id') == model_id:
                    model_info = m
                    if model_info not in existing_models:
                        existing_models.append(model_info)
                    break
        
        # 更新厂商配置 / Update provider configuration
        config['models']['providers'][provider_id] = {
            'name': provider_template.get('name', provider_id),
            'baseUrl': base_url or provider_template.get('baseUrl', ''),
            'apiKey': api_key,
            'api': api_type or provider_template.get('api', 'openai-completions'),
            'models': existing_models
        }
    
    agent_id = data.get('id')
    agent_name = data.get('name', '')
    full_model_id = f'{provider_id}/{model_id}' if provider_id else model_id
    
    # 查找现有智能体并更新 / Find existing agent and update
    found = False
    for i, ag in enumerate(config['agents']['list']):
        if ag.get('id') == agent_id:
            if full_model_id:
                config['agents']['list'][i]['model'] = {'primary': full_model_id}
            config['agents']['list'][i]['name'] = agent_name or agent_id
            # OpenClaw 不支持这些字段，移除 / OpenClaw doesn't support these fields
            found = True
            break
    
    agent_id_for_md = agent_id if found else None
    
    # 如果是新智能体，通过 OpenClaw CLI 创建 / If it's a new agent, create via OpenClaw CLI
    if not found:
        import uuid
        new_agent_id = agent_id or agent_name.lower().replace(' ', '-').replace('_', '-').replace('‌', '') or f"agent-{uuid.uuid4().hex[:8]}"
        
        full_model_id = f'{provider_id}/{model_id}' if provider_id else model_id
        
        # 先删除可能已存在的智能体 / Delete possibly existing agent first
        delete_result = run_openclaw_command(f'agents delete {new_agent_id}', timeout=30)
        
        # 创建新智能体 / Create new agent
        workspace_dir = os.path.join(OPENCLAW_HOME, 'workspace', 'agents', new_agent_id)
        cmd = f'agents add {new_agent_id} --model {full_model_id} --workspace {workspace_dir} --non-interactive'
        result = run_openclaw_command(cmd, timeout=60)
        
        if not result.get('success'):
            error_msg = result.get('stderr') or result.get('error') or 'Unknown error'
            return jsonify({'success': False, 'error': f'Failed to create agent: {error_msg}'})
        
        # 重新加载配置 / Reload configuration
        config = load_openclaw_config()
        if 'agents' not in config:
            config['agents'] = {'list': []}
        if 'list' not in config['agents']:
            config['agents']['list'] = []
        
        # 构建新智能体配置（只保留 OpenClaw 支持的字段）/ Build new agent config (only keep OpenClaw supported fields)
        new_agent = {
            'id': new_agent_id,
            'name': agent_name or new_agent_id,
            'model': {'primary': full_model_id}
        }
        
        # 查找并更新或添加到列表 / Find and update or add to list
        found_in_new = False
        for i, ag in enumerate(config['agents']['list']):
            if ag.get('id') == new_agent_id:
                config['agents']['list'][i].update(new_agent)
                found_in_new = True
                break
        if not found_in_new:
            config['agents']['list'].append(new_agent)
        
        # 将新智能体添加到 main 的子智能体列表 / Add new agent to main's subagent list
        for ag in config['agents']['list']:
            if ag.get('id') == 'main':
                if 'subagents' not in ag:
                    ag['subagents'] = {}
                if 'allowAgents' not in ag['subagents']:
                    ag['subagents']['allowAgents'] = []
                if new_agent_id not in ag['subagents']['allowAgents']:
                    ag['subagents']['allowAgents'].append(new_agent_id)
                break
        
        data['id'] = new_agent_id
    
    # 写入 Markdown 文件 / Write Markdown files
    final_agent_id = data.get('id') or agent_id_for_md
    if final_agent_id:
        write_agent_md_files(final_agent_id, data)
        save_agent_archive(final_agent_id, data)
    
    # 保存配置并创建版本 / Save configuration and create version
    save_openclaw_config(config, create_version=True, action='update')
    return jsonify({'success': True, 'data': data})

@app.route('/api/agents/<agent_id>', methods=['DELETE'])
def delete_agent(agent_id):
    """
    删除智能体
    Delete agent
    
    Args:
        agent_id (str): 智能体 ID / Agent ID
        
    Returns:
        JSON: 操作结果 / Operation result
    """
    # 禁止删除主智能体 / Prevent deleting main agent
    if agent_id == 'main':
        return jsonify({'success': False, 'error': '不能删除主智能体'})
    
    config = load_openclaw_config()
    
    # 从列表中移除 / Remove from list
    if 'agents' in config and 'list' in config['agents']:
        config['agents']['list'] = [ag for ag in config['agents']['list'] if ag.get('id') != agent_id]
        
        # 从 main 的子智能体列表中移除 / Remove from main's subagent list
        for ag in config['agents']['list']:
            if ag.get('id') == 'main':
                if 'subagents' in ag and 'allowAgents' in ag['subagents']:
                    if agent_id in ag['subagents']['allowAgents']:
                        ag['subagents']['allowAgents'].remove(agent_id)
                break
    
    # 删除工作区和智能体目录 / Delete workspace and agent directory
    workspace_dir = os.path.join(OPENCLAW_HOME, 'workspace', 'agents', agent_id)
    agent_dir = os.path.join(OPENCLAW_HOME, 'agents', agent_id)
    
    if os.path.exists(workspace_dir):
        shutil.rmtree(workspace_dir)
    if os.path.exists(agent_dir):
        shutil.rmtree(agent_dir)
    
    # 保存配置 / Save configuration
    save_openclaw_config(config, create_version=True, action='delete')
    return jsonify({'success': True})

@app.route('/api/versions', methods=['GET'])
def get_versions():
    """
    获取配置版本列表
    Get configuration version list
    
    Returns:
        JSON: 版本列表 / Version list
    """
    versions = get_version_list()
    return jsonify(versions)

@app.route('/api/versions/<filename>', methods=['GET'])
def get_version_detail(filename):
    """
    获取版本详情
    Get version detail
    
    Args:
        filename (str): 版本文件名 / Version filename
        
    Returns:
        JSON: 版本详情 / Version detail
    """
    filepath = os.path.join(OPENCLAW_VERSIONS_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'error': 'Version not found'}), 404
    
    with open(filepath, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    return jsonify({
        'success': True,
        'filename': filename,
        'config': config
    })

@app.route('/api/versions/<filename>/restore', methods=['POST'])
def restore_version(filename):
    """
    回滚到指定版本
    Restore to specified version
    
    Args:
        filename (str): 版本文件名 / Version filename
        
    Returns:
        JSON: 操作结果 / Operation result
    """
    filepath = os.path.join(OPENCLAW_VERSIONS_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'error': 'Version not found'}), 404
    
    # 加载旧配置 / Load old configuration
    with open(filepath, 'r', encoding='utf-8') as f:
        old_config = json.load(f)
    
    # 保存为当前配置，并创建新版本备份 / Save as current configuration and create new version backup
    save_openclaw_config(old_config, create_version=True, action='restore')
    return jsonify({'success': True, 'message': 'Version restored successfully'})

@app.route('/api/versions/<filename>', methods=['DELETE'])
def delete_version_file(filename):
    """
    删除指定版本文件
    Delete specified version file
    
    Args:
        filename (str): 版本文件名 / Version filename
        
    Returns:
        JSON: 操作结果 / Operation result
    """
    import shutil
    
    filepath = os.path.join(OPENCLAW_VERSIONS_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'error': 'Version not found'}), 404
    
    try:
        os.remove(filepath)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# 系统备份 API / System Backup API
MAX_BACKUP_VERSIONS = 3  # 最多保留备份版本数 / Max backup versions to keep

def cleanup_old_backups(backup_type, max_keep=MAX_BACKUP_VERSIONS):
    """清理旧备份，只保留最近版本 / Clean up old backups, keep only recent versions"""
    backup_dir = os.environ.get('BACKUP_DIR', '/home/ubuntu/backups')
    if not os.path.exists(backup_dir):
        return
    
    # 获取该类型的所有备份文件 / Get all backup files of this type
    prefix = f'{backup_type}_backup_'
    files = [f for f in os.listdir(backup_dir) if f.startswith(prefix) and f.endswith('.tar.gz')]
    files.sort(reverse=True)  # 最新的排在前面 / Latest first
    
    # 删除多余的旧备份 / Delete excess old backups
    for f in files[max_keep:]:
        try:
            os.remove(os.path.join(backup_dir, f))
        except:
            pass

# 后台任务状态存储 / Background task status storage
backup_tasks = {}
backup_lock = threading.Lock()

def run_backup_task(task_id, backup_type):
    """后台备份任务 / Background backup task"""
    import tarfile
    
    backup_dir = os.environ.get('BACKUP_DIR', '/home/ubuntu/backups')
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    with backup_lock:
        backup_tasks[task_id] = {'status': 'running', 'progress': 0}
    
    try:
        if backup_type == 'openclaw':
            openclaw_dirs = [
                OPENCLAW_HOME,
            ]
            openclaw_files = [
                '/etc/systemd/system/openclaw-gateway.service',
            ]
            
            if not os.path.exists(OPENCLAW_HOME):
                with backup_lock:
                    backup_tasks[task_id] = {'status': 'error', 'error': f'Directory not found: {OPENCLAW_HOME}'}
                return
            
            # 第一步：创建 tar 文件 / Step 1: Create tar file
            tar_filename = f'openclaw_backup_{timestamp}.tar'
            tar_filepath = os.path.join(backup_dir, tar_filename)
            
            added_items = []
            with tarfile.open(tar_filepath, 'w') as tar:
                for d in openclaw_dirs:
                    if os.path.exists(d):
                        tar.add(d, arcname=os.path.basename(d))
                        added_items.append(os.path.basename(d))
                
                for f in openclaw_files:
                    if os.path.exists(f):
                        arcname = os.path.basename(os.path.dirname(f)) + '_' + os.path.basename(f)
                        tar.add(f, arcname=arcname)
                        added_items.append(arcname)
            
            with backup_lock:
                backup_tasks[task_id] = {'status': 'compressing', 'progress': 50}
            
            # 第二步：压缩为 gz / Step 2: Compress to gz
            gz_filename = f'openclaw_backup_{timestamp}.tar.gz'
            gz_filepath = os.path.join(backup_dir, gz_filename)
            
            subprocess.run(['gzip', '-k', tar_filepath], check=True)
            
            # 清理旧备份 / Clean up old backups
            cleanup_old_backups('openclaw')
            
            file_size = os.path.getsize(gz_filepath)
            with backup_lock:
                backup_tasks[task_id] = {
                    'status': 'completed',
                    'progress': 100,
                    'filename': gz_filename,
                    'filepath': gz_filepath,
                    'size': file_size,
                    'items': added_items
                }
                
        elif backup_type == 'rlzclaw':
            rlzclaw_dir = BASE_DIR
            
            if not os.path.exists(rlzclaw_dir):
                with backup_lock:
                    backup_tasks[task_id] = {'status': 'error', 'error': f'Directory not found: {rlzclaw_dir}'}
                return
            
            # 第一步：创建 tar 文件 / Step 1: Create tar file
            tar_filename = f'rlzclaw_backup_{timestamp}.tar'
            tar_filepath = os.path.join(backup_dir, tar_filename)
            
            with tarfile.open(tar_filepath, 'w') as tar:
                tar.add(rlzclaw_dir, arcname='rlzclaw')
            
            with backup_lock:
                backup_tasks[task_id] = {'status': 'compressing', 'progress': 50}
            
            # 第二步：压缩为 gz / Step 2: Compress to gz
            gz_filename = f'rlzclaw_backup_{timestamp}.tar.gz'
            gz_filepath = os.path.join(backup_dir, gz_filename)
            
            subprocess.run(['gzip', '-k', tar_filepath], check=True)
            
            # 清理旧备份 / Clean up old backups
            cleanup_old_backups('rlzclaw')
            
            file_size = os.path.getsize(gz_filepath)
            with backup_lock:
                backup_tasks[task_id] = {
                    'status': 'completed',
                    'progress': 100,
                    'filename': gz_filename,
                    'filepath': gz_filepath,
                    'size': file_size
                }
    except Exception as e:
        logger.error(f"Backup task failed: {str(e)}")
        with backup_lock:
            backup_tasks[task_id] = {'status': 'error', 'error': str(e)}

@app.route('/api/backup/openclaw', methods=['POST'])
def backup_openclaw():
    """
    异步打包备份 OpenClaw 安装目录
    Async backup OpenClaw installation directory
    
    Returns:
        JSON: 任务 ID / Task ID
    """
    task_id = f'openclaw_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
    
    # 启动后台线程 / Start background thread
    thread = threading.Thread(target=run_backup_task, args=(task_id, 'openclaw'))
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'success': True,
        'task_id': task_id,
        'message': '备份任务已启动，请稍候刷新查看进度'
    })

@app.route('/api/backup/openclaw/status/<task_id>', methods=['GET'])
def backup_openclaw_status(task_id):
    """获取备份任务状态 / Get backup task status"""
    with backup_lock:
        task = backup_tasks.get(task_id)
    
    if not task:
        return jsonify({'status': 'not_found'})
    
    return jsonify(task)

@app.route('/api/backup/rlzclaw', methods=['POST'])
def backup_rlzclaw():
    """
    异步打包备份 rlzclaw 配置目录
    Async backup rlzclaw configuration directory
    
    Returns:
        JSON: 任务 ID / Task ID
    """
    task_id = f'rlzclaw_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
    
    # 启动后台线程 / Start background thread
    thread = threading.Thread(target=run_backup_task, args=(task_id, 'rlzclaw'))
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'success': True,
        'task_id': task_id,
        'message': '备份任务已启动，请稍候刷新查看进度'
    })

@app.route('/api/backup/rlzclaw/status/<task_id>', methods=['GET'])
def backup_rlzclaw_status(task_id):
    """获取备份任务状态 / Get backup task status"""
    with backup_lock:
        task = backup_tasks.get(task_id)
    
    if not task:
        return jsonify({'status': 'not_found'})
    
    return jsonify(task)

@app.route('/api/backup/list', methods=['GET'])
def list_backups():
    """
    获取备份文件列表
    Get backup file list
    
    Returns:
        JSON: 备份文件列表 / Backup file list
    """
    backup_dir = os.environ.get('BACKUP_DIR', '/home/ubuntu/backups')
    
    if not os.path.exists(backup_dir):
        return jsonify({'openclaw': [], 'rlzclaw': []})
    
    files = os.listdir(backup_dir)
    openclaw_backups = sorted([f for f in files if f.startswith('openclaw_backup_') and f.endswith('.tar.gz')], reverse=True)
    rlzclaw_backups = sorted([f for f in files if f.startswith('rlzclaw_backup_') and f.endswith('.tar.gz')], reverse=True)
    
    def get_file_info(filename):
        filepath = os.path.join(backup_dir, filename)
        stat = os.stat(filepath)
        return {
            'filename': filename,
            'size': stat.st_size,
            'time': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
        }
    
    return jsonify({
        'openclaw': [get_file_info(f) for f in openclaw_backups],
        'rlzclaw': [get_file_info(f) for f in rlzclaw_backups]
    })

@app.route('/api/backup/download/<filename>', methods=['GET'])
def download_backup(filename):
    """
    下载备份文件
    Download backup file
    
    Args:
        filename (str): 备份文件名 / Backup filename
        
    Returns:
        File: 备份文件 / Backup file
    """
    backup_dir = os.environ.get('BACKUP_DIR', '/home/ubuntu/backups')
    filepath = os.path.join(backup_dir, filename)
    
    if not os.path.exists(filepath):
        return 'File not found', 404
    
    return send_file(filepath, as_attachment=True, download_name=filename)

@app.route('/api/backup/delete/<filename>', methods=['DELETE'])
def delete_backup_file(filename):
    """
    删除备份文件
    Delete backup file
    
    Args:
        filename (str): 备份文件名 / Backup filename
        
    Returns:
        JSON: 操作结果 / Operation result
    """
    backup_dir = os.environ.get('BACKUP_DIR', '/home/ubuntu/backups')
    filepath = os.path.join(backup_dir, filename)
    
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'error': 'File not found'}), 404
    
    try:
        os.remove(filepath)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# OpenClaw 卸载 API / OpenClaw Uninstall API
@app.route('/api/uninstall/openclaw', methods=['POST'])
def uninstall_openclaw():
    """
    卸载 OpenClaw - 停止服务并删除安装目录
    Uninstall OpenClaw - stop service and delete installation directory
    
    Returns:
        JSON: 操作结果 / Operation result
    """
    import subprocess
    
    # 停止并禁用服务 / Stop and disable service
    subprocess.run(['systemctl', 'stop', 'openclaw-gateway'], capture_output=True)
    subprocess.run(['systemctl', 'disable', 'openclaw-gateway'], capture_output=True)
    
    # 删除安装目录 / Delete installation directory
    openclaw_dir = '/home/ubuntu/.openclaw'
    
    try:
        if os.path.exists(openclaw_dir):
            subprocess.run(['rm', '-rf', openclaw_dir], capture_output=True)
        
        return jsonify({'success': True, 'message': 'OpenClaw 卸载成功'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/agents/export', methods=['GET'])
def export_agents():
    """
    导出智能体配置
    Export agent configuration
    
    Returns:
        JSON: 智能体列表 / Agent list
    """
    config = load_openclaw_config()
    return jsonify(config.get('agents', {}).get('list', []))

@app.route('/api/agents/import', methods=['POST'])
def import_agents():
    """
    导入智能体配置
    Import agent configuration
    
    Returns:
        JSON: 操作结果 / Operation result
    """
    data = request.get_json()
    config = load_openclaw_config()
    if 'agents' not in config:
        config['agents'] = {}
    config['agents']['list'] = data
    save_openclaw_config(config)
    return jsonify({'success': True})

# 智能体模板 API / Agent Template API
@app.route('/api/agent-templates', methods=['GET'])
def get_agent_templates():
    """
    获取智能体模板列表
    Get agent template list
    
    Returns:
        JSON: 智能体模板列表 / Agent template list
    """
    config = load_agent_templates_config()
    return jsonify(config.get('templates', []))

@app.route('/api/agent-templates', methods=['POST'])
def save_agent_template():
    """
    保存智能体模板
    Save agent template
    
    Returns:
        JSON: 操作结果 / Operation result
    """
    data = request.get_json()
    config = load_agent_templates_config()
    
    templates = config.get('templates', [])
    template_id = data.get('id')
    
    if template_id:
        # 更新现有模板 / Update existing template
        for i, t in enumerate(templates):
            if t.get('id') == template_id:
                templates[i] = data
                break
    else:
        # 新增模板 / Add new template
        import uuid
        data['id'] = f"template-{uuid.uuid4().hex[:8]}"
        templates.append(data)
    
    config['templates'] = templates
    save_agent_templates_config(config)
    return jsonify({'success': True, 'data': data})

@app.route('/api/agent-templates/<template_id>', methods=['DELETE'])
def delete_agent_template(template_id):
    """
    删除智能体模板
    Delete agent template
    
    Args:
        template_id (str): 模板 ID / Template ID
        
    Returns:
        JSON: 操作结果 / Operation result
    """
    config = load_agent_templates_config()
    templates = config.get('templates', [])
    config['templates'] = [t for t in templates if t.get('id') != template_id]
    save_agent_templates_config(config)
    return jsonify({'success': True})

@app.route('/api/commands', methods=['GET'])
def get_commands():
    """
    获取可用命令列表
    Get available command list
    
    Returns:
        JSON: 命令列表 / Command list
    """
    config = load_server_config()
    gateway_service = config.get("gateway_service", "openclaw-gateway")
    
    commands = config.get('commands', [])
    
    if not commands:
        commands = [
            {
                'id': 'restart_gateway',
                'command': f'sudo systemctl restart {gateway_service}',
                'names': {'zh-CN': '重启网关', 'zh-TW': '重啟閘道', 'en': 'Restart Gateway'}
            },
            {
                'id': 'gateway_status',
                'command': f'sudo systemctl status {gateway_service}',
                'names': {'zh-CN': '查看网关状态', 'zh-TW': '查看閘道狀態', 'en': 'Gateway Status'}
            },
            {
                'id': 'view_logs',
                'command': f'sudo journalctl -u {gateway_service} -n 100 --no-pager',
                'names': {'zh-CN': '查看运行日志', 'zh-TW': '查看執行日誌', 'en': 'View Logs'}
            }
        ]
    else:
        # 动态更新配置文件中的日志查看命令 / Dynamically update log view command in config
        for cmd in commands:
            if cmd.get('id') == 'view_logs':
                cmd['command'] = f'sudo journalctl -u {gateway_service} -n 100 --no-pager'
    
    return jsonify(commands)

@app.route('/api/execute', methods=['POST'])
def execute_command():
    """
    执行命令
    Execute command
    
    Returns:
        JSON: 执行结果 / Execution result
    """
    data = request.get_json()
    command = data.get('command', '')
    config = load_server_config()
    gateway_service = config.get("gateway_service", "openclaw-gateway")
    
    # 构建白名单 / Build whitelist
    allowed_commands = [f'source ~/.nvm/nvm.sh && openclaw agents list']
    
    # 添加配置文件中的命令，但动态替换日志命令 / Add commands from config, but dynamically replace log command
    for cmd in config.get('commands', []):
        cmd_str = cmd.get('command')
        # 如果是日志查看命令，使用journalctl / If it's log view command, use journalctl
        if cmd.get('id') == 'view_logs':
            cmd_str = f'sudo journalctl -u {gateway_service} -n 100 --no-pager'
        allowed_commands.append(cmd_str)
    
    # 如果没有配置文件，添加默认命令 / If no config, add default commands
    if not config.get('commands'):
        allowed_commands.extend([
            f'sudo systemctl restart {gateway_service}',
            f'sudo systemctl status {gateway_service}',
            f'sudo journalctl -u {gateway_service} -n 100 --no-pager'
        ])
    
    if command not in allowed_commands:
        return jsonify({'success': False, 'error': 'Command not allowed'})
    
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=60)
        return jsonify({'success': True, 'stdout': result.stdout, 'stderr': result.stderr, 'returncode': result.returncode})
    except subprocess.TimeoutExpired:
        return jsonify({'success': False, 'error': 'Command timeout'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/chat/send', methods=['POST'])
def chat_send():
    """
    发送聊天消息
    Send chat message
    
    Returns:
        JSON: 聊天响应 / Chat response
    """
    data = request.get_json()
    agent_id = data.get('agentId', 'main')
    message = data.get('message', '')
    session_id = data.get('sessionId', 'web-session')
    
    if not message:
        return jsonify({'success': False, 'error': 'Message is required'})
    
    # 转义消息中的引号 / Escape quotes in message
    escaped_message = message.replace('"', '\\"').replace("'", "\\'")
    cmd = f'agent --agent {agent_id} --session-id {session_id} --message "{escaped_message}" --json'
    result = run_openclaw_command(cmd, timeout=120)
    
    if result['success']:
        try:
            output = json.loads(result['stdout']) if result['stdout'] else {}
            return jsonify({
                'success': True,
                'response': output.get('response', output.get('message', result['stdout'])),
                'raw': result['stdout']
            })
        except:
            return jsonify({
                'success': True,
                'response': result['stdout'],
                'raw': result['stdout']
            })
    
    return jsonify(result)

@app.route('/api/chat/sessions', methods=['GET'])
def get_chat_sessions():
    """
    获取聊天会话列表
    Get chat session list
    
    Returns:
        JSON: 会话列表 / Session list
    """
    agent_id = request.args.get('agentId', 'main')
    sessions_dir = get_agent_sessions_dir(agent_id)
    sessions = []
    
    if os.path.exists(sessions_dir):
        jsonl_files = glob.glob(os.path.join(sessions_dir, '*.jsonl'))
        for f in jsonl_files:
            try:
                mtime = os.path.getmtime(f)
                sessions.append({
                    'id': os.path.basename(f).replace('.jsonl', ''),
                    'file': f,
                    'lastModified': datetime.fromtimestamp(mtime).isoformat()
                })
            except:
                continue
    
    # 按时间从新到旧排序 / Sort by time from newest to oldest
    sessions.sort(key=lambda x: x['lastModified'], reverse=True)
    return jsonify(sessions[:20])

@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    """
    获取聊天历史
    Get chat history
    
    Returns:
        JSON: 聊天历史 / Chat history
    """
    agent_id = request.args.get('agentId', 'main')
    session_id = request.args.get('sessionId', '')
    limit = int(request.args.get('limit', 50))
    
    # 确定会话文件 / Determine session file
    if session_id:
        session_file = os.path.join(get_agent_sessions_dir(agent_id), f'{session_id}.jsonl')
    else:
        session_file = get_latest_session_file(agent_id)
    
    if not session_file:
        return jsonify({'success': True, 'messages': [], 'sessionId': None})
    
    # 解析会话文件 / Parse session file
    messages = parse_jsonl_session(session_file, limit)
    return jsonify({
        'success': True,
        'messages': messages,
        'sessionId': os.path.basename(session_file).replace('.jsonl', ''),
        'file': session_file
    })

@app.route('/api/chat/sync', methods=['GET'])
def sync_feishu_messages():
    """
    同步新消息（轮询接口）
    Sync new messages (polling endpoint)
    
    Returns:
        JSON: 新消息列表 / New message list
    """
    agent_id = request.args.get('agentId', 'main')
    since = request.args.get('since', '')
    
    session_file = get_latest_session_file(agent_id)
    if not session_file:
        return jsonify({'success': True, 'messages': [], 'hasNew': False})
    
    messages = parse_jsonl_session(session_file, 100)
    
    # 如果有 since 参数，只返回新消息 / If there's a since parameter, only return new messages
    if since:
        new_messages = []
        for msg in reversed(messages):
            if msg.get('timestamp', '') > since:
                new_messages.insert(0, msg)
            else:
                break
        
        return jsonify({
            'success': True,
            'messages': new_messages,
            'hasNew': len(new_messages) > 0,
            'lastTimestamp': messages[-1].get('timestamp', '') if messages else ''
        })
    
    # 返回最近 20 条消息 / Return last 20 messages
    return jsonify({
        'success': True,
        'messages': messages[-20:],
        'hasNew': True,
        'lastTimestamp': messages[-1].get('timestamp', '') if messages else ''
    })

# ==================== 应用入口 / Application Entry ====================
if __name__ == '__main__':
    # 确保配置目录存在 / Ensure configuration directory exists
    if not os.path.exists(CONFIG_DIR):
        os.makedirs(CONFIG_DIR)
    
    # 启动 Flask 应用 / Start Flask application
    app.run(host='0.0.0.0', port=5000, debug=False)
