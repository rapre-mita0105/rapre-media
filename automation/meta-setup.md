# 無料の完全自動化（Meta Graph API ＋ GitHub Actions）の設定手順

## これで何ができるか
- Instagram と Facebookページへの公開を、Metricool を使わずに自動で行える（Meta公式の無料の仕組み）。
- Metricool では取れなかった数値（投稿ごとのフォロー数、フォロワー／非フォロワー別のリーチ、カルーセルのシェア、ストーリーズの数値）を毎朝自動で取得し、automation/insights/<日付>.json に保存する。
- 動かす場所は GitHub Actions（このリポジトリは公開リポジトリのため無料）。費用はかからない。

## 仕組みの流れ
1. 投稿の制作（画像・動画・キャプション）… これまでどおり Claude の定期実行が作り、GitHub に保存する。
2. 公開 … 毎日 19:55 と 20:25（日本時間）に GitHub Actions が動き、公開時刻を迎えた投稿を Instagram と Facebook に出す（meta-publish）。
3. 数値 … 毎朝 8:30 に GitHub Actions が数値を取得して保存する（meta-insights）。
4. 分析 … 毎週土曜の朝、Claude の週次分析が保存された数値を読んで週報を書く。

公開に失敗すると、GitHub から代表のメールアドレスに失敗のお知らせが届く（GitHub の標準機能）。

## 代表に1回だけしていただくこと（およそ30分）

### 手順1　Meta for Developers に登録し、アプリを作る（無料）
1. パソコンで https://developers.facebook.com/ を開き、Rapre のFacebookページを管理しているアカウントでログインして「開発者として登録」する。
2. 「マイアプリ」→「アプリを作成」。用途は「ビジネス」または「Instagramのコンテンツを管理」を選ぶ。アプリ名は「Rapre自動投稿」など。ビジネスポートフォリオは Rapre（またはエレメンタルトリニティ）のものを選ぶ。
3. アプリは「開発モード」のままでよい（自分のアカウントだけに使うため、審査は不要）。

### 手順2　システムユーザーのトークン（期限なし）を作る
1. Meta Business Suite の「設定」（ビジネス設定）→「ユーザー」→「システムユーザー」→「追加」。名前は「rapre-bot」、役割は「管理者」。
2. 作ったシステムユーザーを選び「アセットを割り当てる」で、
   - Facebookページ「Rapre」…「すべての権限」
   - Instagramアカウント「@rapre_official」…「すべての権限」
   - アプリ「Rapre自動投稿」…「管理」
3. 「新しいトークンを生成」→ アプリ「Rapre自動投稿」、有効期限「なし」、次の権限にチェック：
   instagram_basic、instagram_content_publish、instagram_manage_insights、
   pages_show_list、pages_read_engagement、pages_manage_posts、read_insights、business_management
4. 表示されたトークン（長い英数字）をコピーする。このトークンは人に見せない。チャットにも貼らない。

### 手順3　トークンを GitHub に保存する
1. https://github.com/rapre-mita0105/rapre-media を開き「Settings」→「Secrets and variables」→「Actions」。
2. 「New repository secret」→ Name に META_TOKEN、Secret にコピーしたトークンを貼って保存。

### 手順4　動作確認
1. リポジトリの「Actions」タブ →「meta-check」→「Run workflow」。
2. 終わったら開いて、Facebookページ名と @rapre_official、フォロワー数が表示されていれば成功。
3. 続けて「meta-insights」→「Run workflow」。automation/insights/ に今日の日付のファイルができれば、数値の取得は成功。
4. 毎朝自動で取るには「Settings」→「Secrets and variables」→「Actions」→「Variables」タブで
   META_INSIGHTS_ENABLED を値 true で作る。

ここまで済んだら、Claude とのチャットで「Graph APIの確認が終わった」とお伝えください。

### 手順5　公開を Metricool から切り替える（確認が済んでから）
二重投稿を防ぐため、次の2つを同じ日に行う。
1. Claude とのチャットで「Graph APIの公開に切り替え」と伝える（Claude が手順書を変え、制作の実行が Metricool に予約しなくなる）。
2. Variables に META_PUBLISH_ENABLED を値 true で作る。
切り替え前に「meta-publish」を dry_run=true で手動実行すると、何が公開されるかを公開せずに確かめられる。

切り替え後、Metricool は無料プランに戻すか解約してよい（数値は automation/insights/ に残る）。

## 注意
- GitHub Actions の定時実行は、混雑時に数分〜十数分遅れることがある。予備の 20:25 の実行で拾う。予定から6時間を過ぎた投稿は出さずに残す。
- トライアルリールは「フォロワーへの公開は手動」（graduation_strategy=MANUAL）で出す。フォロワーに公開するかは、これまでどおり代表がアプリで判断する。
- 公開できる上限は Instagram の仕組みで24時間に100件。Rapre の頻度では問題にならない。
- Meta の仕様変更で動かなくなった場合は、失敗のメールが届く。そのときは Claude に「meta-publish が失敗した」と伝える。
- まだ実際のトークンで動かしていないため、手順4の確認で直す点が出る可能性がある。
