// ===== カラフルSVGアイコンセット =====
// 各アイコンに固有の色を直接指定（currentColor不使用）
const ICONS = {

  // ===== ナビゲーション =====

  // 概要：インディゴ系グリッド
  dashboard: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="7" height="7" rx="2" fill="#6366f1" opacity="0.9"/>
    <rect x="14" y="3" width="7" height="7" rx="2" fill="#8b5cf6" opacity="0.9"/>
    <rect x="3" y="14" width="7" height="7" rx="2" fill="#06b6d4" opacity="0.9"/>
    <rect x="14" y="14" width="7" height="7" rx="2" fill="#10b981" opacity="0.9"/>
  </svg>`,

  // 仕訳帳：オレンジ系ノート
  journal: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="2" width="16" height="20" rx="2" fill="#fed7aa"/>
    <rect x="4" y="2" width="4" height="20" rx="2" fill="#f97316"/>
    <rect x="9" y="7" width="8" height="1.5" rx=".75" fill="#c2410c"/>
    <rect x="9" y="11" width="8" height="1.5" rx=".75" fill="#c2410c" opacity="0.6"/>
    <rect x="9" y="15" width="5" height="1.5" rx=".75" fill="#c2410c" opacity="0.4"/>
  </svg>`,

  // 2026-05-03 追加: その他メニュー（三点リーダー）
  // 視認性を高めるため、グレー系の背景にドットを配置
  more: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#f1f5f9"/>
    <circle cx="12" cy="12" r="10" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
    <circle cx="6" cy="12" r="1.5" fill="#64748b"/>
    <circle cx="12" cy="12" r="1.5" fill="#64748b"/>
    <circle cx="18" cy="12" r="1.5" fill="#64748b"/>
  </svg>`,

  // 元帳：エメラルド系テーブル
  ledger: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="20" height="20" rx="3" fill="#d1fae5"/>
    <rect x="2" y="2" width="20" height="6" rx="3" fill="#10b981"/>
    <rect x="2" y="6" width="20" height="2" fill="#10b981"/>
    <rect x="11" y="8" width="1.5" height="14" fill="#6ee7b7"/>
    <rect x="2" y="14" width="20" height="1.5" fill="#6ee7b7" opacity="0.5"/>
  </svg>`,

  // 消費税：イエロー系％サークル
  tax: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#fef9c3"/>
    <circle cx="12" cy="12" r="10" fill="none" stroke="#eab308" stroke-width="2"/>
    <line x1="8" y1="16" x2="16" y2="8" stroke="#ca8a04" stroke-width="2" stroke-linecap="round"/>
    <circle cx="8.5" cy="8.5" r="2" fill="#eab308"/>
    <circle cx="15.5" cy="15.5" r="2" fill="#eab308"/>
  </svg>`,

  // 決算：ブルー系ファイル
  report: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 2h9l5 5v15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#dbeafe"/>
    <path d="M14 2l5 5h-4a1 1 0 0 1-1-1V2z" fill="#3b82f6"/>
    <rect x="7" y="12" width="10" height="1.5" rx=".75" fill="#2563eb"/>
    <rect x="7" y="16" width="7" height="1.5" rx=".75" fill="#2563eb" opacity="0.5"/>
    <path d="M7 9l2 2 4-4" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // ===== KPIカード =====

  // 収入：グリーン上矢印
  income: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#dcfce7"/>
    <circle cx="12" cy="12" r="10" fill="none" stroke="#22c55e" stroke-width="1.5"/>
    <path d="M12 16V8" stroke="#16a34a" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M8 12l4-4 4 4" stroke="#16a34a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // 支出：レッド下矢印
  expense: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#fee2e2"/>
    <circle cx="12" cy="12" r="10" fill="none" stroke="#ef4444" stroke-width="1.5"/>
    <path d="M12 8v8" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M8 12l4 4 4-4" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // 利益：パープル折れ線
  profit: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 17l4-5 4 3 5-7 3 3" stroke="rgba(255,255,255,0.95)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="7" cy="12" r="2" fill="rgba(255,255,255,0.7)"/>
    <circle cx="11" cy="15" r="2" fill="rgba(255,255,255,0.7)"/>
    <circle cx="16" cy="8" r="2" fill="rgba(255,255,255,0.7)"/>
    <circle cx="19" cy="11" r="2" fill="rgba(255,255,255,0.7)"/>
    <rect x="3" y="20" width="18" height="1.5" rx=".75" fill="rgba(255,255,255,0.3)"/>
  </svg>`,

  // ===== セクション =====

  // 月次予算：グリーンウォレット
  budget: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="6" width="22" height="14" rx="3" fill="#d1fae5"/>
    <rect x="1" y="6" width="22" height="5" rx="3" fill="#34d399" opacity="0.5"/>
    <rect x="1" y="9" width="22" height="2" fill="#34d399" opacity="0.5"/>
    <rect x="1" y="6" width="22" height="14" rx="3" fill="none" stroke="#10b981" stroke-width="1.5"/>
    <circle cx="17" cy="14" r="2.5" fill="#10b981"/>
    <circle cx="17" cy="14" r="1" fill="#d1fae5"/>
    <rect x="3" y="13" width="5" height="1.5" rx=".75" fill="#6ee7b7"/>
  </svg>`,

  // 月次グラフ：マルチカラー棒グラフ
  chart: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="14" width="4" height="7" rx="1" fill="#6366f1"/>
    <rect x="10" y="8" width="4" height="13" rx="1" fill="#10b981"/>
    <rect x="17" y="11" width="4" height="10" rx="1" fill="#f97316"/>
    <rect x="2" y="21" width="20" height="1.5" rx=".75" fill="#94a3b8"/>
    <path d="M4 13l5-4 5 3 5-6" stroke="#eab308" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="14" cy="12" r="1.5" fill="#eab308"/>
  </svg>`,

  // 科目別：レインボードーナツ
  donut: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z" fill="#f1f5f9"/>
    <path d="M12 3a9 9 0 0 1 9 9" stroke="#6366f1" stroke-width="4" stroke-linecap="butt" fill="none"/>
    <path d="M21 12a9 9 0 0 1-4.5 7.8" stroke="#10b981" stroke-width="4" stroke-linecap="butt" fill="none"/>
    <path d="M16.5 19.8A9 9 0 0 1 3 12" stroke="#f97316" stroke-width="4" stroke-linecap="butt" fill="none"/>
    <path d="M3 12a9 9 0 0 1 9-9" stroke="#eab308" stroke-width="4" stroke-linecap="butt" fill="none"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
    <circle cx="12" cy="12" r="2" fill="#e2e8f0"/>
  </svg>`,

  // カレンダー：スカイブルー
  calendar: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="20" height="18" rx="3" fill="#e0f2fe"/>
    <rect x="2" y="4" width="20" height="7" rx="3" fill="#0ea5e9"/>
    <rect x="2" y="9" width="20" height="2" fill="#0ea5e9"/>
    <rect x="6" y="2" width="3" height="5" rx="1.5" fill="#0284c7"/>
    <rect x="15" y="2" width="3" height="5" rx="1.5" fill="#0284c7"/>
    <circle cx="7" cy="16" r="1.3" fill="#0ea5e9"/>
    <circle cx="12" cy="16" r="1.3" fill="#0ea5e9"/>
    <circle cx="17" cy="16" r="1.3" fill="#0ea5e9"/>
    <circle cx="7" cy="20" r="1.3" fill="#bae6fd"/>
    <circle cx="12" cy="20" r="1.3" fill="#bae6fd"/>
  </svg>`,

  // 家事按分：オレンジ家アイコン
  kasji: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z" fill="#ffedd5"/>
    <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z" fill="none" stroke="#f97316" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="9" y="14" width="6" height="8" rx="1" fill="#fed7aa"/>
    <rect x="14" y="10" width="5" height="4" rx="1" fill="#fb923c" opacity="0.6"/>
    <path d="M14.5 10.5v3" stroke="#ea580c" stroke-width="1" stroke-linecap="round"/>
    <line x1="12" y1="3" x2="12" y2="5" stroke="#ea580c" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  // 消費税サマリー：ゴールドチェックリスト
  taxSummary: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="20" height="20" rx="3" fill="#fef9c3"/>
    <rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="#eab308" stroke-width="1.5"/>
    <rect x="2" y="2" width="20" height="6" rx="3" fill="#fde047" opacity="0.6"/>
    <rect x="2" y="6" width="20" height="2" fill="#fde047" opacity="0.6"/>
    <path d="M7 13l2 2 4-4" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="14" y="12.5" width="6" height="1.5" rx=".75" fill="#ca8a04" opacity="0.5"/>
    <rect x="7" y="17" width="13" height="1.5" rx=".75" fill="#ca8a04" opacity="0.3"/>
  </svg>`,

  // 最近の仕訳：シアン時計
  recent: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#cffafe"/>
    <circle cx="12" cy="12" r="10" fill="none" stroke="#06b6d4" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="1.5" fill="#0891b2"/>
    <path d="M12 7v5" stroke="#0891b2" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 12l3.5 3.5" stroke="#0891b2" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="5" r="1" fill="#67e8f9"/>
    <circle cx="19" cy="12" r="1" fill="#67e8f9"/>
    <circle cx="5" cy="12" r="1" fill="#67e8f9"/>
    <circle cx="12" cy="19" r="1" fill="#67e8f9"/>
  </svg>`,

  // インポート：パープルダウンロード
  import: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="16" width="20" height="6" rx="2" fill="#ede9fe"/>
    <rect x="2" y="16" width="20" height="6" rx="2" fill="none" stroke="#8b5cf6" stroke-width="1.5"/>
    <path d="M12 3v11" stroke="#7c3aed" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M7 10l5 5 5-5" stroke="#7c3aed" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="18" cy="19" r="1.5" fill="#8b5cf6"/>
  </svg>`,

  // アップロード：インディゴ（新規追加）
  upload: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="14" width="20" height="8" rx="2" fill="#e0e7ff"/>
    <rect x="2" y="14" width="20" height="8" rx="2" fill="none" stroke="#6366f1" stroke-width="1.5"/>
    <path d="M12 16V5" stroke="#4f46e5" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M7 10l5-5 5 5" stroke="#4f46e5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="6" cy="18" r="1.5" fill="#818cf8"/>
  </svg>`,

  // アラート：アンバー三角形
  alert: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L2 20h20L12 3z" fill="#fef3c7"/>
    <path d="M12 3L2 20h20L12 3z" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="11" y="9" width="2" height="6" rx="1" fill="#d97706"/>
    <circle cx="12" cy="17" r="1.2" fill="#d97706"/>
  </svg>`,

  // ===== フォームラベル用（小サイズ最適化） =====

  // 日付：ブルーカレンダー
  date: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="18" height="16" rx="2" fill="#dbeafe"/>
    <rect x="3" y="5" width="18" height="6" rx="2" fill="#3b82f6"/>
    <rect x="3" y="9" width="18" height="2" fill="#3b82f6"/>
    <rect x="7" y="3" width="2.5" height="5" rx="1.25" fill="#1d4ed8"/>
    <rect x="14.5" y="3" width="2.5" height="5" rx="1.25" fill="#1d4ed8"/>
    <circle cx="8" cy="16" r="1.2" fill="#3b82f6"/>
    <circle cx="12" cy="16" r="1.2" fill="#3b82f6"/>
    <circle cx="16" cy="16" r="1.2" fill="#3b82f6"/>
  </svg>`,

  // 借方：グリーン上矢印（細め）
  debit: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#dcfce7"/>
    <path d="M12 16V9" stroke="#16a34a" stroke-width="2" stroke-linecap="round"/>
    <path d="M8.5 12.5l3.5-3.5 3.5 3.5" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="7" y="17" width="10" height="1.5" rx=".75" fill="#86efac"/>
  </svg>`,

  // 貸方：レッド下矢印（細め）
  credit: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#fee2e2"/>
    <path d="M12 8v7" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>
    <path d="M8.5 11.5l3.5 3.5 3.5-3.5" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="7" y="6" width="10" height="1.5" rx=".75" fill="#fca5a5"/>
  </svg>`,

  // 摘要：オレンジ鉛筆
  memo: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 3l4 4-12 12H5v-4L17 3z" fill="#fed7aa"/>
    <path d="M17 3l4 4-12 12H5v-4L17 3z" fill="none" stroke="#f97316" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M15 5l4 4" stroke="#ea580c" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="3" y="20" width="9" height="1.5" rx=".75" fill="#fdba74"/>
  </svg>`,

  // 家事按分フォーム：オレンジ家（小）
  kasjiForm: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 11L12 3l9 8v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V11z" fill="#ffedd5"/>
    <path d="M3 11L12 3l9 8v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V11z" fill="none" stroke="#f97316" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="9" y="15" width="6" height="7" rx="1" fill="#fed7aa"/>
    <line x1="12" y1="3.5" x2="12" y2="6" stroke="#ea580c" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  // 勘定科目：パープルカード
  account: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="6" width="20" height="13" rx="2.5" fill="#ede9fe"/>
    <rect x="2" y="6" width="20" height="13" rx="2.5" fill="none" stroke="#8b5cf6" stroke-width="1.5"/>
    <rect x="2" y="9" width="20" height="3" fill="#a78bfa" opacity="0.4"/>
    <rect x="5" y="15" width="5" height="1.5" rx=".75" fill="#8b5cf6" opacity="0.5"/>
    <circle cx="18" cy="15.7" r="2" fill="#8b5cf6"/>
    <circle cx="18" cy="15.7" r=".8" fill="#ede9fe"/>
  </svg>`,

  // 税区分：ゴールド積み重ね
  taxForm: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L2 7.5l10 4.5 10-4.5L12 3z" fill="#fde047"/>
    <path d="M2 12l10 4.5L22 12" stroke="#ca8a04" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M2 16.5l10 4.5 10-4.5" stroke="#ca8a04" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.5"/>
  </svg>`,

  // 金額：グリーン円マーク
  amount: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#dcfce7"/>
    <circle cx="12" cy="12" r="10" fill="none" stroke="#22c55e" stroke-width="1.5"/>
    <path d="M12 5v14" stroke="#15803d" stroke-width="2" stroke-linecap="round"/>
    <path d="M15.5 8H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8.5" stroke="#15803d" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,

  // ===== 決算・エクスポート =====

  // 損益計算書：ブルードキュメント
  pl: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="2" width="18" height="20" rx="2.5" fill="#dbeafe"/>
    <rect x="3" y="2" width="18" height="7" rx="2.5" fill="#3b82f6" opacity="0.3"/>
    <rect x="3" y="7" width="18" height="2" fill="#3b82f6" opacity="0.3"/>
    <rect x="6" y="11" width="12" height="1.5" rx=".75" fill="#2563eb"/>
    <rect x="6" y="14.5" width="8" height="1.5" rx=".75" fill="#2563eb" opacity="0.6"/>
    <rect x="6" y="18" width="5" height="1.5" rx=".75" fill="#2563eb" opacity="0.3"/>
    <path d="M6 9l2 2 3-3" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // 貸借対照表：ティールテーブル
  bs: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="3" width="20" height="18" rx="2.5" fill="#ccfbf1"/>
    <rect x="2" y="3" width="20" height="18" rx="2.5" fill="none" stroke="#14b8a6" stroke-width="1.5"/>
    <rect x="12" y="3" width="1.5" height="18" fill="#14b8a6" opacity="0.4"/>
    <rect x="2" y="9" width="20" height="1.5" fill="#14b8a6" opacity="0.3"/>
    <rect x="2" y="15" width="20" height="1.5" fill="#14b8a6" opacity="0.3"/>
    <rect x="4" y="5.5" width="6" height="1.5" rx=".75" fill="#0d9488"/>
    <rect x="4" y="11" width="5" height="1.5" rx=".75" fill="#0d9488" opacity="0.7"/>
    <rect x="4" y="17" width="4" height="1.5" rx=".75" fill="#0d9488" opacity="0.4"/>
    <rect x="14.5" y="5.5" width="5" height="1.5" rx=".75" fill="#0d9488"/>
    <rect x="14.5" y="11" width="4" height="1.5" rx=".75" fill="#0d9488" opacity="0.7"/>
  </svg>`,

  // エクスポート：ローズアップロード
  export: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="16" width="20" height="6" rx="2" fill="#fce7f3"/>
    <rect x="2" y="16" width="20" height="6" rx="2" fill="none" stroke="#ec4899" stroke-width="1.5"/>
    <path d="M12 14V3" stroke="#be185d" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M7 8l5-5 5 5" stroke="#be185d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="18" cy="19" r="1.5" fill="#ec4899"/>
    <circle cx="14" cy="19" r="1.5" fill="#f9a8d4"/>
  </svg>`,

  // 設定：グレー歯車
  settings: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#f1f5f9"/>
    <circle cx="12" cy="12" r="10" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="3.5" fill="#64748b"/>
    <circle cx="12" cy="12" r="1.5" fill="#f1f5f9"/>
    <rect x="11" y="2.5" width="2" height="3" rx="1" fill="#94a3b8"/>
    <rect x="11" y="18.5" width="2" height="3" rx="1" fill="#94a3b8"/>
    <rect x="2.5" y="11" width="3" height="2" rx="1" fill="#94a3b8"/>
    <rect x="18.5" y="11" width="3" height="2" rx="1" fill="#94a3b8"/>
    <rect x="5.3" y="5.3" width="2" height="3" rx="1" fill="#94a3b8" transform="rotate(45 5.3 5.3)"/>
    <rect x="16.7" y="16.7" width="2" height="3" rx="1" fill="#94a3b8" transform="rotate(45 16.7 16.7)"/>
    <rect x="5.3" y="16.7" width="3" height="2" rx="1" fill="#94a3b8" transform="rotate(45 5.3 16.7)"/>
    <rect x="16.7" y="5.3" width="3" height="2" rx="1" fill="#94a3b8" transform="rotate(45 16.7 5.3)"/>
  </svg>`,

  // ===== 電帳法 =====

  // 電帳法ナビ：グリーン盾＋文書
  dencho: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2z" fill="#dcfce7"/>
    <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2z" fill="none" stroke="#16a34a" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M8 12l3 3 5-5" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // 検索アイコン：パープル虫眼鏡
  search: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11" cy="11" r="7" fill="#ede9fe"/>
    <circle cx="11" cy="11" r="7" fill="none" stroke="#8b5cf6" stroke-width="1.8"/>
    <path d="M16.5 16.5L21 21" stroke="#7c3aed" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M8 11h6M11 8v6" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  // チェックリスト：ブルーチェック
  checklist: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="3" fill="#dbeafe"/>
    <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="#3b82f6" stroke-width="1.5"/>
    <path d="M7 8l2 2 4-4" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="14" y="7.5" width="5" height="1.5" rx=".75" fill="#3b82f6" opacity="0.6"/>
    <path d="M7 13l2 2 4-4" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="14" y="12.5" width="4" height="1.5" rx=".75" fill="#3b82f6" opacity="0.6"/>
    <path d="M7 18.5h.01" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
    <rect x="10" y="17.8" width="7" height="1.5" rx=".75" fill="#cbd5e1"/>
  </svg>`,

  // ===== 設定ページ =====

  // 設定ナビ：グレー歯車（ナビ用）
  settingsNav: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="3" fill="#94a3b8"/>
    <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="6" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>
  </svg>`,

  // クラウド保存先：空色クラウド
  cloud: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 10a6 6 0 0 0-11.8-1.5A5 5 0 1 0 6 19h12a4 4 0 0 0 0-8z" fill="#e0f2fe"/>
    <path d="M18 10a6 6 0 0 0-11.8-1.5A5 5 0 1 0 6 19h12a4 4 0 0 0 0-8z" fill="none" stroke="#0ea5e9" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M12 22v-6M9 19l3-3 3 3" stroke="#0284c7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // バックアップ：アンバーシールド
  backupIcon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2z" fill="#fef3c7"/>
    <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2z" fill="none" stroke="#f59e0b" stroke-width="1.5"/>
    <path d="M12 8v4M12 14v.5" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  // 復元：グリーン時計矢印
  restoreIcon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" fill="#dcfce7"/>
    <circle cx="12" cy="12" r="9" fill="none" stroke="#22c55e" stroke-width="1.5"/>
    <path d="M12 7v5l3 3" stroke="#15803d" stroke-width="2" stroke-linecap="round"/>
    <path d="M5 5l2 2-2 2" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // 危険ゾーン：レッドゴミ箱
  dangerIcon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 6h18" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M8 6V4h8v2" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="5" y="6" width="14" height="15" rx="2" fill="#fee2e2"/>
    <rect x="5" y="6" width="14" height="15" rx="2" fill="none" stroke="#ef4444" stroke-width="1.5"/>
    <path d="M10 11v5M14 11v5" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,

};

/**
 * アイコンをSVG文字列で返すヘルパー（classを付与）
 * 修正日: 2026-05-03
 * @param {string} name - ICONSオブジェクトのキー
 * @param {string} [cls=''] - 付与するCSSクラス名
 * @returns {string} - classが付与されたSVG文字列
 */
function icon(name, cls = '') {
  const svg = ICONS[name];
  if (!svg) return '';
  return svg.replace('<svg ', `<svg class="icon ${cls}" `);
}
// [END of icons.js (2026-05-03 Custom More Icon Added)]
