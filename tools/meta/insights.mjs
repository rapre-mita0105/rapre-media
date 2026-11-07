// Instagram と Facebookページの数値を Meta Graph API で取得し、automation/insights/<日付>.json に保存する。
// 毎朝 GitHub Actions が実行する。週次分析（Claude）はこのファイルを読む。
// 使い方: node tools/meta/insights.mjs [--days 14]
import fs from 'node:fs';
import { graph, env, igUserId } from './graph.mjs';

const args = process.argv.slice(2);
const DAYS = Number(args[args.indexOf('--days') + 1]) || 14;
const jstDate = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const since = Math.floor(Date.now() / 1000) - DAYS * 86400;
const until = Math.floor(Date.now() / 1000);
const out = { fetched_at: new Date().toISOString(), days: DAYS, instagram: {}, facebook: {}, unavailable: [] };

// 指標をまとめて取り、失敗したら1つずつ取り直す（取れない指標は unavailable に記録し、推測で埋めない）
async function metrics(id, list, extra = {}) {
  const res = {};
  const put = (data) => { for (const m of data || []) res[m.name] = m.total_value?.value ?? m.values?.[0]?.value ?? null; };
  try { put((await graph('GET', `${id}/insights`, { metric: list.join(','), ...extra })).data); }
  catch {
    for (const m of list) {
      try { put((await graph('GET', `${id}/insights`, { metric: m, ...extra })).data); }
      catch (e) { res[m] = '取得不可'; out.unavailable.push(`${id}:${m} ${e.graph?.message || e.message}`); }
    }
  }
  return res;
}

const FEED = ['reach', 'views', 'saved', 'shares', 'comments', 'likes', 'total_interactions', 'follows', 'profile_visits'];
const REEL = ['reach', 'views', 'saved', 'shares', 'comments', 'likes', 'total_interactions', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time', 'reels_skip_rate'];
const STORY = ['reach', 'views', 'replies', 'shares', 'follows', 'total_interactions', 'navigation'];

// ---------- Instagram ----------
const ig = await igUserId();
const profile = await graph('GET', ig, { fields: 'username,followers_count,follows_count,media_count' });
out.instagram.profile = profile;

const media = (await graph('GET', `${ig}/media`, { fields: 'id,timestamp,media_type,media_product_type,permalink,caption', since, limit: 50 })).data || [];
out.instagram.media = [];
for (const m of media) {
  const isReel = m.media_product_type === 'REELS';
  const v = await metrics(m.id, isReel ? REEL : FEED);
  const row = { id: m.id, timestamp: m.timestamp, type: isReel ? 'REEL' : m.media_type, permalink: m.permalink, caption_head: (m.caption || '').slice(0, 40), ...v };
  if (typeof v.reach === 'number' && v.reach > 0) {
    if (typeof v.saved === 'number') row.saved_per_reach = +(v.saved / v.reach).toFixed(4);
    if (typeof v.shares === 'number') row.shares_per_reach = +(v.shares / v.reach).toFixed(4);
  }
  if (typeof v.ig_reels_avg_watch_time === 'number') row.avg_watch_sec = +(v.ig_reels_avg_watch_time / 1000).toFixed(2);
  out.instagram.media.push(row);
}

// ストーリーズは公開から24時間しか数値が取れないため、毎日取って残す
const stories = (await graph('GET', `${ig}/stories`, { fields: 'id,timestamp,permalink' }).catch(() => ({ data: [] }))).data || [];
out.instagram.stories = [];
for (const s of stories) out.instagram.stories.push({ id: s.id, timestamp: s.timestamp, ...(await metrics(s.id, STORY, { metric_type: 'total_value' })) });

// アカウント：フォロワー／非フォロワー別のリーチ、フォローとフォロー解除
const acct = { since: new Date(since * 1000).toISOString(), until: new Date(until * 1000).toISOString() };
for (const [name, metric, extra] of [
  ['reach_by_follow_type', 'reach', { breakdown: 'follow_type' }],
  ['follows_and_unfollows', 'follows_and_unfollows', { breakdown: 'follow_type' }],
  ['accounts_engaged', 'accounts_engaged', {}],
  ['interactions_by_media_type', 'total_interactions', { breakdown: 'media_product_type' }],
]) {
  try {
    const d = (await graph('GET', `${ig}/insights`, { metric, period: 'day', metric_type: 'total_value', since, until, ...extra })).data?.[0];
    acct[name] = d?.total_value ?? null;
  } catch (e) { acct[name] = '取得不可'; out.unavailable.push(`account:${name} ${e.graph?.message || e.message}`); }
}
try {
  acct.follower_count_daily = (await graph('GET', `${ig}/insights`, { metric: 'follower_count', period: 'day', since: Math.max(since, until - 29 * 86400), until })).data?.[0]?.values ?? null;
} catch (e) { acct.follower_count_daily = '取得不可'; out.unavailable.push(`account:follower_count ${e.graph?.message || e.message}`); }
out.instagram.account = acct;

// ---------- Facebookページ ----------
try {
  const page = env('FB_PAGE_ID');
  const token = (await graph('GET', page, { fields: 'access_token' })).access_token;
  out.facebook.profile = await graph('GET', page, { fields: 'name,followers_count,fan_count' }, { token });
  const posts = (await graph('GET', `${page}/posts`, { fields: 'id,created_time,permalink_url,message,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)', since, limit: 50 }, { token })).data || [];
  out.facebook.posts = posts.map((p) => ({
    id: p.id, created_time: p.created_time, permalink: p.permalink_url, message_head: (p.message || '').slice(0, 40),
    reactions: p.reactions?.summary?.total_count ?? null, comments: p.comments?.summary?.total_count ?? null, shares: p.shares?.count ?? 0,
  }));
} catch (e) { out.facebook = '取得不可'; out.unavailable.push(`facebook ${e.graph?.message || e.message}`); }

fs.mkdirSync('automation/insights', { recursive: true });
fs.writeFileSync(`automation/insights/${jstDate}.json`, JSON.stringify(out, null, 2) + '\n');
console.log(`automation/insights/${jstDate}.json を保存（Instagram ${out.instagram.media.length}件、ストーリーズ ${out.instagram.stories.length}件、取得不可 ${out.unavailable.length}件）`);
