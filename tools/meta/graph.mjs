// Meta Graph API（Instagram・Facebookページ）の共通処理。外部ライブラリなし（Node 20 の fetch を使う）。
// 必要な環境変数（GitHub の Secrets に保存する。リポジトリには書かない）:
//   META_TOKEN    … システムユーザーのアクセストークン（期限なし）
// 任意（無ければ自動で決める）:
//   FB_PAGE_ID    … Facebookページのid（既定 101916651284095：Metricoolに接続済みのページ）
//   IG_USER_ID    … Instagramビジネスアカウントのid（無ければページに紐づくアカウントを使う）
// 任意: GRAPH_VERSION（既定 v23.0）

export const VERSION = process.env.GRAPH_VERSION || 'v23.0';
export const BASE = `https://graph.facebook.com/${VERSION}`;

const DEFAULTS = { FB_PAGE_ID: '101916651284095' };

export function env(name, required = true) {
  const v = process.env[name] || DEFAULTS[name];
  if (required && !v) throw new Error(`環境変数 ${name} がありません（GitHub の Secrets を確認）`);
  return v;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET / POST。トークンはURLに出さず Authorization ヘッダーで送る（ログに残さないため）。
export async function graph(method, path, params = {}, { token } = {}) {
  const t = token || env('META_TOKEN');
  const url = new URL(path.startsWith('http') ? path : `${BASE}/${path.replace(/^\//, '')}`);
  const init = { method, headers: { Authorization: `Bearer ${t}` } };
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  } else {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) body.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    init.body = body;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, init);
    const json = await res.json().catch(() => ({}));
    if (res.ok && !json.error) return json;
    const e = json.error || {};
    const transient = res.status >= 500 || e.is_transient || e.code === 2 || e.error_subcode === 2207001;
    if (transient && attempt < 3) { await sleep(30000 * attempt); continue; }
    const err = new Error(`Graph API ${method} ${url.pathname}: ${res.status} ${e.message || ''} (code ${e.code}, subcode ${e.error_subcode})`);
    err.graph = e;
    throw err;
  }
}

// 動画などのコンテナが使える状態（FINISHED）になるまで待つ。最大およそ10分。
export async function waitContainer(id) {
  for (let i = 0; i < 40; i++) {
    const { status_code, status } = await graph('GET', id, { fields: 'status_code,status' });
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`コンテナ ${id} が ${status_code}: ${status || ''}`);
    await sleep(15000);
  }
  throw new Error(`コンテナ ${id} が時間内に準備できませんでした`);
}

// IG_USER_ID が無いときは、Facebookページに紐づくInstagramビジネスアカウントのidを使う
export async function igUserId() {
  if (process.env.IG_USER_ID) return process.env.IG_USER_ID;
  const r = await graph('GET', env('FB_PAGE_ID'), { fields: 'instagram_business_account{id,username}' });
  const id = r.instagram_business_account?.id;
  if (!id) throw new Error('Facebookページに紐づくInstagramビジネスアカウントが見つかりません');
  process.env.IG_USER_ID = id;
  return id;
}
