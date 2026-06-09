<div align="center">

# 🚐 Biz-Navi（ビズナビ）

### 軽貨物ドライバーのための業務支援アプリ

**ハンドルを握るドライバーの毎日をちょっと軽くする相棒**

[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?style=flat-square)](https://llcsdsa-cmd.github.io/biz-navi.test/)
![Version](https://img.shields.io/badge/version-v0-orange?style=flat-square)
![License](https://img.shields.io/badge/license-Private-red?style=flat-square)

</div>

---

## 📌 概要

**Biz-Navi** は、軽貨物個人事業主（黒ナンバードライバー）のために設計された、完全オフライン動作のPWA（Progressive Web App）型業務支援ツールです。

freeeやマネーフォワードのような「会計ソフト」ではなく、  
**「Excelや紙のノートで毎晩計算しているドライバーを救う相棒」** として開発されています。

---

## ✨ 主な特徴

| 特徴 | 説明 |
|------|------|
| 📱 完全オフライン動作 | Service Worker実装済み。電波なしでも全機能使用可能 |
| 🔒 データをサーバーに送らない | 売上・経費はスマホ内のみに保存。完全サーバーレス設計 |
| 🚀 会計知識ゼロでOK | 「借方・貸方」を「何に使ったか・どこから払ったか」に平易化 |
| ☁️ クラウドバックアップ | Google Drive連携で一発バックアップ（ワンタップ） |
| 📊 確定申告サポート | 電帳法対応・CSV出力・科目別集計で申告準備を効率化 |
| 🆓 60日間無料 | 最初の60日間は全機能が完全無料 |

---

## 🎯 ターゲットユーザー

- 軽貨物個人事業主（Amazon Flex・PickGo・黒ナンバー等）
- 青色申告初心者・既存の会計ソフトで挫折した方
- Excelやメモアプリでなんとなくやっている方

---

## 📱 機能一覧（11ページ構成）

### ダッシュボード
- 今日のアクションバナー（業務前／業務中／業務後の3状態）
- 収入・支出・手残り KPIカード
- 月次収支グラフ・累積利益折れ線（Chart.js）
- 科目別内訳ドーナツチャート
- 月次カレンダー（収支ドット・走行距離表示）
- 車検・保険期限アラートバナー（30日前から色分け表示）

### 取引入力（§6 新設計UI）
- **3ステップ入力フロー**：用途 → カテゴリ → 金額
- スマートサジェスト（マイ辞書による店舗学習）
- 表記揺れ自動正規化（`ＥＮＥＯＳ` / `eneos` → `ENEOS`）
- 入力直後5秒間「↩️ 取り消す」Undoトースト
- 証拠画像保存（SHA-256ハッシュ付き・電帳法対応）
- 汎用CSVインポート（銀行・クレカ明細対応）

### 日報
- 業務開始・終了モーダル（前回ODO自動プリセット）
- 走行距離・時給リアルタイム計算
- カレンダーへの走行距離表示

### 取引記録帳
- 未確認／確認済みタブ切替
- ワンタップ承認UI

### 総勘定元帳・消費税管理・電帳法対応・資産管理・集計レポート

### 経営支援チェック・補助金情報
- 全ユーザー無料で利用可能

### 設定・ウィザード
- 10ステップ承認ウィザード（初回起動時）
- 4ステップ初期設定ウィザード
- 設定画面からウィザードを再実行可能
- Google Drive バックアップ設定（ヒーローUI）
- Firebase Auth（Googleアカウントログイン）

---

## ☁️ バックアップ設計

```
プライマリ   : localStorage（スマホ内）
セカンダリ   : Google Drive（推奨・ヒーローUI）
その他       : Dropbox / OneDrive / WebDAV（折りたたみ表示）
```

**一発クラウド退避ボタン**：設定ページ最上部の大型ボタンをタップするだけで Google Drive に即バックアップ。

---

## 🔐 認証・セキュリティ

- Firebase Auth（Google OAuth）でログイン → 複数端末同期に対応
- `firebase-config.js` は `.gitignore` 対象（APIキーをGitHubに公開しない設計）
- テンプレートとして `firebase-config.example.js` をリポジトリで管理

---

## 🛠️ 技術スタック

| 項目 | 内容 |
|------|------|
| フロントエンド | HTML / CSS / Vanilla JavaScript のみ |
| データ保存 | localStorage（プライマリ） |
| クラウド連携 | Google Drive API（appDataFolder） |
| 認証 | Firebase Auth v9 compat（Google OAuth） |
| グラフ描画 | Chart.js |
| PWA | Service Worker + manifest.json |
| ホスティング | GitHub Pages |
| 廃止済み | Python / MeCab / TF-IDF（§6移行で撤廃） |

---

## 📂 ファイル構成

```
biz-navi.test/
├── index.html              # UI・ページ定義（約1,400行）
├── app.js                  # メインロジック（約7,300行）
├── settings.js             # 設定・ウィザード（約923行）
├── style.css               # スタイル（約2,373行）
├── auth.js                 # Firebase Auth / Google OAuth
├── gdrive.js               # Google Drive連携
├── storage.js              # ストレージ管理
├── dencho.js               # 電帳法対応
├── pro-tax.js              # 経営支援チェック
├── pro-subsidy.js          # 補助金情報
├── pro-features.js         # FABボタン基盤
├── terms.js                # 利用規約・免責事項本文
├── accounts.js             # 勘定科目定義
├── icons.js                # SVGアイコン（39種）
├── manifest.json           # PWAマニフェスト
├── sw.js                   # Service Worker（オフライン対応）
├── firebase-config.js      # ⚠️ .gitignore対象（実キー記載）
├── firebase-config.example.js  # テンプレート（ダミー値）
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## 🚀 セットアップ（開発者向け）

### 1. リポジトリをクローン

```bash
git clone https://github.com/llcsdsa-cmd/biz-navi.test.git
cd biz-navi.test
```

### 2. Firebase設定ファイルを作成

```bash
cp firebase-config.example.js firebase-config.js
# firebase-config.js を開いて実際の値を入力
```

### 3. ローカルサーバーで起動

```bash
# Python 3
python3 -m http.server 8000

# または VS Code Live Server 等
```

### 4. ブラウザでアクセス

```
http://localhost:8000
```

---

## 💰 料金設計

| プラン | 料金 | 内容 |
|--------|------|------|
| フリートライアル | 無料 | 最初の60日間・全機能利用可 |
| 通常プラン | 月額500円 | 全機能・追加課金なし・広告なし |

> Apple税（30%）回避のため、決済は外部ブラウザ（公式サイト）経由の Stripe を予定。

---

## ⚖️ 免責事項

- 本アプリは会計・税務アドバイスを提供するものではありません
- 確定申告の最終的な責任はすべてユーザーご自身にあります
- 損害賠償の上限は、ユーザーが過去12ヶ月に支払った利用料金（最大6,000円）とします

---

## 📈 開発状況

| 領域 | 進捗 |
|------|------|
| コア機能 | ██████████ 約95% |
| UI・UX | ██████████ 約95% |
| バックアップ連携 | █████████░ 約85% |
| オンボーディング | █████████░ 約85% |
| PWA対応 | █████████░ 約90% |
| 決済基盤（Stripe） | ██░░░░░░░░ 約20% |
| **総合** | **█████████░ 約86%** |

---

<div align="center">

© 2026 LLC SDSA — Biz-Navi  
**軽貨物ドライバーの毎日をちょっと軽くする**

</div>
