// 投稿フォルダを、Meta Graph API で Instagram と Facebookページへ公開する。
// 使い方:
//   node tools/meta/publish.mjs --due              公開時刻（post.json の slot）を迎えた未公開のフォルダをすべて公開
//   node tools/meta/publish.mjs posts/rapre/<フォルダ>   指定したフォルダを公開
//   --dry-run を付けると、何を公開するかを表示するだけで、APIは呼ばない
// 公開した結果は <フォルダ>/published.json に書く（同じ投稿を二重に出さないため）。
import fs from 'node:fs';
import path from 'node:path';
import { graph, waitContainer, env, VERSION, igUserId } from './graph.mjs';

const REPO_RAW = process.env.RAW_BASE || 'https://raw.githubusercontent.com/rapre-mita0105/rapre-media/main';
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const DUE = args.includes('--due');
const EARLY_MIN = 15;   // 予定の何分前から出してよいか
const LATE_HOURS = 6;   // 予定から何時間過ぎたら、出さずに報告だけにするか

const rawUrl = (folder, rel) => `${REPO_RAW}/${folder.split(path.sep).join('/')}/${rel}`;
const readJson = (p, d) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : d);

function plan(folder) {
  const post = readJson(path.join(folder, 'post.json'));
  const caption = fs.readFileSync(path.join(folder, 'caption.txt'), 'utf8').trim();
  const steps = [];
  if (post.format === 'carousel') {
    const slides = fs.readdirSync(path.join(folder, 'carousel')).filter((f) => /^slide_\d+\.jpg$/.test(f)).sort();
    const urls = slides.map((f) => rawUrl(folder, `carousel/${f}`));
    steps.push({ key: 'ig_post', run: () => igCarousel(urls, caption) });
    steps.push({ key: 'fb_post', run: () => fbPhotos(urls, caption) });
  } else if (post.format === 'reel' || post.format === 'trial_reel') {
    const video = rawUrl(folder, 'reel/reel.mp4');
    const cover = rawUrl(folder, 'reel/cover.jpg');
    const trial = post.format === 'trial_reel';
    steps.push({ key: 'ig_post', run: () => igReel(video, cover, caption, trial) });
    if (!trial) steps.push({ key: 'fb_post', run: () => fbReel(video, caption) }); // トライアルリールはInstagramだけ
  } else {
    throw new Error(`${folder}: post.json の format が不明（${post.format}）`);
  }
  if (fs.existsSync(path.join(folder, 'story/story.jpg'))) {
    const story = rawUrl(folder, 'story/story.jpg');
    steps.push({ key: 'ig_story', run: () => igStory(story) });
    steps.push({ key: 'fb_story', run: () => fbStory(story) });
  }
  return { post, steps };
}

// ---------- Instagram ----------
const IG = () => env('IG_USER_ID');
async function igPublish(creationId) {
  await waitContainer(creationId);
  const { id } = await graph('POST', `${IG()}/media_publish`, { creation_id: creationId });
  const { permalink } = await graph('GET', id, { fields: 'permalink' }).catch(() => ({}));
  return { id, permalink };
}
async function igCarousel(urls, caption) {
  const children = [];
  for (const image_url of urls) children.push((await graph('POST', `${IG()}/media`, { image_url, is_carousel_item: true })).id);
  for (const c of children) await waitContainer(c);
  const { id } = await graph('POST', `${IG()}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption });
  return igPublish(id);
}
async function igReel(video_url, cover_url, caption, trial) {
  const p = { media_type: 'REELS', video_url, cover_url, caption, share_to_feed: true };
  if (trial) p.trial_params = { graduation_strategy: 'MANUAL' }; // フォロワーへの公開は代表がアプリで判断（手順書 9.）
  const { id } = await graph('POST', `${IG()}/media`, p);
  return igPublish(id);
}
async function igStory(image_url) {
  const { id } = await graph('POST', `${IG()}/media`, { media_type: 'STORIES', image_url });
  return igPublish(id);
}

// ---------- Facebookページ ----------
const PAGE = () => env('FB_PAGE_ID');
let pageToken;
async function pt() {
  if (!pageToken) pageToken = (await graph('GET', PAGE(), { fields: 'access_token' })).access_token;
  return pageToken;
}
async function fbPhotos(urls, message) {
  const token = await pt();
  const ids = [];
  for (const url of urls) ids.push((await graph('POST', `${PAGE()}/photos`, { url, published: false }, { token })).id);
  const { id } = await graph('POST', `${PAGE()}/feed`, { message, attached_media: ids.map((media_fbid) => ({ media_fbid })) }, { token });
  return { id };
}
async function fbReel(fileUrl, description) {
  const token = await pt();
  const { video_id } = await graph('POST', `${PAGE()}/video_reels`, { upload_phase: 'start' }, { token });
  const up = await fetch(`https://rupload.facebook.com/video-upload/${VERSION}/${video_id}`, {
    method: 'POST', headers: { Authorization: `OAuth ${token}`, file_url: fileUrl },
  });
  if (!up.ok) throw new Error(`Facebookリールのアップロード失敗: ${up.status} ${await up.text()}`);
  await graph('POST', `${PAGE()}/video_reels`, { upload_phase: 'finish', video_id, video_state: 'PUBLISHED', description }, { token });
  return { id: video_id };
}
async function fbStory(url) {
  const token = await pt();
  const { id: photo_id } = await graph('POST', `${PAGE()}/photos`, { url, published: false }, { token });
  const r = await graph('POST', `${PAGE()}/photo_stories`, { photo_id }, { token });
  return { id: r.post_id || r.id };
}

// ---------- 実行 ----------
async function publishFolder(folder) {
  const recPath = path.join(folder, 'published.json');
  const rec = readJson(recPath, {});
  const { post, steps } = plan(folder);
  let failed = 0;
  for (const s of steps) {
    if (rec[s.key]?.id) { console.log(`- ${s.key}: 公開済みのためスキップ`); continue; }
    if (DRY) { console.log(`- ${s.key}: 公開予定（dry-run）`); continue; }
    try {
      rec[s.key] = { ...(await s.run()), at: new Date().toISOString() };
      console.log(`- ${s.key}: 公開しました ${rec[s.key].permalink || rec[s.key].id}`);
    } catch (e) {
      failed++;
      rec[s.key] = { error: e.message, at: new Date().toISOString() };
      console.error(`- ${s.key}: 失敗 ${e.message}`);
    }
    fs.writeFileSync(recPath, JSON.stringify(rec, null, 2) + '\n'); // 1件ごとに保存（途中で落ちても二重投稿しない）
  }
  return failed;
}

function dueFolders() {
  const root = 'posts/rapre';
  const now = Date.now();
  const out = [];
  for (const d of fs.readdirSync(root).sort()) {
    const folder = path.join(root, d);
    const post = readJson(path.join(folder, 'post.json'), null);
    if (!post?.slot) continue;
    const t = Date.parse(post.slot);
    const rec = readJson(path.join(folder, 'published.json'), {});
    if (rec.ig_post?.id) continue;
    if (t - now > EARLY_MIN * 60e3) continue;            // まだ早い
    if (now - t > LATE_HOURS * 3600e3) {                  // 遅れすぎ（古いフォルダ）は出さない
      if (now - t < 7 * 86400e3) console.log(`! ${folder}: 予定 ${post.slot} から${LATE_HOURS}時間以上過ぎたため公開しません`);
      continue;
    }
    out.push(folder);
  }
  return out;
}

const folders = DUE ? dueFolders() : args.filter((a) => !a.startsWith('--'));
if (!folders.length) { console.log('公開するフォルダはありません'); process.exit(0); }
if (!DRY) await igUserId();
let failed = 0;
for (const f of folders) { console.log(`# ${f}`); failed += await publishFolder(f); }
process.exit(failed ? 1 : 0);
