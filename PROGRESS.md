==========================================================

---

## [2026-06-10] COOP問題解決：signInWithRedirect方式に切替

### 問題（コンソールログで特定）
```
[Auth] accessToken: null
Cross-Origin-Opener-Policy policy would block the window.closed call.
```

### 根本原因
**GitHub Pages は `Cross-Origin-Opener-Policy: same-origin` ヘッダーを送信する。**
このため Firebase の `signInWithPopup` が開いたGoogleログインポップアップの
結果を親ウィンドウが受け取れず、`credential.accessToken` が常に `null` になる。
`credentialFromResult()` を使っても同じ結果（COOPはブラウザレベルの制限）。

### 解決策：signInWithRedirect 方式に切替

#### auth.js（全面改修）
- `signInWithPopup()` → `signInWithRedirect()` に変更
  - リダイレクト方式はポップアップを使わないためCOOPの影響を受けない
- `_handleRedirectResult()` を新規追加
  - `DOMContentLoaded` → `initFirebase()` → `getRedirectResult()` の順で呼ばれる
  - リダイレクトログイン後のページ読み込み時のみ result に値が入る
  - `credential.accessToken` を確実に取得 → `connectGDriveWithToken()` で Drive接続
- `initFirebase()` 内で `_handleRedirectResult()` を自動呼び出し

#### index.html
- `auth-section-body` の初期HTML（スピナー）を削除
  - リダイレクト方式ではページ再読み込み時にスピナーが残り続ける問題を防止
  - `onAuthStateChanged` 発火後に `renderAuthSection()` が正しい状態を描画する

### 修正後のフロー
```
「Gmailでログイン」ボタン押下
  └→ signInWithRedirect() でGoogleログインページへ遷移（ポップアップなし）
      └→ Googleアカウント選択・drive.appdataスコープ許可
          └→ アプリページに戻る（リダイレクト）
              └→ DOMContentLoaded → initFirebase() → getRedirectResult()
                  └→ credential.accessToken 取得（確実）
                      └→ connectGDriveWithToken() でDrive接続
                          └→「Google Drive バックアップが有効になりました ✓」
```

---

## [2026-06-10] Drive接続失敗の根本修正（credentialFromResult・テンプレートリテラル廃止）

### 問題
- 「接続する」ボタンを押すと赤いエラーが出て接続されない
- Google Drive 未接続の状態が解消されない

### 根本原因（今回特定）
1. **`credential.accessToken` が null になるケース**
   - `result.credential?.accessToken` はFirebase Auth compatの仕様上、
     iOSや一部環境で `null` を返すことがある
   - 正しくは `firebase.auth.GoogleAuthProvider.credentialFromResult(result)` を使う必要がある

2. **テンプレートリテラルのネスト二重エスケープ**
   - `_uploadFile()` 内の `` `name='${filename}'` `` が
     Python heredocやJSエンジンによって二重エスケープされる場合があった
   - 文字列連結に統一して根絶

### 修正内容

#### auth.js
- `result.credential?.accessToken` → `firebase.auth.GoogleAuthProvider.credentialFromResult(result)` に変更
- テンプレートリテラルを文字列連結に完全統一
- `signOut()` で `resetGDriveToken()` を呼ぶよう修正

#### gdrive.js
- テンプレートリテラルを文字列連結に完全統一（エスケープ問題の根絶）
- `resetGDriveToken()` を新規追加（外部公開関数）
- `loadGDrive()` の `sr.json()` 二重呼び出しバグを修正
- `_markConnected()` / `_refreshUI()` に分離してコードをDRY化

### 期待される動作
```
Gmailでログイン（1タップ）
  └→ Googleアカウント選択（ポップアップ）
      └→ drive.appdata スコープも同時許可
          └→ credentialFromResult でアクセストークン確実取得
              └→ connectGDriveWithToken() でテストアップロード
                  └→「Google Drive バックアップが有効になりました ✓」
                  └→ アカウントカードが緑バッジ「接続済み」に更新
```

---

## [2026-06-10] 「Client IDを入力してください」エラーの根絶

### 問題
Googleログイン済み・「接続する」ボタン押下後に「Client IDを入力してください」が表示される。

### 根本原因
`storage.js` に旧来の `connectGDrive()` / `uploadGDrive()` / `loadGDrive()` が残存しており、
`gdrive.js` の Firebase Auth 統合版を**上書き**していた。

- `storage.js:connectGDrive()` — `storageSettings.gdrive.clientId` をチェックして空なら「Client IDを入力してください」を表示
- `storage.js:uploadGDrive()` — `cfg.token` がないと「Google Drive未接続」を throw
- `settings.js:testAndShowGDriveStatus()` — 削除済みの `testGDriveConnection()` を呼んでいた

### 修正内容

#### storage.js
- `uploadGDrive()` / `loadGDrive()` / `connectGDrive()` の3関数を**完全削除**
- `gdrive.js` の Firebase Auth 統合版のみ使用するよう統一
- コメントに「gdrive.jsで定義」を明記

#### settings.js
- `testAndShowGDriveStatus()` の旧実装を削除（`gdrive.js` の同名関数に委譲）

### 修正後の関数の所在
| 関数 | ファイル |
|------|---------|
| `connectGDrive()` | gdrive.js（Firebase Auth統合版） |
| `connectGDriveWithToken()` | gdrive.js |
| `uploadGDrive()` | gdrive.js |
| `loadGDrive()` | gdrive.js |
| `disconnectGDrive()` | gdrive.js |
| `testAndShowGDriveStatus()` | gdrive.js |


---

## [2026-06-10] GIS完全廃止・Firebase Auth一本化でDrive接続を完結

### 問題
- Gmailログイン後も「接続する」ボタンが必要（2ステップ）
- 「接続する」を押すと「client IDが必要」エラーが発生

### 根本原因
- `gdrive.js` の `getGDriveAccessToken()` が GIS（Google Identity Services）の `_tokenClient` を使用していた
- `connectGDrive()` から `uploadGDrive()` → `getGDriveAccessToken()` の経路でGISが起動し「client ID」を要求
- `DEFAULT_STORAGE_SETTINGS` の `gdrive` に `clientId: ''` フィールドがあり、settings.jsがそれを表示していた

### 解決策：GIS完全廃止

#### gdrive.js（全面書き直し）
- `getGDriveAccessToken()` をGISなし・**メモリトークン返却のみ**に変更
  - トークン切れ時は `NEED_REAUTH` エラーを throw → 再ログイン誘導
- `connectGDrive()` は未ログイン/トークン切れなら `signInWithGoogle()` を呼ぶ（= 再ログインでDrive接続も自動完了）
- `_loadGISScript`, `_tokenClient`, `connectGDriveAuto`, GIS関連コードを**全削除**
- `_driveRequest()` ラッパーで NEED_REAUTH 時に再ログイントーストを表示

#### storage.js
- `DEFAULT_STORAGE_SETTINGS.gdrive` から `clientId`, `clientSecret`, `folderId`, `folderName` を除去
  - `{ connected: false }` のみに簡略化

#### settings.js
- GDrive未接続時の「接続する」ボタンを `connectGDrive()` に一本化
  - ログイン済み/未済どちらでも同じボタンで動作

### 最終フロー（更新後）
```
「Gmailでログイン」1タップ
  └→ Firebase Auth ポップアップ（drive.appdata スコープ込み）
      └→ credential.accessToken をメモリにセット
          └→ connectGDriveWithToken() でテストアップロード
              └→ 「Google Drive バックアップが有効になりました ✓」
              → 以降の操作でもトークンは55分間有効
```


---

## [2026-06-10] Gmailログイン → Google Drive 自動接続の実装

### 修正ファイル
- `auth.js` — signInWithGoogle, _autoConnectGDrive, renderAuthSection
- `gdrive.js` — setGDriveTokenFromFirebase, connectGDriveWithToken, connectGDriveAuto
- `style.css` — .auth-drive-status, .auth-drive-ok, .auth-drive-pending

### 変更内容
**問題**: Gmailログインは成功するが、Google Driveへの接続は別途「接続する」ボタンを押す必要があり、2ステップになっていた。

**解決策**: 1回のGmailログインでAuth + Drive接続が完了するよう統合した。

#### auth.js
- `signInWithGoogle()` — `drive.appdata` スコープをFirebase Auth時に同時要求し、取得したアクセストークンを即座に `connectGDriveWithToken()` に渡す
- `_autoConnectGDrive()` — `onAuthStateChanged` でログイン検知時にサイレント自動接続を試みる（既接続はスキップ）
- `renderAuthSection()` — ログイン済み表示にDrive接続ステータスバッジを追加（接続済み✓ / 未接続+「今すぐ接続」ボタン）
- ログインヒントテキストを「ログインするだけでDrive自動バックアップが有効になります」に更新

#### gdrive.js
- `setGDriveTokenFromFirebase(accessToken)` — FirebaseのOAuthトークンをGDriveトークンとして直接セット（55分有効）
- `connectGDriveWithToken(accessToken)` — テストアップロードで接続確認し、backup設定を 'gdrive' に自動セット
- `connectGDriveAuto(email)` — GIS `prompt:''` でポップアップなしのサイレント接続を試みる（5秒タイムアウト）
- `connectGDrive()` — 手動接続後に `BizNaviAuth.renderAuthSection()` を追加

#### style.css
- `.auth-drive-status` — Drive接続状態表示エリア（ログイン済みカード内）
- `.auth-drive-ok` — 接続済み表示（緑系）
- `.auth-drive-pending` — 未接続表示（黄系）+ 「今すぐ接続」ボタン

### 接続フロー（更新後）
```
Gmailでログイン（1タップ）
  └→ Firebase Auth ポップアップ（Google選択）
      └→ drive.appdata スコープも同時許可
          └→ connectGDriveWithToken() でテストアップロード
              └→ 接続完了トースト表示 ✓
              └→ backup = 'gdrive' に自動設定
```

### フォールバック
- Firebase AuthトークンでのDrive接続が失敗した場合: `onAuthStateChanged` → `connectGDriveAuto()` でサイレント再試行
- それも失敗した場合: 設定画面の「接続する」手動ボタンが残る（既存挙動）

Biz-Navi (Biz-Insight Navigator) v0
実装状況 & やりたいことリスト達成状況
2026年6月 現在
==========================================================

【ファイル構成】
  app.js          3,687行→約7,300行  ── メインロジック ※全関数にSTART/ENDコメント付与済み
  settings.js       812行→約923行    ── 設定・ウィザード ※renderProviderConfig のENDコメント欠落あり（要修正）
  style.css       2,797行→約2,373行  ── スタイル（流動設計済み）
  index.html      1,267行→約1,400行  ── UI・ページ定義 ※PWAメタタグ追加済み（未プッシュ）
  pro-tax.js        655行→約667行    ── 経営支援チェック ※関数コメント付与済み
  pro-subsidy.js    391行→約403行    ── 補助金情報 ※関数コメント付与済み
  pro-features.js    80行→約92行     ── FABボタン基盤 ※新フロー統合・コメント付与済み
  icons.js                           ── SVGアイコン39種
  storage.js        294行→約394行    ── ストレージ管理 ※関数コメント付与済み
  accounts.js                        ── 勘定科目定義
  dencho.js         504行→約579行    ── 電帳法対応 ※関数コメント付与済み
  terms.js          NEW              ── 利用規約・免責事項本文データ（差し替え可能）
  auth.js           NEW (227行)      ── Firebase Auth Google OAuth認証（2026-06-05 実装済み）
  gdrive.js         435行            ── Google Drive連携（実装済み・ClientID設定待ち）
  manifest.json                      ── PWAマニフェスト ✅プッシュ済み
  sw.js                              ── Service Worker（オフライン対応）✅プッシュ済み
  entry-modal.js                     ── ★不要（openNewEntryModalをapp.jsに実装済み）
  normalizer.js                      ── ★不要（normalizeStoreNameをapp.jsに実装済み）
  onboarding.js                      ── ★不要（ProWizardをapp.jsに実装済み）
  classifier.py                      ── ✅削除済み（§6移行完了）
  tokenizer.py                       ── ✅削除済み（§6移行完了）
  line-bot.js                        ── LINE Bot連携（将来）

==========================================================
■ 進捗サマリー
==========================================================

  コア機能（全機能）       : ██████████████████  約 95% 完成
  取引入力UI（新設計§6）  : ██████████████████  約 95% 完成  ←numeric強制・Math.round・Undoトースト実装済み
  UI・UX・レスポンシブ     : ██████████████████  約 95% 完成
  バックアップ・連携       : ████████████████░░  約 85% 完成  ←一発クラウド退避ボタン実装済み・Google Drive優先UI完了
  オンボーディング         : ████████████████░░  約 85% 完成  ←§4§5実装済み／OAuth1択・免責上限未実装
  法務・利用規約           : ██████████░░░░░░░░  約 55% 完成  ←terms.js実装済み
  決済基盤（Firebase/Stripe): ████░░░░░░░░░░░░░░  約 20% 完成  ←Firebase Auth実装済み／Stripe未実装
  PWA・配布準備            : █████████████████░  約 90% 完成  ←manifest/SW/icons全プッシュ済み（アイコン生成済み）
  カメラ・写真管理         : ████░░░░░░░░░░░░░░  約 25% 完成  ←OCRなし保存のみ／隔離・軽量化未実装

  総合進捗（推定）         : ████████████████░░  約 86%

  コード総量               : 約 14,000行（Python廃止でJSのみ構成）
  実装ページ数             : 11ページ
  実装機能数               : 85以上

  ✅ 最優先タスク完了（2026-06-03）：
     1. manifest.json / sw.js / index.html（PWA対応）→ プッシュ完了
     2. classifier.py / tokenizer.py / test_classifier.py / requirements.txt / export_to_app.py → 削除完了
     3. icons/icon-192.png / icon-512.png → 生成・プッシュ完了

  ✅ 直近の優先タスクは全て完了（2026-06-05）
     ※ アイコン・グラフ表示バグは2026-06-03に修正済み
     ※ 一発クラウド退避ボタンは2026-06-05に実装済み
     ※ Firebase APIキー分離・GitHubセキュリティ対応は2026-06-05に完了

  🔽 優先度低（時期尚早・後回し）：
     - Firebase Auth実装（Google OAuth）
     - Stripe サブスク設定（月500円・60日トライアル）
-------------------------------------------------------------------------------------------------------------------
-----------------------------------------------------------
【緊急バグ修正（2026-06-09）アプリ全体が表示されない】
  ✅ openSetupWizard() の破損したテンプレートリテラルを修正
     原因: app.js L5242付近に \` と \${} という二重エスケープが混入しており
           JSパーサーがシンタックスエラーを発生させアプリ全体が起動不能になっていた
     修正: テンプレートリテラル（ネスト）を文字列結合（+演算子）に書き直し
           reeditBanner変数を事前定義してel.innerHTMLに代入する形に変更
-----------------------------------------------------------
【機能追加（2026-06-06）初期設定ウィザード再編集対応】
  ✅ 設定画面から初期設定ウィザードを再実行できるボタンを追加
     対象: app.js / index.html
     変更内容:
       - openSetupWizard(reEdit) 引数を追加
         reEdit=true のとき bizNavi_setup_done チェックをスキップして起動
         起動前に bizNaviSettings の現在値を bizNavi_setup_tmp にコピー（既存値が初期表示される）
         黄色バナー「✏️ 設定を変更しています」を表示
       - _swComplete() に再編集フラグ分岐を追加
         再編集時 → 完了後に設定画面へ戻る＋「設定を更新しました」トースト
         初回起動時 → 従来どおりダッシュボードへ遷移
       - index.html 設定画面に「初期設定」セクションを追加
         「✏️ 初期設定を変更する」ボタン → openSetupWizard(true) を呼び出し
         データ管理セクションの直前に配置
-----------------------------------------------------------
【UI修正（2026-06-06）スマートルール表示崩れ修正】
  ✅ 設定画面スマートルールセクションのモバイルレイアウト修正
     対象: index.html / app.js
     修正内容:
       - .rule-header を flex-wrap:wrap に変更（バッジが折り返せるよう）
       - .rule-header-left クラスを追加（アイコン+テキストのmin-width:0）
       - 🧭アイコン: --fs-2xl → --fs-xl に縮小
       - rule-count-badge: white-space:nowrap / flex-shrink:0 を追加
       - .rule-input/.rule-select: --fs-lg → --fs-md に縮小
       - h3 の white-space:nowrap を除去（overflow-wrap:break-word に変更）
       - margin/padding を全体的に数px縮小（12px基準に統一）
       - .rule-header h2: --fs-lg → --fs-md に縮小
-----------------------------------------------------------
【UI修正（2026-06-06）】
  ✅ スマホ画面での大文字フォントを縮小（モバイルUI崩れ対応）
     対象ファイル: app.js / settings.js / index.html / style.css
     変更内容:
       - カテゴリ選択ボタン絵文字: 2rem → 1.4rem（padding も縮小）
       - カテゴリアイコン span: 1.6rem → 1.2rem
       - 金額入力フィールド: 1.5rem → 1.1rem
       - ウィザードSTEPアイコン: 3rem → 2rem
       - 各種大絵文字アイコン（2.2〜2.5rem → 1.6〜1.8rem）
       - settings.js の絵文字ヘッダー: 3rem → 1.8rem
       - index.html のインライン絵文字: 1.3〜2.5rem → 1.1〜1.8rem
       - style.css .s-value--lg: 1.5rem → 1.2rem
-----------------------------------------------------------
【セキュリティ修正（2026-06-05 追記）】
  ✅ firebase-config.js のAPIキーをプレースホルダーに差し替え
     GitHub上のファイルからリアルキーを除去。
     実キーはローカルのfirebase-config.jsにのみ保持する運用に移行。
  ✅ .gitignore により firebase-config.js は今後GitHubに上がらない
【セキュリティ修正（2026-06-05）】
  ✅ Firebase APIキーをコードから分離（GitHubセキュリティ対応）
     原因: auth.js に FIREBASE_CONFIG 定数（APIキー含む）を直書きしており
           GitHub Secret Scanning がプッシュをブロックしていた
     対応:
       - firebase-config.js 新規作成（実キー記載・.gitignore対象）
         window.FIREBASE_CONFIG として定義しauth.jsから参照
       - firebase-config.example.js 新規作成（ダミー値・GitHub管理対象）
       - auth.js 修正: FIREBASE_CONFIG 定数を削除しwindow.FIREBASE_CONFIG参照に変更
       - index.html 修正: firebase-config.js をauth.jsより前に読み込み追加
       - .gitignore 新規作成: firebase-config.js を除外ルールに追加
     効果: GitHub Secret Scanning のブロックが解除される
---
【仕様変更（2026-06-05）】
  ✅ Firebase設定をユーザーに触らせない設計に変更
     - auth.js: FIREBASE_CONFIG定数をコード先頭に移動（開発者記入欄）
     - ユーザー向け設定UI（loadConfig/saveConfig/_showConfigForm等）を全削除
     - renderAuthSection()を2状態（未ログイン/ログイン済み）のみに簡略化
     - index.html: 「⚙️ Firebase設定を入力する」ボタンを除去
     ユーザーが操作するのは「Gmailでログイン」ボタンのみ
-----------------------------------------------------------
【機能実装（2026-06-05）】
  ✅ §2 Firebase Auth 実装（auth.js 新規作成）
     - BizNaviAuth 名前空間で全認証機能を管理
     - initFirebase()         : Firebase SDK（v9 compat）を動的読み込み・初期化
     - signInWithGoogle()     : Google OAuthポップアップ認証
     - signOut()              : ログアウト
     - onAuthStateChanged()   : ログイン状態監視コールバック登録
     - renderAuthSection()    : 設定ページ認証UIを2状態で描画
       ① 未ログイン: 「Gmailでログイン」ボタン
       ② ログイン済み: アバター・名前・メール・ログアウトボタン
       ※ _showConfigForm/_saveConfigFromForm/_clearConfig は仕様変更により削除済み
     - DOMContentLoaded時に自動初期化
  ✅ §2 index.html 設定ページ最上部に「👤 アカウント」セクション追加
     - 「Gmailでログイン」特大白ボタン（Googleロゴ内蔵）
     - 「ログインで複数端末同期・データ復元が使えます」ヒント文
     - 「Firebase設定を入力する」リンクボタン
     - auth.jsをscript読み込みに追加（gdrive.jsの前）
  ✅ §2 style.css Auth UIスタイル追加
     - .auth-google-btn: 白背景・Googleロゴ・hover/active状態
     - .auth-user-card / .auth-avatar / .auth-user-name / .auth-user-email
     - .auth-user-badge / .auth-signout-btn / .auth-hint / .auth-setup-link
-----------------------------------------------------------
【機能実装（2026-06-05）】
  ✅ §2 一発クラウド退避ボタン実装（settings.js / index.html / style.css）
     - quickSaveToGDrive() 新関数追加（settings.js）
       ・Google Drive 接続済みなら即 uploadGDrive() を呼び出してアップロード
       ・未接続なら「データ保存先」セクションへスムーズスクロールして案内
       ・ボタン状態: 通常 → saving(グレー) → done(グリーン) → 3秒後に通常に戻る
       ・storageSettings.lastBackup を更新・renderStorageStatus() を再描画
     - index.html: データ保護セクション先頭に大型青ボタンを追加
       ・Googleロゴ内蔵・サブテキストで状態フィードバック（#quick-cloud-status）
     - style.css: .quick-cloud-btn / .quick-cloud-icon / .quick-cloud-* スタイル追加
       ・saving / done 状態で背景グラデーションを自動切替
-----------------------------------------------------------
【機能実装（2026-06-04）】
  ✅ §2 Google Drive 優先UI・その他保存先の折りたたみ（settings.js / style.css）
     - renderProviderCards() を全面リニューアル
     - Google Drive をヒーローカードとして最上部に特等席表示
     - Dropbox / OneDrive / WebDAV を「その他の保存先 ▼」で折りたたみ
     - toggleOtherProviders() 新関数追加（開閉トグル）
     - style.css に .gdrive-hero-card / .other-providers-toggle 等を追加
-----------------------------------------------------------
【バグ修正（2026-06-04）】
  ✅ 利用規約モーダルの不正インデントを修正
     原因: openTermsModal()のテンプレートリテラル内で ${sec.body} の前に
           スペース14個のインデントが入っており、white-space:pre-wrap により
           各条文の本文先頭行だけ右にずれて表示されていた
     対応: ${sec.body} を行頭に移動し先頭スペースを除去
-----------------------------------------------------------
【機能追加（2026-06-04）】
  ✅ §4ウィザード STEP5「確定申告について」に免責明文化を追加
     - 「確定申告の最終的な責任はすべてユーザーご自身にある」を明記
     - 「本アプリは申告内容の正確性・完全性を保証しない」を追記
     - 「開発者はデータを閲覧しない・個別の税務アドバイスは提供しない」
       を黄色ボーダーのコールアウト枠で明示
  ✅ §4ウィザード STEP9「損害賠償の上限について」を新設（旧：利用規約全文）
     - アイコン変更: 📜→⚖️  タイトル変更: 利用規約（法的な全文）→損害賠償の上限について
     - 損害賠償上限「直近12ヶ月分・総額6,000円」を赤ボーダーのコールアウト枠で明示
     - 逸失利益・間接損害への免責を明記
     - 利用規約全文ボタンはSTEP9内に引き続き配置
-----------------------------------------------------------
【機能削除（2026-06-04）】
  ✅ スワイプ承認UI（attachSwipeToCards）を完全削除
     - app.js: attachSwipeToCards 関数（約100行）を削除
     - app.js: renderJournal 内の attachSwipeToCards 呼び出し箇所を削除
     - app.js: §4ウィザードSTEP7の「スワイプ仕分け」文言を
               「取引記録帳で内容を確認するとき」に修正
     - PROGRESS.md: 取引記録帳セクションのスワイプ承認UI項目を削除
     理由: ワンタップ承認UIで十分な操作性を確保済み。
           スワイプは誤操作リスクがあり不要と判断。
-----------------------------------------------------------
【機能削除（2026-06-03）】
  ✅ CSVインポート設定カードを完全削除
     - index.html: CSVインポート設定 section-card を削除
     - settings.js: renderImportAutoMapping / getIncomeOptions /
       getExpenseOptions / getBankOptions / saveImportMapping を削除
       renderExemptSettingNEW の挿入先を import-mapping-body から
       data-management-body に変更（依存解消）
     - app.js: sec-icon-import-map アイコン定義を削除
-----------------------------------------------------------
【バグ修正（2026-06-03 追加）】
  ✅ app.js 3862行目 SyntaxError修正
     原因: /
?
/ の正規表現が実際の改行コード(LF)として保存されてしまい
           ブラウザがInvalid regular expressionエラーを発生させていた
     対応: バイト列レベルで /
?
/ を正しいエスケープ文字列に修正
     影響: CSVインポートモーダル(_openCsvImportModal)が完全に動作不能だった
           → 修正後は正常動作
     確認: 他の全JSファイル(9ファイル)も同様の破損がないことをスキャン済み
-----------------------------------------------------------
【機能実装（2026-06-04）】
  ✅ §6 取引入力UI 品質強化（app.js: _neRenderStep4 / _neSaveEntry / _neShowUndoToast）
     1. 金額欄（ne-amount）に pattern="[0-9]*" 追加 → モバイルで半角テンキーを強制
     2. inputイベントリスナーで全角数字（０-９）→半角変換＋数字以外を即時除去
     3. _neSaveEntry: Math.round() で入力金額を整数化（按分率計算後も同様）
     4. _neShowUndoToast 新関数追加：
        - 登録直後に5秒間「↩️ 取り消す」トーストを画面下部に表示
        - カウントダウンバーアニメーション（3px紫バー）で残時間を視覚化
        - Undoタップ時：entriesから物理削除（訂正ログなし）→ saveData() → 再描画
        - 5秒経過後はフェードアウトアニメーションで自動消去
        - 複数連続登録時は直前のUndoトーストを自動除去し最新1件のみ表示
-----------------------------------------------------------
【バグ修正（2026-06-03）】
  ✅ ドーナツグラフ（科目別内訳）が期間変更後に更新されないバグを修正
     原因: renderCategorySection のエンプティステート処理で wrap.innerHTML を
           上書きしており、canvas要素ごと消去されていた
           → 次のrenderCategorySection呼び出し時に getElementById('category-chart')
             が null を返しグラフ描画が完全にスキップされていた
     対応: wrap.innerHTML での上書きをやめ、canvasをstyle.display='none'で
           非表示にし、エンプティStateのdivをappendChildで追加する方式に変更
           再描画時はcanvasをdisplay:'block'に戻してから描画する

==========================================================
■ 製品コンセプト（重要）
==========================================================

  Biz-Naviは「会計ソフト」ではなく、
  「ハンドルを握るドライバーの毎日をちょっと軽くする相棒」。
  大手の複雑な画面で挫折した層や、
  Excel・紙のノートで毎晩計算している層を救う。

-----------------------------------------------------------
【革新的な「3方よし」の三角形】
  1. 【使い手（ドライバー）よし】
     日報を入れるだけで時給が見え、
     経費はベッドの上で片手スワイプ仕分け。
     確定申告の恐怖から解放される。
  2. 【委託代理店よし】
     ドライバーからの税務・確定申告の質問が
     ほぼゼロになり、本業の運営に集中できる。
  3. 【税理士よし】
     電帳法対応・日付順・科目別に整頓された
     「完璧なCSVデータ」をボタン一つで受け取れる。

-----------------------------------------------------------
【料金設計】
  ✅ 月額500円で全機能利用可能（シンプル単一プラン）
     最初の60日間は完全無料フリートライアル
     追加課金・広告・データロック一切なし
  🔧 Apple税（30%）完全回避ルートの実装（§2）
     外部ブラウザ（公式サイト）→ Stripe決済 → Firebase Auth
  🔽 Firebase Auth 実装（認証のみ・帳簿データはサーバー送信なし）← 優先度低・時期尚早
  🔽 Firebase Functions（Stripe Webhook受信）← 優先度低・時期尚早
  🔽 Stripe サブスク設定（60日トライアル付き）← 優先度低・時期尚早
  🔧 利用規約・返金ポリシーの法務確認（税理士・弁護士）

-----------------------------------------------------------
【誠実性・データポリシー（§3）】
  ✅ サーバーレス設計（売上・経費はスマホ内にのみ保存）
  ✅ データを人質にしない（ロックなし・CSV/JSON書き出し自由）
  ✅ 追跡ツールなし（行動追跡一切なし・完全オフライン動作）

-----------------------------------------------------------
【UX設計方針】
  ✅ 会計用語を平易化
     借方→「何に使ったか」 貸方→「どこから支払ったか」
     事業所得→「手残り」 家事按分→「仕事割合」
  ✅ 「今日やること」中心UI
     今日のアクションバナー・1分ごと自動更新・即時再描画
  ✅ Progressive Disclosure
     免税モード・シンプルモード・§5ウィザードで初心者自動判定
  ✅ 完全オフライン動作（Service Worker実装済み・未プッシュ）

==========================================================
■ 実装済み機能（✅）
==========================================================

【ページ一覧（11ページ）】
  page-dashboard   ダッシュボード
  page-journal     取引記録帳
  page-ledger      総勘定元帳
  page-tax         消費税管理
  page-dencho      電帳法対応
  page-assets      資産管理
  page-report      集計・レポート
  page-daily       日報
  page-pro-tax     経営支援チェック
  page-pro-subsidy 補助金情報
  page-settings    設定・ウィザード

-----------------------------------------------------------
【§6 取引入力UI（新設計・実装完了）】
  ✅ openNewEntryModal：3ステップ新入力フロー
     STEP1：💸使ったお金 ／ 💰もらったお金
     STEP2：カテゴリ大分類
       支出：🚗車関連 🍱食事 📦業務 📱通信 📝その他
       収入：🚐配送売上 🏛️補助金等 📦物販収益 [もっと見る]
     STEP3：サジェスト候補（勘定科目自動セット）
       車購入30万円以上→資産登録ロジックへ自動警告
     STEP4：金額（今日が初期値）・日付・支払方法・店舗名
  ✅ normalizeStoreName()：表記揺れ吸収
     ＥＮＥＯＳ / eneos / ｴﾈｵｽ → 全て「ENEOS」に正規化
  ✅ マイ辞書（店舗学習機能）
     初回：カテゴリ選択で学習 / 2回目以降：ボタンで文字入力ゼロ
  ✅ Python（classifier.py / tokenizer.py）廃止
     サーバー維持費ゼロ・完全オフライン動作を実現
  ✅ 汎用CSVインポート（銀行・カード明細対応）
     列マッピングUI・ヘッダー自動探索・プレビュー3件表示
  ✅ 証拠画像保存（OCRなし・SHA-256ハッシュ付き）
     電帳法の真実性担保・bizNavi_receiptImagesに保存
  ✅ 旧openEntryModal：編集専用として温存
  ✅ 日付フィールドに「今日の日付」を初期値としてプリセット
  ✅ 勘定科目の平易化マッピング
     「ガソリン代」→「旅費交通費」など画面表示と内部DBを1対1で自動変換

-----------------------------------------------------------
【§4 10ステップ承認ウィザード（実装完了）】
  ✅ ProWizard：初回起動時に自動表示（bizNavi_agreed=1で以後スキップ）
  ✅ 1画面1メッセージ・プログレスバー（N/10形式）
  ✅ STEP3のみ必須チェックボックス（データ消失免責）
  ✅ STEP9から利用規約全文を任意で閲覧可能
  ✅ STEP10完了後にopenSetupWizard()を自動起動

-----------------------------------------------------------
【§5 初期設定4ステップウィザード（実装完了）】
  ✅ openSetupWizard：§4完了直後に自動起動
  ✅ STEP1：活動地域（都道府県）・開業日
  ✅ STEP2：配送種別・1個あたり単価・スマホ回線タイプ
     専用→「全額経費🐱」/ 兼用→「仕事割合で按分🐱」と示唆
  ✅ STEP3：確定申告経験 → 初めて選択でシンプルモード自動ON
  ✅ STEP4：車検日・任意保険更新日 → アラートバナーに即連動
  ✅ 全設定をbizNaviSettingsに統合保存

-----------------------------------------------------------
【利用規約・免責事項（実装完了）】
  ✅ terms.js：本文データのみ分離（差し替え可能）
     TERMS_VERSION / TERMS_DATE / TERMS_SECTIONS で管理
  ✅ openTermsModal()：モーダル表示（app.jsに実装）
  ✅ §4の9/10ステップから任意で開ける
  ✅ 設定ページに「利用規約・アプリ情報」カードを追加
  ✅ 第1〜9条＋お問い合わせの10セクション構成
  🔧 法務・税理士による内容確認（人間が行う作業）

-----------------------------------------------------------
【データ保護・復旧導線（実装完了）】
  ✅ exportAllDataJSON()：全データをJSONで書き出し
     取引・日報・設定・車検通知・マイ辞書を1ファイルに
  ✅ importAllDataJSON()：JSONから全データを復元
     保存日時・件数を確認ダイアログで表示してから実行
  ✅ clearAllDataWithConfirm()：2段階確認の全データ削除
  ✅ loadSampleData()：UI確認用サンプルデータ投入
     取引17件・日報20日分（神奈川県の軽貨物ドライバー想定）
  ✅ 設定ページに「🛡️ データ保護・バックアップ」カード
     消失リスク警告バナー常時表示

-----------------------------------------------------------
【PWA品質向上（ファイル作成済み・未プッシュ）】
  ✅ manifest.json プッシュ済み（2026-06-03）
     name/short_name/icons/theme_color/display:standalone
  ✅ sw.js プッシュ済み（2026-06-03）
     Cache First戦略・アプリシェルキャッシュ
     完全オフライン動作・バックグラウンドキャッシュ更新
     外部API（Google Drive等）はSWをバイパス
     新バージョン検出時にtoastで通知
  ✅ index.html PWAメタタグ追加・プッシュ済み（2026-06-03）

-----------------------------------------------------------
【バグ修正（2026-06-03）】
  ✅ アイコン・グラフ表示不具合を修正
     原因1: index.htmlに古い重複DOMContentLoadedブロックが残存し
             app.jsのメイン起動ロジックと競合（initIconsが呼ばれない経路があった）
     原因2: DOMレンダリング前にinitIconsが実行されるケースがあった
     対応1: index.htmlの旧起動スクリプトブロックを削除
             （起動ロジックはapp.jsのDOMContentLoadedに一本化）
     対応2: initIconsを即時・rAF後・150ms後の3段階で実行するよう強化
     対応3: style.cssに .chart-wrap canvas { display:block; max-width:100% } を追加
             Chart.jsがcanvasのサイズを正しく取得できるよう保証
     manifest link・theme-color・apple-touch-icon
     SW登録スクリプト（updatefound対応）
  ✅ アイコン画像 生成・プッシュ済み（icons/icon-192.png・icon-512.png）

-----------------------------------------------------------
【全関数コメント付与（実装完了）】
  ✅ app.js：161関数にSTART/ENDコメント付与
  ✅ dencho.js：15関数にSTART/ENDコメント付与
  ✅ storage.js：20関数にSTART/ENDコメント付与
  ✅ pro-tax.js：3関数にコメント付与
  ✅ pro-subsidy.js：3関数にコメント付与
  ✅ pro-features.js：3関数にコメント付与
  コメント形式：
  /* ┌──────────────────────────────────────────────────────┐
   * │ ▶ START : 関数名
   * │   機能説明
   * └──────────────────────────────────────────────────────┘ */
  関数本体
  /* └ END : 関数名 ──────────────────────────────────────┘ */

-----------------------------------------------------------
【ダッシュボード】
  ✅ 今日のアクションバナー（3状態・開始直後から0分表示）
  ✅ 業務中バナーを1分ごと自動更新（setIntervalタイマー）
  ✅ 業務終了保存後にバナー・ダッシュボードを即再描画
  ✅ 車検・保険期限アラートバナー（30日以内・残日数色分け）
  ✅ 自動分類率バッジ（プログレスバー付き）
  ✅ 収入・支出・手残り（概算）KPIカード
  ✅ 月次収支グラフ・累積利益折れ線（Chart.js）
  ✅ 科目別内訳ドーナツチャート
  ✅ 月次カレンダー（収支ドット・走行距離表示）
  ✅ 最近の取引一覧
  ✅ 年月フィルター（起動時に当日を自動設定）
  ✅ 空データ時エンプティステート全箇所

-----------------------------------------------------------
【取引記録帳】
  ✅ 未確認/確認済みタブ切替
  ✅ ワンタップ承認UI
  ✅ 「📷 CSV取込」ボタン（汎用CSVインポートに刷新）
  ✅ 「＋ 新規」ボタン → openNewEntryModal()

-----------------------------------------------------------
【日報機能】
  ✅ 業務開始モーダル（前回ODO自動プリセット・変化なし即開始）
  ✅ 業務中バナー・完了バナーへの未確認件数バッジ
  ✅ 業務終了後の領収書チェックプロンプト（未仕訳件数軸）
  ✅ FAB・＋記録ボタンをhandleDailyButtonPressに統一
  ✅ カレンダーへの走行距離表示
  ✅ openDailyEditModal（全フィールド編集対応）

-----------------------------------------------------------
【設定・ウィザード】
  ✅ §4§5ウィザードで初回起動を完全カバー
  ✅ シンプルモード切替カード
  ✅ 車検・保険期限通知設定カード
  ✅ 「🛡️ データ保護・バックアップ」カード（刷新）
  ✅ 「📜 利用規約・アプリ情報」カード（新規）

-----------------------------------------------------------
【ナビゲーション】
  ✅ ボトムナビ：ホーム・日報・記録帳・その他・設定
  ✅ 「日報」をメインナビに昇格

-----------------------------------------------------------
【電帳法対応】
  ✅ SHA-256ハッシュ・タイムスタンプ付与
  ✅ 電帳法安心バナー・ナビ「対応済」バッジ
  ✅ 証拠画像保存との連携（§6）

-----------------------------------------------------------
【消費税管理】
  ✅ Progressive Disclosure（免税→シンプル表示）
  ✅ シンプルモード時は非表示

-----------------------------------------------------------
【経営支援チェック・補助金情報】
  ✅ 全ユーザーが利用可能（旧有料制を廃止）
  ✅ 補助金ページ免責バナー常時表示

==========================================================
■ 未実装・残タスク 優先度別
==========================================================

【最優先 → ✅完了（2026-06-03）】
  ✅ manifest.json をGitHubにプッシュ
  ✅ sw.js をGitHubにプッシュ
  ✅ index.html をGitHubにプッシュ（PWAメタタグ+SW登録スクリプト追加）
  ✅ classifier.py / tokenizer.py / test_classifier.py / requirements.txt / export_to_app.py を削除
  ✅ アイコン画像を生成・プッシュ（icons/icon-192.png・icons/icon-512.png）

【Sランク（リリースブロッカー）】
  ✅ §2 一発クラウド退避ボタンの実装（2026-06-05 完了）
  ✅ §2 バックアップ先をGoogle Drive標準化 ＋ その他クラウドは折りたたみ表示（2026-06-04 完了）
     - Google Drive をヒーローカードとして大きく最上部に表示
     - Dropbox / OneDrive / WebDAV を「その他の保存先 ▼」で折りたたみ
     - 「おすすめ」バッジ・Googleロゴ・接続状態で色変化
  ※ Sランクタスク全完了 → 次はBランクへ

【Bランク（優先度低・時期尚早）】
  ✅ §2 Firebase Auth 実装（認証のみ）（2026-06-05 完了）
     Google OAuth 1択・「Gmailでログイン」特大ボタンを設定ページに配置
     Firebase設定はauth.js内定数として保持（ユーザーへの設定UI不要）
  🔽 §2 Stripe サブスク設定（60日トライアル・月500円）
  🔽 §2 Firebase Functions（Webhook受信・数十行）
  🔽 §2 Apple税回避の外部決済サイト整備
     アプリ内にStripeリンクを1ミリも配置せず外部ブラウザへ誘導
     日報締め後に「クラウドに保存して今日の仕事を終わりにしませんか？🍻」
     特大グリーンボタンを完了エリアに配置
     普段は完全オフライン処理、ボタン押下時だけ1日分のJSON＋写真をまとめて
     Google Driveへバックグラウンド一括アップロード
  🔧 §2 クラウド同期バッジの実装
     ダッシュボード最上部に
     「🟢 データは安全に保護されています（クラウド同期: ○分前）」
     Googleのsaveレスポンス受信時刻をリアルタイム計算して表示
  🔧 §2 通信エラー例外処理
     地下駐車場などオフライン時にtry-catchで囲み
     ローカルデータを傷つけず「未完了・再試行」へ安全にフォールバック
  ✅ §4 損害賠償上限の免責条項を追加（2026-06-04 完了）
     STEP9：バグ等による損害賠償の上限を「ユーザーが過去に支払った
     利用料金（最大12ヶ月分・総額6,000円）」と明文化し法的防衛線を引く
  ✅ §4 確定申告の最終責任はユーザー自身にある旨をSTEP5に明文化（2026-06-04 完了）
     開発者はデータを見ず個別の税務アドバイスもしない旨を記載
  🔧 法務・税理士確認（terms.jsの内容確認）
  🔧 Google Drive同期安定化
     gdrive.jsのロジックは完成済み
     設定UIのエラーハンドリング・接続状態見える化が必要
     ClientIDはユーザーが設定画面から入力する設計

【高優先度】
  🔧 §5 消費税ページのProgressive Disclosure強化
     開業日から逆算して2年未満の場合はpage-taxを
     「シンプルな案内カードのみ」に自動絞り込む
  ✅ §6 入力UIの品質強化（2026-06-04 実装完了）
     金額欄に inputmode="numeric" + pattern="[0-9]*" を付与（半角テンキー固定）
     inputイベントで全角数字→半角変換・数字以外を即時除去
     _neSaveEntry: Math.round() で金額を整数化（1円未満四捨五入）
     _neShowUndoToast: 登録直後5秒間「↩️ 取り消す」トースト（カウントダウンバー付き）
     Undo実行時はentriesから物理削除・saveData()/renderJournal()/updateDashboard()連動
  🔧 §6 カメラ・写真管理の強化
     アルバム隔離：レシート写真をカメラロールと完全に分離した
     アプリ専用フォルダへ保存（Capacitor filesystem利用）
     写真軽量化：撮影後に約200〜300KBへ自動縮小
     （7年保存しても総容量約0.5GB・Google Drive無料枠の3%）
     取引↔写真の1対1リンク：内部DBで取引ID↔写真ファイル名を紐付け
     取引記録帳から仕訳を開いた時に写真を即表示
  🔧 §8 CSV突合・不一致アラートUI
     手入力データと銀行・カード明細CSVを突合
     比較カードで「明細に合わせる」「合算」を選択
  🔧 Google Drive接続設定UIの改善
     settings-sub-modalの中身を整備
     接続状態・エラー内容の見える化

【中優先度】
  🔧 2割特例・簡易課税への対応
  🔧 iPhone Safari長期運用対策
     §7（Capacitor SQLite）移行まで暫定
  🔧 LINE通知

【将来（Capacitor移行後）】
  🔧 §7 Capacitor SQLite移行（iOSデータ消滅対策）
     ※カメラ・写真管理のアルバム隔離もこのフェーズで完全対応
  🔧 AppStore / Google Play正式申請
  🔧 LINE Bot MVP
  ❌ §9 法人成り警告バナー
  ❌ §9 車両更新アドバイス（税率カーブ連動）
  ❌ §9 業種特化テンプレート横展開
  ❌ ダークモード

==========================================================
■ 商業的ポジション
==========================================================

  競合：freee / マネーフォワード ではなく
        「Excelで管理している軽貨物ドライバー」

  Biz-Naviは「軽貨物向け会計ソフト」ではなく
  「軽貨物ドライバー向け業務支援ツール（相棒）」として展開。

-----------------------------------------------------------
【料金モデル】
  月額500円　全機能利用可（単一プラン）
  最初の60日間は完全無料フリートライアル
  追加課金・広告・データロック一切なし
  Apple税（30%）は外部決済ルートで合法回避

-----------------------------------------------------------
【ターゲット層】
  ・軽貨物個人事業主（Amazon Flex・PickGo・黒ナンバー等）
  ・青色申告初心者・既存会計ソフトで挫折した層
  【BtoBからの自動拡散ルート】
  ・委託代理店（標準ツールとして推奨）
  ・税理士（整ったCSVデータを渡せるツールとして推奨）

-----------------------------------------------------------
【集客ロードマップ（§10）】
  ※開発中はSNS大宣伝を封印
  ※Apple審査申請期からInstagramリール始動
  フック：「freeeで挫折した軽貨物ドライバー全員これ使って」
  目標：初期サポーター5,000人 / 月商250万円

==========================================================
■ 技術スタック
==========================================================

  フロントエンド : HTML / CSS / JavaScript のみ（サーバーレス）
  データ保存    : localStorage（プライマリ）
                  Google Drive / Dropbox / OneDrive / WebDAV（セカンダリ）
  認証・課金    : Firebase Auth + Stripe（未実装・次フェーズ）
  将来          : Capacitor SQLite（iOSネイティブ化時）
  廃止済み      : Python / MeCab / TF-IDF / LinearSVC（§6で完全撤廃）

==========================================================
※ 本資料は開発中の内容を含みます。
   実際の仕様・画面・機能は変更となる場合があります。
==========================================================


