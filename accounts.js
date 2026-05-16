// 青色申告対応 勘定科目マスタ
const ACCOUNTS = {
  // === 資産 ===
  assets: {
    label: '資産',
    normal: 'debit',
    items: [
      { code: '100', name: '現金', type: 'asset' },
      { code: '110', name: '普通預金', type: 'asset' },
      { code: '111', name: '当座預金', type: 'asset' },
      { code: '120', name: '売掛金', type: 'asset' },
      { code: '130', name: '前払費用', type: 'asset' },
      { code: '140', name: '仮払消費税', type: 'asset' },
      { code: '150', name: '棚卸資産', type: 'asset' },
      { code: '160', name: '有形固定資産', type: 'asset' },
      { code: '1601', name: '車両運搬具', type: 'asset' }, // ★追加：車両そのもの
      { code: '161', name: '減価償却累計額', type: 'asset' },
      { code: '170', name: '敷金・保証金', type: 'asset' },
    ]
  },
  // === 負債 ===
  liabilities: {
    label: '負債',
    normal: 'credit',
    items: [
      { code: '200', name: '買掛金', type: 'liability' },
      { code: '210', name: '未払費用', type: 'liability' },
      { code: '211', name: '未払消費税', type: 'liability' },
      { code: '220', name: '仮受消費税', type: 'liability' },
      { code: '230', name: '前受金', type: 'liability' },
      { code: '240', name: '借入金', type: 'liability' },
    ]
  },
  // === 純資産 ===
  equity: {
    label: '純資産',
    normal: 'credit',
    items: [
      { code: '300', name: '元入金', type: 'equity' },
      { code: '310', name: '事業主貸', type: 'equity' },
      { code: '311', name: '事業主借', type: 'equity' },
    ]
  },
  // === 収益（青色申告 収入科目）===
  income: {
    label: '収益',
    normal: 'credit',
    items: [
      { code: '400', name: '売上高', type: 'income' },
      { code: '401', name: '受取手数料', type: 'income' },
      { code: '402', name: '受取利息', type: 'income' },
      { code: '403', name: '雑収入', type: 'income' },
    ]
  },
  // === 費用（青色申告 経費科目）===
  expenses: {
    label: '費用',
    normal: 'debit',
    items: [
// 軽貨物ドライバー特化の科目を体系的に整理しました
      { code: '500', name: '仕入高', type: 'expense' },
      { code: '510', name: '給料賃金', type: 'expense' },
      { code: '511', name: '外注工賃', type: 'expense' },
      { code: '512', name: '減価償却費', type: 'expense' },  // 毎年の償却分
      { code: '513', name: '貸倒金', type: 'expense' },
      { code: '520', name: '地代家賃', type: 'expense' },
      { code: '521', name: '水道光熱費', type: 'expense' },
      { code: '522', name: '通信費', type: 'expense' },
      { code: '523', name: '消耗品費', type: 'expense' },
      { code: '524', name: '旅費交通費', type: 'expense' },
      { code: '5241', name: '燃料費', type: 'expense' },     // ガソリン・軽油
      { code: '5242', name: '車両費', type: 'expense' },     // オイル・洗車・修理
      { code: '5243', name: '荷造運賃', type: 'expense' },   // 梱包・テープ・台車
      { code: '525', name: '接待交際費', type: 'expense' },
      { code: '5251', name: '支払手数料', type: 'expense' },  // ATM・振込手数料
      { code: '526', name: '広告宣伝費', type: 'expense' },
      { code: '527', name: '損害保険料', type: 'expense' },
      { code: '528', name: '修繕費', type: 'expense' },
      { code: '529', name: '福利厚生費', type: 'expense' },
      { code: '530', name: '利子割引料', type: 'expense' },
      { code: '531', name: '地代家賃（家事按分）', type: 'expense' },
      { code: '540', name: '租税公課', type: 'expense' },
      { code: '550', name: '雑費', type: 'expense' },
      
    ]
  }
};

// 家事按分が適用可能な科目
const KASJI_ELIGIBLE = ['520', '521', '522', '527', '531'];

// 全科目フラット配列
function getAllAccounts() {
  const all = [];
  Object.values(ACCOUNTS).forEach(group => {
    group.items.forEach(item => all.push({ ...item, group: group.label, normalSide: group.normal }));
  });
  return all;
}

// 科目名から取得
function getAccountByName(name) {
  return getAllAccounts().find(a => a.name === name);
}

// 科目コードから取得
function getAccountByCode(code) {
  return getAllAccounts().find(a => a.code === code);
}

// 科目タイプ判定（「減価償却費」を絶対に見逃さない版）
function getAccountType(name) {
  // ★ 強制判定：名前が「減価償却費」なら、リストを探す前に支出と判定
  if (name === '減価償却費') return 'expense';

  const acc = getAccountByName(name);
  return acc ? acc.type : 'unknown';
}
