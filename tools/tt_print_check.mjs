#!/usr/bin/env node
// CIC BA 排课 · 课表制作「导出／列印」检查
// 用无头 Chrome 以「列印媒体 + A4 横向」实际产生 PDF,逐一量:表格有没有超出纸宽、课片有没有截字或跑出格子、
// 内容有没有溢出外框或互相重叠、最小字够不够大(>=6pt)、PDF 是不是横向;另检查三种检视的 Excel 导出有内容。
// 用法:  node tools/tt_print_check.mjs [学期=2569-2] [输出资料夹]      (PDF/截图存到输出资料夹,预设系统暂存区)
// 安全:只做匿名读取;写入(gasPost)一律拦下。只需 Node 22+ 与 Chrome。改到课表列印样式/导出时推送前跑一次。
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEM = process.argv[2] || '2569-2', OUT = process.argv[3] || join(tmpdir(), 'tt-print-check');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => p && existsSync(p));
await mkdir(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (req, res) => { try { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = join(ROOT, p === '/' ? 'index.html' : p); if (!f.startsWith(ROOT)) throw 0; res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f)); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const target = `http://127.0.0.1:${server.address().port}/index.html`;
const profile = await mkdtemp(join(tmpdir(), 'ba-print-'));
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

const PAGE_W = Math.round((297 - 20) / 25.4 * 96);   // A4 横向扣左右边界 10mm → 1047px
const PAGE_H = Math.round((210 - 20) / 25.4 * 96);   // 扣上 8mm 下 12mm → 718px
const rows = []; let fail = 0;
try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: target + '?pc=' + Date.now() }); await sleep(3000);
  await evaluate(`(function(){window.gasPost=async function(){return {success:true};};window.alert=function(){};window.confirm=function(){return false;};window.print=function(){};return true;})()`);
  await evaluate(`(currentRole='teacher', unlockApp(), true)`);
  for (let i = 0; i < 40; i++) { await sleep(500); if (await evaluate(`(typeof schD!=='undefined'&&schD.length>0)`)) break; }
  await evaluate(`switchTab('tt')`); await sleep(1500);
  await evaluate(`(function(){const s=document.getElementById('tt-sem');s.value='${SEM}';s.dispatchEvent(new Event('change'));return true;})()`); await sleep(2500);
  await evaluate(`(ttAutoSolve(),true)`); await sleep(800);
  const groups = await evaluate(`JSON.stringify({room:_ttExpGroups(_ttExpSol(),'room').map(g=>g.k),cohort:_ttExpGroups(_ttExpSol(),'cohort').map(g=>g.k),teacher:_ttExpGroups(_ttExpSol(),'teacher').map(g=>g.k)})`);
  const G = JSON.parse(groups);
  const pick = (a, n) => Object.fromEntries(a.slice(0, n).map(k => [k, 1]));
  const cases = [
    ['room-all', '依教室号·全部', null, 'room'],
    ['cohort-all', '依届别·全部', null, 'cohort'],
    ['teacher-all', '依授课老师·全部', null, 'teacher'],
    ['room-23', '依教室号·只选一组(' + G.room[G.room.length > 6 ? 6 : 0] + ')', { [G.room[G.room.length > 6 ? 6 : 0]]: 1 }, 'room'],   // 有下半就选下半第一组(有傍晚栏,最宽);第三学期没有下半就选第一组
    ['room-2grp', '依教室号·选两组(' + G.room[0] + '＋' + G.room[2] + ')', { [G.room[0]]: 1, [G.room[2]]: 1 }, 'room'],
    ['cohort-1', '依届别·只选 ' + G.cohort.slice(0, 1).join(''), pick(G.cohort, 1), 'cohort'],
    ['teacher-2', '依授课老师·只选 ' + G.teacher.slice(0, 2).join('＋'), pick(G.teacher, 2), 'teacher'],
  ];
  for (const [id, label, keys, view] of cases) {
    const ok = await evaluate(`_ttPrintBuild(${JSON.stringify({ view, keys })})`);
    await send('Emulation.setEmulatedMedia', { media: 'print' });
    await send('Emulation.setDeviceMetricsOverride', { width: PAGE_W, height: PAGE_H, deviceScaleFactor: 2, mobile: false });
    await sleep(500);
    const m = JSON.parse(await evaluate(`(function(){
      const box=document.getElementById('tt-print');if(!box)return JSON.stringify({none:true});
      const PW=${PAGE_W};const tabs=[...box.querySelectorAll('table')];
      const tw=tabs.map(t=>Math.round(t.getBoundingClientRect().width));
      const wide=tabs.filter(t=>t.getBoundingClientRect().right>PW+2).length;
      let clip=0,clipEx=[],out=0,minPt=99;
      box.querySelectorAll('.tt-chip').forEach(c=>{
        const z=parseFloat(getComputedStyle(c.closest('table')).zoom)||1;
        [c].concat([...c.querySelectorAll('.z1,.z2,.z3')]).forEach(e=>{if(e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1){clip++;if(clipEx.length<3)clipEx.push(e.className+':'+e.innerText.slice(0,30).replace(/\\n/g,'/'));}});
        const td=c.closest('td');if(td){const a=c.getBoundingClientRect(),b=td.getBoundingClientRect();if(a.right>b.right+1.5||a.left<b.left-1.5)out++;}
        c.querySelectorAll('.z1,.z2,.z3').forEach(e=>{const pt=parseFloat(getComputedStyle(e).fontSize)*z*0.75;if(pt<minPt)minPt=pt;});
      });
      const heads=[...box.querySelectorAll('thead th')].filter(e=>e.scrollWidth>e.clientWidth+1).length;
      const spill=[...box.querySelectorAll('.tt-wrap,.tt-ewrap,.tt-ecard,.tt-sheet')].filter(e=>e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1).length;
      const sh=[...box.querySelectorAll('.tt-sheet')];let overlap=0;for(let i=1;i<sh.length;i++){if(sh[i].getBoundingClientRect().top<sh[i-1].getBoundingClientRect().top+sh[i-1].scrollHeight-1)overlap++;}
      const cards=[...box.querySelectorAll('.tt-ecard')];for(let i=1;i<cards.length;i++){if(cards[i].getBoundingClientRect().top<cards[i-1].getBoundingClientRect().bottom-1)overlap++;}
      return JSON.stringify({sheets:box.querySelectorAll('.tt-sheet').length,tables:tabs.length,chips:box.querySelectorAll('.tt-chip').length,maxW:Math.max.apply(null,tw.concat([0])),wide:wide,clip:clip,clipEx:clipEx,out:out,minPt:Math.round(minPt*10)/10,zooms:[...new Set(tabs.map(t=>(parseFloat(getComputedStyle(t).zoom)||1).toFixed(2)))].join(','),heads:heads,spill:spill,overlap:overlap,docW:document.documentElement.scrollWidth});
    })()`));
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: PAGE_W, height: PAGE_H, scale: 1 } });
    if (shot.result && shot.result.data) await writeFile(join(OUT, id + '.png'), Buffer.from(shot.result.data, 'base64'));
    const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, landscape: true });
    let pages = 0, pdfLandscape = null;
    if (pdf.result && pdf.result.data) { const buf = Buffer.from(pdf.result.data, 'base64'); await writeFile(join(OUT, id + '.pdf'), buf); const txt = buf.toString('latin1'); pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length; const mb = txt.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/); if (mb) pdfLandscape = (+mb[3]) > (+mb[4]) ? Math.round(+mb[3]) + 'x' + Math.round(+mb[4]) : 'PORTRAIT ' + Math.round(+mb[3]) + 'x' + Math.round(+mb[4]); }
    for (const pg of [1, 2]) { if (pg > pages) break; const one = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, landscape: true, pageRanges: String(pg) }); if (one.result && one.result.data) await writeFile(join(OUT, id + '-p' + pg + '.pdf'), Buffer.from(one.result.data, 'base64')); }
    await send('Emulation.setEmulatedMedia', { media: '' }); await send('Emulation.clearDeviceMetricsOverride');
    await evaluate(`(_ttPrintClean(),true)`);
    const good = ok && !m.none && m.wide === 0 && m.clip === 0 && m.out === 0 && m.spill === 0 && m.overlap === 0 && m.heads === 0 && m.minPt >= 6 && m.docW <= PAGE_W + 2 && pages > 0 && pdfLandscape && !/PORTRAIT/.test(pdfLandscape);
    if (!good) fail++;
    rows.push({ id, label, good, pages, pdf: pdfLandscape, ...m });
    console.log((good ? '✅ ' : '❌ ') + label + ` | ${pages} 页 ${pdfLandscape} | 表 ${m.tables} 课片 ${m.chips} | 最宽 ${m.maxW}/${PAGE_W}px 超宽 ${m.wide} | 截字 ${m.clip}${m.clipEx && m.clipEx.length ? ' (' + m.clipEx.join(' ; ') + ')' : ''} | 课片出格 ${m.out} 溢出框 ${m.spill} 重叠 ${m.overlap} 表头截字 ${m.heads} | 缩放 ${m.zooms} | 最小字 ${m.minPt}pt`);
  }
  // Excel
  for (const v of ['room', 'cohort', 'teacher']) {
    const x = JSON.parse(await evaluate(`(function(){_ttCache.view='${v}';ttExpOpen();const n=document.getElementById('ttexp-n').innerText;const chips=document.querySelectorAll('#ttexp-body .ttexp-chip').length;ttExpExcel();const L=window._ttExpLast;const d=document.createElement('div');d.innerHTML=L.html.replace(/^[\\s\\S]*<body>/,'').replace(/<\\/body>[\\s\\S]*$/,'');const trs=d.querySelectorAll('tr').length;const tds=[...d.querySelectorAll('td')];const filled=tds.filter(t=>/｜/.test(t.innerText)).length;return JSON.stringify({n:n,chips:chips,name:L.name,bytes:L.html.length,trs:trs,filled:filled,closed:document.getElementById('ttexp-modal').style.display});})()`));
    const good = x.trs > 5 && x.filled > 0 && x.closed === 'none'; if (!good) fail++;
    console.log((good ? '✅ ' : '❌ ') + 'Excel ' + v + ` | ${x.name} | ${x.bytes} 字 | ${x.trs} 列 | 有课的格 ${x.filled} | 弹窗「${x.n}」药丸 ${x.chips}`);
    rows.push({ id: 'xls-' + v, good, ...x });
  }
  if (errors.length) { fail++; console.log('❌ JS 报错: ' + errors.slice(0, 3).join(' | ')); }
} catch (e) { fail++; console.log('❌ 测试本身: ' + e.message); }
finally { try { ws.close(); } catch {} chrome.kill(); server.close(); await sleep(300); await rm(profile, { recursive: true, force: true }).catch(() => {}); }
await writeFile(join(OUT, 'result.json'), JSON.stringify(rows, null, 1));
console.log(`\n(PDF 与截图在 ${OUT})\n=== 列印检查:${rows.filter(r => r.good).length}/${rows.length} 通过 ===`);
process.exit(fail ? 1 : 0);
