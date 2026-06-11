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
};

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
    <button class="brand" data-page="home"><span class="brand-mark">${icon('paw')}</span><span><strong>伴生造物 · PetDex Studio</strong><small>Desktop pet companion</small></span></button>
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
        <p class="lead">上传一张照片，先生成 6 张可选主形象；满意后再购买动作包，获得宠物码、资源包和桌面客户端导入体验。</p>
        <div class="hero-stats"><b>127</b><span>只宠物已生成</span><b>6选1</b><span>先看像不像</span><b>¥9.9</b><span>低价上手</span></div>
        <div class="actions"><button class="primary" data-page="studio">${icon('upload')}上传宠物照片</button><button class="secondary" data-page="pricing">查看套餐</button></div>
        <small>支持支付宝扫码支付演示，后续可接真实支付回调</small>
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
      <p>PetDex 的购买理由是“长期陪伴资产”：主形象、动作帧、宠物码、资源包、桌面客户端一起完成闭环。</p>
    </section>
    <section class="steps">${['上传照片', '生成候选', '选择套餐', '下载陪伴'].map((s, i) => `<article><b>0${i + 1}</b><h3>${s}</h3><p>${['一张清晰正脸或自然坐姿照片即可。', '免费先看方向，挑最像的一张。', '基础版适合尝鲜，高级版适合上架主推。', '导入宠物码或 .petpack，桌宠出现在桌面。'][i]}</p></article>`).join('')}</section>
  </main>`;
}

function uploadForm() {
  return `<aside class="panel form-panel"><h2>上传宠物照片</h2><label>宠物名字<input value="豆包"></label><label>性格描述<input value="温柔、粘人、好奇，会在桌面边缘安静待着"></label><label class="upload-box">${icon('image')}<strong>选择一张宠物照片</strong><span>已选择 cat.jpg · 12.4 KB · 建议使用正脸照</span><input type="file" accept="image/*"></label><label class="check-row"><input type="checkbox" checked>用右跑动作镜像生成左跑<span>适合左右对称的猫狗，节省生成时间</span></label><div class="row-actions"><button class="primary" data-action="generate">开始生成桌宠</button><button class="secondary" data-action="prototype">继续上次任务</button></div></aside>`;
}

function studioPreview() {
  if (state.studioPhase === 'generating') return `<div class="generate-work"><div class="split-title"><div><h2>豆包，正在准备候选</h2><p>正在生成 6 张主形象，完成后从中选一张最像的。</p></div><span class="pill">1-2 分钟</span></div><div class="generation-canvas"><span>等待你的第一只桌宠</span></div><div class="pipeline">${['上传照片', '生成候选', '相似度检查', '进入选择'].map((s, i) => `<div class="${i < 2 ? 'active' : ''}"><b>${i + 1}</b><span>${s}</span></div>`).join('')}</div></div>`;
  if (state.studioPhase === 'motion') return `<div class="generate-work"><div class="split-title"><div><h2>豆包，基础动作生成中</h2><p>正在制作待机、走路、打招呼等基础动作。</p></div><span class="pill">3-5 分钟</span></div><div class="motion-canvas">${Array.from({ length: 6 }).map((_, i) => `<span style="--i:${i}">${petAvatar(pets[2], true)}</span>`).join('')}</div><div class="pipeline">${['确认形象', '制作基础动作', '制作打包', '完成交付'].map((s, i) => `<div class="${i < 2 ? 'active' : ''}"><b>${i + 1}</b><span>${s}</span></div>`).join('')}</div></div>`;
  if (state.studioPhase === 'prototype') return `<div class="prototype"><h2>豆包，选一张最像的</h2><div class="candidate-grid">${pets.map((p, i) => `<button class="candidate ${state.selected === i ? 'selected' : ''}" data-select="${i}">${petAvatar(p)}<span>版本${String.fromCharCode(65 + i)}</span></button>`).join('')}</div><div class="row-actions"><button class="primary wide" data-action="tier">就是它，选套餐 →</button><button class="secondary wide" data-action="generate">不太像，重新生成六张</button></div><p class="hint">账号免费次数已用完，可以购买券继续刷新候选。</p></div>`;
  if (state.studioPhase === 'tier') return `<div>${sectionHead('立即开始制作全套动作', '已选中主形象，选择套餐后进入支付。', true)}<div class="selected-banner">${petAvatar(pets[state.selected], true)}<span>豆包 · 已确认主形象</span></div><div class="tier-grid studio-tiers">${tiers.slice(1).map((t, i) => tierCard(t, i === 1, true)).join('')}</div><p class="hint">买断制，不订阅。宠物码永久有效，可换设备重新下载。</p></div>`;
  if (state.studioPhase === 'pay') return payPanel();
  if (state.studioPhase === 'done') return donePanel();
  return `<div class="center-state"><div class="mascot">${petAvatar(pets[0], true)}</div><h2>等待你的第一只宠物</h2><p>上传照片后会生成 6 张主形象候选，满意后再进入套餐和完整制作。</p><div class="chips"><span>待机</span><span>走路</span><span>睡觉</span><span>伸懒腰</span></div><small>账号剩余 2 次（免费 2 · 购买 0）</small><a data-page="pricing">点这里购买套餐</a></div>`;
}

function tierCard(tier, recommended = false, studio = false) {
  return `<article class="tier ${recommended ? 'recommended' : ''}"><span>${recommended ? '推荐' : '套餐'}</span><h3>${tier[0]}</h3><b>${tier[1]}</b><p>${tier[2]}</p><ul>${tier[3].map(x => `<li>${x}</li>`).join('')}</ul><button class="${recommended ? 'primary' : 'secondary'}" data-action="pay" data-tier="${tiers.indexOf(tier)}">${studio ? '选择' : '开始体验'}</button></article>`;
}

function payPanel() {
  return `<div class="pay-shell"><div class="pay-card"><p class="eyebrow">豆包</p><h2>付款信息 ${state.payTier[1]}（${state.payTier[0]}）</h2><div class="pay-methods"><button class="selected">支付宝 <small>扫码支付</small></button><button disabled>微信 <small>暂不支持</small></button></div><div class="qr"><span>PetDex<br>QR</span></div><p>请使用支付宝扫码支付</p><div class="countdown">剩余支付时间 <b>29:42</b></div><button class="primary wide" data-action="motion">我已支付，检查状态</button><button class="text-btn" data-action="tier">取消订单</button></div></div>`;
}

function donePanel() {
  return `<div class="done-layout"><div class="pet-result">${petAvatar(pets[state.selected])}</div><div class="delivery-card"><h2>豆包，准备好了。</h2><p>豆包 · ${state.payTier[0]}</p><div class="code">PD-6NDT-PUQB</div><div class="copy-row"><input value="PD-6NDT-PUQB" readonly><button class="secondary">复制</button></div><select><option>查看动作</option><option>待机</option><option>走动</option><option>伸懒腰</option></select><div class="row-actions"><button class="primary">下载资产包</button><button class="secondary" data-page="install">下载客户端</button></div><button class="secondary wide" data-modal="share">生成分享卡</button><button class="secondary wide">补 ¥20 升级完整版 →</button></div></div>`;
}

function studio() {
  return `<main class="page studio">${sectionHead('生成工作台', '上传一张照片，先生成 6 张主形象候选；确认最像的一张后选套餐，再制作全套动作。')}<div class="studio-layout">${uploadForm()}<section class="panel preview-panel">${studioPreview()}</section></div></main>`;
}

function album() {
  const sets = [['A', '手绘萌宠'], ['B', '清新日常'], ['C', '风格大片'], ['D', '国风祥瑞'], ['E', 'Q版贴纸']];
  return `<main class="page two-col">${sectionHead('艺术相册', '上传宠物正视图，先免费预览，再生成整套高清写真。')}<div class="two-layout"><section class="panel"><h2>创作台</h2><div class="set-tabs">${sets.map((s, i) => `<button class="${i === state.albumSet ? 'active' : ''}" data-set="${i}">${s[0]}</button>`).join('')}</div><label class="upload-box">${icon('upload')}<strong>上传正视图</strong><span>支持 JPG、PNG、WebP</span></label><button class="primary">生成免费预览</button></section><section class="panel"><h2>${sets[state.albumSet][1]}</h2><div class="album-grid">${Array.from({ length: 10 }).map((_, i) => `<article><span>${String(i + 1).padStart(2, '0')}</span>${petAvatar(pets[i % pets.length], true)}<b>${sets[state.albumSet][1]}模板</b></article>`).join('')}</div></section></div></main>`;
}

function library() {
  return `<main class="page">${sectionHead('作品库', '每只生成过的宠物都可预览、继续修复和下载，作品库会保留你的每一次创作结果。')}<div class="section-row"><h2>公开作品</h2><p>精选 6 个公开作品，点击可查看可下载</p></div><div class="pet-grid library-grid">${pets.map(petCard).join('')}</div><div class="section-row my-work-title"><h2>我的作品</h2><button class="secondary" data-page="studio">生成新的宠物</button></div><div class="work-grid"><article class="work-card"><div class="empty-work">生成中</div><h3>豆包</h3><p>生成资源包中 · 基础陪伴版</p><button class="secondary">继续任务</button></article><article class="work-card"><div class="cyan">${petAvatar(pets[2])}</div><h3>豆包</h3><p>请选择套餐 · 生成中</p><button class="secondary" data-page="studio">继续任务</button></article></div></main>`;
}

function plaza() {
  return `<main class="plaza"><div class="plaza-bar"><button data-page="home">返回</button><strong>PetDex 云养广场</strong><div><button class="active">1</button><button>2</button><button>3</button></div></div><div class="stage">${Array.from({ length: 22 }).map((_, i) => `<button class="stage-pet" style="left:${8 + (i * 11) % 84}%;top:${18 + (i * 17) % 58}%">${petAvatar(pets[i % pets.length], true)}</button>`).join('')}</div><div class="plaza-tip">目前开放 3 个广场，每个最多 50 只。好友选择同一广场，就能一起云养。</div></main>`;
}

function install() {
  return `<main class="page install-page">${sectionHead('下载一次，所有宠物都在。', '客户端和宠物资源包分开保存，客户端负责在桌面展示和管理。')}<div class="install-hero"><div><p class="eyebrow">桌面客户端</p><h2>客户端和宠物资源包分开保存</h2></div><div class="desktop-preview">${petAvatar(pets[0], true)}</div></div><div class="download-list"><article class="download-feature"><h2>Windows 64位</h2><p>推荐下载，适合第一批用户快速体验。</p><button class="primary">下载</button></article><article><h3>macOS Apple Silicon</h3><p>适用于 M1/M2/M3/M4 芯片。</p><button class="secondary">下载</button></article><article><h3>macOS Intel</h3><p>适用于 Intel 芯片 Mac。</p><button class="secondary">下载</button></article></div><section class="steps install-steps">${['安装客户端', '生成并下载宠物包', '导入陪伴开始'].map((s, i) => `<article><b>${i + 1}</b><h3>${s}</h3><p>下载、解压、导入宠物码或 .petpack 后即可使用。</p></article>`).join('')}</section></main>`;
}

function pricing() {
  return `<main class="page">${sectionHead('为你家的宠物，选一种陪伴方式。', '付费购买的不是一张图，而是一只可安装到桌面、永久陪你工作的宠物。')}<div class="tier-grid pricing">${tiers.slice(1).map((t, i) => tierCard(t, i === 1)).join('')}<article class="tier"><span>专属服务</span><h3>专属定制</h3><b>按需报价</b><p>一对一沟通，从外形到性格全程定制。</p><ul><li>定制外形、配色和像素细节</li><li>独特动作设计与性格表达</li><li>专属资源包与后续更新权益</li></ul><button class="secondary">咨询定制</button></article></div><p class="hint center">生成不满意可重试 · 宠物码永久有效 · 可换设备重新下载</p></main>`;
}

function faq() {
  const items = ['每次生成都会成功吗？不满意能重来吗？', '¥9.9 基础版和 ¥29.9 高级版有什么区别？', '付款后多久能拿到桌宠？支持哪些付款方式？', '生成失败 / 卡了很久没动，怎么办？', '桌宠支持哪些系统？最低要求是什么？', '换电脑了，还能用同一只桌宠吗？', '能不能传朋友的宠物照片、明星宠物、动漫角色？', '会有更多新动作、新表情更新吗？'];
  return `<main class="page narrow">${sectionHead('常见问题', '关于生成、付费、安装的常见疑问。还有问题加 QQ 3790462593。')}${items.map(q => `<details class="faq-item"><summary>${q}</summary><p>当前初版已包含完整前端演示和支付流程占位。上线前接入真实支付回调、生成队列和订单系统即可承接真实用户。</p></details>`).join('')}</main>`;
}

function shareModal() {
  if (state.modal !== 'share') return '';
  return `<div class="modal"><div class="share-card-wrap"><button class="modal-close" data-modal="">×</button><p class="eyebrow">完成，可保存或复制</p><div class="share-card"><p><b>PETDEX.CC</b> · 桌面宠物</p><h2>这是我家豆包<br><span>住进我桌面</span></h2><small>它现在住在我的电脑里啦</small><div class="cyan big">${petAvatar(pets[state.selected])}</div><p class="slogan">猫猫狗狗都能做，做的就是你家那只</p></div><div class="row-actions"><button class="primary">保存图片</button><button class="secondary">复制图片</button></div></div></div>`;
}

function render() {
  const pages = { home, studio, album, library, plaza, install, pricing, faq };
  document.getElementById('root').innerHTML = header() + (pages[state.page] || home)() + petAvatar(pets[1], true) + petAvatar(pets[5], true) + shareModal();
  location.hash = state.page;
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-page],[data-action],[data-select],[data-set],[data-tier],[data-modal]');
  if (!target) return;
  if (target.dataset.page) state.page = target.dataset.page;
  if (target.dataset.select) state.selected = Number(target.dataset.select);
  if (target.dataset.set) state.albumSet = Number(target.dataset.set);
  if (target.dataset.tier) state.payTier = tiers[Number(target.dataset.tier)];
  if ('modal' in target.dataset) state.modal = target.dataset.modal;
  const action = target.dataset.action;
  if (action === 'generate') {
    state.studioPhase = 'generating';
    render();
    setTimeout(() => { state.studioPhase = 'prototype'; render(); }, 900);
    return;
  }
  if (['prototype', 'tier', 'pay', 'motion', 'done'].includes(action)) {
    state.studioPhase = action === 'motion' ? 'motion' : action;
    if (action === 'motion') setTimeout(() => { state.studioPhase = 'done'; render(); }, 900);
  }
  render();
});

render();
