// 使い方: node tools/check.mjs posts/rapre/<フォルダ>
// caption.txt と post.json を手順書の規則で検査します。1つでも不合格があれば終了コード1。
import fs from 'fs';
import path from 'path';

const dir = path.resolve(process.argv[2]);
const post = JSON.parse(fs.readFileSync(path.join(dir, 'post.json'), 'utf8'));
const cap = fs.readFileSync(path.join(dir, 'caption.txt'), 'utf8').trim();
const ng = [];
const ok = [];
const check = (cond, msg) => (cond ? ok : ng).push(msg);

// 本文とハッシュタグを分ける
const lines = cap.split('\n');
const tagLine = lines.filter(l => l.trim().startsWith('#')).join(' ');
const body = lines.filter(l => !l.trim().startsWith('#')).join('\n');
const n = body.replace(/\s/g, '').length;
check(n >= 600 && n < 800, `本文の文字数 ${n}（空白を除き600以上800未満）`);

const tags = tagLine.split(/\s+/).filter(t => t.startsWith('#'));
check(tags.length === 5, `ハッシュタグ ${tags.length}個（5個）`);
check(tags[tags.length - 1] === '#ボディチューニング', '最後のタグが #ボディチューニング');
check(new Set(tags).size === tags.length, 'タグの重複なし');
const hair = tags.filter(t => /脱毛/.test(t));
check(hair.length === 0 || post.hair_removal_topic === true, '脱毛のタグは脱毛の回だけ');

// 表記
const all = body + '\n' + JSON.stringify(post);
const badSkin = [...all.matchAll(/(.)肌/g)].filter(m => m[1] !== 'お' && m[1] !== '美');
check(badSkin.length === 0, `「肌」の表記（お肌）${badSkin.length ? '：' + badSkin.map(m => m[0]).join('、') : ''}`);
const okBody = /(体温|体調|体内|体質|体験|体感|全体|具体|身体|体重|体脂肪|体幹|体操)/g;
const badBody = all.replace(okBody, '').match(/体/g) || [];
check(badBody.length === 0, `「体」の表記（カラダ）${badBody.length ? '：' + badBody.length + '箇所' : ''}`);
check(!/\*\*/.test(all), '太字記号なし');

// 禁止表現
const banned = ['治る', '治す', '改善', '効果がある', '効果的', '解消', '必ず', '絶対', '痩せる', '若返', '完治', '保証'];
const hit = banned.filter(w => all.includes(w));
check(hit.length === 0, `禁止表現なし${hit.length ? '：' + hit.join('、') : ''}`);

// 締めの構成（紹介導線）
for (const w of ['完全紹介制', '完全予約制', '初回カウンセリングは無料', '送ってくださった方を通して', 'DMで送']) {
  check(body.includes(w), `必須の文言「${w}」`);
}
for (const w of ['全て返信します', '番号でコメント']) check(!body.includes(w), `廃止した定型文「${w}」を使っていない`);
check((body.match(/？|\?|でしょうか。|ますか。/g) || []).length >= 1, '問いかけが1つ以上');
check(typeof post.send_to === 'string' && post.send_to.length > 0, `post.json に send_to（誰に送ってもらう投稿か）：${post.send_to || 'なし'}`);

// 代表がお客様へ個別に送る文（line.txt）
const lf = path.join(dir, 'line.txt');
if (fs.existsSync(lf)) {
  const lt = fs.readFileSync(lf, 'utf8').trim();
  const msg = lt.split('\n').filter(l => !l.startsWith('送る相手の目安')).join('');
  const ln = msg.replace(/\s/g, '').length;
  check(ln >= 60 && ln <= 160, `line.txt の本文 ${ln}字（60〜160字）`);
  check(/送る相手の目安：/.test(lt), 'line.txt に「送る相手の目安：」の行');
  check(/転送|送って/.test(msg), 'line.txt にご友人への転送のお願い');
  const badL = banned.filter(w => lt.includes(w));
  check(badL.length === 0, `line.txt に禁止表現なし${badL.length ? '：' + badL.join('、') : ''}`);
} else check(false, 'line.txt がある');

// 形式
if ((post.format || 'carousel') === 'carousel') {
  check(Array.isArray(post.slides) && post.slides.length === 5, 'カルーセルは5枚');
  const last = post.slides?.[4];
  check(last && last.kind === 'cta' && /紹介/.test(JSON.stringify(last)), '5枚目が紹介のご案内カード');
} else {
  const fr = post.reel?.frames || [];
  const total = fr.reduce((a, f) => a + (f.sec || 3), 0) - Math.max(fr.length - 1, 0) * 0.4;
  check(fr.length >= 2 && fr.length <= 4, `リールのコマ数 ${fr.length}（2〜4）`);
  check(total >= 7 && total <= 12, `リールの長さ ${total.toFixed(1)}秒（7〜12秒）`);
  check(fr[0] && fr[0].kind === 'hook', '1コマ目は結論の一文（hook）');
}

// 直近4回と締めの文が同じでないこと（固定の案内文は除く）
const fixed = /(完全紹介制|初回カウンセリング|プロフィールのリンク|送ってくださった方を通して)/;
const root = path.dirname(dir);
const prev = fs.readdirSync(root).filter(f => f < path.basename(dir)).sort().slice(-4)
  .map(f => path.join(root, f, 'caption.txt')).filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8'));
const sents = body.split(/(?<=。)/).map(s => s.trim()).filter(s => s.length > 8 && !fixed.test(s));
const dup = sents.filter(s => prev.some(p => p.includes(s)));
check(dup.length === 0, `直近4回と同じ文なし${dup.length ? '：' + dup.join(' / ') : ''}`);

for (const m of ok) console.log('合格 ', m);
for (const m of ng) console.log('不合格', m);
console.log(ng.length ? `\n不合格 ${ng.length}件` : '\nすべて合格');
process.exitCode = ng.length ? 1 : 0;
