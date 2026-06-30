const COLOR_MAP = {
  'red': '#FE4C61',
  'orange': '#F39C11',
  'green': '#52C41A',
  'blue': '#3498DB',
  'purple': '#9D3DCF',
  'gray': '#BFBFBF',
  'cheater': '#AD8B00'
};

const PERM_MAP = [
  { id: 1, name: "登录鉴权" },
  { id: 2, name: "进入主站" },
  { id: 4, name: "进入后台" },
  { id: 8, name: "题目管理" },
  { id: 16, name: "团队管理" },
  { id: 32, name: "比赛管理" },
  { id: 64, name: "秩序管理" },
  { id: 128, name: "未知权限#128" },
  { id: 256, name: "用户管理" },
  { id: 512, name: "专栏管理" },
  { id: 32768, name: "自由发言" },
  { id: 65536, name: "发送私信" },
  { id: 131072, name: "使用专栏" },
  { id: 262144, name: "未知权限#262144" },
  { id: 524288, name: "使用图床" },
  { id: 2097152, name: "题库志愿者" },
  { id: 4194304, name: "专栏志愿者" },
  { id: 1073741824, name: "超级用户" },
];

function formatPerms(val, prefix) {
  if (!val) return '';
  const names = [];
  let remaining = val;
  for (let i = PERM_MAP.length - 1; i >= 0; i--) {
    const p = PERM_MAP[i];
    if ((remaining & p.id) === p.id) {
      names.unshift(p.name);
      remaining -= p.id;
    }
  }
  if (!names.length) names.push('未知权限');
  return `<span class="perm ${prefix === '−' ? 'perm-rev' : 'perm-add'}" title="${prefix}${val}">${names.join(', ')}</span> `;
}

var tab = 'j', jPage = 1, lPage = 1, LIMIT = 50;

// 显示选项偏好：从 localStorage 读取，默认 Badge 关闭，其余打开
function loadPref(key, def) {
  try { const v = localStorage.getItem(key); return v !== null ? v === '1' : def; }
  catch (e) { return def; }
}
function setPref(key, val) {
  window[key] = val;
  try { localStorage.setItem(key, val ? '1' : '0'); } catch (e) { }
}
var showColor = loadPref('showColor', true);
var showBadge = loadPref('showBadge', false);
var showCcf = loadPref('showCcf', true);
var showXcpc = loadPref('showXcpc', true);
var showUid = loadPref('showUid', true);
var showAvatar = loadPref('showAvatar', true);
var showReason = loadPref('showReason', true);
var showTime = loadPref('showTime', true);

(function popPerm() {
  const cRev = document.getElementById('perm-rev');
  const cAdd = document.getElementById('perm-add');
  for (const p of PERM_MAP) {
    cRev.appendChild(makeCb(p, 'rev'));
    cAdd.appendChild(makeCb(p, 'add'));
  }

  const cSpec = document.getElementById('perm-special');
  const l = document.createElement('label');
  l.style.cssText = 'display:block;font-size:.82rem;cursor:pointer;margin:2px 0';
  l.innerHTML = '<input type="checkbox" id="chk-no-perm" value="1" data-kind="special" onchange="jPage=1;loadJ()"> 无权限变更（学术不端导致的棕名）';
  cSpec.appendChild(l);
  function makeCb(p, kind) {
    const l = document.createElement('label');
    l.style.cssText = 'display:block;font-size:.82rem;cursor:pointer;margin:2px 0';
    l.innerHTML = `<input type="checkbox" value="${p.id}" data-kind="${kind}" onchange="jPage=1;loadJ()"> ${p.name}`;
    return l;
  }
})();

(function popShow() {
  [
    {
      el: 'show-opts-a', items: [
        { id: 'chk-color', label: '名字颜色', v: 'showColor' },
        { id: 'chk-badge', label: 'Badge', v: 'showBadge' },
        { id: 'chk-ccf', label: 'OI 认证', v: 'showCcf' },
        { id: 'chk-xcpc', label: 'XCPC 认证', v: 'showXcpc' }
      ]
    },
    {
      el: 'show-opts-b', items: [
        { id: 'chk-uid', label: 'UID', v: 'showUid' },
        { id: 'chk-avatar', label: '头像', v: 'showAvatar' },
        { id: 'chk-reason', label: '原因', v: 'showReason' },
        { id: 'chk-time', label: '时间', v: 'showTime' }
      ]
    }
  ].forEach(col => {
    const c = document.getElementById(col.el);
    col.items.forEach(o => {
      const checked = window[o.v] ? 'checked' : '';
      const l = document.createElement('label');
      l.style.cssText = 'display:block;font-size:.82rem;cursor:pointer;margin:2px 0';
      l.innerHTML = `<input type="checkbox" id="${o.id}" ${checked} onchange="setPref('${o.v}',this.checked);jPage=1;loadJ()"> ${o.label}`;
      c.appendChild(l);
    });
  });
})();

function clearPerms() {
  document.querySelectorAll('#perm-rev input,#perm-add input,#perm-special input').forEach(c => c.checked = false);
}

function getPermFilter() {
  const rev = [], add = [];
  document.querySelectorAll('#perm-rev input:checked').forEach(c => rev.push(+c.value));
  document.querySelectorAll('#perm-add input:checked').forEach(c => add.push(+c.value));
  let q = '';
  if (rev.length) q += '&rev_perm=' + rev.join(',');
  if (add.length) q += '&add_perm=' + add.join(',');
  if (document.getElementById('chk-no-perm').checked) q += '&no_perm=1';
  return q;
}

async function init() {
  const r = await fetch('/api/stats').then(d => d.json());
  if (r.success) document.getElementById('sub').textContent = `共 ${r.data.total_judgements} 条记录 · ${r.data.total_fetch_logs} 次抓取`;
  loadJ();
}
setInterval(init, 60000);

function showTab(t) {
  tab = t;
  document.getElementById('nav-j').className = t === 'j' ? 'on' : '';
  document.getElementById('nav-l').className = t === 'l' ? 'on' : '';
  document.getElementById('nav-a').className = t === 'a' ? 'on' : '';
  document.getElementById('nav-b').className = t === 'b' ? 'on' : '';
  document.getElementById('j-filter').style.display = t === 'j' ? 'flex' : 'none';
  document.getElementById('l-filter').style.display = t === 'l' ? 'flex' : 'none';
  const pp = document.getElementById('perm-panel');
  const sp = document.getElementById('show-panel');
  if (t !== 'j') { pp.classList.remove('show'); sp.classList.remove('show'); }
  if (t === 'j') { jPage = 1; loadJ(); }
  else if (t === 'l') { lPage = 1; loadL(); }
  else { document.getElementById('pager').innerHTML = ''; t === 'a' ? loadA() : loadB(); }
}

async function loadJ() {
  const c = document.getElementById('content');
  c.innerHTML = '<div class="loading">加载中…</div>';
  const uid = document.getElementById('f-uid').value;
  const name = document.getElementById('f-name').value.trim();
  const permQ = getPermFilter();
  let url = `/api/judgement?page=${jPage}&limit=${LIMIT}`;
  if (uid) url += `&uid=${uid}`;
  if (name) url += `&name=${encodeURIComponent(name)}`;
  if (permQ) url += permQ;
  const r = await fetch(url).then(d => d.json());
  if (!r.success) { c.innerHTML = `<div class="empty">${r.error}</div>`; return; }
  if (!r.data.length) { c.innerHTML = '<div class="empty">无数据</div>'; pager(r.pagination, 'J'); return; }
  // 构建表头
  let h = '<table><thead><tr>';
  if (showUid) h += '<th>UID</th>';
  if (showAvatar) h += '<th>头像</th>';
  h += '<th>用户名</th><th>权限变更</th>';
  if (showReason) h += '<th>原因</th>';
  if (showTime) h += '<th>时间</th>';
  h += '</tr></thead><tbody>';

  for (const x of r.data) {
    const d = new Date(x.time * 1000).toLocaleString('zh-CN');
    let perm = '';
    if (x.revoked_permission) perm += formatPerms(x.revoked_permission, '−');
    if (x.added_permission) perm += formatPerms(x.added_permission, '+');
    if (!perm) perm = '—';
    const uc = (x.user && x.user.color || '').toLowerCase();
    const colorHex = COLOR_MAP[uc];
    const cs = showColor ? ` style="color:${colorHex};font-weight:bold"` : '';
    let suffixHtml = '';

    // badge
    if (showBadge && x.user && x.user.badge != null && x.user.badge !== '') {
      suffixHtml += ` <span style="display:inline-block;background:${colorHex};color:#fff;font-size:.72rem;padding:0 5px;border-radius:3px;line-height:1.4;vertical-align:middle">${esc(String(x.user.badge))}</span>`;
    }

    // ccf level 勾
    if (showCcf && x.user && x.user.ccfLevel != null) {
      const cl = x.user.ccfLevel;
      if (cl >= 3) {
        const cc = cl <= 5 ? '#52C41A' : cl <= 7 ? '#3498DB' : '#FFC116';
        suffixHtml += ` <svg style="display:inline-block;vertical-align:middle;width:1em;height:1em" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="${cc}"/><path fill="#fff" d="M328.7 155.5c7.8-10.7 22.8-13.1 33.5-5.3 10.7 7.8 13.1 22.8 5.3 33.5L244.7 352.7c-4.2 5.7-10.7 9.4-17.8 9.8-7.1 .5-14-2.2-18.9-7.3l-55.7-57.6c-9.2-9.5-9-24.7 .6-33.9 9.5-9.2 24.7-8.9 33.9 .6l35.8 37 106.1-145.8z"/></svg>`;
      }
    }

    // xcpc level 气球
    if (showXcpc && x.user && x.user.xcpcLevel != null) {
      const xl = x.user.xcpcLevel;
      if (xl >= 3) {
        const xc = xl >= 8 ? '#FFC116' : xl >= 6 ? '#3498DB' : '#52C41A';
        suffixHtml += ` <svg style="display:inline-block;vertical-align:middle;width:1em;height:1em" viewBox="0 0 384 512"><path fill="${xc}" d="M0 192C0 86 86 0 192 0S384 86 384 192c0 128-160 240-160 240l27.9 41.8c2.7 4 4.1 8.8 4.1 13.6 0 13.6-11 24.6-24.6 24.6l-78.9 0c-13.6 0-24.6-11-24.6-24.6 0-4.8 1.4-9.6 4.1-13.6L160 432S0 320 0 192z"/></svg>`;
      }
    }

    // 构建数据行
    h += '<tr>';
    if (showUid) h += `<td class="uid"><a href="#" class="uid-link" onclick="copyUid(${x.uid});return false">${x.uid}</a></td>`;
    if (showAvatar) h += `<td class="avatar"><a href="https://www.luogu.com.cn/user/${x.uid}" target="_blank"><img src="https://cdn.luogu.com.cn/upload/usericon/${x.uid}.png" alt="" loading="lazy"></a></td>`;
    h += `<td><a href="https://www.luogu.me/user/${x.uid}" target="_blank"${cs}>${esc(x.name)}</a>${suffixHtml}</td>`;
    h += `<td>${perm}</td>`;
    if (showReason) h += `<td class="reason" title="${esc(x.reason || '')}">${esc(x.reason || '—')}</td>`;
    if (showTime) h += `<td class="time">${d}</td>`;
    h += '</tr>';
  }
  h += '</tbody></table>';
  c.innerHTML = h;
  pager(r.pagination, 'J');
}

async function loadL() {
  const c = document.getElementById('content');
  c.innerHTML = '<div class="loading">加载中…</div>';
  const r = await fetch(`/api/logs?page=${lPage}&limit=${LIMIT}`).then(d => d.json());
  if (!r.success) { c.innerHTML = `<div class="empty">${r.error}</div>`; return; }
  if (!r.data.length) { c.innerHTML = '<div class="empty">无日志</div>'; pager(r.pagination, 'L'); return; }
  let h = '<table><thead><tr><th>ID</th><th>时间</th><th>记录数</th><th>状态</th><th>备注</th></tr></thead><tbody>';
  for (const x of r.data) {
    const s = x.status === 'success' ? '<span class="perm-add">成功</span>' : '<span class="perm-rev">失败</span>';
    h += `<tr><td>${x.id}</td><td class="time">${x.fetched_at}</td><td>${x.record_count}</td><td>${s}</td><td>${esc(x.error_message || '—')}</td></tr>`;
  }
  h += '</tbody></table>';
  c.innerHTML = h;
  pager(r.pagination, 'L');
}

function pager(p, type) {
  const el = document.getElementById('pager');
  if (p.total_pages <= 1) { el.innerHTML = ''; return; }
  const fn = type === 'J' ? 'loadJ()' : 'loadL()';
  el.innerHTML =
    (p.page > 1 ? `<a href="#" onclick="${type === 'J' ? 'jPage--' : 'lPage--'};${fn};return false">← 上一页</a>` : '<span></span>') +
    `<span>第 ${p.page}/${p.total_pages} 页（共 ${p.total} 条）</span>` +
    (p.page < p.total_pages ? `<a href="#" onclick="${type === 'J' ? 'jPage++' : 'lPage++'};${fn};return false">下一页 →</a>` : '<span></span>');
}

function loadA() {
  const c = document.getElementById('content');
  c.innerHTML = `<div class="api-doc">
<h2>GET /api/judgement</h2>
<p>获取 judgement 记录。</p>
<table><thead><tr><th>参数</th><th>类型</th><th>默认值</th><th>说明</th></tr></thead><tbody>
<tr><td><code>page</code></td><td>int</td><td>1</td><td>页码</td></tr>
<tr><td><code>limit</code></td><td>int</td><td>50</td><td>每页条数（最大 500）</td></tr>
<tr><td><code>uid</code></td><td>int[]</td><td>—</td><td>按用户 UID 精确筛选（逗号分隔，IN 逻辑）</td></tr>
<tr><td><code>name</code></td><td>string</td><td>—</td><td>按用户名模糊筛选</td></tr>
<tr><td><code>rev_perm</code></td><td>int[]</td><td>—</td><td>按移除的权限值筛选（逗号分隔，AND 逻辑）</td></tr>
<tr><td><code>add_perm</code></td><td>int[]</td><td>—</td><td>按添加的权限值筛选（逗号分隔，AND 逻辑）</td></tr>
</tbody></table>
<h2>GET /api/logs</h2>
<p>获取抓取日志。</p>
<table><thead><tr><th>参数</th><th>类型</th><th>默认值</th><th>说明</th></tr></thead><tbody>
<tr><td><code>page</code></td><td>int</td><td>1</td><td>页码</td></tr>
<tr><td><code>limit</code></td><td>int</td><td>50</td><td>每页条数（最大 500）</td></tr>
</tbody></table>

<h2>GET /api/stats</h2>
<p>获取统计信息（总记录数、总抓取次数）。</p>
</div>`;
}

function loadB() {
  const c = document.getElementById('content');
  c.innerHTML = `<div class="api-doc">
<h2>关于</h2>
<p>@quanac-lcx, Luogu-Saver.</p>
<p>GitHub: <code>quanac-lcx/luogu-judgement-saver</code></p>
<h2>鸣谢</h2>
<p>GitHub: <code>oi-zone/luogu-archive</code></p>
</div>`;
}

function copyUid(uid) {
  navigator.clipboard.writeText(String(uid)).then(() => {
    const toast = document.createElement('span');
    toast.className = 'copy-toast';
    toast.textContent = 'Copied!';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 18px;border-radius:6px;font-size:.85rem;z-index:9999;pointer-events:none;opacity:0;transition:opacity .2s';
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 1500);
  }).catch(() => { });
}

(function initBackToTop() {
  const btn = document.getElementById('btn-top');
  window.addEventListener('scroll', function () {
    if (tab === 'b') { btn.classList.remove('show'); return; }
    if (window.scrollY > 400) btn.classList.add('show');
    else btn.classList.remove('show');
  }, { passive: true });
})();

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
init();
