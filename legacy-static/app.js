const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const toast = (message) => {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  window.clearTimeout(window.toastTimer);
  window.toastTimer = window.setTimeout(() => el.classList.remove('show'), 2600);
};

const panels = $$('.page-panel');
const navItems = $$('.nav-item');
const setPage = (page) => {
  panels.forEach(panel => { panel.hidden = panel.dataset.panel !== page; });
  navItems.forEach(item => item.classList.toggle('active', item.dataset.page === page));
  $('.main-nav').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
navItems.forEach(item => item.addEventListener('click', () => setPage(item.dataset.page)));
$('#mobileMenu').addEventListener('click', () => $('.main-nav').classList.toggle('open'));

$$('.category-tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.category-tab').forEach(item => item.classList.remove('selected'));
  tab.classList.add('selected');
  const category = tab.dataset.category;
  $('#promptSummary').textContent = category === '电商' ? '夏季上新、漫画分镜、自然人物光' : category === '漫画' ? '电影感角色出场、低机位、细雨氛围' : '自然肤色、柔和光影、清透细节';
  toast(`已切换到「${category}」创作场景`);
}));

$$('.step').forEach(step => step.addEventListener('click', () => {
  const stepNumber = Number(step.dataset.step);
  $$('.step').forEach(item => item.classList.toggle('active', Number(item.dataset.step) === stepNumber));
  $$('.step').forEach(item => item.classList.toggle('done', Number(item.dataset.step) < stepNumber));
  toast(`创作流程：${step.querySelector('b').textContent}`);
}));

$('#themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
  $('#themeToggle').textContent = document.body.classList.contains('dark-theme') ? '☀' : '☾';
  toast(document.body.classList.contains('dark-theme') ? '已切换到深色模式' : '已切换到浅色模式');
});
const appShell = $('.app-shell');
const canvasLibraryView = $('#canvasLibraryView');
const canvasEditorView = $('#canvasEditorView');
const showCanvasLibrary = () => {
  appShell.hidden = true;
  canvasEditorView.hidden = true;
  canvasLibraryView.hidden = false;
  document.body.classList.add('canvas-mode');
  if (window.lucide) window.lucide.createIcons();
};
const showCanvasEditor = () => {
  canvasLibraryView.hidden = true;
  canvasEditorView.hidden = false;
  document.body.classList.add('canvas-mode');
  if (window.lucide) window.lucide.createIcons();
  resetCanvasView();
};
const leaveCanvasMode = () => {
  canvasLibraryView.hidden = true;
  canvasEditorView.hidden = true;
  appShell.hidden = false;
  document.body.classList.remove('canvas-mode');
};
$('#enterStudio').addEventListener('click', () => { setPage('image'); toast('已进入生图工作台'); });
$('#startCreate').addEventListener('click', showCanvasLibrary);
$('#openCanvas').addEventListener('click', showCanvasLibrary);
$('#backHome').addEventListener('click', leaveCanvasMode);
$('#newCanvasFromLibrary').addEventListener('click', showCanvasEditor);
$('#newCanvasEmpty').addEventListener('click', showCanvasEditor);
$('#editorBack').addEventListener('click', showCanvasLibrary);
$('#importCanvas').addEventListener('click', () => $('#canvasFileInput').click());
$('#canvasFileInput').addEventListener('change', (event) => { if (event.target.files[0]) toast(`已导入画布：${event.target.files[0].name}`); });
$$('[data-library-page]').forEach(button => button.addEventListener('click', () => { leaveCanvasMode(); setPage(button.dataset.libraryPage); }));
$('#libraryEnterStudio').addEventListener('click', () => { leaveCanvasMode(); setPage('image'); });
$('#libraryThemeToggle').addEventListener('click', () => { document.body.classList.toggle('dark-theme'); $('#libraryThemeToggle').textContent = document.body.classList.contains('dark-theme') ? '☀' : '☾'; });
$('#modalClose').addEventListener('click', () => $('#modalBackdrop').hidden = true);
$('#modalBackdrop').addEventListener('click', (event) => { if (event.target === $('#modalBackdrop')) $('#modalBackdrop').hidden = true; });
$$('.canvas-option').forEach(option => option.addEventListener('click', () => { $$('.canvas-option').forEach(item => item.classList.remove('selected')); option.classList.add('selected'); }));
$('#createCanvas').addEventListener('click', () => { $('#modalBackdrop').hidden = true; toast('新画布已创建'); });

const editorGrid = $('#editorGrid');
const editorWrap = $('#editorCanvasWrap');
const zoomSlider = $('#zoomSlider');
const zoomValue = $('#zoomValue');
let canvasZoom = 1;
let canvasOffset = { x: 0, y: 0 };
let panState = null;
let renderCanvasTransform = () => {
  editorGrid.style.transform = `translate(calc(-50% + ${canvasOffset.x}px), calc(-50% + ${canvasOffset.y}px)) scale(${canvasZoom})`;
  zoomSlider.value = Math.round(canvasZoom * 100);
  zoomValue.textContent = `${Math.round(canvasZoom * 100)}%`;
};
const resetCanvasView = () => { canvasZoom = 1; canvasOffset = { x: 0, y: 0 }; renderCanvasTransform(); };
const setCanvasZoom = (nextZoom) => { canvasZoom = Math.max(.5, Math.min(1.8, nextZoom)); renderCanvasTransform(); };
zoomSlider.addEventListener('input', event => setCanvasZoom(Number(event.target.value) / 100));
$('#zoomOut').addEventListener('click', () => setCanvasZoom(canvasZoom - .1));
$('#zoomIn').addEventListener('click', () => setCanvasZoom(canvasZoom + .1));
$('#resetView').addEventListener('click', () => { resetCanvasView(); toast('画布视图已重置'); });
$('#minimapToggle').addEventListener('click', () => { $('#minimapPreview').hidden = !$('#minimapPreview').hidden; });
$('#canvasHelp').addEventListener('click', () => { $('#shortcutModal').hidden = false; if (window.lucide) window.lucide.createIcons(); });
$('#shortcutClose').addEventListener('click', () => { $('#shortcutModal').hidden = true; });
$('#shortcutModal').addEventListener('click', event => { if (event.target === $('#shortcutModal')) $('#shortcutModal').hidden = true; });
$('#generationClose').addEventListener('click', () => { $('#generationPanel').hidden = true; });
$('#generationPromptClose').addEventListener('click', () => { $('#generationPanel').hidden = true; });
editorWrap.addEventListener('pointerdown', event => { if (event.target.closest('.editor-topbar, .editor-toolbar, .canvas-minimap, .minimap-preview, .text-node')) return; panState = { x: event.clientX, y: event.clientY, offsetX: canvasOffset.x, offsetY: canvasOffset.y }; editorWrap.classList.add('is-panning'); editorWrap.setPointerCapture(event.pointerId); });
editorWrap.addEventListener('pointermove', event => { if (!panState) return; canvasOffset = { x: panState.offsetX + event.clientX - panState.x, y: panState.offsetY + event.clientY - panState.y }; renderCanvasTransform(); });
editorWrap.addEventListener('pointerup', event => { panState = null; editorWrap.classList.remove('is-panning'); editorWrap.releasePointerCapture?.(event.pointerId); });
editorWrap.addEventListener('pointercancel', () => { panState = null; editorWrap.classList.remove('is-panning'); });
editorWrap.addEventListener('wheel', event => { event.preventDefault(); setCanvasZoom(canvasZoom + (event.deltaY < 0 ? .05 : -.05)); }, { passive: false });
const minimapPreview = $('#minimapPreview');
const miniViewport = $('#miniViewport');
let minimapPanState = null;
const renderMinimapViewport = () => {
  const left = Math.max(15, Math.min(108, 45 - canvasOffset.x * .055));
  const top = Math.max(29, Math.min(69, 45 - canvasOffset.y * .055));
  miniViewport.style.left = `${left}px`;
  miniViewport.style.top = `${top}px`;
};
const panFromMinimap = (event) => {
  const rect = minimapPreview.getBoundingClientRect();
  const x = Math.max(16, Math.min(124, event.clientX - rect.left - 39));
  const y = Math.max(28, Math.min(82, event.clientY - rect.top - 22));
  canvasOffset = { x: (45 - x) / .055, y: (45 - y) / .055 };
  renderCanvasTransform();
};
miniViewport.addEventListener('pointerdown', event => { minimapPanState = true; miniViewport.setPointerCapture(event.pointerId); event.stopPropagation(); });
minimapPreview.addEventListener('pointermove', event => { if (minimapPanState) panFromMinimap(event); });
minimapPreview.addEventListener('pointerup', event => { minimapPanState = false; miniViewport.releasePointerCapture?.(event.pointerId); });
minimapPreview.addEventListener('pointercancel', () => { minimapPanState = false; });
const originalRenderCanvasTransform = renderCanvasTransform;
renderCanvasTransform = () => { originalRenderCanvasTransform(); renderMinimapViewport(); };
renderCanvasTransform();
const toolNames = { hand: ['移动画布', '按住空白处拖动浏览画布'], text: ['添加文字', '在画布中点击任意位置添加文字节点'], image: ['添加图片', '导入一张参考图片到画布'], video: ['添加视频', '添加视频素材或生成视频节点'], audio: ['添加音乐', '为你的画布添加声音素材'], connector: ['连接节点', '连接不同的创作节点'], upload: ['上传素材', '从本地上传创作素材'], folder: ['打开素材库', '浏览已保存的素材'], palette: ['颜色与样式', '调整画布节点的颜色和样式'], eraser: ['橡皮擦', '清除选中的画布元素'] };
let createTextNode = () => {
  const node = document.createElement('article');
  node.className = 'text-node';
  node.style.left = `${820 - canvasOffset.x / Math.max(canvasZoom, .01)}px`;
  node.style.top = `${555 - canvasOffset.y / Math.max(canvasZoom, .01)}px`;
  node.innerHTML = `<div class="text-node-head"><button class="text-node-generate"><i data-lucide="image"></i> 生图</button></div><textarea class="text-node-input" placeholder="双击编辑文字"></textarea><span class="node-status">文本节点为空</span>`;
  editorGrid.appendChild(node);
  $('.canvas-empty-hint')?.remove();
  if (window.lucide) window.lucide.createIcons();
  const input = $('.text-node-input', node);
  const status = $('.node-status', node);
  input.focus();
  input.addEventListener('input', () => { const hasText = input.value.trim().length > 0; status.textContent = hasText ? '已输入文本 · 可生成' : '文本节点为空'; status.classList.toggle('has-text', hasText); });
  $('.text-node-generate', node).addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) { toast('文本节点为空，请输入文字'); input.focus(); return; }
    $('#generationPrompt').value = text;
    $('#promptChipCount').textContent = '1';
    $('#generationPanel').hidden = false;
    if (window.lucide) window.lucide.createIcons();
  });
  return node;
};
$$('.tool-button').forEach(button => button.addEventListener('click', () => {
  const tool = button.dataset.tool;
  if (tool === 'undo' || tool === 'redo') { toast(tool === 'undo' ? '当前没有可撤销的操作' : '当前没有可重做的操作'); return; }
  $$('.tool-button').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  const [title, description] = toolNames[tool] || ['画布工具', '工具已选择'];
  $('#toolPopoverTitle').textContent = title;
  $('#toolPopoverText').textContent = description;
  $('#toolPopover').hidden = false;
  window.clearTimeout(window.toolPopoverTimer);
  window.toolPopoverTimer = window.setTimeout(() => { $('#toolPopover').hidden = true; }, 2300);
  if (tool === 'text') createTextNode();
  if (tool === 'upload') toast('请选择要上传的素材');
}));
$('#generateAction').addEventListener('click', () => {
  const prompt = $('#generationPrompt').value.trim();
  if (!prompt) { toast('文本节点为空，请输入文字'); return; }
  toast('已提交生图任务，正在生成');
  $('#generateAction').innerHTML = '<i data-lucide="loader-circle"></i> 生成中...';
  if (window.lucide) window.lucide.createIcons();
  window.setTimeout(() => { $('#generateAction').innerHTML = '<i data-lucide="check"></i> 生成完成'; if (window.lucide) window.lucide.createIcons(); toast('图片生成完成'); }, 2200);
});
$('#editorThemeToggle').addEventListener('click', () => { canvasEditorView.classList.toggle('editor-dark'); $('#editorThemeToggle').textContent = canvasEditorView.classList.contains('editor-dark') ? '☀' : '☾'; });

const runGeneration = () => {
  const status = $('.preview-status');
  status.textContent = '生成中 · 预计 8 秒';
  status.style.color = '#2dbde9';
  toast('已提交生成任务，正在准备画面');
  window.setTimeout(() => { status.textContent = '生成完成'; status.style.color = '#42b979'; toast('图片生成完成，可以继续微调'); }, 2300);
};
$('#generateImage').addEventListener('click', runGeneration);
$('#quickGenerate').addEventListener('click', runGeneration);
$('#enhancePrompt').addEventListener('click', () => { const input = $('#promptInput'); input.value += '，画面层次丰富，细节清晰，专业视觉设计'; toast('描述已优化'); });
$('#uploadReference').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', (event) => { if (event.target.files[0]) toast(`已添加参考图：${event.target.files[0].name}`); });
$('#createVideo').addEventListener('click', () => { setPage('video'); toast('视频创作台已准备好'); });
$('#newPrompt').addEventListener('click', () => { setPage('prompts'); toast('请在下方创建你的提示词'); $('#createPromptCard').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
$('#createPromptCard').addEventListener('click', () => toast('新提示词编辑器即将打开'));

$('#promptSearch').addEventListener('input', (event) => {
  const term = event.target.value.trim().toLowerCase();
  $$('.prompt-card:not(.create-prompt)').forEach(card => { card.style.display = card.textContent.toLowerCase().includes(term) ? '' : 'none'; });
});
$$('.filter').forEach(button => button.addEventListener('click', () => {
  $$('.filter').forEach(item => item.classList.remove('active')); button.classList.add('active');
  const filter = button.textContent.trim();
  $$('.prompt-card:not(.create-prompt)').forEach(card => { card.style.display = filter === '全部' || card.dataset.tags.includes(filter) ? '' : 'none'; });
}));
$('#uploadAsset').addEventListener('click', () => $('#assetInput').click());
$('#uploadPlaceholder').addEventListener('click', () => $('#assetInput').click());
$('#assetInput').addEventListener('change', (event) => { if (event.target.files[0]) toast(`素材已上传：${event.target.files[0].name}`); });
$$('.ratio').forEach(button => button.addEventListener('click', () => { $$('.ratio').forEach(item => item.classList.remove('active')); button.classList.add('active'); }));
$('.toggle').addEventListener('click', (event) => { event.currentTarget.classList.toggle('on'); toast(event.currentTarget.classList.contains('on') ? '自动保存已开启' : '自动保存已关闭'); });
$$('.stepper button').forEach(button => button.addEventListener('click', () => { const value = $('.stepper b'); value.textContent = Math.max(1, Math.min(8, Number(value.textContent) + (button.textContent === '+' ? 1 : -1))); }));

if (window.lucide) window.lucide.createIcons();

// Interactive generation graph layer.
const connectionLayer = $('#connectionLayer');
const modelMenu = $('#modelMenu');
const settingsPopover = $('#imageSettingsPopover');
const generationPanel = $('#generationPanel');
let generationNode = null;
let activeImageNode = null;
let activeNode = null;
let generationSettings = { quality: 'auto', aspect: '1:1', count: 3 };
let generationModel = 'gpt-image-1';

const setNodeSelected = (node) => {
  $$('.text-node, .generation-node, .image-result-node').forEach(item => item.classList.remove('selected'));
  activeNode = node;
  node?.classList.add('selected');
  if (node?.classList.contains('image-result-node')) {
    activeImageNode = node;
    positionNodeActions(node);
    $('#nodeActions').hidden = false;
  } else {
    $('#nodeActions').hidden = true;
  }
};

const getNodePoint = (node, side) => ({
  x: node.offsetLeft + (side === 'right' ? node.offsetWidth : 0),
  y: node.offsetTop + node.offsetHeight / 2
});

const drawConnection = (source, target, muted = false) => {
  if (!source || !target) return;
  const start = getNodePoint(source, 'right');
  const end = getNodePoint(target, 'left');
  const distance = Math.max(70, Math.abs(end.x - start.x) * .42);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.classList.add('connection-path');
  if (muted) path.classList.add('muted');
  path.dataset.source = source.dataset.nodeId || '';
  path.dataset.target = target.dataset.nodeId || '';
  path.setAttribute('d', `M ${start.x} ${start.y} C ${start.x + distance} ${start.y}, ${end.x - distance} ${end.y}, ${end.x} ${end.y}`);
  connectionLayer.appendChild(path);
};

const refreshConnections = () => {
  connectionLayer.replaceChildren();
  const textNodes = $$('.text-node');
  textNodes.forEach(node => {
    if (generationNode) drawConnection(node, generationNode, node.classList.contains('selected') === false);
  });
  $$('.image-result-node').forEach(node => {
    if (generationNode) drawConnection(generationNode, node, node !== activeImageNode);
  });
};

const attachNodeDrag = (node) => {
  let drag = null;
  node.addEventListener('pointerdown', event => {
    if (event.target.closest('button, textarea, input')) return;
    event.stopPropagation();
    setNodeSelected(node);
    drag = { x: event.clientX, y: event.clientY, left: node.offsetLeft, top: node.offsetTop };
    node.setPointerCapture(event.pointerId);
  });
  node.addEventListener('pointermove', event => {
    if (!drag) return;
    node.style.left = `${drag.left + (event.clientX - drag.x) / canvasZoom}px`;
    node.style.top = `${drag.top + (event.clientY - drag.y) / canvasZoom}px`;
    refreshConnections();
    if (node === activeImageNode) positionNodeActions(node);
  });
  node.addEventListener('pointerup', event => { drag = null; node.releasePointerCapture?.(event.pointerId); });
  node.addEventListener('pointercancel', () => { drag = null; });
  node.addEventListener('click', event => { if (!event.target.closest('button, textarea, input')) setNodeSelected(node); });
};

const positionNodeActions = (node) => {
  if (!node) return;
  const rect = node.getBoundingClientRect();
  const actions = $('#nodeActions');
  actions.style.left = `${Math.max(10, Math.min(window.innerWidth - actions.offsetWidth - 10, rect.left + rect.width / 2))}px`;
  actions.style.top = `${Math.max(72, rect.top - 52)}px`;
  actions.style.bottom = 'auto';
  actions.style.transform = 'translateX(-50%)';
};

const createGenerationNode = () => {
  if (generationNode) return generationNode;
  generationNode = document.createElement('article');
  generationNode.className = 'generation-node';
  generationNode.dataset.nodeId = 'generation-node';
  generationNode.style.left = '1160px';
  generationNode.style.top = '500px';
  generationNode.innerHTML = `<div class="generation-node-title"><strong>生成配置</strong><span class="node-type-badge">生图</span></div><div class="generation-node-tabs"><span class="active">▧ 生图</span><span>□ 文本</span><span>▣ 视频</span><span>♬ 音频</span></div><div class="generation-node-chips"><span>提示词 <b id="nodePromptCount">1</b> 个</span><span>参考图 0 张</span><span>参考视频 0 个</span><span>参考音频 0 个</span></div><div class="generation-node-model"><span>✣ <b class="node-model-name">${generationModel}</b></span><span class="node-settings-summary">${generationSettings.quality} · auto · ${generationSettings.count} 张</span></div><button class="node-generate-button"><i data-lucide="play"></i> 开始生成</button>`;
  editorGrid.appendChild(generationNode);
  attachNodeDrag(generationNode);
  generationNode.querySelector('.node-generate-button').addEventListener('click', () => { setNodeSelected(generationNode); generationPanel.hidden = false; });
  if (window.lucide) window.lucide.createIcons();
  refreshConnections();
  return generationNode;
};

const createGeneratedImageNode = (index) => {
  const node = document.createElement('article');
  node.className = 'image-result-node generated-image';
  node.dataset.nodeId = `image-result-${Date.now()}-${index}`;
  node.style.left = `${1540 + (index % 2) * 330}px`;
  node.style.top = `${430 + Math.floor(index / 2) * 280}px`;
  const art = ['sunset-art', 'lake-art', 'forest-art', 'mountain-art'][index % 4];
  node.innerHTML = `<div class="generated-art ${art}"><span>VOZEB</span></div><span class="image-tag">图片${index + 1}</span>`;
  editorGrid.appendChild(node);
  attachNodeDrag(node);
  node.addEventListener('mouseenter', () => { setNodeSelected(node); });
  node.addEventListener('mouseleave', () => { window.clearTimeout(window.imageActionTimer); window.imageActionTimer = window.setTimeout(() => { if (!node.matches(':hover') && !$('#nodeActions').matches(':hover')) $('#nodeActions').hidden = true; }, 300); });
  return node;
};

const openGenerationForText = (node, text) => {
  createGenerationNode();
  node.classList.add('connected-source');
  $('#generationPrompt').value = text;
  $('#promptChipCount').textContent = '1';
  $('#nodePromptCount').textContent = '1';
  generationPanel.hidden = false;
  setNodeSelected(generationNode);
  refreshConnections();
  if (window.lucide) window.lucide.createIcons();
};

const generateGraphImages = () => {
  const prompt = $('#generationPrompt').value.trim();
  if (!prompt) { toast('文本节点为空，请输入文字'); return; }
  createGenerationNode();
  generationPanel.hidden = true;
  generationNode.classList.add('is-generating');
  generationNode.querySelector('.node-generate-button').innerHTML = '<i data-lucide="loader-circle"></i> 生成中...';
  if (window.lucide) window.lucide.createIcons();
  toast('已开始生成图片，结果会连接到当前节点');
  $$('.generated-image').forEach(node => node.remove());
  refreshConnections();
  window.setTimeout(() => {
    generationNode.classList.remove('is-generating');
    generationNode.querySelector('.node-generate-button').innerHTML = '<i data-lucide="check"></i> 生成完成';
    [0, 1, 2, 3].slice(0, Math.min(4, generationSettings.count)).forEach(index => createGeneratedImageNode(index));
    refreshConnections();
    if (window.lucide) window.lucide.createIcons();
    toast('图片生成完成');
  }, 1600);
};

const originalCreateTextNode = createTextNode;
createTextNode = () => {
  const node = originalCreateTextNode();
  node.dataset.nodeId = `text-node-${Date.now()}`;
  attachNodeDrag(node);
  const input = $('.text-node-input', node);
  const generateButton = $('.text-node-generate', node);
  generateButton.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) { toast('文本节点为空，请输入文字'); input.focus(); return; }
    openGenerationForText(node, text);
  });
  return node;
};

$('#generateAction').addEventListener('click', generateGraphImages);
$('#modelSelect').addEventListener('click', () => { modelMenu.hidden = !modelMenu.hidden; settingsPopover.hidden = true; if (window.lucide) window.lucide.createIcons(); });
$('#settingsSelect').addEventListener('click', () => { settingsPopover.hidden = !settingsPopover.hidden; modelMenu.hidden = true; if (window.lucide) window.lucide.createIcons(); });
$$('#modelMenu [data-model]').forEach(button => button.addEventListener('click', () => { generationModel = button.dataset.model; $('#modelName').textContent = generationModel; const modelLabel = $('.node-model-name', generationNode || document); if (modelLabel) modelLabel.textContent = generationModel; modelMenu.hidden = true; toast(`已切换模型：${generationModel}`); }));
$$('.quality-options button, .count-options button, .aspect-grid button').forEach(button => button.addEventListener('click', () => {
  const group = button.parentElement;
  $$('button', group).forEach(item => item.classList.remove('selected'));
  button.classList.add('selected');
  if (button.dataset.quality) generationSettings.quality = button.dataset.quality;
  if (button.dataset.aspect) generationSettings.aspect = button.dataset.aspect;
  if (button.dataset.count) generationSettings.count = Number(button.dataset.count);
}));
$('#settingsApply').addEventListener('click', () => { $('#settingsSummary').textContent = `${generationSettings.quality} · ${generationSettings.aspect} · ${generationSettings.count} 张`; const settingsLabel = $('.node-settings-summary', generationNode || document); if (settingsLabel) settingsLabel.textContent = `${generationSettings.quality} · ${generationSettings.aspect} · ${generationSettings.count} 张`; settingsPopover.hidden = true; toast('图片参数已更新'); });
$('#assemblePrompt').addEventListener('click', () => { $('#generationPrompt').focus(); toast('输入 @ 可以引用已连接节点'); });
$('#generationPrompt').addEventListener('input', event => { $('#mentionMenu').hidden = !event.target.value.endsWith('@'); });
$$('#mentionMenu [data-mention]').forEach(button => button.addEventListener('click', () => { const prompt = $('#generationPrompt'); prompt.value = `${prompt.value}@${button.dataset.mention} `; $('#mentionMenu').hidden = true; prompt.focus(); }));
document.addEventListener('click', event => { if (!event.target.closest('#modelMenu, #modelSelect')) modelMenu.hidden = true; if (!event.target.closest('#imageSettingsPopover, #settingsSelect')) settingsPopover.hidden = true; });

$$('#nodeActions [data-action]').forEach(button => button.addEventListener('click', () => {
  if (!activeImageNode) return;
  const action = button.dataset.action;
  if (action === 'info') {
    $('#infoPrompt').textContent = $('#generationPrompt').value || '夏日山谷与湖畔的电影感风景';
    $('#infoJson').textContent = JSON.stringify({ id: activeImageNode.dataset.nodeId, type: 'image', size: '1024 x 1024', position: { x: activeImageNode.offsetLeft, y: activeImageNode.offsetTop }, status: 'success', prompt: $('#generationPrompt').value }, null, 2);
    $('#infoModal').hidden = false;
  } else if (action === 'delete') { activeImageNode.remove(); activeImageNode = null; $('#nodeActions').hidden = true; refreshConnections(); toast('图片节点已删除');
  } else if (action === 'save') { toast('图片已存入素材库');
  } else if (action === 'download') { const link = document.createElement('a'); link.href = createDemoImageData(); link.download = 'vozeb-generated.png'; link.click(); toast('图片下载已开始');
  } else if (action === 'edit') { generationPanel.hidden = false; $('#generationPrompt').value = '请基于这张图片进行修改：'; $('#generationPrompt').focus(); toast('已打开图片编辑配置');
  } else if (action === 'copy') { navigator.clipboard?.writeText($('#generationPrompt').value || '夏日山谷与湖畔的电影感风景'); toast('提示词已复制');
  } else if (action === 'reverse') { const node = createTextNode(); $('.text-node-input', node).value = '根据参考图片反推一段适合用于 AI 生图的提示词'; $('.node-status', node).textContent = '已反推提示词'; $('.node-status', node).classList.add('has-text'); refreshConnections(); toast('已创建反推提示词节点');
  } else if (action === 'more') { toast('更多图片操作已打开'); }
}));
$('#infoClose').addEventListener('click', () => { $('#infoModal').hidden = true; });
$('#infoModal').addEventListener('click', event => { if (event.target === $('#infoModal')) $('#infoModal').hidden = true; });
$$('.info-tab').forEach(tab => tab.addEventListener('click', () => { $$('.info-tab').forEach(item => item.classList.remove('active')); tab.classList.add('active'); const json = tab.dataset.infoTab === 'json'; $('#infoDetails').hidden = json; $('#infoJson').hidden = !json; }));
const createDemoImageData = () => { const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eb805e"/><stop offset=".46" stop-color="#768fc7"/><stop offset="1" stop-color="#172d4a"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/><circle cx="680" cy="300" r="145" fill="#ffd68e" opacity=".82"/><path d="M0 720 290 370 490 620 690 290 1024 720v304H0Z" fill="#263d57" opacity=".85"/><text x="512" y="890" text-anchor="middle" font-family="Arial" font-size="42" fill="white" opacity=".8">VOZEB IMAGE</text></svg>`; return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; };
window.addEventListener('resize', () => { if (activeImageNode && !$('#nodeActions').hidden) positionNodeActions(activeImageNode); refreshConnections(); });
