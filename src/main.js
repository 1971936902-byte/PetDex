const navItems = [
  ['home', '首页'], ['studio', '生成工作台'], ['album', '艺术相册'], ['library', '作品库'],
  ['plaza', '云养广场'], ['install', '下载桌宠'], ['pricing', '定制方案'], ['faq', '常见问题'],
];

const pets = [
  ['豆包', '白底花纹，温柔黏人', '#f8f3e6', '#2a211b', '#fffaf3', '基础体验版'],
  ['奶糖', '橘猫，圆脸大眼', '#f7bd69', '#9e5a22', '#fff0d3', '高级陪伴版'],
  ['小银', '银渐层，大胆好奇', '#d7d4c8', '#6c6a66', '#f5f0e8', '高级陪伴版'],
  ['Marni', '贝灵顿梗，温柔安静', '#efe7d6', '#8d7d63', '#f8f1e8', '基础体验版'],
  ['小黑白', '奶牛猫，精神饱满', '#ffffff', '#1d1a18', '#eeeeea', '高级陪伴版'],
  ['领结猫', '白猫咪，戴蝴蝶结', '#fffaf1', '#bd6942', '#f5ede0', '高级陪伴版'],
];

const tiers = [
  ['单次刷新券', '¥1', '重新生成 6 张候选主形象，不影响已购权益。', ['适合只想再挑一版', '不满意可再生成', '快速检查形象方向']],
  ['基础体验版', '¥9.9', '先把宠物带上桌面，适合第一次体验。', ['11 种基础动作', '1 次主形象生成（6 选 1）', '永久宠物码，双端可用', '一次买断，不订阅']],
  ['高级陪伴版', '¥29.9', '更完整的动作与行为模式，推荐上架主推。', ['22 种完整动作（含进阶 11）', '3 种行为模式可切换', '窗口边缘趴伏巡游', '加赠 1 张 ¥9.9 基础版券']],
];

let state = {
  page: location.hash.replace('#', '') || 'home',
  studioPhase: 'empty',
  selected: 0,
  albumSet: 0,
  payTier: tiers[1],
  modal: '',
  petName: '豆包',
  description: '温柔、粘人、好奇，会在桌面边缘安静待着',
  file: null,
  localFile: null,
  formError: '',
  orderId: 'PD-20260612-0918',
  job: null,
  order: null,
  petList: [],
  isLoading: false,
  selectedAction: 'idle',
};

async function apiJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || `请求失败：${response.status}`);
  }
  return data;
}

function skuFromTier(tier) {
  if (!tier) return 'basic';
  if (tier[0].includes('高级')) return 'advanced';
  if (tier[0].includes('刷新')) return 'refresh';
  return 'basic';
}

function currentCandidate() {
  const candidates = state.job?.candidates || [];
  return candidates[state.selected] || null;
}

function escapeAttr(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function qualityWarnings() {
  return state.job?.features?.qualityWarnings || [];
}

function qualityWarningHtml() {
  const warnings = qualityWarnings();
  if (!warnings.length) return '';
  return `<div class="quality-warning"><strong>图片质量提示</strong>${warnings.map((w) => `<p>${w}</p>`).join('')}</div>`;
}

function trustStrip() {
  return `<div class="trust-strip">
    <span>${icon('check')}先看 6 张候选，满意再付费</span>
    <span>${icon('download')}交付宠物码和 .petpack</span>
    <span>${icon('card')}演示支付可完整跑通流程</span>
  </div>`;
}

function petImg(url, alt = '宠物图') {
  return `<img class="generated-pet-img" src="${url}" alt="${alt}" loading="lazy">`;
}

function actionEntries() {
  return Object.entries(state.job?.actions || {}).filter(([key, value]) => key !== 'short_video' && value?.frames?.length);
}

function shortVideoDelivery() {
  return state.job?.actions?.short_video || null;
}

function currentActionEntry() {
  const entries = actionEntries();
  return entries.find(([key]) => key === state.selectedAction) || entries[0] || null;
}

function actionPlayer(action, compact = false) {
  if (!action?.frames?.length) {
    return `<div class="animation-empty">${petAvatar(pets[state.selected] || pets[0])}<span>等待动作帧</span></div>`;
  }
  const duration = Math.max(0.6, action.frames.length / (action.fps || 8));
  return `<div class="action-player ${compact ? 'compact' : ''}" style="--frames:${action.frames.length};--duration:${duration}s">
    ${action.frames.map((frame, i) => `<img src="${frame}" alt="${action.label || '动作'} 第 ${i + 1} 帧" style="--i:${i}">`).join('')}
  </div>`;
}

async function createDemoCatFile() {
  const canvas = document.createElement('canvas');
  canvas.width = 420;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#16ded7';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#8b8179';
  ctx.beginPath();
  ctx.arc(210, 220, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(142, 160);
  ctx.lineTo(174, 84);
  ctx.lineTo(202, 160);
  ctx.moveTo(218, 160);
  ctx.lineTo(246, 84);
  ctx.lineTo(278, 160);
  ctx.fill();
  ctx.fillStyle = '#f1a940';
  ctx.beginPath();
  ctx.arc(178, 214, 14, 0, Math.PI * 2);
  ctx.arc(242, 214, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a211b';
  ctx.beginPath();
  ctx.arc(178, 214, 5, 0, Math.PI * 2);
  ctx.arc(242, 214, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(210, 242, 5, 0, Math.PI * 2);
  ctx.fill();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new File([blob], 'demo-cat.png', { type: 'image/png' });
}

function icon(name) {
  const map = {
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3-9 M13.73 21a2 2 0 0 1-3.46 0',
    down: 'M6 9l6 6 6-6',
    image: 'M4 5h16v14H4z M8 13l2.5-3 3 4 2-2.5L20 17 M8 8h.01',
    check: 'M20 6L9 17l-5-5',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8',
    plus: 'M12 5v14 M5 12h14',
    refresh: 'M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8 M18 2v4h-4 M6 22v-4h4',
    play: 'M8 5v14l11-7z',
    paw: 'M11 17.5c-1.5 1.7-4.9.9-5.2-1.5-.2-1.8 1.5-3 3.3-2.7 1.1.2 2 1 2.9 1 1 0 1.8-.8 2.9-1 1.8-.3 3.5.9 3.3 2.7-.3 2.4-3.7 3.2-5.2 1.5-.5-.6-1.5-.6-2 0z M7.5 9.5c.8 0 1.5-.9 1.5-2s-.7-2-1.5-2S6 6.4 6 7.5s.7 2 1.5 2z M16.5 9.5c.8 0 1.5-.9 1.5-2s-.7-2-1.5-2S15 6.4 15 7.5s.7 2 1.5 2z M11 7c.8 0 1.5-.9 1.5-2S11.8 3 11 3 9.5 3.9 9.5 5 10.2 7 11 7z M13 7c.8 0 1.5-.9 1.5-2S13.8 3 13 3s-1.5.9-1.5 2S12.2 7 13 7z',
    card: 'M4 7h16v10H4z M4 10h16',
  };
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${map[name]}"/></svg>`;
}

function petAvatar(pet = pets[0], small = false) {
  return `<div class="pet-avatar ${small ? 'small' : ''}" style="--fur:${pet[2]};--mark:${pet[3]};--belly:${pet[4]}">
    <span class="ear left"></span><span class="ear right"></span>
    <span class="head"><span class="patch"></span><span class="eye left"></span><span class="eye right"></span><span class="nose"></span></span>
    <span class="body"></span><span class="tail"></span>
  </div>`;
}

function header() {
  return `<header class="topbar">
    <button class="brand" data-page="home"><span class="brand-mark">${icon('paw')}</span><span><strong>伴生造物 · MyPet Studio</strong><small>Desktop pet companion</small></span></button>
    <nav class="nav">${navItems.map(([id, label]) => `<button class="${state.page === id ? 'active' : ''}" data-page="${id}">${label}</button>`).join('')}</nav>
    <div class="account"><span class="status">模型已连接</span><button class="icon-btn">${icon('bell')}</button><button class="login">1971936902... ${icon('down')}</button></div>
    <button class="float-cta" data-page="studio">开始生成</button>
  </header>`;
}

function sectionHead(title, text, compact = false) {
  return `<div class="section-head ${compact ? 'compact' : ''}"><p class="eyebrow">${title}</p><h1>${title}</h1><p>${text}</p></div>`;
}

function petCard(pet) {
  return `<article class="pet-card"><div class="compare"><div class="photo-bg">${petAvatar(pet, true)}</div><div class="cyan">${petAvatar(pet)}</div></div><div class="pet-card-body"><h3>${pet[0]}</h3><p>${pet[1]}</p><div class="chips"><span>待机</span><span>走动</span><span>打瞌睡</span><span>陪伴</span></div></div></article>`;
}

function home() {
  return `<main class="home page">
    <section class="hero hero-upgraded">
      <div class="hero-copy">
        <p class="eyebrow">AI 桌宠生成 · 先预览，再付费</p>
        <h1>把你家的宠物，<span>真正带到桌面上。</span></h1>
        <p class="lead">上传一张清晰照片，先生成 6 张可选主形象；满意后再购买动作包，获得宠物码、资源包和桌面客户端导入体验。</p>
        <div class="hero-stats"><b>127</b><span>只宠物已生成</span><b>6选1</b><span>先看像不像</span><b>¥9.9</b><span>低价上手</span></div>
        <div class="actions"><button class="primary" data-page="studio">${icon('upload')}上传宠物照片</button><button class="secondary" data-page="pricing">查看套餐</button></div>
        <small>测试环境为模拟支付；真实上架前接入支付回调和订单验签。</small>
        ${trustStrip()}
      </div>
      <div class="hero-board">
        <div class="desktop-window"><span></span><span></span><span></span><div>${petAvatar(pets[2])}</div></div>
        <div class="floating-card one"><strong>候选生成</strong><p>6 张主形象</p></div>
        <div class="floating-card two"><strong>动作包</strong><p>待机 / 走动 / 趴伏</p></div>
        <div class="floating-card three"><strong>交付</strong><p>.petpack + 宠物码</p></div>
      </div>
    </section>
    <section class="showcase">
      <div class="section-row"><div><p class="eyebrow">真实案例</p><h2>它们正在陪伴自己的主人</h2></div><button class="secondary" data-page="studio">生成你家宠物</button></div>
      <div class="pet-grid">${pets.map(petCard).join('')}</div>
    </section>
    <section class="value-band">
      <h2>不是生成一张图，而是交付一只可陪伴的桌宠。</h2>
      <p>伴生造物的购买理由是“长期陪伴资产”：主形象、动作帧、宠物码、资源包、桌面客户端一起完成闭环。</p>
    </section>
    <section class="promise-grid">
      ${[
        ['先预览', '候选图免费生成，先判断像不像，再决定是否购买动作包。'],
        ['可找回', '宠物码和订单状态进入作品库，换设备也能重新下载资源包。'],
        ['有边界', '上传图片会检测水印和质量风险，避免把不适合商用的素材直接带入交付。'],
      ].map(([title, text]) => `<article><h3>${title}</h3><p>${text}</p></article>`).join('')}
    </section>
    <section class="steps">${['上传照片', '生成候选', '选择套餐', '下载陪伴'].map((s, i) => `<article><b>0${i + 1}</b><h3>${s}</h3><p>${['一张清晰正脸或自然坐姿照片即可。', '免费先看方向，挑最像的一张。', '基础版适合尝鲜，高级版适合上架主推。', '导入宠物码或 .petpack，桌宠出现在桌面。'][i]}</p></article>`).join('')}</section>
  </main>`;
}

function uploadForm() {
  const fileText = state.file
    ? `已选择 ${state.file.name} · ${state.file.size} · ${state.file.type}`
    : '支持 JPG、PNG、WebP；建议使用清晰正脸或自然坐姿照片';
  const uploadPreview = state.file ? `<span class="upload-preview">${petAvatar(pets[2], true)}</span>` : icon('image');
  return `<aside class="panel form-panel"><h2>上传宠物照片</h2><label>宠物名字<input value="${escapeAttr(state.petName)}" data-field="petName" aria-label="宠物名字"></label><label>性格描述<input value="${escapeAttr(state.description)}" data-field="description" aria-label="性格描述"></label><label class="upload-box">${uploadPreview}<strong>选择一张宠物照片</strong><span>${fileText}</span><input type="file" accept="image/jpeg,image/png,image/webp"></label>${state.formError ? `<p class="form-error">${state.formError}</p>` : ''}<button class="secondary subtle" data-action="demo-file">使用示例照片体验</button><div class="upload-tips"><strong>照片建议</strong><p>优先使用无水印、主体完整、背景简单的宠物照片；截图、低清图和带字图片会降低相似度。</p></div><label class="check-row"><input type="checkbox" checked>我确认拥有该照片的使用权<span>请不要上传未授权素材、明星图片或带版权风险的商业图库图。</span></label><label class="check-row"><input type="checkbox" checked>用右跑动作镜像生成左跑<span>适合左右对称的猫狗，节省生成时间</span></label><div class="row-actions"><button class="primary" data-action="generate">开始生成桌宠</button><button class="secondary" data-action="restore">继续上次任务</button></div><p class="microcopy">任务会保存为本地草稿；生成完成后原始上传图会从服务端清理。</p></aside>`;
}

function studioPreview() {
  if (state.studioPhase === 'generating') return `<div class="generate-work"><div class="split-title"><div><h2>${state.petName}，正在准备候选</h2><p>正在生成 6 张主形象，完成后从中选一张最像的。</p></div><span class="pill">1-2 分钟</span></div><div class="generation-canvas"><span>等待你的第一只桌宠</span></div><div class="pipeline">${['上传照片', '生成候选', '相似度检查', '进入选择'].map((s, i) => `<div class="${i < 2 ? 'active' : ''}"><b>${i + 1}</b><span>${s}</span></div>`).join('')}</div></div>`;
  if (state.studioPhase === 'motion') {
    return `<div class="generate-work"><div class="split-title"><div><h2>${state.petName}，连续动作生成中</h2><p>正在制作多种透明 PNG 动作帧，并打包 .petpack。</p></div><span class="pill">透明背景</span></div><div class="motion-canvas">${Array.from({ length: 8 }).map((_, i) => `<span style="--i:${i}">${petAvatar(pets[2], true)}</span>`).join('')}</div><div class="pipeline">${['确认形象', '生成连续动作', '透明帧打包', '完成交付'].map((s, i) => `<div class="${i < 3 ? 'active' : ''}"><b>${i + 1}</b><span>${s}</span></div>`).join('')}</div></div>`;
  }
  if (state.studioPhase === 'prototype') {
    const candidates = state.job?.candidates || [];
    const cards = candidates.length
      ? candidates.map((c, i) => `<button class="candidate ${state.selected === i ? 'selected' : ''}" data-select="${i}">${petImg(c.url, c.label)}<span>${c.label} · ${Math.round((c.score || 0.8) * 100)}%</span></button>`).join('')
      : pets.map((p, i) => `<button class="candidate ${state.selected === i ? 'selected' : ''}" data-select="${i}">${petAvatar(p)}<span>版本${String.fromCharCode(65 + i)}</span></button>`).join('');
    return `<div class="prototype"><h2>${state.petName}，选一张最像的</h2>${qualityWarningHtml()}<div class="candidate-grid">${cards}</div><div class="row-actions"><button class="primary wide" data-action="tier">就是它，选套餐 →</button><button class="secondary wide" data-action="generate">不太像，重新生成六张</button></div><p class="hint">候选图由服务器本地 TinyPetVision-Pillow 管线生成，未调用云端模型。</p></div>`;
  }
  if (state.studioPhase === 'tier') {
    const candidate = currentCandidate();
    return `<div>${sectionHead('立即开始制作全套动作', '已选中主形象，选择套餐后进入支付。', true)}${qualityWarningHtml()}<div class="selected-banner">${candidate ? petImg(candidate.url, '已选候选') : petAvatar(pets[state.selected], true)}<span>${state.petName} · 已确认主形象 · 任务 ${state.job?.id || 'PDX-JOB-018'}</span></div><div class="tier-grid studio-tiers">${tiers.slice(1).map((t, i) => tierCard(t, i === 1, true)).join('')}</div><div class="purchase-notes"><span>买断制，不订阅</span><span>同一任务不重复扣款</span><span>支付后生成动作帧和资源包</span></div><p class="hint">宠物码长期有效，可换设备重新下载。若生成失败，保留订单和任务记录便于人工处理。</p></div>`;
  }
  if (state.studioPhase === 'pay') return payPanel();
  if (state.studioPhase === 'done') return donePanel();
  return `<div class="center-state"><div class="mascot">${petAvatar(pets[0], true)}</div><h2>等待你的第一只宠物</h2><p>上传照片后会生成 6 张主形象候选，满意后再进入套餐和完整制作。</p><div class="chips"><span>待机</span><span>走路</span><span>睡觉</span><span>伸懒腰</span></div><small>账号剩余 2 次（免费 2 · 购买 0）</small><a data-page="pricing">点这里购买套餐</a></div>`;
}

function tierCard(tier, recommended = false, studio = false) {
  return `<article class="tier ${recommended ? 'recommended' : ''}"><span>${recommended ? '推荐' : '套餐'}</span><h3>${tier[0]}</h3><b>${tier[1]}</b><p>${tier[2]}</p><ul>${tier[3].map(x => `<li>${x}</li>`).join('')}</ul><button class="${recommended ? 'primary' : 'secondary'}" data-action="pay" data-tier="${tiers.indexOf(tier)}">${studio ? '选择' : '开始体验'}</button></article>`;
}

function payPanel() {
  const order = state.order;
  return `<div class="pay-shell"><div class="pay-card"><p class="eyebrow">${state.petName} · 订单 ${order?.id || state.orderId}</p><h2>付款信息 ${state.payTier[1]}（${state.payTier[0]}）</h2><div class="pay-methods"><button class="selected">支付宝 <small>扫码支付</small></button><button disabled>微信 <small>暂不支持</small></button></div><div class="qr"><span>MyPet<br>QR</span></div><p>请使用支付宝扫码支付</p><div class="order-status"><span>订单状态</span><b>${order?.status || 'pending_payment'}</b></div><div class="countdown">支付倒计时 <b>29:42</b></div><div class="pay-assurance"><span>当前为模拟支付</span><span>真实支付将以服务端回调为准</span><span>失败订单可联系客服按任务号处理</span></div><button class="primary wide" data-action="motion">${state.isLoading ? '正在确认并生成...' : '我已支付，检查状态'}</button><button class="text-btn" data-action="cancel-order">取消订单</button><p class="microcopy">刷新页面后可通过订单号恢复；同一任务只保留一笔待支付订单，避免重复扣款。</p></div></div>`;
}

function donePanel() {
  const job = state.job || {};
  const video = shortVideoDelivery();
  if (video) {
    const videoUrl = video.url || job.petpackUrl || '#';
    return `<div class="done-layout action-done video-done"><div class="pet-result video-stage"><video class="result-video" src="${videoUrl}" controls autoplay muted loop playsinline></video><p>${video.label || 'HunyuanVideo short motion'} · ${video.durationSeconds || 4}s · ${video.fps || 24}fps</p></div><div class="delivery-card"><h2>${job.petName || 'Pet'} short video is ready.</h2><p>${job.petName || 'Pet'} · ${state.payTier[0]} · ${video.sourceModel || 'hunyuanvideo-1.5'}</p><div class="code">${job.petCode || 'MP-6NDT-PUQB'}</div><div class="copy-row"><input value="${job.petCode || 'MP-6NDT-PUQB'}" readonly><button class="secondary">Copy</button></div><div class="next-steps"><strong>HunyuanVideo MP4</strong><p>The current delivery is an MP4 short video for motion review: identity preservation, natural continuity, and visible limb movement. Transparent frames and GIF export can be extracted after the video quality is stable.</p></div><div class="row-actions"><a class="primary link-button" href="${videoUrl}" download>Download MP4</a><button class="secondary" data-page="install">Desktop client</button></div><button class="secondary wide" data-modal="share">Share card</button><button class="secondary wide">Upgrade later</button><button class="text-btn" data-page="library">Open library</button></div></div>`;
  }
  const actions = actionEntries();
  const active = currentActionEntry();
  const activeKey = active?.[0] || 'idle';
  const activeAction = active?.[1] || null;
  const petpackUrl = job.petpackUrl || '#';
  const actionButtons = actions.length
    ? actions.map(([key, action]) => `<button class="${key === activeKey ? 'active' : ''}" data-action-preview="${key}"><strong>${action.label || key}</strong><span>${action.frameCount || action.frames?.length || 0} 帧 · ${action.fps || 8}fps · ${action.transparent ? '透明' : '非透明'}</span></button>`).join('')
    : `<button class="active"><strong>待机呼吸</strong><span>等待动作资源</span></button>`;
  return `<div class="done-layout action-done"><div class="pet-result transparent-stage"><div class="stage-grid"></div>${actionPlayer(activeAction)}<p>${activeAction?.label || '动作预览'} · 透明 PNG 连续帧</p></div><div class="delivery-card"><h2>${job.petName || '豆包'}，准备好了。</h2><p>${job.petName || '豆包'} · ${state.payTier[0]} · ${job.status || 'ready'}</p><div class="code">${job.petCode || 'MP-6NDT-PUQB'}</div><div class="copy-row"><input value="${job.petCode || 'MP-6NDT-PUQB'}" readonly><button class="secondary">复制</button></div><div class="action-list" aria-label="动作类型列表">${actionButtons}</div><div class="next-steps"><strong>下一步</strong><p>选择动作可直接预览动画。下载 .petpack 后，客户端会按这些透明 PNG 帧播放桌宠行为。</p></div><div class="row-actions"><a class="primary link-button" href="${petpackUrl}" download>下载 .petpack</a><button class="secondary" data-page="install">下载客户端</button></div><button class="secondary wide" data-modal="share">生成分享卡</button><button class="secondary wide">补 ¥20 升级完整版 →</button><button class="text-btn" data-page="library">去作品库查看</button></div></div>`;
}

function studio() {
  return `<main class="page studio">${sectionHead('生成工作台', '上传一张照片，先生成 6 张主形象候选；确认最像的一张后选套餐，再制作全套动作。')}<div class="studio-layout">${uploadForm()}<section class="panel preview-panel">${studioPreview()}</section></div></main>`;
}

function album() {
  const sets = [['A', '手绘萌宠'], ['B', '清新日常'], ['C', '风格大片'], ['D', '国风祥瑞'], ['E', 'Q版贴纸']];
  return `<main class="page two-col">${sectionHead('艺术相册', '上传宠物正视图，先免费预览，再生成整套高清写真。')}<div class="two-layout"><section class="panel"><h2>创作台</h2><div class="set-tabs">${sets.map((s, i) => `<button class="${i === state.albumSet ? 'active' : ''}" data-set="${i}">${s[0]}</button>`).join('')}</div><label class="upload-box">${icon('upload')}<strong>上传正视图</strong><span>支持 JPG、PNG、WebP</span></label><button class="primary">生成免费预览</button></section><section class="panel"><h2>${sets[state.albumSet][1]}</h2><div class="album-grid">${Array.from({ length: 10 }).map((_, i) => `<article><span>${String(i + 1).padStart(2, '0')}</span>${petAvatar(pets[i % pets.length], true)}<b>${sets[state.albumSet][1]}模板</b></article>`).join('')}</div></section></div></main>`;
}

function library() {
  const works = state.petList.length
    ? state.petList.map((job) => {
        const preview = job.selectedCandidateUrl || job.candidates?.[0]?.url;
        return `<article class="work-card"><div class="cyan">${preview ? petImg(preview, job.petName) : '<div class="empty-work">生成中</div>'}</div><h3>${job.petName}</h3><p>状态：${job.status}</p><p>套餐：${job.tier || '未选择'} · 宠物码 ${job.petCode || '待生成'}</p><div class="work-actions"><button class="secondary">复制宠物码</button>${job.petpackUrl ? `<a class="secondary link-button" href="${job.petpackUrl}" download>下载 .petpack</a>` : '<button class="secondary" data-page="studio">继续任务</button>'}<button class="secondary">升级高级版</button></div></article>`;
      }).join('')
    : `<article class="work-card"><div class="empty-work">暂无后端作品</div><h3>先生成一只宠物</h3><p>上传猫咪照片后，这里会显示真实生成任务。</p><button class="secondary" data-page="studio">开始生成</button></article>`;
  return `<main class="page">${sectionHead('作品库', '每只生成过的宠物都可预览、继续修复和下载，作品库会保留你的每一次创作结果。')}<div class="section-row"><h2>公开作品</h2><p>精选 6 个公开作品，点击可查看可下载</p></div><div class="pet-grid library-grid">${pets.map(petCard).join('')}</div><div class="section-row my-work-title"><h2>我的作品</h2><button class="secondary" data-page="studio">生成新的宠物</button></div><div class="work-grid">${works}</div><section class="panel login-guide"><h2>未登录也可以看公开案例</h2><p>登录邮箱后可保存订单、恢复任务、跨设备找回宠物码。</p><button class="primary">登录并同步作品</button></section></main>`;
}

function plaza() {
  return `<main class="plaza"><div class="plaza-bar"><button data-page="home">返回</button><strong>MyPet 云养广场（增长试验）</strong><div><button class="active">1</button><button>2</button><button>3</button></div></div><div class="stage">${Array.from({ length: 22 }).map((_, i) => `<button class="stage-pet" style="left:${8 + (i * 11) % 84}%;top:${18 + (i * 17) % 58}%">${petAvatar(pets[i % pets.length], true)}</button>`).join('')}</div><div class="plaza-tip">P2 增长模块：目前只做展示试验，互动、同步和审核后续接入。</div></main>`;
}

function install() {
  return `<main class="page install-page">${sectionHead('下载一次，所有宠物都在。', '客户端和宠物资源包分开保存，客户端负责在桌面展示和管理。')}<div class="install-hero"><div><p class="eyebrow">MyPet Desktop Client</p><h2>客户端和宠物资源包分开保存</h2><p>Windows 优先交付，macOS 版本作为预告或内测包，不复用任何竞品下载链接。</p></div><div class="desktop-preview">${petAvatar(pets[0], true)}</div></div><div class="download-list"><article class="download-feature"><h2>MyPet Windows 64位</h2><p>推荐下载，支持宠物码导入、.petpack 拖入、托盘退出和至少 3 个基础动作。</p><button class="primary">下载</button></article><article><h3>macOS Apple Silicon</h3><p>内测预告，适用于 M 系列芯片。</p><button class="secondary">预约内测</button></article><article><h3>macOS Intel</h3><p>内测预告，适用于 Intel 芯片 Mac。</p><button class="secondary">预约内测</button></article></div><section class="support-note"><h2>安装前请确认</h2><p>当前网页已能生成资源包；客户端下载按钮在 MVP 阶段可接真实安装包地址。若暂未提供安装包，请先保存 .petpack 和宠物码，后续客户端发布后可直接导入。</p></section><section class="steps install-steps">${['下载并解压', '导入宠物码或 .petpack', '处理系统安全提示'].map((s, i) => `<article><b>${i + 1}</b><h3>${s}</h3><p>${['Windows 如出现 SmartScreen，确认来源后选择“仍要运行”。', '在客户端输入宠物码 MP-XXXX 或拖入 .petpack 资源包。', 'macOS 未签名提示会在正式签名版发布后减少。'][i]}</p></article>`).join('')}</section></main>`;
}

function pricing() {
  return `<main class="page">${sectionHead('为你家的宠物，选一种陪伴方式。', '付费购买的不是一张图，而是一只可安装到桌面、永久陪你工作的宠物。')}<div class="tier-grid pricing">${tiers.slice(1).map((t, i) => tierCard(t, i === 1)).join('')}<article class="tier"><span>专属服务</span><h3>专属定制</h3><b>按需报价</b><p>一对一沟通，从外形到性格全程定制。</p><ul><li>定制外形、配色和像素细节</li><li>独特动作设计与性格表达</li><li>专属资源包与后续更新权益</li></ul><button class="secondary">咨询定制</button></article></div><p class="hint center">生成不满意可重试 · 宠物码永久有效 · 可换设备重新下载</p></main>`;
}

function faq() {
  const items = [
    ['每次生成都会成功吗？不满意能重来吗？', '生成失败可重试；如果主形象不满意，可以使用候选刷新券重新生成 6 张候选。'],
    ['¥9.9 基础版和 ¥29.9 高级版有什么区别？', '基础版适合首次体验，高级版包含更多动作、行为模式和窗口边缘互动。'],
    ['付款后多久能拿到桌宠？支持哪些付款方式？', '初版为 mock/人工确认支付；真实上线后优先支持支付宝扫码，并保留订单状态复查。'],
    ['生成失败 / 卡了很久没动，怎么办？', '任务 ID 会保存在本地，可回到工作台继续任务或联系客服处理。'],
    ['桌宠支持哪些系统？最低要求是什么？', 'MVP 优先 Windows 64 位；macOS 作为内测或后续版本。'],
    ['macOS 安装提示“无法验证开发者”怎么办？', '未签名内测包可能出现安全提示，正式版会推进签名和 notarization。'],
    ['换电脑了，还能用同一只桌宠吗？', '可以，通过宠物码或 .petpack 资源包在新设备导入。'],
    ['能不能传朋友的宠物照片、明星宠物、动漫角色？', '请只上传你拥有授权的宠物照片，不建议上传明星、动漫角色或他人无授权素材。'],
    ['照片会保存多久？隐私怎么处理？', 'MVP 应明确删除周期；生产环境建议原图仅用于生成，完成后删除或允许用户主动删除。'],
    ['怎么联系你们？响应快吗？', '可通过页面客服入口或 QQ 3790462593 联系，支付和安装问题优先处理。'],
  ];
  return `<main class="page narrow">${sectionHead('常见问题', '关于生成、付费、安装的常见疑问。还有问题加 QQ 3790462593。')}${items.map(([q,a]) => `<details class="faq-item"><summary>${q}</summary><p>${a}</p></details>`).join('')}</main>`;
}

function shareModal() {
  if (state.modal !== 'share') return '';
  return `<div class="modal"><div class="share-card-wrap"><button class="modal-close" data-modal="">×</button><p class="eyebrow">完成，可保存或复制</p><div class="share-card"><p><b>MyPet Studio</b> · 桌面宠物</p><h2>这是我家豆包<br><span>住进我桌面</span></h2><small>它现在住在我的电脑里啦</small><div class="cyan big">${petAvatar(pets[state.selected])}</div><p class="slogan">猫猫狗狗都能做，做的就是你家那只</p></div><div class="row-actions"><button class="primary">保存图片</button><button class="secondary">复制图片</button></div></div></div>`;
}

function render() {
  const pages = { home, studio, album, library, plaza, install, pricing, faq };
  document.getElementById('root').innerHTML = header() + (pages[state.page] || home)() + petAvatar(pets[1], true) + petAvatar(pets[5], true) + shareModal();
  location.hash = state.page;
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-page],[data-action],[data-select],[data-set],[data-tier],[data-modal],[data-action-preview]');
  if (!target) return;
  if (target.dataset.page) state.page = target.dataset.page;
  if (target.dataset.page === 'library') loadPets();
  if (target.dataset.select) state.selected = Number(target.dataset.select);
  if (target.dataset.set) state.albumSet = Number(target.dataset.set);
  if (target.dataset.tier) state.payTier = tiers[Number(target.dataset.tier)];
  if ('modal' in target.dataset) state.modal = target.dataset.modal;
  if (target.dataset.actionPreview) {
    state.selectedAction = target.dataset.actionPreview;
    render();
    return;
  }
  const action = target.dataset.action;
  if (action === 'demo-file') {
    state.file = { name: 'cat-demo.jpg', size: '128 KB', type: 'image/jpeg' };
    state.localFile = await createDemoCatFile();
    state.formError = '';
  }
  if (action === 'generate') {
    if (!state.localFile) {
      state.formError = '请先上传 JPG、PNG 或 WebP 宠物照片，或使用示例照片体验。';
      render();
      return;
    }
    state.formError = '';
    state.studioPhase = 'generating';
    state.isLoading = true;
    saveDraft();
    render();
    try {
      const form = new FormData();
      form.append('image', state.localFile);
      form.append('petName', state.petName || '未命名宠物');
      form.append('description', state.description || '');
      const data = await apiJson('/api/pet-jobs', { method: 'POST', body: form });
      state.job = data.job;
      state.selected = 0;
      state.studioPhase = 'prototype';
    } catch (error) {
      state.formError = error.message;
      state.studioPhase = 'empty';
    } finally {
      state.isLoading = false;
      render();
    }
    return;
  }
  if (action === 'restore') {
    state.file = state.file || { name: 'restored-cat.jpg', size: '96 KB', type: 'image/jpeg' };
    state.formError = '';
    state.studioPhase = 'prototype';
  }
  if (action === 'cancel-order') {
    if (state.order?.id) {
      try { await apiJson(`/api/orders/${state.order.id}/cancel`, { method: 'POST' }); } catch {}
    }
    state.order = null;
    state.studioPhase = 'tier';
    state.formError = '订单已取消，可重新选择套餐。';
  }
  if (action === 'tier' && state.job?.id) {
    try {
      const candidate = state.job.candidates[state.selected];
      if (candidate) {
        const data = await apiJson(`/api/pet-jobs/${state.job.id}/select-candidate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidateId: candidate.id }),
        });
        state.job = data.job;
      }
    } catch (error) {
      state.formError = error.message;
    }
  }
  if (action === 'pay' && state.job?.id) {
    state.studioPhase = 'pay';
    state.isLoading = true;
    render();
    try {
      const data = await apiJson('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: state.job.id, sku: skuFromTier(state.payTier) }),
      });
      state.order = data.order;
      state.orderId = data.order.id;
    } catch (error) {
      state.formError = error.message;
      state.studioPhase = 'tier';
    } finally {
      state.isLoading = false;
      render();
    }
    return;
  }
  if (action === 'motion' && state.job?.id && state.order?.id) {
    state.isLoading = true;
    render();
    try {
      await apiJson(`/api/orders/${state.order.id}/confirm-mock`, { method: 'POST' });
      state.studioPhase = 'motion';
      render();
      const data = await apiJson(`/api/pet-jobs/${state.job.id}/generate-pack`, { method: 'POST' });
      state.job = data.job;
      state.selectedAction = Object.keys(data.job.actions || {})[0] || 'idle';
      state.studioPhase = 'done';
      loadPets();
    } catch (error) {
      state.formError = error.message;
      state.studioPhase = 'pay';
    } finally {
      state.isLoading = false;
      render();
    }
    return;
  }
  if (['prototype', 'tier', 'pay', 'done'].includes(action)) {
    state.studioPhase = action === 'motion' ? 'motion' : action;
  }
  render();
});

document.addEventListener('change', (event) => {
  const input = event.target.closest('input[type="file"]');
  if (!input || !input.files || !input.files[0]) return;
  const file = input.files[0];
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    state.file = null;
    state.formError = '图片格式不支持，请上传 JPG、PNG 或 WebP。';
  } else if (file.size > 8 * 1024 * 1024) {
    state.file = null;
    state.formError = '图片超过 8MB，请压缩后再上传。';
  } else {
    state.file = { name: file.name, size: formatBytes(file.size), type: file.type };
    state.localFile = file;
    state.formError = '';
  }
  render();
});

document.addEventListener('input', (event) => {
  const field = event.target?.dataset?.field;
  if (!field) return;
  if (field === 'petName') state.petName = event.target.value;
  if (field === 'description') state.description = event.target.value;
});

window.addEventListener('hashchange', () => {
  const nextPage = location.hash.replace('#', '') || 'home';
  if (nextPage && nextPage !== state.page) {
    state.page = nextPage;
    if (nextPage === 'library') loadPets();
    else render();
  }
});

async function loadPets() {
  try {
    const data = await apiJson('/api/pets');
    state.petList = data.pets || [];
    render();
  } catch {}
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function saveDraft() {
  try {
    localStorage.setItem('mypet:lastTask', JSON.stringify({
      id: 'PDX-JOB-018',
      petName: '豆包',
      status: state.studioPhase,
      file: state.file,
      updatedAt: new Date().toISOString(),
    }));
  } catch {}
}

render();
