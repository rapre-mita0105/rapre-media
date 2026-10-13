// 使い方: node tools/render.mjs posts/<brand>/<slug>
// post.json を読み、format に応じて carousel/（1080×1350の5枚）または reel/（1080×1920のコマと reel.mp4）を書き出し、
// どちらの場合も story/story.jpg（新着のお知らせ）を書き出します。
// format: "carousel" は slides を使う。format: "reel" は reel.frames（各コマに sec 秒）を使う。
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

// 配色: ゴールドとホワイト（2026-10-13改定）。1枚目と最後はゴールド地に白文字、途中は白地にゴールドのアクセント。
// 白地の本文だけは読みやすさのために深い墨色を使う。タイトルの <em>…</em> は強調色（白地ではゴールド、ゴールド地では下線）。
const G = '#A8833A', GL = '#C9A84C', GD = '#8A6A26', INK = '#2B2418', PAPER = '#FFFFFF';
const styleFor = (W, H, tall) => `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px}
body{background:${PAPER};color:${INK};font-family:"Noto Sans JP",sans-serif;font-weight:400;position:relative;overflow:hidden}
body.gold{background:linear-gradient(155deg,#BE9A4E 0%,${G} 45%,${GD} 100%);color:#FFFFFF}
.frame{position:absolute;inset:36px;border:2px solid ${GL}}
.gold .frame{border-color:rgba(255,255,255,.75)}
.frame:after{content:"";position:absolute;inset:10px;border:1px solid rgba(201,168,76,.45)}
.gold .frame:after{border-color:rgba(255,255,255,.35)}
.mark{position:absolute;right:-30px;bottom:${tall ? 330 : 40}px;font-family:"Cormorant Garamond",serif;font-style:italic;font-weight:600;font-size:${tall ? 300 : 260}px;line-height:1;letter-spacing:-4px;color:rgba(201,168,76,.13);white-space:nowrap}
.gold .mark{color:rgba(255,255,255,.14)}
.num{position:absolute;top:${tall ? 250 : 120}px;right:96px;font-family:"Cormorant Garamond",serif;font-weight:300;font-size:200px;line-height:1;color:rgba(201,168,76,.32)}
.gold .num{display:none}
.brand{position:absolute;top:84px;left:0;right:0;text-align:center;font-family:"Cormorant Garamond",serif;font-weight:600;font-size:34px;letter-spacing:16px;text-indent:16px;color:${G}}
.gold .brand{color:#FFFFFF}
.cat{position:absolute;bottom:84px;left:0;right:0;text-align:center;font-size:24px;letter-spacing:6px;text-indent:6px;color:${G}}
.gold .cat{color:rgba(255,255,255,.9)}
.no{position:absolute;bottom:86px;right:112px;font-family:"Cormorant Garamond",serif;font-weight:600;font-size:26px;letter-spacing:3px;color:${G}}
.gold .no{color:#FFFFFF}
.main{position:absolute;top:190px;bottom:170px;left:104px;right:104px;display:flex;flex-direction:column;justify-content:center;z-index:2}
.eyebrow{display:inline-block;align-self:flex-start;font-family:"Cormorant Garamond",serif;font-style:italic;font-weight:600;font-size:34px;letter-spacing:5px;color:${G};margin-bottom:34px}
.eyebrow.jp{font-family:"Noto Sans JP",sans-serif;font-style:normal;font-weight:500;font-size:28px;letter-spacing:6px;color:#FFFFFF;background:${G};padding:10px 22px}
.gold .eyebrow{color:#FFFFFF}
.gold .eyebrow.jp{color:${GD};background:#FFFFFF}
h1{font-family:"Shippori Mincho",serif;font-weight:800;line-height:1.38;letter-spacing:2px}
h1 em{font-style:normal;color:${G}}
.gold h1 em{color:#FFFFFF;background:linear-gradient(transparent 72%,rgba(255,255,255,.38) 72%)}
.hook h1{font-size:124px;text-shadow:0 4px 24px rgba(80,55,10,.25)}
.text h1,.evidence h1{font-size:66px}.cta h1{font-size:64px}
.rule{width:120px;height:4px;background:${GL};margin:44px 0}
.gold .rule{background:#FFFFFF}
.sub{font-size:36px;line-height:1.7;letter-spacing:2px;color:rgba(43,36,24,.82)}
.gold .sub{color:#FFFFFF;font-weight:500}
.body p{font-size:41px;line-height:1.85;letter-spacing:1.5px}
.body p+p{margin-top:40px;padding-top:40px;border-top:2px solid rgba(201,168,76,.45)}
.items{counter-reset:it}
.item{position:relative;padding:22px 0 22px 92px;border-top:2px solid rgba(201,168,76,.45)}
.item:last-of-type{border-bottom:2px solid rgba(201,168,76,.45)}
.item:before{counter-increment:it;content:counter(it);position:absolute;left:0;top:14px;font-family:"Cormorant Garamond",serif;font-weight:600;font-size:76px;line-height:1;color:${G}}
.item .head{font-size:28px;letter-spacing:2px;color:${G};font-weight:500;margin-bottom:10px}
.item .t{font-family:"Shippori Mincho",serif;font-weight:700;font-size:39px;line-height:1.45}
.item .src{font-size:22px;letter-spacing:1px;color:rgba(43,36,24,.6);margin-top:10px}
.note{font-size:25px;line-height:1.7;color:rgba(43,36,24,.7);margin-top:22px}
.evidence h1{font-size:58px;margin-bottom:28px}.evidence .eyebrow{margin-bottom:20px}
.tags{display:flex;flex-wrap:wrap;gap:18px;margin-bottom:46px}
.tags span{font-size:34px;letter-spacing:4px;font-weight:500;padding:12px 26px;border:2px solid #FFFFFF;border-radius:999px}
.cta .sub{font-family:"Shippori Mincho",serif;font-weight:700;font-size:42px;line-height:1.6;background:#FFFFFF;color:${GD};padding:26px 34px;align-self:stretch}
${tall ? `.brand{top:210px}.main{top:360px;bottom:560px;right:140px}.cat{bottom:450px}.no{bottom:452px;right:140px}.story .sub{font-size:40px}` : ''}
`;
const GOLD_KINDS = new Set(['hook', 'cta']);
const frame = (inner, kind, label, W, H, tall) => {
  const word = (post.category.split('/')[1] || '').trim();
  const gold = kind.split(' ').some(k => GOLD_KINDS.has(k));
  const num = label ? label.split(' / ')[0] : '';
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">${css}<style>${styleFor(W, H, tall)}</style></head>
<body class="${kind}${gold ? ' gold' : ''}"><div class="frame"></div><div class="mark">${word.charAt(0) + word.slice(1).toLowerCase()}</div>${num ? `<div class="num">${num}</div>` : ''}
<div class="brand">${post.brand}</div><div class="main">${inner}</div>
<div class="cat">${post.category}</div><div class="no">${label}</div></body></html>`;
};
const eb = s => `<div class="eyebrow${/[^\x00-\x7F]/.test(s.eyebrow) ? ' jp' : ''}">${s.eyebrow}</div>`;
const build = s => {
  if (s.kind === 'hook') return `${eb(s)}<h1>${s.title}</h1><div class="rule"></div><div class="sub">${s.sub}</div>`;
  if (s.kind === 'text') return `${eb(s)}<h1>${s.title}</h1><div class="rule"></div><div class="body">${s.body.map(p => `<p>${p}</p>`).join('')}</div>`;
  if (s.kind === 'evidence') return `${eb(s)}<h1>${s.title}</h1><div class="items">${s.items.map(x => `<div class="item"><div class="head">${x.head}</div><div class="t">${x.text}</div>${x.src ? `<div class="src">${x.src}</div>` : ''}</div>`).join('')}</div><div class="note">${s.note}</div>`;
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
const format = post.format || 'carousel';
const pad2 = pad;
if (format === 'carousel') {
  const n = post.slides.length;
  for (let i = 0; i < n; i++) {
    const s = post.slides[i], label = `${pad(i + 1)} / ${pad(n)}`;
    await shot(frame(build(s), s.kind, label, 1080, 1350, false), 1080, 1350, path.join(dir, 'carousel', `slide_${pad(i + 1)}.jpg`), `c${i + 1}`);
  }
} else if (format === 'reel') {
  const fr = post.reel.frames;
  for (let i = 0; i < fr.length; i++) {
    await shot(frame(build(fr[i]), fr[i].kind, '', 1080, 1920, true), 1080, 1920, path.join(dir, 'reel', `frame_${pad(i + 1)}.jpg`), `r${i + 1}`);
  }
} else throw new Error('unknown format ' + format);
const st = { kind: 'hook', ...post.story };
await shot(frame(build(st), 'hook story', '', 1080, 1920, true), 1080, 1920, path.join(dir, 'story', 'story.jpg'), 'story');
await browser.close();

if (format === 'reel') {
  // リール動画: 各コマ sec 秒、0.4秒のクロスフェード、1コマ目の最初から静かなズームで動きを出す。無音の音声トラック付き。
  const { execFileSync } = await import('child_process');
  const fr = post.reel.frames, X = 0.4;
  const D = fr.map(f => f.sec || 3);
  const total = D.reduce((a, b) => a + b, 0) - (fr.length - 1) * X;
  if (total < 7 || total > 12) { console.error(`リールの長さが ${total} 秒です（7〜12秒にしてください）`); process.exitCode = 1; }
  const args = ['-y', '-loglevel', 'error'];
  fr.forEach((f, i) => args.push('-loop', '1', '-t', String(D[i]), '-framerate', '30', '-i', path.join(dir, 'reel', `frame_${pad2(i + 1)}.jpg`)));
  args.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
  let fc = '';
  fr.forEach((f, i) => { fc += `[${i}:v]scale=2160:3840,zoompan=z='min(1+0.0009*on,1.03)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,setsar=1[z${i}];`; });
  let prev = '[z0]', off = 0;
  for (let i = 1; i < fr.length; i++) { off += D[i - 1] - X; const o = i === fr.length - 1 ? '[v]' : `[x${i}]`; fc += `${prev}[z${i}]xfade=transition=fade:duration=${X}:offset=${off.toFixed(2)}${o};`; prev = o; }
  if (fr.length === 1) fc += '[z0]null[v];';
  args.push('-filter_complex', fc.replace(/;$/, ''), '-map', '[v]', '-map', `${fr.length}:a`, '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '18', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-t', String(total), path.join(dir, 'reel', 'reel.mp4'));
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  fs.copyFileSync(path.join(dir, 'reel', 'frame_01.jpg'), path.join(dir, 'reel', 'cover.jpg'));
  console.log('wrote reel.mp4', total.toFixed(1) + 's');
}
