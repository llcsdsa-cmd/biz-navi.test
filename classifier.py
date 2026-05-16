"""
classifier.py — 勘定科目・取引先自動分類エンジン（軽貨物ドライバー特化版・売上内訳強化）
"""

import argparse
import csv
import json
import os
import re
import sys
import pickle
import unicodedata
from datetime import datetime
from pathlib import Path

# --- scikit-learn ---
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.metrics import classification_report
import pandas as pd

# ローカルモジュール（tokenizer.py）
from tokenizer import tokenize, tokens_to_string, extract_features

# ===== パス設定 =====
BASE_DIR       = Path(__file__).parent
MODEL_PATH     = BASE_DIR / "model.pkl"
TRAIN_DATA     = BASE_DIR / "training_data.csv"
RULES_PATH     = BASE_DIR / "rules.json"
HISTORY_PATH   = BASE_DIR / "history.json"

# ===== 青色申告 勘定科目マスタ =====
ACCOUNTS = [
    "売上高", "受取手数料", "受取利息", "雑収入",        # 収益
    "仕入高",                                            # 売上原価
    "給料賃金", "外注工賃", "減価償却費",                # 人件費系
    "地代家賃", "水道光熱費", "通信費", "消耗品費",       # 固定費
    "旅費交通費", "接待交際費", "広告宣伝費",             # 変動費
    "損害保険料", "修繕費", "福利厚生費", "利子割引料",   # その他経費
    "租税公課", "雑費",                                  # 租税・雑費
    "普通預金", "当座預金", "現金", "売掛金",             # 資産
    "買掛金", "未払費用", "借入金",                       # 負債
    "燃料費", "荷造運賃", "車両費"                        # ★軽貨物ドライバー用
]

# ===== キーワードルール（取引先特定キーワードを売上高に追加） =====
DEFAULT_RULES = {
    "燃料費": [
        "レギュラー", "ハイオク", "軽油", "ガソリン", "燃料", "油", "＠", "単価", "数量", "リットル", " L ",
        "出光", "エネオス", "eneos", "アポロ", "apollo", "コスモ", "cosmo", "キグナス", "kygnus", "宇佐美",
        "usami", "シェル", "shell", "solar", "太陽石油", "jass", "ja-ss", "ホクレン", "三菱商事エネルギー",
        "フリート", "掛け売り", "apollostation", "earthe",
    ],
    "車両費": [
        "洗車", "シャンプー", "コーティング", "ワックス", "車内清掃", "掃除機", "撥水", "ふき取り",
        "ワイパー", "オイル", "エレメント", "フィルター", "タイヤ", "スタッドレス", "ホイール", "バルブ",
        "ウォッシャー", "バッテリー", "プラグ", "ブレーキ", "パッド", "クーラント", "不凍液", "エアコンガス",
        "アドブルー", "adblue", "尿素", "工賃", "技術料", "点検", "車検", "法定", "整備",
        "イエローハット", "yellow", "オートバックス", "autobacs", "ジェームス", "jms", "アップガレージ",
        "トヨタ", "日産", "ホンダ", "ダイハツ", "スズキ", "三菱", "マツダ", "スバル",
    ],
    "旅費交通費": [
        "高速道路", "nexco", "ネクスコ", "首都高", "阪神高速", "有料", "etc", "領収書（etc）", "料金所",
        "タイムズ", "times", "リパーク", "三井のリパーク", "パーキング", "駐車場", "コインパ", "駐輪",
        "suica", "icoca", "pasmo", "電車", "バス", "タクシー", "jr", "新幹線", "駅", "乗車",
    ],
    "荷造運賃": [
        "台車", "キャリー", "カート", "テープ", "養生", "ガムテープ", "布テープ", "opｐ", "ロープ",
        "ストレッチフィルム", "梱包", "ラップ", "ダンボール", "緩衝材", "プチプチ", "ラッシング",
        "荷締め", "ベルト", "パレット", "伝票", "送り状", "封筒", "レターパック", "切手",
    ],
    "消耗品費": [
        "ホルダー", "充電器", "ケーブル", "シガーソケット", "usb", "マグネット", "イヤホン",
        "bluetooth", "ワイヤレス", "ヘッドセット", "モバイルバッテリー", "アンカー", "anker",
        "軍手", "グローブ", "手袋", "安全靴", "レインウェア", "カッパ", "防寒", "ワークマン", "workman",
        "文房具", "コクヨ", "プリンタ", "インク", "トナー", "コピー用紙", "ボールペン", "ファイル", "電池",
    ],
    "通信費": [
        "ドコモ", "docomo", "au", "kddi", "ソフトバンク", "softbank", "ワイモバイル", "uq", "楽天モバイル",
        "格安sim", "携帯", "スマホ", "wifi", "インターネット", "光回線", "プロバイダ", "ntt", "通信", "ギガ",
    ],
    "広告宣伝費": [
        "名刺", "チラシ", "看板", "マグネットシート", "ステッカー", "pr", "ホームページ",
    ],
    "損害保険料": [
        "保険", "共済", "損保", "東京海上", "損保ジャパン", "三井住友海上", "あいおい", "アクサ",
    ],
    "修繕費": [
        "修理", "修繕", "補修", "板金", "塗装", "デント", "ガラス交換", "リペア",
    ],
    "租税公課": [
        "重量税", "自動車税", "軽自動車税", "税金", "住民税", "固定資産税", "印紙", "収入印紙",
    ],
    "地代家賃": [
        "家賃", "賃料", "マンション", "アパート", "テナント", "地代", "月極駐車場", "保管場所",
    ],
    "売上高": [
        "売上", "請求", "入金", "報酬", "売り上げ", "アマゾン", "amazon", "出前館", "ウーバー", "uber", "配送料",
        "サガワ", "佐川", "ヤマト", "stores", "決済", "sdsa"
    ],
    "福利厚生費": [
        "健康診断", "慶弔", "福利", "ジム",
    ],
    "雑費": [
        "その他", "雑費", "雑", "その他経費",
    ],
}


def load_rules() -> dict:
    if RULES_PATH.exists():
        with open(RULES_PATH, encoding="utf-8") as f:
            return json.load(f)
    return DEFAULT_RULES


def save_rules(rules: dict):
    with open(RULES_PATH, "w", encoding="utf-8") as f:
        json.dump(rules, f, ensure_ascii=False, indent=2)
    print(f"[rules] {RULES_PATH} に保存しました")


def classify_by_rules(text: str, rules: dict) -> tuple[str, float]:
    text_n = unicodedata.normalize("NFKC", text).lower()
    best_account = "消耗品費"
    best_score   = 0.0

    for account, keywords in rules.items():
        matched = sum(1 for kw in keywords if kw.lower() in text_n)
        if matched > 0:
            score = min(matched / max(len(keywords) * 0.3, 1), 1.0)
            if score > best_score:
                best_score   = score
                best_account = account

    return best_account, round(best_score, 3)


def load_model():
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            return pickle.load(f)
    return None


def train_model(df: pd.DataFrame) -> Pipeline:
    X = df["text"].apply(lambda t: tokens_to_string(tokenize(str(t))))
    y = df["account"]

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            analyzer="word",
            ngram_range=(1, 2),
            min_df=1,
            max_features=5000,
            sublinear_tf=True,
        )),
        ("clf", LinearSVC(
            C=1.0,
            max_iter=2000,
            class_weight="balanced",
        )),
    ])
    pipeline.fit(X, y)
    return pipeline


def classify_by_model(text: str, model: Pipeline) -> tuple[str, float]:
    token_str = tokens_to_string(tokenize(text))
    pred = model.predict([token_str])
    try:
        scores = model.decision_function([token_str])
        classes = model.classes_
        idx = list(classes).index(pred)
        exp_scores = [2 ** s for s in scores]
        confidence = exp_scores[idx] / sum(exp_scores)
    except Exception:
        confidence = 0.75
    return pred[0], round(confidence, 3)


class AccountClassifier:
    def __init__(self):
        self.rules = load_rules()
        self.model = load_model()
        self.history: list[dict] = self._load_history()

    def _load_history(self) -> list[dict]:
        if HISTORY_PATH.exists():
            with open(HISTORY_PATH, encoding="utf-8") as f:
                return json.load(f)
        return []

    def _save_history(self):
        with open(HISTORY_PATH, "w", encoding="utf-8") as f:
            json.dump(self.history, f, ensure_ascii=False, indent=2)

    def classify(self, text: str, amount: float = 0.0, is_income: bool = False) -> dict:
        """
        [2026-05-14 強化] 取引先(sub_account)の自動判別機能を追加
        """
        sub_account = ""
        text_n = unicodedata.normalize("NFKC", text).lower()

        # 1. 収入(売上高)の場合の特別処理：キーワードから取引先を特定
        if is_income:
            if any(k in text_n for k in ["amazon", "アマゾン", "ｱﾏｿﾞﾝ"]):
                sub_account = "Amazon"
            elif any(k in text_n for k in ["佐川", "サガワ", "ｻｶﾞﾜ"]):
                sub_account = "佐川急便"
            elif any(k in text_n for k in ["uber", "ウーバー", "ｳｰﾊﾞｰ", "出前館"]):
                sub_account = "フードデリバリー"
            elif any(k in text_n for k in ["stores", "ｽﾄｰｽﾞ", "sdsa"]):
                sub_account = "SDSAアプリ"
            elif any(k in text_n for k in ["ヤマト", "ﾔﾏﾄ"]):
                sub_account = "ヤマト運輸"
            else:
                sub_account = "その他取引先"

            return {
                "account":      "売上高",
                "sub_account":  sub_account,
                "confidence":   1.0,
                "method":       "income_rule",
                "alternatives": ["受取手数料", "雑収入"],
                "needs_review": False,
            }

        # 2. 支出の場合の通常分類
        ml_account   = None
        ml_confidence = 0.0
        rule_account  = None
        rule_confidence = 0.0

        if self.model:
            ml_account, ml_confidence = classify_by_model(text, self.model)

        rule_account, rule_confidence = classify_by_rules(text, self.rules)

        if rule_confidence > 0:
            account    = rule_account
            confidence = rule_confidence
            method     = "keyword_rule"
        elif self.model and ml_confidence >= 0.70:
            account    = ml_account
            confidence = ml_confidence
            method     = "ml_model"
        elif self.model:
            account    = ml_account
            confidence = ml_confidence
            method     = "ml_model_low"
        else:
            account    = "消耗品費"
            confidence = 0.1
            method     = "default"

        alternatives = self._get_alternatives(text, account)
        needs_review = confidence < 0.5

        result = {
            "account":      account,
            "sub_account":  "", # 支出の場合は現状空
            "confidence":   confidence,
            "method":       method,
            "alternatives": alternatives,
            "needs_review": needs_review,
        }

        self.history.append({
            "text":       text,
            "amount":      amount,
            "is_income":  is_income,
            "predicted":  account,
            "confidence": confidence,
            "method":     method,
            "timestamp":  datetime.now().isoformat(),
            "corrected":  None,
        })
        self._save_history()

        return result

    def _get_alternatives(self, text: str, predicted: str) -> list[str]:
        candidates = []
        if self.model:
            token_str = tokens_to_string(tokenize(text))
            try:
                scores  = self.model.decision_function([token_str])
                classes = self.model.classes_
                ranked  = sorted(zip(classes, scores[0]), key=lambda x: -x[1])
                candidates = [c for c, _ in ranked if c != predicted][:3]
            except Exception:
                pass
        if not candidates:
            scores = {}
            text_n = unicodedata.normalize("NFKC", text).lower()
            for acc, kws in self.rules.items():
                if acc == predicted:
                    continue
                s = sum(1 for kw in kws if kw in text_n)
                if s > 0:
                    scores[acc] = s
            candidates = sorted(scores, key=lambda x: -scores[x])[:3]
        return candidates or ["消耗品費", "雑費"]

    def add_correction(self, text: str, correct_account: str):
        for entry in reversed(self.history):
            if entry["text"] == text and entry["corrected"] is None:
                entry["corrected"] = correct_account
                break
        self._save_history()

        row = {"text": text, "account": correct_account}
        file_exists = TRAIN_DATA.exists()
        with open(TRAIN_DATA, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["text", "account"])
            if not file_exists:
                writer.writeheader()
            writer.writerow(row)
        print(f"[learn] 学習データ追加: '{text}' → {correct_account}")


# ===== CLI インターフェース =====

def detect_encoding(filepath: str) -> str:
    with open(filepath, "rb") as f:
        raw = f.read(4096)
    if raw.startswith(b'\xef\xbb\xbf'):
        return 'utf-8-sig'
    if raw.startswith(b'\xff\xfe'):
        return 'utf-16'
    for enc in ('cp932', 'shift-jis'):
        try:
            raw.decode(enc)
            return enc
        except Exception:
            pass
    return 'utf-8'


def detect_delimiter(first_line: str) -> str:
    counts = {',': first_line.count(','), '\t': first_line.count('\t')}
    return max(counts, key=counts.get)


COL_ALIASES = {
    "date":        ["date", "日付", "取引日", "年月日", "Date", "支払日"],
    "description": ["description", "内容", "摘要", "件名", "Description", "取引内容", "備考", "明細", "name", "Name", "品名", "店舗名"],
    "amount":      ["amount", "金額", "取引金額", "Amount", "金額(税込)", "入出金額", "出金額", "入金額", "価格", "支払金額", "合計金額"],
    "type":        ["type", "区分", "収支", "収支区分", "出入", "入出"],
}


def resolve_column(fieldnames: list[str], col_key: str, override: str = "") -> str:
    if override and override in fieldnames:
        return override
    for alias in COL_ALIASES.get(col_key, []):
        if alias in fieldnames:
            return alias
    col_lower = col_key.lower()
    for f in fieldnames:
        if col_lower in f.lower():
            return f
    return ""


def parse_amount(val: str) -> float:
    import unicodedata
    val = unicodedata.normalize("NFKC", str(val))
    val = val.replace(",", "").replace("¥", "").replace("￥", "").strip()
    if val.startswith("(") and val.endswith(")"):
        val = "-" + val[1:-1]
    try:
        return float(val)
    except ValueError:
        return 0.0


def cmd_classify(
    input_path: str,
    output_path: str,
    encoding: str = "",
    delimiter: str = "",
    col_date: str = "",
    col_desc: str = "",
    col_amount: str = "",
    col_type: str = "",
    skip_rows: int = 0,
    default_type: str = "",
):
    p = Path(input_path)

    if not p.exists():
        print(f"\n{'='*60}\n  ❌ エラー: ファイルが見つかりません\n{'='*60}")
        return

    size = p.stat().st_size
    if size == 0:
        print(f"\n{'='*60}\n  ❌ エラー: ファイルが空です（0 bytes）\n{'='*60}")
        return

    enc = encoding or detect_encoding(input_path)
    content = None
    tried_encodings = [enc] if encoding else [enc, 'utf-8', 'utf-8-sig', 'cp932', 'shift-jis', 'utf-16']

    for try_enc in tried_encodings:
        try:
            with open(input_path, encoding=try_enc, errors='strict') as f:
                content = f.read()
            enc = try_enc
            break
        except Exception:
            pass

    if content is None:
        print(f"\n{'='*60}\n  ❌ エラー原因: 文字コードのデコード失敗\n{'='*60}")
        return

    all_lines  = content.splitlines()
    data_lines = [l for l in all_lines if l.strip()]
    content = "\n".join(data_lines)

    delim = delimiter or detect_delimiter(data_lines[0])
    
    import io
    reader    = csv.DictReader(io.StringIO(content), delimiter=delim)
    fieldnames = reader.fieldnames or []

    if not fieldnames:
        print(f"\n{'='*60}\n  ❌ エラー原因: ヘッダー行の解析に失敗しました\n{'='*60}")
        return

    c_date   = resolve_column(fieldnames, "date",        col_date)
    c_desc   = resolve_column(fieldnames, "description", col_desc)
    c_amount = resolve_column(fieldnames, "amount",      col_amount)
    c_type   = resolve_column(fieldnames, "type",        col_type)

    clf  = AccountClassifier()
    rows = []

    for row in csv.DictReader(io.StringIO(content), delimiter=delim):
        text = (row.get(c_desc) or "").strip() if c_desc else ""
        if not text:
            text = " ".join(v for v in row.values() if v and v.strip())

        raw_amt = (row.get(c_amount) or "0") if c_amount else "0"
        amount  = parse_amount(raw_amt)

        type_val = str(row.get(c_type, "")).strip().lower() if c_type else ""
        
        if type_val in ["income", "収入", "入金"]:
            is_income = True
        elif type_val in ["expense", "支出", "出金"]:
            is_income = False
        else:
            if default_type == "income": is_income = True
            elif default_type == "expense": is_income = False
            else: is_income = amount > 0

        result = clf.classify(text, amount=abs(amount), is_income=is_income)

        rows.append({
            **row,
            "predicted_account": result["account"],
            "predicted_sub":     result["sub_account"], # ★新設：取引先名
            "confidence":        result["confidence"],
            "method":            result["method"],
            "alternatives":      "|".join(result["alternatives"]),
            "needs_review":      "要確認" if result["needs_review"] else "OK",
            "correct_account":   "",
        })

    if rows:
        with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        print(f"\n  ✅ 分類完了 → {output_path} ({len(rows)}件)")
    else:
        print(f"\n{'='*60}\n  ❌ エラー原因: 有効なデータ行が0件でした\n{'='*60}")
        sys.exit(1)


def cmd_learn(corrected_path: str):
    clf = AccountClassifier()
    count = 0
    with open(corrected_path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            text    = row.get("description") or row.get("内容") or row.get("摘要") or ""
            correct = row.get("correct_account") or row.get("正解科目") or ""
            if text and correct:
                clf.add_correction(text, correct)
                count += 1
    print(f"[learn] {count}件の正解ラベルを追加しました")


def cmd_train():
    if not TRAIN_DATA.exists():
        print("[train] training_data.csv がありません"); sys.exit(1)
    df = pd.read_csv(TRAIN_DATA, encoding="utf-8-sig").dropna(subset=["text", "account"])
    df = df[df["text"].str.strip() != ""]
    if len(df) < 5:
        print(f"[train] 学習データが少なすぎます。最低5件必要です"); sys.exit(1)
    pipeline = train_model(df)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(pipeline, f)
    print(f"[train] モデル保存: {MODEL_PATH}")


def cmd_evaluate():
    model = load_model()
    if not model or not TRAIN_DATA.exists():
        print("[evaluate] 必要なファイルがありません"); sys.exit(1)
    df = pd.read_csv(TRAIN_DATA, encoding="utf-8-sig").dropna(subset=["text", "account"])
    X = df["text"].apply(lambda t: tokens_to_string(tokenize(str(t))))
    y = df["account"]
    y_pred = model.predict(X)
    print(classification_report(y, y_pred, zero_division=0))


def cmd_add_rule(account: str, keywords: str):
    rules = load_rules()
    kw_list = [k.strip() for k in keywords.split(",") if k.strip()]
    if account not in rules: rules[account] = []
    for kw in kw_list:
        if kw not in rules[account]: rules[account].append(kw)
    save_rules(rules)
    print(f"[rule] '{account}' にキーワードを追加: {kw_list}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PRiMPO CSV 勘定科目 自動分類エンジン (軽貨物版)")
    
    parser.add_argument("--classify", help="CSVを分類する")
    parser.add_argument("--output", help="出力先CSVパス", default="output_classified.csv")
    parser.add_argument("--encoding", help="文字コード指定", default="")
    parser.add_argument("--delimiter", help="区切り文字", default="")
    parser.add_argument("--skip-rows", help="先頭N行をスキップ", type=int, default=0)
    parser.add_argument("--col-date", help="日付列名", default="")
    parser.add_argument("--col-desc", help="摘要列名", default="")
    parser.add_argument("--col-amount", help="金額列名", default="")
    parser.add_argument("--col-type", help="収支区分列名", default="")
    parser.add_argument("--default-type", help="収支不明時のデフォルト (income/expense/省略=符号判定)", default="")
    
    parser.add_argument("--learn", help="修正済みCSVを学習データに追加")
    parser.add_argument("--train", action="store_true", help="モデルを学習する")
    parser.add_argument("--evaluate", action="store_true", help="モデルを評価する")
    parser.add_argument("--add-rule", nargs=2, help="ルール追加: --add-rule 科目名 '単語1,単語2'")

    args = parser.parse_args()
    
    if args.classify:
        cmd_classify(
            args.classify, args.output,
            encoding=args.encoding,
            delimiter=args.delimiter,
            col_date=args.col_date,
            col_desc=args.col_desc,
            col_amount=args.col_amount,
            col_type=args.col_type,
            skip_rows=args.skip_rows,
            default_type=args.default_type
        )
    elif args.learn: cmd_learn(args.learn)
    elif args.train: cmd_train()
    elif args.evaluate: cmd_evaluate()
    elif args.add_rule: cmd_add_rule(args.add_rule[0], args.add_rule[1])
    else: parser.print_help()
