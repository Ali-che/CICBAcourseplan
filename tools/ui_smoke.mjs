#!/usr/bin/env node
// CIC BA 排课 · 画面冒烟测试(真的打开网页、跑程序、点每个分页)
//
// 为什么要有它:tools/smoke.py 只查「文件在不在、数据库读不读得到」,不会执行网页里的程序。
// 2026-11-09 的崩溃(opsD 为 null → 排课表空白、在线名单消失)它就拦不住。
// 这支用无头 Chrome 模拟「刚打开网页、从没进过后台」的同事,依序点开各分页,有任何 JS 报错就失败。
//
// 用法:
//   node tools/ui_smoke.mjs                 # 测本地 index.html(推送前跑这个)
//   node tools/ui_smoke.mjs --url <网址>    # 测线上
// 退出码 0=全过,1=有失败。只需 Node 22+ 与 Chrome,不装任何套件,不需要 PIN。
// 安全:只做匿名读取;所有写入类呼叫(gasPost,含心跳)一律在测试中拦截,不会动到资料、也不会出现在在线名单。

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argUrl = (() => { const i = process.argv.indexOf('--url'); return i > 0 ? process.argv[i + 1] : null; })();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 找 Chrome ──
const CHROME = [process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(p => p && existsSync(p));
if (!CHROME) { console.error('❌ 找不到 Chrome(可用环境变量 CHROME 指定路径)'); process.exit(1); }

// ── 本地模式:起一个只读静态服务器 ──
let server = null, target = argUrl;
if (!target) {
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
  server = createServer(async (req, res) => {
    try {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const f = join(ROOT, p === '/' ? 'index.html' : p);
      if (!f.startsWith(ROOT)) throw 0;
      const body = await readFile(f);
      res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  target = `http://127.0.0.1:${server.address().port}/index.html`;
}

// ── 启动无头 Chrome ──
const profile = await mkdtemp(join(tmpdir(), 'ba-smoke-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, '--window-size=1400,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((res, rej) => {
  let buf = ''; const t = setTimeout(() => rej(new Error('Chrome 启动超时')), 20000);
  chrome.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } });
});
const port = new URL(wsUrl).port;
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');

// ── 极简 CDP 客户端(Node 22 内建 WebSocket) ──
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0; const pending = new Map(); const errors = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push('JS 报错: ' + ((d.exception && d.exception.description) || d.text).split('\n').slice(0, 2).join(' | '));
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  }
};
const send = (method, params = {}) => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception || {}).description || r.result.exceptionDetails.text);
  return r.result && r.result.result ? r.result.result.value : undefined;
};

// ── 检查 ──
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log((ok ? '  ✅ ' : '  ❌ ') + name + (detail ? '  — ' + detail : '')); };
const step = async (name, fn) => {
  const before = errors.length;
  let detail = '';
  try { detail = (await fn()) || ''; } catch (e) { errors.push(String(e.message).split('\n')[0]); }
  await sleep(600);
  const fresh = errors.slice(before);
  check(name, fresh.length === 0, fresh.length ? fresh[0] : detail);
};

console.log(`\n=== CIC BA 排课 画面冒烟测试 ===\n目标:${target}\n`);
try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: target + (target.includes('?') ? '&' : '?') + 'smoke=' + Date.now() });
  await sleep(3000);

  // 拦截所有写入 + 弹窗;记录错误 toast 与「刷新失败」
  await evaluate(`(function(){
    window.__blocked=[]; window.__toastErr=[];
    window.gasPost=async function(a){window.__blocked.push(a);return {success:true};};
    window.alert=function(m){window.__toastErr.push('alert: '+m);};
    window.confirm=function(){return false;}; window.prompt=function(){return null;};
    if(typeof showToast==='function'){const _t=showToast;window.showToast=function(m,o){if(o&&o.kind==='error')window.__toastErr.push(String(m));return _t.apply(this,arguments);};}
    return true;})()`);

  // 以「一般同事」身份进入(teacher,没进过后台)
  await step('进入系统并载入排课(模拟一般同事,从没开过后台)', async () => {
    await evaluate(`(currentRole='teacher', unlockApp(), true)`);
    for (let i = 0; i < 40; i++) { await sleep(500); if (await evaluate(`(typeof schD!=='undefined'&&schD.length>0&&document.querySelectorAll('#sch-tb tr').length>0)`)) break; }
    const n = await evaluate(`document.querySelectorAll('#sch-tb tr').length`);
    if (!n) throw new Error('排课表 0 行(画面空白)');
    return `排课表 ${n} 行`;
  });
  await step('在线名单与轮询有启动(init 跑完)', async () => {
    // init 若中途崩溃,后面的 startRemotePoll/startHeartbeat 不会跑 → 在线名单空白(2026-11-09 就是这样)
    const st = await evaluate(`(document.getElementById('sync-status-bar')||{}).textContent||''`);
    if (/失败/.test(st)) throw new Error('状态列: ' + st.trim());
    const hb = await evaluate(`typeof _heartbeatTimer!=='undefined'&&!!_heartbeatTimer`);
    const poll = await evaluate(`typeof pollTimer!=='undefined'&&!!pollTimer`);
    if (!hb) throw new Error('心跳(在线名单)没有启动 —— init 可能中途出错');
    if (!poll) throw new Error('30 秒轮询没有启动 —— init 可能中途出错');
    return '心跳与轮询都在跑';
  });

  // 依序点各分页;后台(ops)放最后,因为进后台会载入 opsD,会掩盖「没进过后台」才出现的错误
  const TABS = [['sch', '排课'], ['sp', 'IS/SG'], ['exam', '期末考'], ['sum', '学期总表'], ['notice', '教务须知'], ['btec', 'BTEC'], ['sta', '教学统计'], ['ops', '后台操作']];
  for (const [id, label] of TABS) {
    await step(`分页「${label}」`, async () => {
      await evaluate(`switchTab('${id}')`); await sleep(1200);
      if (id === 'sp') { const n = await evaluate(`document.querySelectorAll('#sp-tb tr').length`); return `IS/SG ${n} 行`; }
      if (id === 'sum') {
        const subs = await evaluate(`[...document.querySelectorAll('[onclick^="switchSub("]')].map(e=>e.getAttribute('onclick').match(/switchSub\\('([^']+)'/)[1])`);
        for (const s of [...new Set(subs)]) { await evaluate(`switchSub('${s}')`); await sleep(500); }
        return `子页 ${[...new Set(subs)].join(', ')}`;
      }
    });
  }
  // 进过后台后再回排课,确认两种状态都正常
  await step('进过后台后再回「排课」', async () => { await evaluate(`switchTab('sch'); renderSch(); true`); return 'ok'; });

  const toastErr = await evaluate(`window.__toastErr`);
  check('没有出现红色错误提示 / alert', toastErr.length === 0, toastErr.slice(0, 3).join(' | '));
  const blocked = await evaluate(`[...new Set(window.__blocked)].join(',')`);
  console.log(`\n  (测试中拦下的写入呼叫:${blocked || '无'} —— 均未送出)`);
} catch (e) {
  check('测试本身', false, e.message);
} finally {
  try { ws.close(); } catch {}
  chrome.kill(); if (server) server.close();
  await sleep(300); await rm(profile, { recursive: true, force: true }).catch(() => {});
}

const passed = results.filter(Boolean).length;
console.log(`\n=== 结果:${passed}/${results.length} 通过 ===\n`);
process.exit(passed === results.length ? 0 : 1);
