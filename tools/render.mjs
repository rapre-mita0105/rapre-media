// 使い方: node tools/render.mjs posts/<brand>/<slug>
// post.json を読み、carousel/（1080×1350）、reel/（1080×1920のコマと reel.mp4）、story/ を書き出します。
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(process.argv[2]);
const post = JSON.parse(fs.readFileSync(path.join(dir, 'post.json'), 'utf8'));
const nm = pathToFileURL(path.join(root, 'node_modules')).href;
const css = ['shippori-mincho/700.css', 'shippori-mincho/800.css',
  'cormorant-garamond/300.css', 'cormorant-garamond/400.css', 'cormorant-garamond/600-italic.css',
  'noto-sans-jp/300.css', 'noto-sans-jp/400.css', 'noto-sans-jp/500.css']
  .map(f => `<link rel="stylesheet" href="${nm}/@fontsource/${f}">`).join('');

const styleFor = (W, H, tall) => `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px}
body{background:#0B1A2E;color:#F5F2EC;font-family:"Noto Sans JP",sans-serif;font-weight:300;position:relative;overflow:hidden;
  background-image:linear-gradient(rgba(201,168,76,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,.04) 1px,transparent 1px);background-size:54px 54px}
.top{position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#C9A84C 20%,#E8D08A 50%,#C9A84C 80%,transparent)}
.c{position:absolute;width:52px;height:52px;border:1px solid rgba(201,168,76,.7)}
.c.tl{top:44px;left:44px;border-right:0;border-bottom:0}.c.tr{top:44px;right:44px;border-left:0;border-bottom:0}
.c.bl{bottom:44px;left:44px;border-right:0;border-top:0}.c.br{bottom:44px;right:44px;border-left:0;border-top:0}
.brand{position:absolute;top:84px;left:0;right:0;text-align:center;font-family:"Cormorant Garamond",serif;font-weight:400;font-size:34px;letter-spacing:16px;text-indent:16px;color:#C9A84C}
.cat{position:absolute;bottom:84px;left:0;right:0;text-align:center;font-size:24px;letter-spacing:6px;text-indent:6px;color:rgba(245,242,236,.72)}
.no{position:absolute;bottom:86px;right:112px;font-family:"Cormorant Garamond",serif;font-size:26px;letter-spacing:3px;color:#C9A84C}
.main{position:absolute;top:190px;bottom:170px;left:104px;right:104px;display:flex;flex-direction:column;justify-content:center}
.eyebrow{font-family:"Cormorant Garamond",serif;font-style:italic;font-weight:600;font-size:34px;letter-spacing:5px;color:#C9A84C;margin-bottom:34px}
.eyebrow.jp{font-family:"Noto Sans JP",sans-serif;font-style:normal;font-weight:400;font-size:30px;letter-spacing:8px}
h1{font-family:"Shippori Mincho",serif;font-weight:800;line-height:1.42;letter-spacing:2px}
.hook h1{font-size:112px}.text h1,.evidence h1{font-size:66px}.cta h1{font-size:62px}
.rule{width:96px;height:1px;background:#C9A84C;margin:46px 0}
.sub{font-size:36px;line-height:1.7;letter-spacing:2px;color:rgba(245,242,236,.86)}
.body p{font-size:41px;line-height:1.85;letter-spacing:1.5px;font-weight:400}
.body p+p{margin-top:44px;padding-top:44px;border-top:1px solid rgba(74,104,128,.7)}
.item{padding:22px 0;border-top:1px solid rgba(74,104,128,.7)}
.item:last-of-type{border-bottom:1px solid rgba(74,104,128,.7)}
.item .head{font-size:29px;letter-spacing:2px;color:#C9A84C;font-weight:400;margin-bottom:12px}
.item .t{font-family:"Shippori Mincho",serif;font-weight:700;font-size:40px;line-height:1.45}
.item .src{font-size:23px;letter-spacing:1px;color:rgba(245,242,236,.66);margin-top:12px}
.note{font-size:25px;line-height:1.7;color:rgba(245,242,236,.74);margin-top:22px}
.evidence h1{font-size:58px;margin-bottom:30px}.evidence .eyebrow{margin-bottom:20px}
.tags{display:flex;flex-direction:column;gap:22px;margin-bottom:50px}
.tags span{font-size:38px;letter-spacing:6px;font-weight:400;padding-left:30px;border-left:1px solid #C9A84C}
.cta .sub{font-family:"Shippori Mincho",serif;font-weight:700;font-size:44px;color:#C9A84C;line-height:1.6}
${tall ? `.brand{top:210px}.main{top:330px;bottom:560px;right:140px}.cat{bottom:450px}.no{bottom:452px;right:140px}.story .sub{font-size:40px;color:#C9A84C}` : ''}
`;
const frame = (inner, kind, label, W, H, tall) => `<!doctype html><html lang="ja"><head><meta charset="utf-8">${css}<style>${styleFor(W, H, tall)}</style></head>
<body class="${kind}"><div class="top"></div><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
<div class="brand">${post.brand}</div><div class="main">${inner}</div>
<div class="cat">${post.category}</div><div class="no">${label}</div></body></html>`;
const eb = s => `<div class="eyebrow${/[^\x00-\x7F]/.test(s.eyebrow) ? ' jp' : ''}">${s.eyebrow}</div>`;
const build = s => {
  if (s.kind === 'hook') return `${eb(s)}<h1>${s.title}</h1><div class="rule"></div><div class="sub">${s.sub}</div>`;
  if (s.kind === 'text') return `${eb(s)}<h1>${s.title}</h1><div class="rule"></div><div class="body">${s.body.map(p => `<p>${p}</p>`).join('')}</div>`;
  if (s.kind === 'evidence') return `${eb(s)}<h1>${s.title}</h1>${s.items.map(x => `<div class="item"><div class="head">${x.head}</div><div class="t">${x.text}</div>${x.src ? `<div class="src">${x.src}</div>` : ''}</div>`).join('')}<div class="note">${s.note}</div>`;
  if (s.kind === 'cta') return `${eb(s)}<h1>${s.title}</h1><div class="rule"></div><div class="tags">${s.tags.map(t => `<span>${t}</span>`).join('')}</div><div class="sub">${s.sub}</div>`;
  throw new Error('unknown kind ' + s.kind);
};
const tmp = path.join(root, '.build'); fs.mkdirSync(tmp, { recursive: true });
const browser = await chromium.launch();
const pad = i => String(i).padStart(2, '0');
async function shot(html, W, H, out, name) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const f = path.join(tmp, name + '.html'); fs.writeFileSync(f, html);
  await page.goto(pathToFileURL(f).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const over = await page.evaluate(() => { const m = document.querySelector('.main'); return m.scrollHeight > m.clientHeight + 1 || m.scrollWidth > m.clientWidth + 1; });
  if (over) { console.error(`${name}: 文字がはみ出しています`); process.exitCode = 1; }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: W, height: H } });
  await page.close(); console.log('wrote', path.relative(root, out));
}
const n = post.slides.length;
for (let i = 0; i < n; i++) {
  const s = post.slides[i], label = `${pad(i + 1)} / ${pad(n)}`;
  await shot(frame(build(s), s.kind, label, 1080, 1350, false), 1080, 1350, path.join(dir, 'carousel', `slide_${pad(i + 1)}.jpg`), `c${i + 1}`);
  await shot(frame(build(s), s.kind, label, 1080, 1920, true), 1080, 1920, path.join(dir, 'reel', `frame_${pad(i + 1)}.jpg`), `r${i + 1}`);
}
const st = { kind: 'hook', ...post.story };
await shot(frame(build(st), 'hook story', '', 1080, 1920, true), 1080, 1920, path.join(dir, 'story', 'story.jpg'), 'story');
await browser.close();

// リール動画: 各4秒、0.5秒のクロスフェード、無音の音声トラック付き
import { execFileSync } from 'child_process';
const D = 4, X = 0.5, total = n * D - (n - 1) * X;
const args = ['-y', '-loglevel', 'error'];
for (let i = 1; i <= n; i++) args.push('-loop', '1', '-t', String(D), '-framerate', '30', '-i', path.join(dir, 'reel', `frame_${pad(i)}.jpg`));
args.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
let fc = '', prev = '[0:v]';
for (let i = 1; i < n; i++) { const o = i === n - 1 ? '[v]' : `[x${i}]`; fc += `${prev}[${i}:v]xfade=transition=fade:duration=${X}:offset=${i * (D - X)}${o};`; prev = o; }
args.push('-filter_complex', fc.replace(/;$/, ''), '-map', '[v]', '-map', `${n}:a`, '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '18', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-t', String(total), path.join(dir, 'reel', 'reel.mp4'));
execFileSync('ffmpeg', args, { stdio: 'inherit' });
fs.copyFileSync(path.join(dir, 'reel', 'frame_01.jpg'), path.join(dir, 'reel', 'cover.jpg'));
console.log('wrote reel.mp4', total + 's');
