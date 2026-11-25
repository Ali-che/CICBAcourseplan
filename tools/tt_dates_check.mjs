#!/usr/bin/env node
// CIC BA 排课 · 课表制作「📅 上课日期」导出 Excel / 列印 检查
// 用无头 Chrome 打开页面(匿名只读,写入一律拦下),对「按课程」「按上/下半」两种排序各量:
//   ① 画面表格的课程顺序  ② 导出 Excel 的课程顺序(必须和画面一样)  ③ 列印版面(列印媒体)实际印出的课数、页数(必须是全部课,不能只印一部分)
// 用法:  node tools/tt_dates_check.mjs [学期=2569-2] [输出资料夹] [网站根资料夹=本 repo]
//   第三个参数可指向别的拷贝(例如旧版 worktree)来重现问题。只需 Node 22+ 与 Chrome。改到上课日期的导出/列印时,推送前跑一次。
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[4] ? resolve(process.argv[4]) : join(dirname(fileURLToPath(import.meta.url)), '..');
const SEM = process.argv[2] || '2569-2', OUT = process.argv[3] || join(tmpdir(), 'tt-dates-check');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => p && existsSync(p));
await mkdir(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (req, res) => { try { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = join(ROOT, p === '/' ? 'index.html' : p); if (!f.startsWith(ROOT)) throw 0; res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f)); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const target = `http://127.0.0.1:${server.address().port}/index.html`;
const profile = await mkdtemp(join(tmpdir(), 'ba-dates-'));
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
  await evaluate(`(currentRole='teacher', unlockApp(), true)`);
  for (let i = 0; i < 40; i++) { await sleep(500); if (await evaluate(`(typeof schD!=='undefined'&&schD.length>0)`)) break; }
  await evaluate(`switchTab('tt')`); await sleep(1500);
  await evaluate(`(function(){const s=document.getElementById('tt-sem');s.value='${SEM}';s.dispatchEvent(new Event('change'));return true;})()`); await sleep(3000);
  // 有存档就用存档的课表;没有就一键排一次
  const hasSol = await evaluate(`(!!(_ttCache.sol||_ttCache.tt))`);
  if (!hasSol) { await evaluate(`(ttAutoSolve(),true)`); for (let i = 0; i < 240; i++) { await sleep(500); if (await evaluate(`(!_ttSolving&&!!_ttCache.sol)`)) break; } }
  const nRows = await evaluate(`(function(){const sol=_ttCache.sol||(_ttCache.tt?_ttSolutionFromSaved(_ttCache.sem,_ttCache.tt):null);const r=sol?_ttCourseDateRows(sol):null;return r?r.length:-1;})()`);
  console.log(`学期 ${SEM}:上课日期共 ${nRows} 门课(-1=日期没设定/没排课)`);
  if (nRows < 1) { ok(false, '没有可测的上课日期(需要该学期已设定课表日期,且有存档或能排课)'); throw new Error('no rows'); }

  for (const sort of ['name', 'half']) {
    const label = sort === 'name' ? '按课程' : '按上/下半';
    await evaluate(`(ttDatesOpen(), ttDatesSort('${sort}'), true)`); await sleep(300);
    const screen = JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('#ttdates-body tbody tr')].map(tr=>tr.cells[0].innerText.replace(/\\s+/g,' ').trim()))`));
    // ② 导出 Excel:截下送出的档案,读出课程那一栏
    await evaluate(`(window.__blob=null,ttDatesExcel(),true)`); await sleep(300);
    const xls = JSON.parse(await evaluate(`(async function(){if(!window.__blob)return JSON.stringify(null);const t=await window.__blob.text();const d=document.createElement('div');d.innerHTML=t.replace(/^[\\s\\S]*<body>/,'').replace(/<\\/body>[\\s\\S]*$/,'');return JSON.stringify([...d.querySelectorAll('tr')].slice(2).map(tr=>tr.cells[0].innerText.replace(/\\s+/g,' ').trim()));})()`));
    // 画面的课程格会多一个「上半/下半」标签,Excel 把它放全形括号里 → 两边都只比课码部分
    const key = s => s.replace(/（.*?）/g, '').replace(/\s*(上半|下半|全学期)\s*$/, '').trim();
    const same = xls && xls.length === screen.length && xls.every((v, i) => key(v) === key(screen[i]));
    ok(same, `排序「${label}」:Excel 的课程顺序和画面一致(画面 ${screen.length} 门 / Excel ${xls ? xls.length : '无档案'} 门)`);
    if (!same && xls) { const k = xls.findIndex((v, i) => key(v) !== key(screen[i])); console.log(`   第 ${k + 1} 笔开始不同:画面「${screen[k]}」 vs Excel「${xls[k]}」`); }

    // ③ 列印:套上列印版面(新版 _ttDatesPrintBuild;旧版只有 body class),用列印媒体实际产生 PDF
    await evaluate(`(function(){if(typeof _ttDatesPrintBuild==='function'){ttDatesClose();_ttDatesPrintBuild();}else document.body.classList.add('print-ttdates');return true;})()`);
    await send('Emulation.setEmulatedMedia', { media: 'print' });
    await send('Emulation.setDeviceMetricsOverride', { width: 1047, height: 718, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, landscape: true });
    const file = join(OUT, `dates-${sort}.pdf`);
    let pages = 0; if (pdf.result && pdf.result.data) { const buf = Buffer.from(pdf.result.data, 'base64'); await writeFile(file, buf); pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length; }
    await send('Emulation.setEmulatedMedia', { media: '' }); await send('Emulation.clearDeviceMetricsOverride');
    await evaluate(`(function(){if(typeof _ttDatesPrintClean==='function')_ttDatesPrintClean();else document.body.classList.remove('print-ttdates');return true;})()`);
    // 用 Python 的 pypdf(若有)读 PDF 文字,数每门课的课码印出了几门
    const { spawnSync } = await import('node:child_process');
    const py = spawnSync('python3', ['-c', `
import sys,json
try:
    from pypdf import PdfReader
except Exception:
    print(json.dumps({"err":"no pypdf"})); sys.exit(0)
r=PdfReader(sys.argv[1]); names=json.loads(sys.argv[2]); txt=''.join((p.extract_text() or '') for p in r.pages).replace(' ','').replace('\\n','')
miss=[n for n in names if n.replace(' ','') not in txt]
print(json.dumps({"pages":len(r.pages),"missing":miss}))`, file, JSON.stringify(screen.map(key))], { encoding: 'utf8' });
    let res = {}; try { res = JSON.parse(py.stdout.trim()); } catch { res = { err: 'python 失败' }; }
    if (res.err) ok(pages > 0, `排序「${label}」:列印 PDF ${pages} 页(没装 pypdf,课数没逐笔核对)`);
    else ok(pages > 0 && res.missing.length === 0, `排序「${label}」:列印 PDF ${res.pages} 页,${screen.length} 门课里印出 ${screen.length - res.missing.length} 门${res.missing.length ? '(缺 ' + res.missing.slice(0, 5).join('、') + (res.missing.length > 5 ? '…' : '') + ')' : ''}`);
  }
  // 搜索(2026-11-25):画面、Excel、列印用同一个筛选
  await evaluate(`(ttDatesOpen(), ttDatesSort('name'), true)`); await sleep(200);
  const total = JSON.parse(await evaluate(`JSON.stringify(document.querySelectorAll('#ttdates-body tbody tr').length)`));
  const cases = [['KG133', n => /KG133/i.test(n)], ['KG133-971', n => /KG133/i.test(n) && /971/.test(n)], ['KG133 DI325', n => /KG133|DI325/i.test(n)], ['不存在的课zzz', () => false]];
  for (const [q, test] of cases) {
    await evaluate(`(ttDatesSearch(${JSON.stringify(q)}), true)`); await sleep(150);
    const names = JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('#ttdates-body tbody tr')].map(tr=>tr.cells[0].innerText.replace(/\\s+/g,' ').trim()))`));
    await evaluate(`(window.__blob=null,ttDatesExcel(),true)`); await sleep(200);
    const xn = JSON.parse(await evaluate(`JSON.stringify((window._ttDatesLast&&window._ttDatesLast.rows)||[])`));
    const pn = JSON.parse(await evaluate(`(function(){const ok=_ttDatesPrintBuild();const n=ok?document.querySelectorAll('#tt-dates-print tbody tr').length:0;_ttDatesPrintClean();return JSON.stringify(n);})()`));
    const cnt = await evaluate(`document.getElementById('ttdates-cnt').textContent`);
    const hit = names.length > 0 ? names.every(n => test(n)) : true;
    const good = q.startsWith('不存在') ? (names.length === 0 && pn === 0) : (names.length > 0 && names.length < total && hit && xn.length === names.length && pn === names.length);
    ok(good, `搜索「${q}」:画面 ${names.length} 门 / Excel ${xn.length} 门 / 列印 ${pn} 门（全部 ${total} 门；计数「${cnt}」）`);
  }
  await evaluate(`(ttDatesSearchClear(), true)`); await sleep(150);
  const back = JSON.parse(await evaluate(`JSON.stringify(document.querySelectorAll('#ttdates-body tbody tr').length)`));
  ok(back === total, `清除搜索后回到全部 ${total} 门（现在 ${back} 门）`);
  if (errors.length) { fail++; console.log('❌ JS 报错: ' + errors.slice(0, 3).join(' | ')); }
} catch (e) { if (e.message !== 'no rows') { fail++; console.log('❌ 测试本身: ' + e.message); } }
finally { try { ws.close(); } catch {} chrome.kill(); server.close(); await sleep(300); await rm(profile, { recursive: true, force: true }).catch(() => {}); }
console.log(`\n(PDF 存在 ${OUT})\n=== 上课日期检查:${fail ? fail + ' 项失败' : '全部通过'} ===`);
process.exit(fail ? 1 : 0);
