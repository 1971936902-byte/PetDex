const navItems = [
  ['home', '首页'], ['studio', '生成工作台'], ['album', '艺术相册'], ['library', '作品库'],
  ['plaza', '云养广场'], ['install', '下载桌宠'], ['pricing', '定制方案'], ['faq', '常见问题'],
];

const pets = [
  ['豆包', '白底花纹，头顶圆润虎斑', '#fdf6e9', '#27211c', '#f7f7f2'],
  ['奶糖', '橘猫，圆脸大眼', '#fbd493', '#9f5a20', '#fff3db'],
  ['小银', '银渐层，大胆好奇', '#d7d4c8', '#6c6a66', '#f5f0e8'],
  ['Marni', '贝灵顿梗，温柔黏人', '#efe7d6', '#8d7d63', '#f8f1e8'],
  ['小黑白', '奶牛猫，黑白配色', '#ffffff', '#1d1a18', '#eeeeea'],
  ['领结猫', '白猫咪，戴蝴蝶结', '#fffaf1', '#bd6942', '#f5ede0'],
];

const albumSets = [
  ['A', '手绘萌宠', '软线条与暖色背景'], ['B', '清新日常', '窗边、咖啡与午后光'],
  ['C', '风格大片', '电影感布光与海报构图'], ['D', '国风祥瑞', '云纹、花窗与绸缎'],
  ['E', 'Q版贴纸', '圆润头像和表情包'],
];

let state = {
  page: location.hash.replace('#', '') || 'home',
  studioPhase: 'empty',
  selected: 0,
  albumSet: 0,
};

function petAvatar(pet = pets[0], small = false) {
  return `<div class="pet-avatar ${small ? 'small' : ''}" style="--fur:${pet[2]};--mark:${pet[3]};--belly:${pet[4]}">
    <span class="ear left"></span><span class="ear right"></span>
    <span class="head"><span class="patch"></span><span class="eye left"></span><span class="eye right"></span><span class="nose"></span></span>
    <span class="body"></span><span class="tail"></span>
  </div>`;
}

function icon(name) {
  const map = {
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
    down: 'M6 9l6 6 6-6',
    image: 'M4 5h16v14H4z M8 13l2.5-3 3 4 2-2.5L20 17 M8 8h.01',
    check: 'M20 6L9 17l-5-5',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8',
    plus: 'M12 5v14 M5 12h14',
    refresh: 'M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8 M18 2v4h-4 M6 22v-4h4',
    play: 'M8 5v14l11-7z',
    food: 'M4 3v8 M8 3v8 M4 7h4 M6 11v10 M14 3v18 M14 3c4 3 4 8 0 10',
    paw: 'M11 17.5c-1.5 1.7-4.9.9-5.2-1.5-.2-1.8 1.5-3 3.3-2.7 1.1.2 2 1 2.9 1 1 0 1.8-.8 2.9-1 1.8-.3 3.5.9 3.3 2.7-.3 2.4-3.7 3.2-5.2 1.5-.5-.6-1.5-.6-2 0z M7.5 9.5c.8 0 1.5-.9 1.5-2s-.7-2-1.5-2S6 6.4 6 7.5s.7 2 1.5 2z M16.5 9.5c.8 0 1.5-.9 1.5-2s-.7-2-1.5-2S15 6.4 15 7.5s.7 2 1.5 2z M11 7c.8 0 1.5-.9 1.5-2S11.8 3 11 3 9.5 3.9 9.5 5 10.2 7 11 7z M13 7c.8 0 1.5-.9 1.5-2S13.8 3 13 3s-1.5.9-1.5 2S12.2 7 13 7z',
  };
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${map[name]}"/></svg>`;
}

function header() {
  return `<header class="topbar">
    <button class="brand" data-page="home"><span class="brand-mark">${icon('paw')}</span><span><strong>伴生造物 · PetDex Studio</strong><small>Desktop pet companion</small></span></button>
    <nav class="nav">${navItems.map(([id, label]) => `<button class="${state.page === id ? 'active' : ''}" data-page="${id}">${label}</button>`).join('')}</nav>
    <div class="account"><span class="status">模型已连接</span><button class="icon-btn">${icon('bell')}</button><button class="login">账号登录 ${icon('down')}</button></div>
    <button class="float-cta" data-page="studio">开始生成</button>
  </header>`;
}

function sectionHead(title, text, compact = false) {
  return `<div class="section-head ${compact ? 'compact' : ''}"><p class="eyebrow">${title}</p><h1>${title}</h1><p>${text}</p></div>`;
}

function petCard(pet) {
  return `<article class="pet-card"><div class="compare"><div class="photo-bg">${petAvatar(pet, true)}</div><div class="cyan">${petAvatar(pet)}</div></div><h3>${pet[0]}</h3><p>${pet[1]}</p><div class="chips"><span>待机</span><span>走动</span><span>打瞌睡</span><span>陪伴</span></div></article>`;
}

function home() {
  return `<main class="home page"><section class="hero"><div class="mascot">${petAvatar(pets[0], true)}</div><p class="eyebrow">AI 桌面陪伴定制</p><h1>把你家的宠物，<span>真正带到桌面上。</span></h1><p class="lead">上传一张宠物照片，几分钟生成专属桌宠，安装到电脑桌面，安静地陪着你工作。</p><p class="proof">已为 <b>127</b> 只宠物绘制专属桌面小人</p><div class="actions"><button class="primary" data-page="studio">${icon('upload')}上传宠物照片</button><button class="secondary" data-page="library">查看作品库</button></div><small>免费生成预览，满意后再下载桌宠客户端</small></section><section class="showcase"><p class="eyebrow">真实案例</p><h2>它们正在陪伴自己的主人</h2><div class="pet-grid">${pets.map(petCard).join('')}<button class="create-card" data-page="studio">${icon('plus')}生成你家宠物<span>上传一张正脸照片即可</span></button></div></section><section class="steps"><h2>不是生成一张图，而是交付一只可陪伴的桌宠。</h2>${['上传', '生成', '验收', '陪伴'].map((s, i) => `<article><b>0${i + 1}</b><h3>${s}</h3><p>${['一张清晰日常照片就够了。', '自动生成候选、走动、休息等动作。', '逐项确认相似度与动作。', '下载客户端，导入资源包。'][i]}</p></article>`).join('')}</section></main>`;
}

function studioPreview() {
  if (state.studioPhase === 'generating') return `<div class="generate-state">${petAvatar()}<h2>正在生成主形象候选</h2><p>预计 1-2 分钟，当前为本地演示流程。</p>${['照片解析', '提取毛色与轮廓', '生成候选', '整理验收记录'].map((s, i) => `<div class="progress-line"><span>${s}</span><b style="width:${35 + i * 18}%"></b></div>`).join('')}</div>`;
  if (state.studioPhase === 'prototype') return `<div><div class="split-title"><div><p class="eyebrow">主形象候选</p><h2>选一张最像的</h2></div><button class="secondary">${icon('refresh')}重新生成</button></div><div class="candidate-grid">${pets.map((p, i) => `<button class="candidate ${state.selected === i ? 'selected' : ''}" data-select="${i}">${petAvatar(p)}<span>${Math.round(92 - i * 2)}% 相似</span></button>`).join('')}</div><button class="primary wide" data-action="tier">确认主形象并选择套餐</button></div>`;
  if (state.studioPhase === 'tier') return `<div>${sectionHead('选择套餐', '先确认主形象，再选择完整动作包权益。', true)}<div class="tier-grid">${[['候选刷新券', '¥1', '再生成 6 张主形象候选'], ['基础体验版', '¥9.9', '基础动作、永久宠物码、双端可用'], ['高级陪伴版', '¥29.9', '更多动作、行为模式、加赠基础券']].map((t, i) => `<article class="tier ${i === 2 ? 'recommended' : ''}"><span>${i === 2 ? '推荐' : '套餐'}</span><h3>${t[0]}</h3><b>${t[1]}</b><p>${t[2]}</p><button class="primary" data-action="pay">选择方案</button></article>`).join('')}</div></div>`;
  if (state.studioPhase === 'pay') return `<div class="pay"><h2>付款信息 ¥9.9（基础体验版）</h2><p>豆包 · 基础动作资源包</p><div class="pay-methods"><button class="selected">支付宝 <small>扫码支付</small></button><button disabled>微信 <small>暂不支持</small></button></div><div class="qr"><span>PetDex<br>QR</span></div><div class="order"><span>订单号 PD-20260612-0918</span><b>等待支付</b></div><button class="primary wide" data-action="done">我已支付，检查状态</button><button class="text-btn" data-action="tier">取消订单</button></div>`;
  if (state.studioPhase === 'done') return `<div class="done">${icon('check')}<h2>豆包 的桌宠资源包完成</h2><p>宠物码：PDX-DOUBAO-83K2</p><div class="actions"><button class="primary">${icon('download')}下载 .petpack</button><button class="secondary">复制宠物码</button><button class="secondary">生成分享卡</button></div><div class="motion-strip">${['待机', '走动', '睡觉', '伸懒腰', '边缘趴伏'].map(m => `<span>${m}</span>`).join('')}</div></div>`;
  return `<div class="center-state"><div class="mascot">${petAvatar(pets[0], true)}</div><h2>等待你的第一只宠物</h2><p>上传照片后会生成 6 张主形象候选，满意后再进入套餐和完整制作。</p><div class="chips"><span>待机</span><span>走路</span><span>睡觉</span><span>伸懒腰</span></div><small>账号剩余 2 次（免费 2 · 购买 0）</small><a>点这里购买套餐</a></div>`;
}

function studio() {
  return `<main class="page studio">${sectionHead('生成工作台', '上传一张照片，先生成 6 张主形象候选；确认最像的一张后选套餐，再制作全套动作。')}<div class="studio-layout"><aside class="panel form-panel"><h2>上传宠物照片</h2><label>宠物名字<input value="豆包"></label><label>性格描述<input value="温柔、粘人、好奇，会在桌面边缘安静待着"></label><label class="upload-box">${icon('image')}<strong>选择一张宠物照片</strong><span>建议使用清晰正脸、侧脸或自然坐姿照片</span><input type="file" accept="image/*"></label><label class="check-row"><input type="checkbox" checked>用右跑动作镜像生成左跑<span>适合左右对称的猫狗，节省生成时间</span></label><div class="row-actions"><button class="primary" data-action="generate">开始生成桌宠</button><button class="secondary" data-action="prototype">继续上次任务</button></div></aside><section class="panel preview-panel">${studioPreview()}</section></div></main>`;
}

function album() {
  const set = albumSets[state.albumSet];
  return `<main class="page two-col">${sectionHead('艺术相册', '上传宠物正视图，选择套系后先生成免费预览，再制作整套高清写真。')}<div class="two-layout"><section class="panel"><h2>创作台</h2><div class="set-tabs">${albumSets.map((s, i) => `<button class="${i === state.albumSet ? 'active' : ''}" data-set="${i}">${s[0]}</button>`).join('')}</div><label class="upload-box">${icon('upload')}<strong>上传正视图</strong><span>支持 JPG、PNG、WebP</span></label><button class="primary">生成免费预览</button></section><section class="panel"><h2>${set[1]}</h2><p>${set[2]}</p><div class="album-grid">${Array.from({ length: 10 }).map((_, i) => `<article><span>${String(i + 1).padStart(2, '0')}</span>${petAvatar(pets[i % pets.length], true)}<b>${set[1]}模板</b></article>`).join('')}</div></section></div></main>`;
}

function library() {
  return `<main class="page">${sectionHead('作品库', '公开作品用于参考，我的作品保存宠物码、资源包与继续生成入口。')}<div class="pet-grid library-grid">${pets.map(petCard).join('')}</div><section class="panel login-guide"><h2>登录邮箱后查看我的作品</h2><p>找回宠物码、下载 .petpack、继续修复动作或分享到云养广场。</p><button class="primary">登录并生成</button></section></main>`;
}

function plaza() {
  return `<main class="plaza"><div class="plaza-bar"><button data-page="home">返回</button><strong>云养广场</strong><div>${[1, 2, 3].map((n, i) => `<button class="${i === 0 ? 'active' : ''}">广场 ${n}</button>`).join('')}</div></div><div class="stage">${pets.map((p, i) => `<button class="stage-pet" style="left:${12 + (i * 14) % 70}%;top:${28 + (i * 11) % 45}%">${petAvatar(p, true)}<span>${p[0]}</span></button>`).join('')}</div><aside class="plaza-card"><h2>豆包</h2><p>当前广场容量 18/50，好友选择同一广场即可一起云养。</p><div class="actions"><button class="secondary">${icon('heart')}点赞</button><button class="secondary">${icon('food')}投喂</button><button class="secondary">${icon('play')}散开</button></div></aside></main>`;
}

function install() {
  return `<main class="page">${sectionHead('下载桌宠', '网页负责生成资源，桌面客户端负责导入宠物码或 .petpack 后在电脑桌面陪伴。')}<div class="download-grid">${['Windows 64 位', 'macOS Apple Silicon', 'macOS Intel'].map((p, i) => `<article class="panel download-card">${icon('download')}<h2>${p}</h2><p>${['推荐，免安装测试包', 'M 系列芯片', 'Intel Mac'][i]}</p><button class="primary">下载客户端</button></article>`).join('')}</div><section class="steps install-steps">${['下载并解压', '启动客户端', '导入宠物码或资源包'].map((s, i) => `<article><b>0${i + 1}</b><h3>${s}</h3><p>支持系统托盘、拖入资源包和切换多只宠物。</p></article>`).join('')}</section></main>`;
}

function pricing() {
  return `<main class="page">${sectionHead('定制方案', '从免费预览进入付费制作，按陪伴深度选择动作包。')}<div class="tier-grid pricing">${[['基础体验版', '¥9.9', '一次主形象生成、基础动作、永久宠物码'], ['高级陪伴版', '¥29.9', '更多动作、边缘趴伏巡游、加赠基础券'], ['专属定制', '按需报价', '一对一沟通、外形/风格/动作定制']].map((t, i) => `<article class="tier ${i === 1 ? 'recommended' : ''}"><span>${i === 1 ? '推荐' : '方案'}</span><h3>${t[0]}</h3><b>${t[1]}</b><p>${t[2]}</p><button class="primary" data-page="studio">开始体验</button></article>`).join('')}</div></main>`;
}

function faq() {
  const items = ['每次生成都会成功吗？不满意能重来吗？', '¥9.9 基础版和 ¥29.9 高级版有什么区别？', '付款后多久能拿到桌宠？支持哪些付款方式？', '生成失败 / 卡了很久没动，怎么办？', '桌宠支持哪些系统？最低要求是什么？', '换电脑了，还能用同一只桌宠吗？', '能不能传朋友的宠物照片、明星宠物、动漫角色？'];
  return `<main class="page narrow">${sectionHead('常见问题', '关于生成、付费、安装的常见疑问。还有问题加 QQ 3790462593。')}${items.map(q => `<details class="faq-item"><summary>${q}</summary><p>可以。当前页面是前端演示版，真实上线时会接入订单、生成队列、下载包和客服流程。</p></details>`).join('')}</main>`;
}

function render() {
  const pages = { home, studio, album, library, plaza, install, pricing, faq };
  document.getElementById('root').innerHTML = header() + (pages[state.page] || home)() + petAvatar(pets[1], true) + petAvatar(pets[5], true);
  location.hash = state.page;
}

document.addEventListener('click', (event) => {
  const page = event.target.closest('[data-page]')?.dataset.page;
  const action = event.target.closest('[data-action]')?.dataset.action;
  const select = event.target.closest('[data-select]')?.dataset.select;
  const set = event.target.closest('[data-set]')?.dataset.set;
  if (page) state.page = page;
  if (select) state.selected = Number(select);
  if (set) state.albumSet = Number(set);
  if (action === 'generate') {
    state.studioPhase = 'generating';
    render();
    setTimeout(() => { state.studioPhase = 'prototype'; render(); }, 900);
    return;
  }
  if (['prototype', 'tier', 'pay', 'done'].includes(action)) state.studioPhase = action;
  render();
});

render();
