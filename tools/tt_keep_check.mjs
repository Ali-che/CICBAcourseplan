#!/usr/bin/env node
// CIC BA 排课 · 「🧩 只补排改动的课」不报错检查(2026-11-25)
// 用管理员身份打开页面(匿名只读,写入一律拦下),拿该学期存档直接按「只补排」,必须不丢例外、要产生 keep 结果。
// 起因:已排的课全被锁住、又有个别学生撞课时,局部优化会取到 undefined → 按钮点了没反应。
// 用法:  node tools/tt_keep_check.mjs [学期=2569-2] [输出资料夹]
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[4] ? resolve(process.argv[4]) : join(dirname(fileURLToPath(import.meta.url)), '..');
const SEM = process.argv[2] || '2569-2', OUT = process.argv[3] || join(tmpdir(), 'tt-reg-check');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => p && existsSync(p));
await mkdir(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (req, res) => { try { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = join(ROOT, p === '/' ? 'index.html' : p); if (!f.startsWith(ROOT)) throw 0; res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f)); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const target = `http://127.0.0.1:${server.address().port}/index.html`;
const profile = await mkdtemp(join(tmpdir(), 'ba-reg-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1400,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((res, rej) => { let buf = ''; const t = setTimeout(() => rej(new Error('Chrome 启动超时')), 20000); chrome.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } }); });
const port = new URL(wsUrl).port;
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0; const pending = new Map(); const errors = [];
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; } if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push(((d.exception && d.exception.description) || d.text).split('\n')[0]); } };
const send = (method, params = {}) => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception || {}).description || r.result.exceptionDetails.text); return r.result && r.result.result ? r.result.result.value : undefined; };

let fail = 0; const ok = (good, msg) => { if (!good) fail++; console.log((good ? '✅ ' : '❌ ') + msg); };
try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: target + '?dc=' + Date.now() }); await sleep(3000);
  await evaluate(`(function(){window.gasPost=async function(){return {success:true};};window.alert=function(){};window.confirm=function(){return false;};window.print=function(){};
    window.__blob=null;const o=URL.createObjectURL.bind(URL);URL.createObjectURL=function(b){window.__blob=b;return o(b);};return true;})()`);
  await evaluate(`(currentRole='admin', unlockApp(), true)`);
  for (let i = 0; i < 40; i++) { await sleep(500); if (await evaluate(`(typeof schD!=='undefined'&&schD.length>0)`)) break; }
  await evaluate(`switchTab('tt')`); await sleep(1500);
  await evaluate(`(function(){const s=document.getElementById('tt-sem');s.value='${SEM}';s.dispatchEvent(new Event('change'));return true;})()`); await sleep(3000);
  // 有存档就用存档的课表;没有就一键排一次
  const hasSol = await evaluate(`(!!(_ttCache.sol||_ttCache.tt))`);
  if (!hasSol) { await evaluate(`(ttAutoSolve(),true)`); for (let i = 0; i < 240; i++) { await sleep(500); if (await evaluate(`(!_ttSolving&&!!_ttCache.sol)`)) break; } }
  await evaluate(`(function(){window.__toasts=[];const o=window.showToast;window.showToast=function(m,x){window.__toasts.push(m);return o&&o(m,x);};return true;})()`);
  const before = await evaluate(`JSON.stringify({role:currentRole,can:_ttCanEdit(),preview:!!_ttCache.preview,hasSol:!!_ttCache.sol,hasTt:!!_ttCache.tt,n:((_ttCache.sol||{}).placements||[]).length})`);
  console.log('before', before);
  const r = await evaluate(`(function(){try{ttKeepSolve();return 'called';}catch(e){return 'EXC '+e.message+' | '+(e.stack||'').split('\\n').slice(0,3).join(' / ');}})()`);
  console.log('ttKeepSolve ->', r);
  await sleep(1500);
  console.log('toasts', await evaluate(`JSON.stringify(window.__toasts)`));
  console.log('after', await evaluate(`JSON.stringify({n:((_ttCache.sol||{}).placements||[]).length,keep:(_ttCache.sol||{}).keep?{kept:_ttCache.sol.keep.kept,added:_ttCache.sol.keep.added,fail:_ttCache.sol.keep.fail,gone:_ttCache.sol.keep.gone,moved:_ttCache.sol.keep.moved}:null})`));
  console.log('errors', JSON.stringify(errors.slice(0,5)));
  const kk = await evaluate(`(!!(_ttCache.sol&&_ttCache.sol.keep))`);
  ok(r === 'called' && kk && !errors.length, '「只补排」按下去不报错、有产生 keep 结果');
} catch (e) { console.log('测试本身: ' + e.message); }
finally { try { ws.close(); } catch {} chrome.kill(); server.close(); await sleep(300); await rm(profile, { recursive: true, force: true }).catch(() => {}); }
console.log(`\n=== 只补排检查:${fail ? fail + ' 项失败' : '全部通过'} ===`);
process.exit(fail ? 1 : 0);
