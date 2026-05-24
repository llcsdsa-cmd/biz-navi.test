/**
 * pro-subsidy.js
 * Biz-Navi 拡張機能モジュール（有料プラン）
 *
 * 含まれる機能：
 *   D. 補助金・助成金提案（Claude API連携・7日キャッシュ）
 *
 * 依存：app.js, pro-tax.js
 * 分離方針：このファイルを外せば補助金機能が完全に無効化される
 */

/* 'use strict' disabled for compatibility */

const ProSubsidy = {

  CACHE_KEY:    'pro_subsidy_cache',
  CACHE_DAYS:   7,
  JGRANTS_URL:  'https://jgrants.go.jp',
  MIRASAPO_URL: 'https://mirasapo-plus.go.jp/subsidy/',

  // ──────────────────────────────────────────────────────────
  // キャッシュ管理
  // ──────────────────────────────────────────────────────────
  _loadCache() {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      if (!raw) return null;
      const cache = JSON.parse(raw);
      const days = (Date.now() - cache.timestamp) / (1000 * 60 * 60 * 24);
      if (days > this.CACHE_DAYS) return null; // 期限切れ
      return cache;
    } catch { return null; }
  },

  _saveCache(data) {
    const cache = { timestamp: Date.now(), data };
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
  },

  _cacheAge() {
    const cache = this._loadCache();
    if (!cache) return null;
    const hours = (Date.now() - cache.timestamp) / (1000 * 60 * 60);
    if (hours < 1)  return '1時間以内';
    if (hours < 24) return `${Math.floor(hours)}時間前`;
    return `${Math.floor(hours / 24)}日前`;
  },

  // ──────────────────────────────────────────────────────────
  // ユーザープロファイル取得
  // ──────────────────────────────────────────────────────────
  _getUserProfile() {
    const settings  = JSON.parse(localStorage.getItem('userSettings')    || '{}');
    const bizSettings = JSON.parse(localStorage.getItem('bizNaviSettings') || '{}');
    const year = new Date().getFullYear();
    const entries = window.entries || [];
    const yearEntries = entries.filter(e => e?.date?.startsWith(String(year)));
    const sums = typeof calcSums === 'function' ? calcSums(yearEntries) : {};

    return {
      industry:     '軽貨物運送業（軽貨物ドライバー・個人事業主）',
      region:       settings.region     || settings.address || '神奈川県',
      city:         settings.city       || '平塚市',
      isExempt:     settings.isExempt   ?? true,
      openingDate:  settings.openingDate || '',
      revenue:      sums.income         || 0,
      expense:      sums.expense        || 0,
      profit:       (sums.income || 0) - (sums.expense || 0),
      vehicleRatio: bizSettings.vehicleRatio || 0,
      hasSoftware:  true, // Biz-Navi開発中
    };
  },

  // ──────────────────────────────────────────────────────────
  // Claude API呼び出し
  // ──────────────────────────────────────────────────────────
  async _fetchFromClaude(profile) {
    const prompt = `
あなたは中小企業診断士・補助金コンサルタントです。
以下のユーザー情報をもとに、2025〜2026年に申請できる可能性が高い
補助金・助成金・給付金を提案してください。

【ユーザー情報】
- 業種: ${profile.industry}
- 地域: ${profile.region} ${profile.city}
- 免税事業者: ${profile.isExempt ? 'はい（売上1,000万円以下）' : 'いいえ（課税事業者）'}
- 年間売上概算: ${profile.revenue.toLocaleString()}円
- 年間利益概算: ${profile.profit.toLocaleString()}円
- 特記事項: 会計・業務管理スマホアプリ（Biz-Navi）を個人開発中

【回答形式】
以下のJSON形式のみで回答してください。前置き・説明文は不要です。
{
  "subsidies": [
    {
      "name": "補助金・助成金名",
      "category": "国/都道府県/市区町村/商工会議所",
      "amount": "上限金額（例: 最大50万円）",
      "purpose": "何に使えるか（1〜2行）",
      "eligibility": "対象要件（1〜2行）",
      "deadline": "申請時期の目安（例: 毎年4〜6月頃）",
      "url": "公式ページURL（分からなければJグランツまたはミラサポplusのURL）",
      "priority": "high/medium/low",
      "reason": "このユーザーに勧める理由（1行）"
    }
  ],
  "summary": "全体的なアドバイス（2〜3行）",
  "lastUpdated": "${new Date().toLocaleDateString('ja-JP')}"
}
補助金は最低5件・最大10件提案してください。
priorityはhigh（強くおすすめ）・medium（検討の余地あり）・low（参考）で分類してください。
`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    const text = data.content.find(b => b.type === 'text')?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  },

  // ──────────────────────────────────────────────────────────
  // D. 補助金ページ描画
  // ──────────────────────────────────────────────────────────
  renderSubsidyPage() {
    const el = document.getElementById('pro-subsidy-content');
    if (!el) return;

    const cache = this._loadCache();
    const cacheAge = this._cacheAge();
    const profile = this._getUserProfile();

    el.innerHTML = `
      <!-- 免責バナー（目立つ位置に固定） -->
      <div style="margin:8px 16px 4px;background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:12px 14px;">
        <div style="font-weight:700;color:#92400e;font-size:0.88rem;margin-bottom:4px;">⚠️ ご利用前にお読みください</div>
        <div style="font-size:0.78rem;color:#78350f;line-height:1.7;">
          表示される補助金情報は<b>AI生成の参考情報</b>です。最新の公募状況・申請要件・金額は必ず<b>公式サイトでご確認ください</b>。
          申請の結果について、Biz-Naviは一切の責任を負いません。
        </div>
      </div>

      <style>
        .sub-card { background:#fff; border:0.5px solid var(--color-border);
          border-radius:14px; box-shadow:0 2px 8px rgba(0,0,0,.06);
          margin:0 16px 10px; overflow:hidden; }
        .sub-head { padding:12px 14px; font-size:var(--fs-lg); font-weight:700; }
        .sub-body { padding:8px 14px 12px; font-size:var(--fs-md);
          color:var(--color-dark); line-height:1.6; }
        .sub-tag  { display:inline-block; font-size:var(--fs-sm); border-radius:4px;
          padding:2px 7px; font-weight:700; margin-right:4px; }
        .sub-high   { background:#fef3c7; color:#92400e; }
        .sub-medium { background:#e0f2fe; color:#0c4a6e; }
        .sub-low    { background:#f3f4f6; color:#6b7280; }
        .sub-cat-gov   { background:#ede9fe; color:#5b21b6; }
        .sub-cat-pref  { background:#dcfce7; color:#166534; }
        .sub-cat-city  { background:#fce7f3; color:#9d174d; }
        .sub-cat-other { background:#fef9c3; color:#713f12; }
        .sub-profile-card { background:var(--color-accent); color:#fff;
          border-radius:14px; margin:0 16px 12px; padding:14px 16px; }
        .sub-fetch-btn { width:calc(100% - 32px); margin:0 16px 12px;
          padding:14px; background:var(--color-accent); color:#fff;
          border:none; border-radius:12px; font-size:var(--fs-xl); font-weight:700;
          cursor:pointer; display:flex; align-items:center;
          justify-content:center; gap:8px; }
        .sub-fetch-btn:disabled { opacity:.6; cursor:wait; }
        .sub-link { color:var(--color-teal,#028090); font-size:var(--fs-base);
          text-decoration:none; }
      </style>

      <!-- プロファイル確認 -->
      <div class="sub-profile-card">
        <div style="font-size:var(--fs-md); opacity:.8; margin-bottom:6px;">検索対象プロファイル</div>
        <div style="font-size:var(--fs-lg); font-weight:600; margin-bottom:2px;">
          ${profile.industry}
        </div>
        <div style="font-size:var(--fs-md); opacity:.85;">
          📍 ${profile.region} ${profile.city}　
          ${profile.isExempt ? '免税事業者' : '課税事業者'}　
          年商概算 ${profile.revenue > 0 ? Math.round(profile.revenue/10000)+'万円' : '未記録'}
        </div>
      </div>

      <!-- キャッシュ情報 -->
      ${cache ? `
        <div style="margin:0 16px 8px; font-size:var(--fs-base); color:var(--color-muted);
          display:flex; justify-content:space-between; align-items:center;">
          <span>🕐 最終確認: ${cacheAge}（${new Date(cache.timestamp).toLocaleDateString('ja-JP')}）</span>
          <button onclick="ProSubsidy.fetchSubsidies(true)"
            style="font-size:var(--fs-base); color:var(--color-teal,#028090);
            background:none; border:none; cursor:pointer; text-decoration:underline;">
            今すぐ更新
          </button>
        </div>` : ''}

      <!-- 検索ボタン -->
      <button class="sub-fetch-btn" id="sub-fetch-btn"
        onclick="ProSubsidy.fetchSubsidies(false)">
        <span id="sub-btn-icon">🔍</span>
        <span id="sub-btn-text">
          ${cache ? '補助金情報を再取得する' : '補助金・助成金を提案してもらう'}
        </span>
      </button>

      <!-- 結果エリア -->
      <div id="sub-result-area">
        ${cache ? this._renderResults(cache.data) : this._renderEmpty()}
      </div>

      <!-- 外部リンク -->
      <div style="margin:0 16px 16px; padding:12px 14px; background:#f8fafc;
        border-radius:10px; font-size:var(--fs-base); color:var(--color-muted); line-height:1.8;">
        📎 最新の公募情報は公式サイトでご確認ください<br>
        <a href="${this.JGRANTS_URL}" target="_blank" class="sub-link">Jグランツ（政府補助金ポータル）</a>　
        <a href="${this.MIRASAPO_URL}" target="_blank" class="sub-link">ミラサポplus</a>
      </div>
    `;
  },

  async fetchSubsidies(forceRefresh = false) {
    const btn     = document.getElementById('sub-fetch-btn');
    const icon    = document.getElementById('sub-btn-icon');
    const text    = document.getElementById('sub-btn-text');
    const result  = document.getElementById('sub-result-area');
    if (!result) return;

    // キャッシュが有効なら使う
    if (!forceRefresh) {
      const cache = this._loadCache();
      if (cache) {
        result.innerHTML = this._renderResults(cache.data);
        return;
      }
    }

    // ローディング
    if (btn)  btn.disabled = true;
    if (icon) icon.textContent = '⏳';
    if (text) text.textContent = '補助金情報を取得中...';
    result.innerHTML = `
      <div style="text-align:center; padding:32px 16px; color:var(--color-muted);">
        <div style="font-size:var(--fs-4xl); margin-bottom:8px; animation:spin 1s linear infinite;">⏳</div>
        <div style="font-size:var(--fs-lg);">Claude AIが補助金を検索中です...</div>
        <div style="font-size:var(--fs-base); margin-top:4px;">少々お待ちください（10〜20秒）</div>
      </div>
      <style>@keyframes spin { to { transform:rotate(360deg); } }</style>`;

    try {
      const profile = this._getUserProfile();
      const data = await this._fetchFromClaude(profile);
      this._saveCache(data);
      result.innerHTML = this._renderResults(data);
      if (btn)  btn.disabled = false;
      if (icon) icon.textContent = '✅';
      if (text) text.textContent = '補助金情報を更新しました';
      setTimeout(() => {
        if (icon) icon.textContent = '🔍';
        if (text) text.textContent = '補助金情報を再取得する';
      }, 3000);
    } catch (err) {
      console.error('ProSubsidy fetch error:', err);
      result.innerHTML = `
        <div style="background:#fff5f5; border:1px solid #feb2b2; border-radius:12px;
          margin:0 16px; padding:14px 16px; font-size:var(--fs-lg); color:#c53030;">
          ⚠️ 取得に失敗しました<br>
          <span style="font-size:var(--fs-base); color:#718096;">
            ネットワーク接続を確認してから再度お試しください
          </span>
        </div>`;
      if (btn)  btn.disabled = false;
      if (icon) icon.textContent = '🔍';
      if (text) text.textContent = '再試行する';
    }
  },

  _renderResults(data) {
    if (!data?.subsidies?.length) {
      return this._renderEmpty();
    }

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sorted = [...data.subsidies].sort((a, b) =>
      (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

    const catClass = (cat) => {
      if (cat?.includes('国'))    return 'sub-cat-gov';
      if (cat?.includes('都道府県') || cat?.includes('県')) return 'sub-cat-pref';
      if (cat?.includes('市'))    return 'sub-cat-city';
      return 'sub-cat-other';
    };

    const priorityLabel = { high: '🔥 強くおすすめ', medium: '⭐ 検討を', low: '📌 参考' };
    const priorityClass = { high: 'sub-high', medium: 'sub-medium', low: 'sub-low' };

    const cards = sorted.map(s => `
      <div class="sub-card">
        <div class="sub-head" style="
          background:${s.priority === 'high' ? '#fffbeb' : s.priority === 'medium' ? '#f0f9ff' : '#f9fafb'};
          border-bottom:0.5px solid var(--color-border);">
          <span class="sub-tag ${priorityClass[s.priority] || 'sub-low'}">
            ${priorityLabel[s.priority] || s.priority}
          </span>
          <span class="sub-tag ${catClass(s.category)}">${s.category || ''}</span>
          <div style="margin-top:6px; font-size:var(--fs-md); color:var(--color-text);">
            ${s.name}
          </div>
          <div style="font-size:var(--fs-lg); color:var(--color-income); font-weight:700; margin-top:2px;">
            ${s.amount || '要確認'}
          </div>
        </div>
        <div class="sub-body">
          <div style="margin-bottom:6px;">
            <span style="color:var(--color-muted); font-size:var(--fs-base);">使途：</span>${s.purpose || ''}
          </div>
          <div style="margin-bottom:6px;">
            <span style="color:var(--color-muted); font-size:var(--fs-base);">要件：</span>${s.eligibility || ''}
          </div>
          <div style="margin-bottom:6px;">
            <span style="color:var(--color-muted); font-size:var(--fs-base);">申請時期：</span>${s.deadline || '公式サイトで確認'}
          </div>
          <div style="background:#f0faf5; border-radius:6px; padding:6px 8px; font-size:var(--fs-base);
            color:var(--color-income); margin-bottom:6px;">
            💡 ${s.reason || ''}
          </div>
          ${s.url ? `<a href="${s.url}" target="_blank" class="sub-link">🔗 詳細・申請はこちら →</a>` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div style="margin:0 16px 8px; font-size:var(--fs-md); color:var(--color-muted);">
        ${sorted.length}件の補助金・助成金が見つかりました
        （優先度順）
      </div>
      ${cards}
      ${data.summary ? `
        <div style="background:var(--color-accent); color:#fff; border-radius:12px;
          margin:0 16px 12px; padding:14px 16px; font-size:var(--fs-md); line-height:1.7;">
          💬 ${data.summary}
        </div>` : ''}
      <div style="margin:0 16px 8px; font-size:var(--fs-sm); color:#94a3b8; line-height:1.6;">
        ※ AI生成の参考情報です。補助金の最新情報・申請要件は必ず公式サイトでご確認ください。
      </div>`;
  },

  _renderEmpty() {
    return `
      <div style="text-align:center; padding:32px 16px; color:var(--color-muted);">
        <div style="font-size:clamp(32px, 10vw, 40px); margin-bottom:8px;">🔍</div>
        <div style="font-size:var(--fs-lg); font-weight:600; margin-bottom:4px;">
          補助金・助成金を提案します
        </div>
        <div style="font-size:var(--fs-md); line-height:1.6;">
          上のボタンをタップすると<br>
          あなたの業種・地域に合った補助金を<br>
          Claude AIが検索して提案します
        </div>
      </div>`;
  },

  init() {
    document.addEventListener('bizNavi:pageChanged', (e) => {
      if (e.detail?.page === 'pro-subsidy') {
        this.renderSubsidyPage();
        // 7日以上経過していたら自動取得
        const cache = this._loadCache();
        if (!cache) {
          // キャッシュなし：自動取得しない（ユーザーボタン押下待ち）
        } else {
          const days = (Date.now() - cache.timestamp) / (1000 * 60 * 60 * 24);
          if (days >= this.CACHE_DAYS) {
            setTimeout(() => this.fetchSubsidies(true), 800);
          }
        }
      }
    });
  },
};

document.addEventListener('DOMContentLoaded', () => {
  ProSubsidy.init();
});
