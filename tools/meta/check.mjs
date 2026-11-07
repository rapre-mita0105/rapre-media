// トークンの確認：つながっているFacebookページとInstagramアカウント、使える権限を表示する（数値・投稿は変えない）
import { graph, env, igUserId } from './graph.mjs';
const page = await graph('GET', env('FB_PAGE_ID'), { fields: 'name,followers_count' });
const ig = await igUserId();
const prof = await graph('GET', ig, { fields: 'username,followers_count' });
console.log(`Facebookページ: ${page.name}（id ${env('FB_PAGE_ID')}、フォロワー ${page.followers_count}）`);
console.log(`Instagram: @${prof.username}（id ${ig}、フォロワー ${prof.followers_count}）`);
const perms = await graph('GET', 'me/permissions').catch(() => null);
if (perms?.data) console.log('許可されている権限: ' + perms.data.filter((p) => p.status === 'granted').map((p) => p.permission).join(', '));
const lim = await graph('GET', `${ig}/content_publishing_limit`, { fields: 'quota_usage,config' }).catch((e) => ({ error: e.message }));
console.log('公開の上限（24時間）: ' + JSON.stringify(lim.data?.[0] || lim));
