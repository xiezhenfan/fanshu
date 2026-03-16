// ==================== 智能体关系图 / Agent Relationship Graph ====================

let agentGraphSvg = null;
let agentGraphSimulation = null;
let agentGraphLinks = [];
let agentGraphNodes = [];

/**
 * 刷新智能体关系图
 * Refresh agent relationship graph
 */
function refreshAgentGraph() {
    renderAgentGraph();
}

/**
 * 渲染智能体关系图
 * Render agent relationship graph
 */
function renderAgentGraph() {
    const container = document.getElementById('agentGraphContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (agents.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-diagram-3 display-4"></i><p class="mt-3">暂无智能体数据</p></div>';
        return;
    }
    
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    
    agentGraphNodes = agents.map(ag => ({
        id: ag.id,
        name: ag.name || ag.id,
        isMain: ag.id === 'main',
        avatarUrl: ag.avatarUrl || '',
        subagents: ag.subagents || {}
    }));
    
    agentGraphLinks = [];
    agentGraphNodes.forEach(node => {
        const allowAgents = node.subagents?.allowAgents || [];
        allowAgents.forEach(targetId => {
            const targetNode = agentGraphNodes.find(n => n.id === targetId);
            if (targetNode) {
                agentGraphLinks.push({
                    source: node.id,
                    target: targetId
                });
            }
        });
    });
    
    agentGraphSvg = d3.select('#agentGraphContainer')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('cursor', 'move');
    
    const defs = agentGraphSvg.append('defs');
    
    defs.append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '-0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .append('path')
        .attr('d', 'M 0,-5 L 10,0 L 0,5')
        .attr('fill', '#999');
    
    const g = agentGraphSvg.append('g');
    
    const link = g.append('g')
        .selectAll('line')
        .data(agentGraphLinks)
        .join('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 2)
        .attr('marker-end', 'url(#arrowhead)');
    
    const node = g.append('g')
        .selectAll('g')
        .data(agentGraphNodes)
        .join('g')
        .attr('cursor', 'pointer')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    node.append('circle')
        .attr('r', d => d.isMain ? 40 : 30)
        .attr('fill', d => d.isMain ? '#0d6efd' : '#6c757d')
        .attr('stroke', '#fff')
        .attr('stroke-width', 3);
    
    node.append('text')
        .attr('dy', d => d.isMain ? 55 : 45)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#333')
        .text(d => d.name);
    
    node.append('image')
        .attr('x', d => d.isMain ? -25 : -18)
        .attr('y', d => d.isMain ? -25 : -18)
        .attr('width', d => d.isMain ? 50 : 36)
        .attr('height', d => d.isMain ? 50 : 36)
        .attr('xlink:href', d => d.avatarUrl || 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=robot%20icon%20simple%20flat%20design&image_size=square')
        .attr('clip-path', d => `circle(${d.isMain ? 25 : 18}px at center)`);
    
    node.on('click', (event, d) => {
        showAgentContextMenu(d, event);
    });
    
    node.on('mouseenter', (event, d) => {
        d3.select(event.currentTarget).select('circle')
            .transition()
            .duration(200)
            .attr('r', d.isMain ? 45 : 35);
    });
    
    node.on('mouseleave', (event, d) => {
        d3.select(event.currentTarget).select('circle')
            .transition()
            .duration(200)
            .attr('r', d.isMain ? 40 : 30);
    });
    
    agentGraphSimulation = d3.forceSimulation(agentGraphNodes)
        .force('link', d3.forceLink(agentGraphLinks).id(d => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => d.isMain ? 50 : 40))
        .on('tick', ticked);
    
    function ticked() {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    }
    
    function dragstarted(event, d) {
        if (!event.active) agentGraphSimulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragended(event, d) {
        if (!event.active) agentGraphSimulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
    
    const zoom = d3.zoom()
        .scaleExtent([0.5, 3])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
    
    agentGraphSvg.call(zoom);
}

/**
 * 显示智能体上下文菜单
 * Show agent context menu
 */
function showAgentContextMenu(agent, event) {
    event.stopPropagation();
    
    const existingMenu = document.querySelector('.agent-context-menu');
    if (existingMenu) existingMenu.remove();
    
    const menu = document.createElement('div');
    menu.className = 'agent-context-menu dropdown-menu show';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.zIndex = '9999';
    
    menu.innerHTML = `
        <h6 class="dropdown-header">${agent.name || agent.id}</h6>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item" href="#" onclick="editAgentFromGraph('${agent.id}'); return false;"><i class="bi bi-pencil me-2"></i>编辑智能体</a></li>
        ${!agent.isMain ? `<li><a class="dropdown-item text-danger" href="#" onclick="deleteAgentFromGraph('${agent.id}'); return false;"><i class="bi bi-trash me-2"></i>删除智能体</a></li>` : ''}
    `;
    
    document.body.appendChild(menu);
    
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = (event.clientX - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (event.clientY - rect.height) + 'px';
    }
    
    setTimeout(() => {
        document.addEventListener('click', closeContextMenu, { once: true });
    }, 0);
}

/**
 * 关闭上下文菜单
 * Close context menu
 */
function closeContextMenu() {
    const menu = document.querySelector('.agent-context-menu');
    if (menu) menu.remove();
}

/**
 * 从关系图编辑智能体
 * Edit agent from graph
 */
function editAgentFromGraph(agentId) {
    closeContextMenu();
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
        editAgent(agentId);
    }
}

/**
 * 从关系图删除智能体
 * Delete agent from graph
 */
function deleteAgentFromGraph(agentId) {
    closeContextMenu();
    deleteAgent(agentId);
}

document.addEventListener('DOMContentLoaded', () => {
    const agentGraphTab = document.getElementById('agent-graph-tab');
    if (agentGraphTab) {
        agentGraphTab.addEventListener('shown.bs.tab', () => {
            setTimeout(renderAgentGraph, 100);
        });
    }
});
