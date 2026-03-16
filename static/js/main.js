// 全局变量声明 / Global variable declarations
let feishuChannels = [];      // 飞书通道列表 / Feishu channel list
let agents = [];                // 智能体列表 / Agent list
let commands = [];              // 命令列表 / Command list
let currentAgent = null;        // 当前选中的智能体 / Currently selected agent
let chatHistory = {};           // 聊天历史记录 / Chat history
let lastTimestamp = {};         // 最后同步的时间戳 / Last sync timestamp
let syncInterval = null;        // 同步定时器 / Sync timer
let isLoadingHistory = false;   // 是否正在加载历史 / Whether loading history
let availableModels = [];       // 可用模型列表 / Available model list
let presetModels = {};          // 预设模型 / Preset models
let modelProviders = {};        // 模型厂商 / Model providers
let allProviderTemplates = {};  // 所有厂商模板 / All provider templates
let agentTemplates = [];       // 智能体模板列表 / Agent template list

// DOM 加载完成后执行 / Execute after DOM loaded
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化语言显示 / Initialize language display
    const savedLang = localStorage.getItem('language') || 'zh-CN';
    const langSelect = document.getElementById('langSelect');
    if (langSelect) {
        langSelect.value = savedLang;
        langSelect.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }
    
    // 检查登录状态 / Check login status
    try {
        const loginRes = await fetch('/check-login');
        const loginData = await loginRes.json();
        
        if (!loginData.logged_in) {
            window.location.href = '/login';
            return;
        }
        
        // 如果需要修改密码 / If password change required
        if (loginData.must_change_password) {
            const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
            modal.show();
        }
    } catch (e) {
        console.error('Login check failed:', e);
        window.location.href = '/login';
        return;
    }
    
    loadFeishuChannels();        // 加载飞书通道 / Load Feishu channels
    loadAgents();                // 加载智能体 / Load agents
    loadCommands();              // 加载命令 / Load commands
    loadAvailableModels();       // 加载可用模型 / Load available models
    loadPresetModels();          // 加载预设模型 / Load preset models
    loadAllProviderTemplates();  // 加载所有厂商模板 / Load all provider templates
    loadAgentTemplates();       // 加载智能体模板 / Load agent templates
    loadUsers();                // 加载用户列表 / Load user list
    loadLogo();                // 加载Logo / Load logo
    
    // 聊天输入回车发送 / Chat input enter to send
    document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // 文件导入 / File import
    document.getElementById('importFile')?.addEventListener('change', handleImport);
    
    // 版本标签页显示时加载版本 / Load versions when versions tab is shown
    document.getElementById('versions-tab')?.addEventListener('shown.bs.tab', loadVersions);
    
    // 模板标签页显示时加载模板 / Load templates when templates tab is shown
    document.getElementById('templates-tab')?.addEventListener('shown.bs.tab', () => {
        loadAgentTemplates();
    });
});

/**
 * 加载可用模型列表
 * Load available model list
 */
async function loadAvailableModels() {
    try {
        const response = await fetch('/api/models/available');
        availableModels = await response.json();
    } catch (error) {
        console.error('Failed to load available models:', error);
    }
}

/**
 * 加载预设模型
 * Load preset models
 */
async function loadPresetModels() {
    try {
        const response = await fetch('/api/models/preset');
        presetModels = await response.json();
    } catch (error) {
        console.error('Failed to load preset models:', error);
    }
}

/**
 * 加载模型厂商
 * Load model providers
 */
async function loadModelProviders() {
    try {
        const response = await fetch('/api/models/providers');
        modelProviders = await response.json();
    } catch (error) {
        console.error('Failed to load model providers:', error);
    }
}

/**
 * 加载所有厂商模板
 * Load all provider templates
 */
async function loadAllProviderTemplates() {
    try {
        const response = await fetch('/api/models/providers/all');
        allProviderTemplates = await response.json();
    } catch (error) {
        console.error('Failed to load provider templates:', error);
    }
}

/**
 * 加载智能体模板
 * Load agent templates
 */
async function loadAgentTemplates() {
    try {
        const response = await fetch('/api/agent-templates');
        agentTemplates = await response.json();
        renderTemplateList();
    } catch (error) {
        console.error('Failed to load agent templates:', error);
    }
}

/**
 * 保存智能体模板
 * Save agent template
 */
async function saveAgentTemplate(data) {
    try {
        const response = await fetch('/api/agent-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            await loadAgentTemplates();
        }
        return result;
    } catch (error) {
        console.error('Failed to save agent template:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 删除智能体模板
 * Delete agent template
 */
async function deleteAgentTemplate(templateId) {
    try {
        const response = await fetch(`/api/agent-templates/${templateId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
            await loadAgentTemplates();
        }
        return result;
    } catch (error) {
        console.error('Failed to delete agent template:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 渲染智能体模板列表
 * Render agent template list
 */
function renderTemplateList() {
    const container = document.getElementById('templateList');
    if (!container) return;
    
    if (agentTemplates.length === 0) {
        container.innerHTML = `<div class="col-12 text-center text-muted py-3">暂无模板</div>`;
        return;
    }
    
    container.innerHTML = agentTemplates.map(t => `
        <div class="col-md-4 mb-3">
            <div class="card h-100">
                <div class="card-body">
                    <h6 class="card-title"><i class="bi bi-file-text me-2"></i>${t.name || '未命名模板'}</h6>
                    <p class="card-text small text-muted text-truncate-2">${t.identity ? t.identity.substring(0, 80) + '...' : '-'}</p>
                </div>
                <div class="card-footer bg-transparent">
                    <div class="btn-group btn-group-sm w-100">
                        <button class="btn btn-outline-primary" onclick="editTemplate('${t.id}')"><i class="bi bi-pencil"></i> 编辑</button>
                        <button class="btn btn-outline-danger" onclick="confirmDeleteTemplate('${t.id}')"><i class="bi bi-trash"></i> 删除</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * 显示模板模态框
 * Show template modal
 */
function showTemplateModal(template = null) {
    const modal = new bootstrap.Modal(document.getElementById('templateModal'));
    document.getElementById('templateForm').reset();
    document.getElementById('templateId').value = template?.id || '';
    document.getElementById('templateName').value = template?.name || '';
    document.getElementById('templateIdentity').value = template?.identity || '';
    document.getElementById('templateSkills').value = template?.skills || '';
    document.getElementById('templatePersonality').value = template?.personality || '';
    document.getElementById('templateTools').value = template?.tools || '';
    document.getElementById('templateUserProfile').value = template?.userProfile || '';
    modal.show();
}

/**
 * 编辑模板
 * Edit template
 */
function editTemplate(templateId) {
    const template = agentTemplates.find(t => t.id === templateId);
    if (template) showTemplateModal(template);
}

/**
 * 保存模板
 * Save template
 */
async function saveTemplate() {
    const data = {
        id: document.getElementById('templateId').value || null,
        name: document.getElementById('templateName').value,
        identity: document.getElementById('templateIdentity').value,
        skills: document.getElementById('templateSkills').value,
        personality: document.getElementById('templatePersonality').value,
        tools: document.getElementById('templateTools').value,
        userProfile: document.getElementById('templateUserProfile').value
    };
    
    if (!data.name) {
        alert('请输入模板名称');
        return;
    }
    
    const result = await saveAgentTemplate(data);
    if (result.success) {
        bootstrap.Modal.getInstance(document.getElementById('templateModal')).hide();
        renderTemplateList();
    } else {
        alert(result.error || '保存失败');
    }
}

/**
 * 确认删除模板
 * Confirm delete template
 */
function confirmDeleteTemplate(templateId) {
    if (confirm('确定要删除这个模板吗？')) {
        deleteAgentTemplate(templateId).then(() => {
            renderTemplateList();
        });
    }
}

/**
 * 加载飞书通道
 * Load Feishu channels
 */
async function loadFeishuChannels() {
    try {
        const response = await fetch('/api/feishu');
        feishuChannels = await response.json();
        renderFeishuList();
    } catch (error) {
        console.error('Failed to load feishu channels:', error);
    }
}

/**
 * 渲染飞书通道列表
 * Render Feishu channel list
 */
function renderFeishuList() {
    const container = document.getElementById('feishuList');
    if (!container) return;
    
    // 无数据时显示提示 / Show hint when no data
    if (feishuChannels.length === 0) {
        container.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">${t('common.noData')}</td></tr>`;
        return;
    }
    
    // 渲染通道列表 / Render channel list
    container.innerHTML = feishuChannels.map(ch => `
        <tr>
            <td>${ch.name || '-'}</td>
            <td><code>${ch.appId ? ch.appId.substring(0, 12) + '...' : '-'}</code></td>
            <td><span class="badge ${ch.enabled ? 'bg-success' : 'bg-secondary'} status-badge">${ch.enabled ? t('common.enabled') : t('common.disabled')}</span></td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-${ch.enabled ? 'warning' : 'success'}" onclick="toggleFeishu('${ch.id}')" title="${t('common.status')}"><i class="bi bi-${ch.enabled ? 'pause' : 'play'}"></i></button>
                    <button class="btn btn-outline-primary" onclick="editFeishu('${ch.id}')" title="${t('common.edit')}"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" onclick="deleteFeishu('${ch.id}')" title="${t('common.delete')}"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * 显示飞书通道编辑模态框
 * Show Feishu channel edit modal
 * @param {Object} channel - 通道对象 / Channel object
 */
function showFeishuModal(channel = null) {
    const modal = new bootstrap.Modal(document.getElementById('feishuModal'));
    document.getElementById('feishuForm').reset();
    document.getElementById('feishuId').value = channel?.id || '';
    document.getElementById('feishuName').value = channel?.name || '';
    document.getElementById('feishuAppId').value = channel?.appId || '';
    document.getElementById('feishuAppSecret').value = channel?.appSecret || '';
    document.getElementById('feishuToken').value = channel?.verificationToken || '';
    document.getElementById('feishuEnabled').checked = channel?.enabled !== false;
    document.querySelector('#feishuModal .modal-title').textContent = channel ? t('feishu.editChannel') : t('feishu.addChannel');
    modal.show();
}

/**
 * 编辑飞书通道
 * Edit Feishu channel
 * @param {string} id - 通道 ID / Channel ID
 */
function editFeishu(id) {
    const channel = feishuChannels.find(c => c.id === id);
    if (channel) showFeishuModal(channel);
}

/**
 * 保存飞书通道
 * Save Feishu channel
 */
async function saveFeishu() {
    const data = {
        id: document.getElementById('feishuId').value || null,
        name: document.getElementById('feishuName').value,
        appId: document.getElementById('feishuAppId').value,
        appSecret: document.getElementById('feishuAppSecret').value,
        verificationToken: document.getElementById('feishuToken').value,
        enabled: document.getElementById('feishuEnabled').checked
    };
    
    // 验证必填字段 / Validate required fields
    if (!data.name || !data.appId || !data.appSecret) {
        alert(t('common.operationFailed'));
        return;
    }
    
    try {
        const response = await fetch('/api/feishu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('feishuModal')).hide();
            loadFeishuChannels();
        }
    } catch (error) {
        console.error('Failed to save feishu channel:', error);
    }
}

/**
 * 切换飞书通道启用状态
 * Toggle Feishu channel enabled status
 * @param {string} id - 通道 ID / Channel ID
 */
async function toggleFeishu(id) {
    try {
        await fetch(`/api/feishu/${id}/toggle`, { method: 'POST' });
        loadFeishuChannels();
    } catch (error) {
        console.error('Failed to toggle feishu channel:', error);
    }
}

/**
 * 删除飞书通道
 * Delete Feishu channel
 * @param {string} id - 通道 ID / Channel ID
 */
function deleteFeishu(id) {
    showConfirm(t('feishu.deleteConfirm'), async () => {
        try {
            await fetch(`/api/feishu/${id}`, { method: 'DELETE' });
            loadFeishuChannels();
        } catch (error) {
            console.error('Failed to delete feishu channel:', error);
        }
    });
}

/**
 * 加载智能体列表
 * Load agent list
 */
async function loadAgents() {
    try {
        const response = await fetch('/api/agents');
        agents = await response.json();
        renderAgentList();
        renderChatAgentList();
    } catch (error) {
        console.error('Failed to load agents:', error);
    }
}

/**
 * 渲染智能体列表
 * Render agent list
 */
function renderAgentList() {
    const container = document.getElementById('agentList');
    if (!container) return;
    
    // 无数据时显示提示 / Show hint when no data
    if (agents.length === 0) {
        container.innerHTML = `<div class="col-12 text-center text-muted py-5">${t('common.noData')}</div>`;
        return;
    }
    
    // 渲染智能体卡片 / Render agent cards
    container.innerHTML = agents.map(ag => {
        const modelInfo = availableModels.find(m => m.id === ag.modelId);
        const modelDisplay = modelInfo ? modelInfo.name : ag.modelId || 'Default';
        return `
        <div class="col-md-4 mb-3">
            <div class="card agent-card h-100">
                <div class="card-body">
                    <h6 class="card-title"><i class="bi bi-robot me-2"></i>${ag.name || ag.id || 'Unnamed'}</h6>
                    <p class="card-text small text-muted mb-2"><i class="bi bi-cpu me-1"></i>${modelDisplay}</p>
                    <p class="card-text small text-truncate-2">${typeof ag.identity === 'object' ? (ag.identity?.text || '-') : (ag.identity || '-')}</p>
                </div>
                <div class="card-footer bg-transparent">
                    <div class="btn-group btn-group-sm w-100">
                        <button class="btn btn-outline-primary" onclick="editAgent('${ag.id}')"><i class="bi bi-pencil"></i> ${t('common.edit')}</button>
                        <button class="btn btn-outline-danger" onclick="deleteAgent('${ag.id}')"><i class="bi bi-trash"></i> ${t('common.delete')}</button>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');
}

/**
 * 渲染聊天智能体列表
 * Render chat agent list
 */
function renderChatAgentList() {
    const container = document.getElementById('chatAgentList');
    if (!container) return;
    
    // 无数据时显示提示 / Show hint when no data
    if (agents.length === 0) {
        container.innerHTML = `<div class="list-group-item text-muted">${t('common.noData')}</div>`;
        return;
    }
    
    // 渲染智能体列表 / Render agent list
    container.innerHTML = agents.map(ag => `
        <a href="#" class="list-group-item list-group-item-action ${currentAgent?.id === ag.id ? 'active' : ''}" onclick="selectAgent('${ag.id}'); return false;">
            <i class="bi bi-robot me-2"></i>${ag.name || ag.id || 'Unnamed'}
        </a>
    `).join('');
}

/**
 * 显示智能体编辑模态框
 * Show agent edit modal
 * @param {Object} agent - 智能体对象 / Agent object
 */
function showAgentModal(agent = null) {
    const modalElement = document.getElementById('agentModal');
    const modal = new bootstrap.Modal(modalElement);
    document.getElementById('agentForm').reset();
    document.getElementById('agentId').value = agent?.id || '';
    document.getElementById('agentName').value = agent?.name || '';
    
    // 判断是新增还是编辑 / Determine if it's add or edit
    const isEdit = agent && agent.id;
    
    // 默认 Markdown 模板 / Default Markdown templates
    const defaultTemplates = {
        identity: `# 身份与权限体系
## 1. 角色定义
你是 Python 开发助手，专门帮助用户解决 Python 编程相关问题。

## 2. 权限范围
- 可以查看和修改用户提供的代码
- 可以执行代码调试命令
- 可以提供技术建议和解决方案

## 3. 知识边界
- 专注于 Python 编程语言
- 熟悉主流 Python 框架和库
- 了解常见开发最佳实践`,
        
        skills: `# 技能能力说明书
## 1. 核心技能
- Python 语法和标准库
- Web 开发 (Flask, Django, FastAPI)
- 数据处理 (pandas, numpy)
- 异步编程 (asyncio)
- 单元测试 (pytest, unittest)

## 2. 可执行操作
- 代码编写和调试
- 代码审查和优化建议
- 错误排查和问题定位
- 技术方案设计

## 3. 输出格式
- 代码块使用 \\\`\\\`\\\`python
- 复杂问题提供分步骤解决方案
- 适当使用表格和列表说明`,
        
        personality: `# 核心人格与价值观
## 1. 沟通风格
- 专业但易于理解
- 耐心细致，有问必答
- 主动确认用户需求

## 2. 价值观
- 追求代码可读性和可维护性
- 注重性能优化
- 推崇最佳实践
- 尊重用户现有技术栈

## 3. 行为准则
- 不直接给出最优解，而是解释原理
- 适当提醒潜在风险
- 尊重用户最终决定`,
        
        tools: `# 工具集接入文档
## 1. 可用工具
本智能体暂未配置外部工具。

## 2. 使用方式
用户通过文字描述问题，智能体直接给出解决方案。

## 3. 扩展说明
后续可根据需要接入代码执行、文档查询等工具。`,
        
        userProfile: `# 用户画像与交互规范
## 1. 目标用户画像
### 1.1 核心用户
| 用户类型 | 特征 | 核心需求 |
|----------|------|----------|
| 初级Python开发者 | 入行1-2年，熟悉基础语法，缺乏项目经验 | 代码纠错/基础功能实现/入门指导 |
| 中级Python工程师 | 3-5年经验，熟悉主流框架，负责业务开发 | 性能优化/复杂功能实现/问题排查 |
| 数据分析工程师 | 熟悉Python数据栈，侧重业务分析 | 数据处理/可视化/自动化分析脚本 |

### 1.2 用户痛点
- 初级用户：语法错误多/不知道如何选型/缺乏调试思路
- 中级用户：性能瓶颈/复杂场景设计/第三方库兼容问题
- 数据用户：数据清洗效率低/可视化效果差/批量处理慢

## 2. 交互规范
### 2.1 语言规范
- 对初级用户：使用通俗语言+基础术语，附带示例
- 对中级用户：使用专业术语，聚焦解决方案和优化点
- 对数据用户：侧重方法效率，提供可复用代码片段

### 2.2 回复格式规范
- 代码块：使用 \\\`\\\`\\\`python 标识，附带注释，控制单行长度≤120字符
- 步骤说明：使用有序列表，每步不超过2个核心操作
- 结果展示：优先使用表格/图表，其次纯文本
- 异常说明：先给出解决方案，再解释原因

### 2.3 交互流程规范
1. 问候与确认：了解用户需求
2. 需求澄清：确认用户具体场景/技术栈/预期结果
3. 方案提供：给出1-2个可选方案
4. 效果验证：提供测试方法，确认方案有效性
5. 后续建议：补充优化方向/学习资源

### 2.4 禁忌话术
- ❌ 绝对化表述："这个方案一定可行"
- ❌ 贬低性表述："这么简单都不会"
- ❌ 模糊表述："大概可以" / "应该没问题"`
    };
    
    // 处理 identity 字段，可能是对象或字符串 / Handle identity field, may be object or string
    const identityValue = isEdit 
        ? (typeof agent?.identity === 'object' ? (agent.identity?.text || '') : (agent?.identity || ''))
        : defaultTemplates.identity;
    const skillsValue = isEdit
        ? (typeof agent?.skills === 'object' ? (agent.skills?.text || '') : (agent?.skills || ''))
        : defaultTemplates.skills;
    const personalityValue = isEdit
        ? (typeof agent?.personality === 'object' ? (agent.personality?.text || '') : (agent?.personality || ''))
        : defaultTemplates.personality;
    const toolsValue = isEdit
        ? (typeof agent?.tools === 'object' ? (agent.tools?.text || '') : (agent?.tools || ''))
        : defaultTemplates.tools;
    const userProfileValue = isEdit
        ? (typeof agent?.userProfile === 'object' ? (agent.userProfile?.text || '') : (agent?.userProfile || ''))
        : defaultTemplates.userProfile;
    
    document.getElementById('agentIdentity').value = identityValue;
    document.getElementById('agentSkills').value = skillsValue;
    document.getElementById('agentPersonality').value = personalityValue;
    document.getElementById('agentTools').value = toolsValue;
    document.getElementById('agentUserProfile').value = userProfileValue;
    
    // 重置保存状态 / Reset saving state
    isSavingAgent = false;
    const saveBtn = document.getElementById('saveAgentBtn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = t('common.save') || '保存';
    }
    
    // 渲染模板选择下拉框 / Render template select dropdown
    const templateSelect = document.getElementById('agentTemplateSelect');
    if (templateSelect) {
        templateSelect.innerHTML = '<option value="">-- 不使用模板 --</option>';
        agentTemplates.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.name || '未命名模板';
            templateSelect.appendChild(option);
        });
    }
    
    // 渲染模型厂商选择 - 确保厂商模板已加载 / Render model provider select - ensure templates are loaded
    const renderForm = () => {
        if (allProviderTemplates && Object.keys(allProviderTemplates).length > 0) {
            renderProviderSelect(agent);
        } else {
            // 如果还没加载完成，等待一下再试 / If not loaded yet, try again later
            loadAllProviderTemplates().then(() => renderProviderSelect(agent));
        }
    };
    renderForm();
    
    document.querySelector('#agentModal .modal-title').textContent = agent ? t('agent.editAgent') : t('agent.addAgent');
    modal.show();
    
    // 监听模态框隐藏事件，确保状态重置 / Listen to modal hide event to ensure state reset
    modalElement.addEventListener('hidden.bs.modal', function onModalHidden() {
        isSavingAgent = false;
        modalElement.removeEventListener('hidden.bs.modal', onModalHidden);
    });
}

/**
 * 模板选择变化事件
 * Template select change event
 */
function onTemplateSelect() {
    const templateId = document.getElementById('agentTemplateSelect')?.value;
    if (!templateId) return;
    
    const template = agentTemplates.find(t => t.id === templateId);
    if (template) {
        document.getElementById('agentIdentity').value = template.identity || '';
        document.getElementById('agentSkills').value = template.skills || '';
        document.getElementById('agentPersonality').value = template.personality || '';
        document.getElementById('agentTools').value = template.tools || '';
        document.getElementById('agentUserProfile').value = template.userProfile || '';
    }
}

/**
 * 渲染模型厂商选择
 * Render model provider select
 * @param {Object} agent - 智能体对象 / Agent object
 */
function renderProviderSelect(agent = null) {
    const container = document.getElementById('modelSelectContainer');
    if (!container) return;
    
    const currentModelId = agent?.modelId || '';
    const currentProviderId = agent?.providerId || '';
    const currentBaseUrl = agent?.baseUrl || '';
    const currentApiType = agent?.apiType || '';
    const hasApiKey = agent?.hasApiKey || false;
    let currentModelData = null;
    
    // 查找当前模型数据 / Find current model data
    if (currentModelId && allProviderTemplates) {
        for (const [pid, provider] of Object.entries(allProviderTemplates)) {
            const model = provider.models?.find(m => m.id === currentModelId);
            if (model) {
                currentModelData = model;
                break;
            }
        }
    }
    
    let html = `
        <div class="row">
            <div class="col-md-6 mb-3">
                <label class="form-label">${t('agent.provider') || '模型厂商'}</label>
                <select class="form-select" id="agentProviderId" onchange="onProviderChange()">
                    <option value="">-- ${t('common.select') || '选择'} --</option>
    `;
    
    // 添加厂商选项 / Add provider options
    if (allProviderTemplates) {
        for (const [pid, provider] of Object.entries(allProviderTemplates)) {
            const selected = pid === currentProviderId ? 'selected' : '';
            html += `<option value="${pid}" ${selected}>${provider.name}</option>`;
        }
    }
    
    html += `
                </select>
            </div>
            <div class="col-md-6 mb-3">
                <label class="form-label">${t('agent.modelId') || '模型版本'}</label>
                <select class="form-select" id="agentModelId" onchange="onModelChange()">
                    <option value="">-- ${t('common.select') || '选择'} --</option>
                </select>
            </div>
        </div>
        <div class="row">
            <div class="col-md-6 mb-3">
                <label class="form-label">Base URL</label>
                <input type="text" class="form-control" id="agentBaseUrl" readonly value="${currentBaseUrl}">
            </div>
            <div class="col-md-6 mb-3">
                <label class="form-label">API Type</label>
                <input type="text" class="form-control" id="agentApiType" readonly value="${currentApiType}">
            </div>
        </div>
        <div class="mb-3">
            <label class="form-label">${t('agent.apiKey') || 'API Key'}</label>
            <div class="input-group">
                <input type="password" class="form-control" id="agentApiKey" placeholder="${hasApiKey ? (t('agent.apiKeyPlaceholderOptional') || '已配置，留空保持不变') : (t('agent.apiKeyPlaceholder') || '输入API密钥')}">
                <button class="btn btn-outline-secondary" type="button" id="toggleApiKey" onclick="toggleApiKeyVisibility()">
                    <i class="bi bi-eye"></i>
                </button>
            </div>
            ${hasApiKey ? `<small class="text-success"><i class="bi bi-check-circle"></i> ${t('agent.apiKeyConfigured') || '已配置API密钥'}</small>` : ''}
        </div>
    `;
    
    container.innerHTML = html;
    
    // 如果有厂商，延迟触发厂商变化事件 / If there's a provider, delay trigger provider change event
    if (currentProviderId) {
        setTimeout(() => {
            onProviderChange(currentModelId);
        }, 50);
    }
}

/**
 * 厂商选择变化事件
 * Provider select change event
 * @param {string} selectedModelId - 已选择的模型 ID / Selected model ID
 */
function onProviderChange(selectedModelId = null) {
    const providerId = document.getElementById('agentProviderId')?.value;
    const modelSelect = document.getElementById('agentModelId');
    const baseUrlInput = document.getElementById('agentBaseUrl');
    const apiTypeInput = document.getElementById('agentApiType');
    
    if (!modelSelect) return;
    
    // 重置模型选择 / Reset model select
    modelSelect.innerHTML = `<option value="">-- ${t('common.select') || '选择'} --</option>`;
    if (baseUrlInput) baseUrlInput.value = '';
    if (apiTypeInput) apiTypeInput.value = '';
    
    if (!providerId || !allProviderTemplates?.[providerId]) return;
    
    const provider = allProviderTemplates[providerId];
    
    // 设置厂商信息 / Set provider info
    if (baseUrlInput) baseUrlInput.value = provider.baseUrl || '';
    if (apiTypeInput) apiTypeInput.value = provider.api || '';
    
    // 添加模型选项 / Add model options
    if (provider.models) {
        provider.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name + (model.context ? ` (${formatContext(model.context)})` : '');
            if (selectedModelId && model.id === selectedModelId) {
                option.selected = true;
            }
            modelSelect.appendChild(option);
        });
    }
    
    if (selectedModelId) {
        onModelChange();
    }
}

/**
 * 模型选择变化事件
 * Model select change event
 */
function onModelChange() {
}

/**
 * 格式化上下文大小
 * Format context size
 * @param {number} context - 上下文大小 / Context size
 * @returns {string} 格式化后的大小 / Formatted size
 */
function formatContext(context) {
    if (context >= 1000000) {
        return (context / 1000000).toFixed(1) + 'M';
    } else if (context >= 1000) {
        return (context / 1000).toFixed(0) + 'K';
    }
    return context;
}

/**
 * 编辑智能体
 * Edit agent
 * @param {string} id - 智能体 ID / Agent ID
 */
function editAgent(id) {
    const agent = agents.find(a => a.id === id);
    if (agent) showAgentModal(agent);
}

// 保存智能体相关变量 / Save agent related variables
let isSavingAgent = false;            // 是否正在保存 / Whether saving
let countdownModalInterval = null;    // 倒计时模态框定时器 / Countdown modal timer

/**
 * 保存智能体
 * Save agent
 */
async function saveAgent() {
    // 防止重复点击 / Prevent double click
    const saveBtn = document.getElementById('saveAgentBtn');
    const agentModal = document.getElementById('agentModal');
    
    // 只禁用按钮，不移除 onclick / Only disable button, don't remove onclick
    if (isSavingAgent) return;
    isSavingAgent = true;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${t('common.saving') || '保存中...'}`;
    
    const isNewAgent = !document.getElementById('agentId').value;
    
    // 验证必填字段 / Validate required fields
    const name = document.getElementById('agentName')?.value;
    const modelId = document.getElementById('agentModelId')?.value;
    
    if (!name) {
        alert(t('common.operationFailed'));
        bootstrap.Modal.getInstance(agentModal)?.hide();
        return;
    }
    if (!modelId) {
        alert(t('agent.selectModel') || '请选择模型');
        bootstrap.Modal.getInstance(agentModal)?.hide();
        return;
    }
    
    const providerId = document.getElementById('agentProviderId')?.value || '';
    const baseUrl = document.getElementById('agentBaseUrl')?.value || '';
    const apiType = document.getElementById('agentApiType')?.value || '';
    const apiKey = document.getElementById('agentApiKey')?.value || '';
    
    const data = {
        id: document.getElementById('agentId').value || null,
        name: name,
        modelId: modelId,
        providerId: providerId,
        baseUrl: baseUrl,
        apiType: apiType,
        apiKey: apiKey,
        identity: document.getElementById('agentIdentity').value,
        skills: document.getElementById('agentSkills').value,
        personality: document.getElementById('agentPersonality').value,
        tools: document.getElementById('agentTools').value,
        userProfile: document.getElementById('agentUserProfile').value
    };
    
    try {
        const response = await fetch('/api/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (response.ok && result.success) {
            // 保存成功 - 关闭模态框 / Save successful - close modal
            bootstrap.Modal.getInstance(agentModal)?.hide();
            loadAgents();
            
            // 如果是新增智能体，显示倒计时提示框 / If it's a new agent, show countdown modal
            if (isNewAgent) {
                showCountdownModal();
            }
        } else {
            // 保存失败 / Save failed
            alert(result.error || t('common.operationFailed'));
            // 恢复按钮状态 / Restore button state
            isSavingAgent = false;
            saveBtn.disabled = false;
            saveBtn.innerHTML = t('common.save') || '保存';
        }
    } catch (error) {
        console.error('Failed to save agent:', error);
        alert(t('common.operationFailed'));
        // 恢复按钮状态 / Restore button state
        isSavingAgent = false;
        saveBtn.disabled = false;
        saveBtn.innerHTML = t('common.save') || '保存';
    }
}

/**
 * 显示倒计时提示框
 * Show countdown modal
 */
function showCountdownModal() {
    const countdownModal = new bootstrap.Modal(document.getElementById('countdownModal'));
    const countdownTimer = document.getElementById('countdownTimer');
    
    let countdown = 30;
    countdownTimer.textContent = countdown;
    
    countdownModal.show();
    
    // 倒计时逻辑 / Countdown logic
    countdownModalInterval = setInterval(() => {
        countdown--;
        countdownTimer.textContent = countdown;
        
        if (countdown <= 0) {
            clearInterval(countdownModalInterval);
            countdownModalInterval = null;
            countdownModal.hide();
        }
    }, 1000);
}

/**
 * 删除智能体
 * Delete agent
 * @param {string} id - 智能体 ID / Agent ID
 */
function deleteAgent(id) {
    showConfirm(t('agent.deleteConfirm'), async () => {
        try {
            await fetch(`/api/agents/${id}`, { method: 'DELETE' });
            loadAgents();
        } catch (error) {
            console.error('Failed to delete agent:', error);
        }
    });
}

/**
 * 导出智能体
 * Export agents
 */
async function exportAgents() {
    try {
        const response = await fetch('/api/agents/export');
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'agents.json';
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Failed to export agents:', error);
    }
}

/**
 * 备份 OpenClaw 安装目录
 * Backup OpenClaw installation directory
 */
async function backupOpenclaw() {
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>处理中...`;
    
    try {
        const response = await fetch('/api/backup/openclaw', { method: 'POST' });
        const result = await response.json();
        
        if (!result.success) {
            alert('备份失败: ' + result.error);
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }
        
        const taskId = result.task_id;
        alert('备份任务已启动，请稍候...');
        
        // 轮询备份状态 / Poll backup status
        for (let i = 0; i < 60; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const statusRes = await fetch(`/api/backup/openclaw/status/${taskId}`);
            const status = await statusRes.json();
            
            if (status.status === 'completed') {
                btn.innerHTML = `<i class="bi bi-check-circle"></i> 完成`;
                await loadBackupLists();
                alert(`备份成功！文件: ${status.filename}`);
                break;
            } else if (status.status === 'error') {
                alert('备份失败: ' + status.error);
                break;
            } else if (status.status === 'compressing') {
                btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>压缩中...`;
            }
        }
    } catch (error) {
        console.error('Backup error:', error);
        alert('备份失败: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * 备份 rlzclaw 配置目录
 * Backup rlzclaw configuration directory
 */
async function backupRlzclaw() {
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>处理中...`;
    
    try {
        const response = await fetch('/api/backup/rlzclaw', { method: 'POST' });
        const result = await response.json();
        
        if (!result.success) {
            alert('备份失败: ' + result.error);
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }
        
        const taskId = result.task_id;
        alert('备份任务已启动，请稍候...');
        
        // 轮询备份状态 / Poll backup status
        for (let i = 0; i < 60; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const statusRes = await fetch(`/api/backup/rlzclaw/status/${taskId}`);
            const status = await statusRes.json();
            
            if (status.status === 'completed') {
                btn.innerHTML = `<i class="bi bi-check-circle"></i> 完成`;
                await loadBackupLists();
                alert(`备份成功！文件: ${status.filename}`);
                break;
            } else if (status.status === 'error') {
                alert('备份失败: ' + status.error);
                break;
            } else if (status.status === 'compressing') {
                btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>压缩中...`;
            }
        }
    } catch (error) {
        console.error('Backup error:', error);
        alert('备份失败: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * 加载备份列表
 * Load backup lists
 */
async function loadBackupLists() {
    try {
        const response = await fetch('/api/backup/list');
        const data = await response.json();
        
        // OpenClaw 备份列表 / OpenClaw backup list
        const openclawContainer = document.getElementById('openclawBackupList');
        if (openclawContainer) {
            if (data.openclaw.length === 0) {
                openclawContainer.innerHTML = '<small class="text-muted">暂无备份</small>';
            } else {
                openclawContainer.innerHTML = data.openclaw.map(b => `
                    <div class="d-flex justify-content-between align-items-center mb-1 small">
                        <span><i class="bi bi-file-zip me-1"></i>${b.filename} (${formatSize(b.size)})</span>
                        <div>
                            <a href="/api/backup/download/${b.filename}" class="btn btn-xs btn-outline-secondary me-1" title="下载"><i class="bi bi-download"></i></a>
                            <button class="btn btn-xs btn-outline-danger" onclick="deleteBackup('${b.filename}')" title="删除"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                `).join('');
            }
        }
        
        // rlzclaw 备份列表 / rlzclaw backup list
        const rlzclawContainer = document.getElementById('rlzclawBackupList');
        if (rlzclawContainer) {
            if (data.rlzclaw.length === 0) {
                rlzclawContainer.innerHTML = '<small class="text-muted">暂无备份</small>';
            } else {
                rlzclawContainer.innerHTML = data.rlzclaw.map(b => `
                    <div class="d-flex justify-content-between align-items-center mb-1 small">
                        <span><i class="bi bi-file-zip me-1"></i>${b.filename} (${formatSize(b.size)})</span>
                        <div>
                            <a href="/api/backup/download/${b.filename}" class="btn btn-xs btn-outline-secondary me-1" title="下载"><i class="bi bi-download"></i></a>
                            <button class="btn btn-xs btn-outline-danger" onclick="deleteBackup('${b.filename}')" title="删除"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Failed to load backup lists:', error);
    }
}

/**
 * 删除备份文件
 * Delete backup file
 */
async function deleteBackup(filename) {
    if (!confirm(`确定要删除备份 "${filename}" 吗？`)) return;
    
    try {
        const response = await fetch(`/api/backup/delete/${filename}`, { method: 'DELETE' });
        const result = await response.json();
        
        if (result.success) {
            loadBackupLists();
        } else {
            alert('删除失败: ' + result.error);
        }
    } catch (error) {
        console.error('Failed to delete backup:', error);
        alert('删除失败');
    }
}

/**
 * 格式化文件大小
 * Format file size
 */
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * 修改密码
 * Change password
 */
async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorDiv = document.getElementById('passwordError');
    
    errorDiv.classList.add('d-none');
    
    try {
        const response = await fetch('/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `current_password=${encodeURIComponent(currentPassword)}&new_password=${encodeURIComponent(newPassword)}&confirm_password=${encodeURIComponent(confirmPassword)}`
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('密码修改成功！请重新登录。');
            window.location.href = '/logout';
        } else {
            errorDiv.textContent = result.error || '修改失败';
            errorDiv.classList.remove('d-none');
        }
    } catch (error) {
        errorDiv.textContent = '请求失败: ' + error.message;
        errorDiv.classList.remove('d-none');
    }
}

async function loadUsers() {
    try {
        // 获取当前登录用户 / Get current logged in user
        const loginRes = await fetch('/check-login');
        const loginData = await loginRes.json();
        const currentUser = loginData.username || '';
        
        const response = await fetch('/api/users');
        const result = await response.json();
        
        if (!result.success) {
            document.getElementById('userList').innerHTML = '<small class="text-danger">加载失败</small>';
            return;
        }
        
        if (result.users.length === 0) {
            document.getElementById('userList').innerHTML = '<small class="text-muted">暂无用户</small>';
            return;
        }
        
        document.getElementById('userList').innerHTML = result.users.map(u => `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span><i class="bi bi-person me-1"></i>${u.username}</span>
                ${u.username !== currentUser ? `<button class="btn btn-xs btn-outline-danger" onclick="deleteUser('${u.username}')" title="删除"><i class="bi bi-trash"></i></button>` : '<small class="text-muted">(当前)</small>'}
            </div>
        `).join('');
        
        // 同时更新模态框中的用户列表 / Also update user list in modal
        const userListModal = document.getElementById('userListModal');
        if (userListModal) {
            if (result.users.length === 0) {
                userListModal.innerHTML = '<small class="text-muted">暂无用户</small>';
            } else {
                userListModal.innerHTML = result.users.map(u => `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span><i class="bi bi-person me-1"></i>${u.username}</span>
                        ${u.username !== currentUser ? `<button class="btn btn-xs btn-outline-danger" onclick="deleteUser('${u.username}')" title="删除"><i class="bi bi-trash"></i></button>` : '<small class="text-muted">(当前)</small>'}
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Failed to load users:', error);
        document.getElementById('userList').innerHTML = '<small class="text-danger">加载失败</small>';
    }
}

async function addUser() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const errorDiv = document.getElementById('addUserError');
    
    errorDiv.classList.add('d-none');
    
    if (!username || !password) {
        errorDiv.textContent = '请填写用户名和密码';
        errorDiv.classList.remove('d-none');
        return;
    }
    
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(result.message);
            document.getElementById('newUsername').value = '';
            document.getElementById('newUserPassword').value = '';
            bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
            loadUsers();
        } else {
            errorDiv.textContent = result.error || '创建失败';
            errorDiv.classList.remove('d-none');
        }
    } catch (error) {
        errorDiv.textContent = '请求失败: ' + error.message;
        errorDiv.classList.remove('d-none');
    }
}

async function deleteUser(username) {
    if (!confirm(`确定要删除用户 "${username}" 吗？`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${username}`, { method: 'DELETE' });
        const result = await response.json();
        
        if (result.success) {
            alert(result.message);
            loadUsers();
        } else {
            alert('删除失败: ' + result.error);
        }
    } catch (error) {
        alert('请求失败: ' + error.message);
    }
}

async function loadLogo() {
    try {
        const response = await fetch('/api/logo');
        const data = await response.json();
        
        if (data.success && data.logo_url) {
            // 导航栏 / Nav bar
            const navLogo = document.getElementById('navLogo');
            const navLogoEmoji = document.getElementById('navLogoEmoji');
            if (navLogo) {
                navLogo.src = data.logo_url + '?t=' + Date.now();
                navLogo.style.display = 'inline-block';
                if (navLogoEmoji) navLogoEmoji.style.display = 'none';
            }
            
            // 首页 / Index page
            const currentLogo = document.getElementById('currentLogo');
            const currentLogoEmoji = document.getElementById('currentLogoEmoji');
            if (currentLogo) {
                currentLogo.src = data.logo_url + '?t=' + Date.now();
                currentLogo.style.display = 'inline-block';
                if (currentLogoEmoji) currentLogoEmoji.style.display = 'none';
            }
            
            // 登录页 / Login page
            const loginLogo = document.getElementById('loginLogo');
            const loginLogoEmoji = document.getElementById('loginLogoEmoji');
            if (loginLogo) {
                loginLogo.src = data.logo_url + '?t=' + Date.now();
                loginLogo.style.display = 'inline-block';
                if (loginLogoEmoji) loginLogoEmoji.style.display = 'none';
            }
            
            // 模态框 / Modal
            const currentLogoModal = document.getElementById('currentLogoModal');
            const currentLogoEmojiModal = document.getElementById('currentLogoEmojiModal');
            if (currentLogoModal) {
                currentLogoModal.src = data.logo_url + '?t=' + Date.now();
                currentLogoModal.style.display = 'inline-block';
                if (currentLogoEmojiModal) currentLogoEmojiModal.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Failed to load logo:', error);
    }
}

function setLanguage(lang) {
    localStorage.setItem('language', lang);
    updateLanguageDisplay(lang);
}

function updateLanguageDisplay(lang) {
    const langText = lang === 'zh-CN' ? '简体中文' : lang === 'zh-TW' ? '繁體中文' : 'English';
    const langSelect = document.getElementById('langSelect');
    if (langSelect) {
        langSelect.value = lang;
    }
    // 刷新页面以加载新语言 / Refresh page to load new language
    location.reload();
}

async function uploadLogo() {
    const fileInput = document.getElementById('logoInput');
    const errorDiv = document.getElementById('logoError');
    const successDiv = document.getElementById('logoSuccess');
    
    errorDiv.classList.add('d-none');
    successDiv.classList.add('d-none');
    
    if (!fileInput.files || !fileInput.files[0]) {
        errorDiv.textContent = '请选择图片文件';
        errorDiv.classList.remove('d-none');
        return;
    }
    
    const formData = new FormData();
    formData.append('logo', fileInput.files[0]);
    
    try {
        const response = await fetch('/api/logo', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            successDiv.textContent = 'Logo 上传成功！';
            successDiv.classList.remove('d-none');
            loadLogo();
            fileInput.value = '';
        } else {
            errorDiv.textContent = result.error || '上传失败';
            errorDiv.classList.remove('d-none');
        }
    } catch (error) {
        errorDiv.textContent = '请求失败: ' + error.message;
        errorDiv.classList.remove('d-none');
    }
}

async function uploadLogoModal() {
    const fileInput = document.getElementById('logoInputModal');
    const errorDiv = document.getElementById('logoErrorModal');
    const successDiv = document.getElementById('logoSuccessModal');
    
    errorDiv.classList.add('d-none');
    successDiv.classList.add('d-none');
    
    if (!fileInput.files || !fileInput.files[0]) {
        errorDiv.textContent = '请选择图片文件';
        errorDiv.classList.remove('d-none');
        return;
    }
    
    const formData = new FormData();
    formData.append('logo', fileInput.files[0]);
    
    try {
        const response = await fetch('/api/logo', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            successDiv.textContent = 'Logo 上传成功！';
            successDiv.classList.remove('d-none');
            loadLogo();
            fileInput.value = '';
            // 刷新页面 / Reload page
            setTimeout(() => location.reload(), 1000);
        } else {
            errorDiv.textContent = result.error || '上传失败';
            errorDiv.classList.remove('d-none');
        }
    } catch (error) {
        errorDiv.textContent = '请求失败: ' + error.message;
        errorDiv.classList.remove('d-none');
    }
}

// 全局变量用于微积分验证 / Global variables for calculus verification
let currentCalcQuestion = null;
let currentCalcAnswer = null;

/**
 * 生成微积分题目
 * Generate calculus question
 */
function generateCalcQuestion() {
    const funcs = [
        { q: '求导: d/dx(x²)', a: '2x' },
        { q: '求导: d/dx(x³)', a: '3x^2' },
        { q: '求导: d/dx(e^x)', a: 'e^x' },
        { q: '求导: d/dx(ln(x))', a: '1/x' },
        { q: '求导: d/dx(sin(x))', a: 'cos(x)' },
        { q: '求导: d/dx(cos(x))', a: '-sin(x)' },
        { q: '求导: d/dx(x⁴)', a: '4x^3' },
        { q: '求导: d/dx(2x)', a: '2' },
        { q: '求导: d/dx(5)', a: '0' },
        { q: '求导: d/dx(x+1)', a: '1' },
        { q: '∫2x dx', a: 'x^2' },
        { q: '∫x dx', a: 'x^2/2' },
        { q: '∫dx', a: 'x' },
        { q: '∫e^x dx', a: 'e^x' },
        { q: '求导: d/dx(x⁵)', a: '5x^4' }
    ];
    const idx = Math.floor(Math.random() * funcs.length);
    currentCalcQuestion = funcs[idx].q;
    currentCalcAnswer = funcs[idx].a;
    return currentCalcQuestion;
}

/**
 * 显示卸载验证模态框
 * Show uninstall verification modal
 */
function showUninstallModal() {
    const modal = new bootstrap.Modal(document.getElementById('uninstallModal'));
    document.getElementById('calcQuestion').textContent = generateCalcQuestion();
    document.getElementById('calcAnswer').value = '';
    document.getElementById('calcError').classList.add('d-none');
    modal.show();
}

/**
 * 验证答案并卸载
 * Verify answer and uninstall
 */
async function verifyAndUninstall() {
    const userAnswer = document.getElementById('calcAnswer').value.trim().toLowerCase();
    const correctAnswers = [
        currentCalcAnswer.toLowerCase(),
        currentCalcAnswer.replace('^', '**').toLowerCase()
    ];
    
    // 处理 x^2 格式 / Handle x^2 format
    const normalizedUser = userAnswer.replace(/\^/g, '**');
    
    let isCorrect = correctAnswers.some(a => {
        const normCorrect = a.replace(/\^/g, '**');
        return normalizedUser === normCorrect || 
               normalizedUser === normCorrect.replace(/\*\*2/g, '²').replace(/\*\*3/g, '³').replace(/\*\*4/g, '⁴');
    });
    
    // 简单匹配 / Simple match
    if (!isCorrect) {
        // 尝试数值比较 / Try numeric comparison
        if (userAnswer === currentCalcAnswer) isCorrect = true;
    }
    
    if (!isCorrect && userAnswer) {
        // 显示错误 / Show error
        document.getElementById('calcError').classList.remove('d-none');
        // 换一道题 / Change question
        document.getElementById('calcQuestion').textContent = generateCalcQuestion();
        document.getElementById('calcAnswer').value = '';
        return;
    }
    
    if (!userAnswer) {
        alert('请输入答案');
        return;
    }
    
    // 验证通过，执行卸载 / Verify passed, execute uninstall
    if (!confirm('确定要卸载 OpenClaw 吗？此操作不可恢复！')) {
        return;
    }
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('uninstallModal'));
    modal.hide();
    
    try {
        const response = await fetch('/api/uninstall/openclaw', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            alert('OpenClaw 卸载成功！');
        } else {
            alert('卸载失败: ' + result.error);
        }
    } catch (error) {
        console.error('Failed to uninstall OpenClaw:', error);
        alert('卸载失败: ' + error.message);
    }
}

/**
 * 触发文件导入
 * Trigger file import
 */
function triggerImport() {
    document.getElementById('importFile').click();
}

/**
 * 处理文件导入
 * Handle file import
 * @param {Event} event - 文件变化事件 / File change event
 */
async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            await fetch('/api/agents/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            loadAgents();
        } catch (error) {
            console.error('Failed to import agents:', error);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

/**
 * 选择智能体
 * Select agent
 * @param {string} id - 智能体 ID / Agent ID
 */
function selectAgent(id) {
    currentAgent = agents.find(a => a.id === id);
    document.getElementById('currentAgentName').textContent = currentAgent?.name || currentAgent?.id || '-';
    document.querySelectorAll('#chatAgentList .list-group-item').forEach(el => el.classList.remove('active'));
    event?.target?.classList.add('active');
    
    // 重置聊天历史 / Reset chat history
    chatHistory[currentAgent.id] = [];
    lastTimestamp[currentAgent.id] = '';
    
    loadChatHistory();
    startSync();
}

/**
 * 加载聊天历史
 * Load chat history
 */
async function loadChatHistory() {
    if (!currentAgent || isLoadingHistory) return;
    isLoadingHistory = true;
    
    try {
        const response = await fetch(`/api/chat/history?agentId=${currentAgent.id}&limit=50`);
        const result = await response.json();
        
        if (result.success && result.messages.length > 0) {
            chatHistory[currentAgent.id] = result.messages;
            lastTimestamp[currentAgent.id] = result.messages[result.messages.length - 1]?.timestamp || '';
            renderChatMessages();
        } else {
            renderChatMessages();
        }
    } catch (error) {
        console.error('Failed to load chat history:', error);
    }
    
    isLoadingHistory = false;
}

/**
 * 开始同步聊天消息
 * Start syncing chat messages
 */
function startSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    syncInterval = setInterval(syncMessages, 3000);
}

/**
 * 同步聊天消息
 * Sync chat messages
 */
async function syncMessages() {
    if (!currentAgent) return;
    
    try {
        const since = lastTimestamp[currentAgent.id] || '';
        const response = await fetch(`/api/chat/sync?agentId=${currentAgent.id}&since=${encodeURIComponent(since)}`);
        const result = await response.json();
        
        if (result.success && result.hasNew && result.messages.length > 0) {
            // 添加新消息 / Add new messages
            for (const msg of result.messages) {
                const exists = chatHistory[currentAgent.id].some(m => m.id === msg.id);
                if (!exists) {
                    chatHistory[currentAgent.id].push(msg);
                }
            }
            lastTimestamp[currentAgent.id] = result.lastTimestamp;
            renderChatMessages();
        }
    } catch (error) {
        console.error('Sync error:', error);
    }
}

/**
 * 渲染聊天消息
 * Render chat messages
 */
function renderChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const history = chatHistory[currentAgent?.id] || [];
    
    // 未选择智能体 / No agent selected
    if (!currentAgent) {
        container.innerHTML = `<div class="text-center text-muted py-5"><i class="bi bi-chat-dots display-4"></i><p class="mt-2">${t('chat.noAgent')}</p></div>`;
        return;
    }
    // 无聊天历史 / No chat history
    if (history.length === 0) {
        container.innerHTML = `<div class="text-center text-muted py-5"><i class="bi bi-chat display-4"></i><p class="mt-2">${t('chat.selectAgent')}</p></div>`;
        return;
    }
    
    // 渲染消息列表 / Render message list
    container.innerHTML = history.map(msg => {
        const isUser = msg.role === 'user';
        const content = formatMessageContent(msg.content);
        const time = formatTimestamp(msg.timestamp);
        return `
            <div class="chat-message ${isUser ? 'user' : 'agent'}">
                <div class="chat-bubble">${content}</div>
                <div class="chat-time">${time}</div>
            </div>
        `;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

/**
 * 格式化消息内容
 * Format message content
 * @param {string} content - 消息内容 / Message content
 * @returns {string} 格式化后的内容 / Formatted content
 */
function formatMessageContent(content) {
    if (!content) return '-';
    let formatted = content
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
    return formatted;
}

/**
 * 格式化时间戳
 * Format timestamp
 * @param {string} ts - 时间戳 / Timestamp
 * @returns {string} 格式化后的时间 / Formatted time
 */
function formatTimestamp(ts) {
    if (!ts) return '';
    try {
        const date = new Date(ts);
        return date.toLocaleTimeString();
    } catch {
        return ts;
    }
}

/**
 * 发送聊天消息
 * Send chat message
 */
async function sendMessage() {
    if (!currentAgent) {
        alert(t('chat.noAgent'));
        return;
    }
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    const now = new Date();
    const sessionId = `web-${Date.now()}`;
    if (!chatHistory[currentAgent.id]) chatHistory[currentAgent.id] = [];
    
    // 添加用户消息 / Add user message
    chatHistory[currentAgent.id].push({ 
        id: `user-${Date.now()}`,
        type: 'user', 
        role: 'user',
        content: message, 
        time: now.toLocaleTimeString(),
        timestamp: now.toISOString()
    });
    input.value = '';
    input.disabled = true;
    renderChatMessages();
    
    try {
        const response = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                message: message,
                sessionId: sessionId
            })
        });
        const result = await response.json();
        
        let replyContent = result.response || result.error || 'No response';
        
        // 添加智能体回复 / Add agent reply
        chatHistory[currentAgent.id].push({
            id: `agent-${Date.now()}`,
            type: 'agent',
            role: 'assistant',
            content: replyContent,
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString()
        });
        
        lastTimestamp[currentAgent.id] = new Date().toISOString();
    } catch (error) {
        chatHistory[currentAgent.id].push({
            id: `error-${Date.now()}`,
            type: 'agent',
            role: 'assistant',
            content: `Error: ${error.message}`,
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString()
        });
    }
    
    input.disabled = false;
    renderChatMessages();
}

/**
 * 清空聊天
 * Clear chat
 */
function clearChat() {
    if (currentAgent) {
        chatHistory[currentAgent.id] = [];
        lastTimestamp[currentAgent.id] = '';
        renderChatMessages();
    }
}

/**
 * 加载命令列表
 * Load command list
 */
async function loadCommands() {
    try {
        const response = await fetch('/api/commands');
        commands = await response.json();
        renderCommandList();
    } catch (error) {
        console.error('Failed to load commands:', error);
    }
}

/**
 * 渲染命令列表
 * Render command list
 */
function renderCommandList() {
    const container = document.getElementById('commandList');
    if (!container) return;
    const lang = getCurrentLang();
    
    container.innerHTML = commands.map(cmd => `
        <a href="#" class="list-group-item list-group-item-action" onclick="executeCommand('${cmd.id}'); return false;">
            <i class="bi bi-terminal me-2"></i>${cmd.names[lang] || cmd.names['en']}
        </a>
    `).join('');
}

/**
 * 执行命令
 * Execute command
 * @param {string} id - 命令 ID / Command ID
 */
async function executeCommand(id) {
    const cmd = commands.find(c => c.id === id);
    if (!cmd) return;
    
    showConfirm(t('command.confirmExecute'), async () => {
        const resultArea = document.getElementById('commandResult');
        resultArea.textContent = t('command.executing');
        try {
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd.command })
            });
            const result = await response.json();
            resultArea.textContent = result.success ? (result.stdout || result.stderr || 'OK') : `Error: ${result.error || result.stderr}`;
        } catch (error) {
            resultArea.textContent = `Error: ${error.message}`;
        }
    });
}

/**
 * 清空命令结果
 * Clear command result
 */
function clearResult() {
    document.getElementById('commandResult').textContent = '';
}

/**
 * 复制命令结果
 * Copy command result
 */
function copyResult() {
    navigator.clipboard.writeText(document.getElementById('commandResult').textContent);
}

/**
 * 显示确认对话框
 * Show confirm dialog
 * @param {string} message - 确认消息 / Confirm message
 * @param {Function} onConfirm - 确认回调 / Confirm callback
 */
function showConfirm(message, onConfirm) {
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    document.getElementById('confirmMessage').textContent = message;
    const confirmBtn = document.getElementById('confirmBtn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', () => {
        bootstrap.Modal.getInstance(document.getElementById('confirmModal')).hide();
        onConfirm();
    });
    modal.show();
}

/**
 * 切换 API Key 可见性
 * Toggle API Key visibility
 */
function toggleApiKeyVisibility() {
    const input = document.getElementById('agentApiKey');
    const icon = document.querySelector('#toggleApiKey i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
    }
}

// 版本管理相关变量 / Version management related variables
let currentVersionFilename = '';

/**
 * 加载版本列表
 * Load version list
 */
async function loadVersions() {
    const container = document.getElementById('versionList');
    const currentContainer = document.getElementById('currentVersion');
    if (!container) return;
    
    try {
        const response = await fetch('/api/versions');
        const versions = await response.json();
        
        // 无数据时显示提示 / Show hint when no data
        if (versions.length === 0) {
            container.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">${t('common.noData') || '暂无版本记录'}</td></tr>`;
            if (currentContainer) currentContainer.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">暂无版本</td></tr>`;
            document.getElementById('historyCount').textContent = '0';
            return;
        }
        
        // 当前版本（最新版本）/ Current version (latest)
        const currentV = versions[0];
        if (currentContainer) {
            currentContainer.innerHTML = `
                <tr>
                    <td><span class="badge bg-success me-2">当前</span>${currentV.displayTime}</td>
                    <td><code>${currentV.filename}</code></td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="viewVersion('${currentV.filename}')" title="查看">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-warning" onclick="confirmRestore('${currentV.filename}')" title="回滚">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        // 历史版本（除最新外的其他版本）/ History versions (all except latest)
        const historyVersions = versions.slice(1);
        document.getElementById('historyCount').textContent = historyVersions.length;
        
        if (historyVersions.length === 0) {
            container.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">暂无历史版本</td></tr>`;
            return;
        }
        
        // 渲染历史版本列表 / Render history version list
        container.innerHTML = historyVersions.map((v, index) => `
            <tr>
                <td>${v.displayTime}</td>
                <td><code>${v.filename}</code></td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary btn-sm" onclick="viewVersion('${v.filename}')" title="查看">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-warning btn-sm" onclick="confirmRestore('${v.filename}')" title="回滚">
                            <i class="bi bi-arrow-counterclockwise"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteVersion('${v.filename}')" title="删除">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load versions:', error);
        container.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-3">${t('common.loadFailed') || '加载失败'}</td></tr>`;
    }
}

/**
 * 查看版本详情
 * View version detail
 * @param {string} filename - 版本文件名 / Version filename
 */
async function viewVersion(filename) {
    currentVersionFilename = filename;
    try {
        const response = await fetch(`/api/versions/${filename}`);
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('versionTime').textContent = result.filename.replace('openclaw_', '').replace('.json', '').replace('_', ' ');
            document.getElementById('versionContent').textContent = JSON.stringify(result.config, null, 2);
            
            // 更新主题样式 / Update theme style
            updateVersionContentTheme();
            
            const modal = new bootstrap.Modal(document.getElementById('versionModal'));
            modal.show();
        }
    } catch (error) {
        console.error('Failed to load version detail:', error);
    }
}

/**
 * 更新版本内容区域的主题样式
 * Update version content area theme style
 */
function updateVersionContentTheme() {
    const versionContent = document.getElementById('versionContent');
    if (!versionContent) return;
    
    const isDark = document.body.classList.contains('dark-mode') || document.documentElement.getAttribute('data-bs-theme') === 'dark';
    
    if (isDark) {
        versionContent.style.background = '#2b2b2b';
        versionContent.style.color = '#e0e0e0';
    } else {
        versionContent.style.background = '#f8f9fa';
        versionContent.style.color = '#212529';
    }
}

/**
 * 确认回滚版本
 * Confirm restore version
 * @param {string} filename - 版本文件名 / Version filename
 */
function confirmRestore(filename) {
    currentVersionFilename = filename;
    showConfirm(t('version.restoreConfirm') || '确定要回滚到此版本吗？当前配置将被备份。', async () => {
        try {
            const response = await fetch(`/api/versions/${filename}/restore`, { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                loadAgents();
                loadVersions();
                alert(t('version.restoreSuccess') || '版本回滚成功');
            } else {
                alert(result.error || t('common.operationFailed'));
            }
        } catch (error) {
            console.error('Failed to restore version:', error);
            alert(t('common.operationFailed'));
        }
    });
}

/**
 * 删除版本
 * Delete version
 * @param {string} filename - 版本文件名 / Version filename
 */
async function deleteVersion(filename) {
    if (!confirm(`确定要删除版本 "${filename}" 吗？`)) return;
    
    try {
        const response = await fetch(`/api/versions/${filename}`, { method: 'DELETE' });
        const result = await response.json();
        
        if (result.success) {
            loadVersions();
        } else {
            alert(result.error || '删除失败');
        }
    } catch (error) {
        console.error('Failed to delete version:', error);
        alert('删除失败');
    }
}

// 版本详情模态框回滚按钮 / Version detail modal restore button
document.getElementById('restoreVersionBtn')?.addEventListener('click', () => {
    bootstrap.Modal.getInstance(document.getElementById('versionModal'))?.hide();
    confirmRestore(currentVersionFilename);
});
