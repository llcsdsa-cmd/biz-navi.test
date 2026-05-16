"""
export_to_app.py — 分類済みCSVを会計アプリ用JSONに変換

使い方:
  python export_to_app.py --input output_classified.csv --output kaikei_import.json

出力JSONは会計アプリの「ファイルから復元」機能でそのまま取り込み可能。
"""

import argparse
import csv
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

# 青色申告 収益科目リスト（収入かどうかの判定に使用）
INCOME_ACCOUNTS = {"売上高", "受取手数料", "受取利息", "雑収入"}

# 税区分マッピング（勘定科目 → デフォルト税区分）
DEFAULT_TAX_CODE = {
    "売上高":      "exempt10",
    "受取手数料":  "exempt10",
    "受取利息":    "free",
    "雑収入":      "exempt10",
    "仕入高":      "input10",
    "消耗品費":    "input10",
    "旅費交通費":  "input10",
    "通信費":      "input10",
    "水道光熱費":  "input10",
    "地代家賃":    "input10",
    "広告宣伝費":  "input10",
    "接待交際費":  "input10",
    "外注工賃":    "input10",
    "修繕費":      "input10",
    "損害保険料":  "free",
    "給料賃金":    "non",
    "租税公課":    "non",
    "雑費":        "input10",
    "福利厚生費":  "input10",
}

# 預金科目（借方/貸方の相手科目）
BANK_ACCOUNT = "普通預金"


def normalize_amount(val: str) -> float:
    # 日本語ヘッダーと英語ヘッダーの両方に対応できるように修正
    date        = (row.get("date") or row.get("日付") or "").strip()
    description = (row.get("description") or row.get("取引内容/商品名") or row.get("取引先・品名") or "").strip()
    amount_raw  = row.get("amount") or row.get("金額") or "0"
    account     = (row.get("predicted_account") or row.get("勘定科目") or "消耗品費").strip()
    confidence  = float(row.get("confidence") or row.get("confidence", 0.5))



def build_entry(row: dict, idx: int) -> dict | None:
    """
    CSVの1行から仕訳エントリを生成する
    """
    date        = row.get("date", "").strip()
    description = row.get("description", "").strip()
    amount_raw  = row.get("amount", "0")
    account     = row.get("predicted_account", "消耗品費").strip()
    confidence  = float(row.get("confidence", 0.5))

    # 正解科目がある場合は優先
    correct = row.get("correct_account", "").strip()
    if correct:
        account = correct

    # 日付バリデーション
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")

    amount = abs(normalize_amount(amount_raw))
    if amount == 0:
        return None

    is_income = account in INCOME_ACCOUNTS
    tax_code  = DEFAULT_TAX_CODE.get(account, "input10")

    # 消費税額計算（税込金額から逆算）
    tax_rate_map = {
        "exempt10": 0.10, "exempt8": 0.08,
        "input10":  0.10, "input8":  0.08,
        "free": 0.0, "non": 0.0,
    }
    rate    = tax_rate_map.get(tax_code, 0.0)
    tax_amt = round(amount * rate / (1 + rate)) if rate > 0 else 0

    entry_id = f"import_{datetime.now().strftime('%Y%m%d')}_{idx:04d}"

    if is_income:
        debit  = {"account": BANK_ACCOUNT, "sub": "", "amount": amount, "taxCode": "non",    "taxAmount": 0}
        credit = {"account": account,      "sub": "", "amount": amount, "taxCode": tax_code, "taxAmount": tax_amt}
    else:
        debit  = {"account": account,      "sub": "", "amount": amount, "taxCode": tax_code, "taxAmount": tax_amt}
        credit = {"account": BANK_ACCOUNT, "sub": "", "amount": amount, "taxCode": "non",    "taxAmount": 0}

return {
        "id":        entry_id,
        "date":      date,
        "debit":     debit,
        "credit":    credit,
        "memo":      description + "（CSV取込）",
        "kasji":     None,
        "manually_saved": True,  # ★ここを追加（JS側で true として読み込まれます）
        "createdAt": int(datetime.now().timestamp() * 1000),
        "_meta": {
            "confidence":   confidence,
            "needs_review": confidence < 0.5 or bool(row.get("needs_review") == "要確認"),
            "source":       "primpo_classifier",
        },
    }

def convert(input_path: str, output_path: str):
    entries    = []
    skipped    = 0
    need_review = 0

    with open(input_path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            entry = build_entry(row, idx)
            if entry is None:
                skipped += 1
                continue
            if entry["_meta"]["needs_review"]:
                need_review += 1
            entries.append(entry)

    # 日付順ソート
    entries.sort(key=lambda e: e["date"])

    # 会計アプリ形式のJSON
    output = {
        "entries":     entries,
        "exportedAt":  datetime.now().isoformat(),
        "source":      "primpo_classifier",
        "version":     "2.0",
        "meta": {
            "total":       len(entries),
            "skipped":     skipped,
            "need_review": need_review,
        },
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"[export] {len(entries)}件を変換 → {output_path}")
    if skipped:
        print(f"  スキップ: {skipped}件（金額なし）")
    if need_review:
        print(f"  ⚠ 要確認: {need_review}件（信頼度 < 0.5 または明示的に要確認）")
    print(f"\n会計アプリへの取り込み方法:")
    print(f"  設定タブ → データ管理 → バックアップから復元 → {output_path} を選択")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="分類済みCSVを会計アプリ用JSONに変換")
    parser.add_argument("--input",  required=True, help="分類済みCSVパス（output_classified.csv）")
    parser.add_argument("--output", default="kaikei_import.json", help="出力JSONパス")
    args = parser.parse_args()
    convert(args.input, args.output)
