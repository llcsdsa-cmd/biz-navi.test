"""
test_classifier.py — 分類エンジンのテストとサンプルデータ生成
"""

import csv
import sys
from pathlib import Path
from classifier import AccountClassifier, cmd_train, cmd_evaluate, TRAIN_DATA

# ===== サンプル学習データ（日本の一般的な取引） =====
SAMPLE_TRAINING_DATA = [
    # 旅費交通費
    ("Suica チャージ",                "旅費交通費"),
    ("JR東日本 定期券",               "旅費交通費"),
    ("タクシー代 客先訪問",            "旅費交通費"),
    ("東京メトロ 乗車",               "旅費交通費"),
    ("高速道路 ETC",                  "旅費交通費"),
    ("新幹線 出張",                   "旅費交通費"),
    ("飛行機 国内出張",               "旅費交通費"),
    ("バス代",                        "旅費交通費"),
    # 通信費
    ("NTTドコモ 月額料金",            "通信費"),
    ("ソフトバンク スマートフォン",    "通信費"),
    ("au 携帯電話料金",               "通信費"),
    ("インターネット回線 光",          "通信費"),
    ("Wifi ルーター",                 "通信費"),
    ("携帯電話料金",                  "通信費"),
    ("プロバイダ料金",                "通信費"),
    # 水道光熱費
    ("東京電力 電気料金",             "水道光熱費"),
    ("東京ガス ガス代",               "水道光熱費"),
    ("水道料金",                      "水道光熱費"),
    ("電気代",                        "水道光熱費"),
    ("ガス料金",                      "水道光熱費"),
    # 地代家賃
    ("事務所 家賃",                   "地代家賃"),
    ("マンション 賃料",               "地代家賃"),
    ("オフィス テナント料",           "地代家賃"),
    ("駐車場代",                      "地代家賃"),
    ("倉庫 賃借料",                   "地代家賃"),
    # 消耗品費
    ("コクヨ ノート 文房具",          "消耗品費"),
    ("プリンター インク",             "消耗品費"),
    ("コピー用紙 A4",                 "消耗品費"),
    ("ボールペン まとめ買い",         "消耗品費"),
    ("クリアファイル",                "消耗品費"),
    ("USBメモリ",                    "消耗品費"),
    ("電池 単三",                    "消耗品費"),
    # 広告宣伝費
    ("Google Ads 広告費",             "広告宣伝費"),
    ("Facebook 広告",                 "広告宣伝費"),
    ("チラシ印刷 宣伝",              "広告宣伝費"),
    ("SNS広告",                      "広告宣伝費"),
    # 接待交際費
    ("取引先 会食",                   "接待交際費"),
    ("接待 ゴルフ",                   "接待交際費"),
    ("お中元 贈答品",                 "接待交際費"),
    ("お歳暮",                        "接待交際費"),
    ("手土産",                        "接待交際費"),
    # 損害保険料
    ("損害保険料",                    "損害保険料"),
    ("火災保険",                      "損害保険料"),
    ("自動車保険",                    "損害保険料"),
    # 修繕費
    ("パソコン 修理",                 "修繕費"),
    ("エアコン メンテナンス",         "修繕費"),
    ("オフィス 補修",                 "修繕費"),
    # 外注工賃
    ("業務委託 フリーランス",         "外注工賃"),
    ("外注 デザイン",                 "外注工賃"),
    ("システム開発 外注",             "外注工賃"),
    # 租税公課
    ("印紙税",                        "租税公課"),
    ("固定資産税",                    "租税公課"),
    ("収入印紙",                      "租税公課"),
    # 売上高
    ("売上入金 株式会社A",            "売上高"),
    ("請求書 サービス料",             "売上高"),
    ("コンサルティング報酬",          "売上高"),
    ("システム開発 納品",             "売上高"),
    # 給料賃金
    ("給与 支払い",                   "給料賃金"),
    ("社員 給料",                     "給料賃金"),
    ("アルバイト 賃金",               "給料賃金"),
    # 雑費
    ("その他経費",                    "雑費"),
    ("雑費 小口",                     "雑費"),
]


def generate_sample_training_csv():
    """サンプル学習データをCSVに書き出す"""
    with open(TRAIN_DATA, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["text", "account"])
        writer.writeheader()
        for text, account in SAMPLE_TRAINING_DATA:
            writer.writerow({"text": text, "account": account})
    print(f"[setup] サンプル学習データ {len(SAMPLE_TRAINING_DATA)}件 → {TRAIN_DATA}")


def generate_sample_primpo_csv():
    """PRiMPO風のサンプル入力CSVを生成"""
    sample_path = Path(__file__).parent / "sample_primpo.csv"
    rows = [
        {"date": "2025-04-01", "description": "Suica チャージ",          "amount": -3000,  "category": "交通"},
        {"date": "2025-04-02", "description": "東京電力 電気料金",        "amount": -8500,  "category": "光熱"},
        {"date": "2025-04-03", "description": "NTTドコモ 月額",           "amount": -7200,  "category": "通信"},
        {"date": "2025-04-05", "description": "コクヨ ノート 文房具",     "amount": -1200,  "category": "消耗品"},
        {"date": "2025-04-07", "description": "売上入金 株式会社サンプル","amount": 150000, "category": "売上"},
        {"date": "2025-04-08", "description": "事務所 家賃 4月分",        "amount": -80000, "category": "家賃"},
        {"date": "2025-04-10", "description": "Google Ads 広告費",        "amount": -25000, "category": "広告"},
        {"date": "2025-04-12", "description": "取引先 会食 接待",         "amount": -15000, "category": "接待"},
        {"date": "2025-04-15", "description": "業務委託 デザイン外注",    "amount": -50000, "category": "外注"},
        {"date": "2025-04-18", "description": "高速道路 ETC 出張",        "amount": -2500,  "category": "交通"},
        {"date": "2025-04-20", "description": "パソコン 修理",            "amount": -12000, "category": "修繕"},
        {"date": "2025-04-22", "description": "損害保険料 年払い",        "amount": -36000, "category": "保険"},
        {"date": "2025-04-25", "description": "コンサルティング報酬",     "amount": 200000, "category": "売上"},
        {"date": "2025-04-28", "description": "収入印紙",                 "amount": -400,   "category": "税"},
        {"date": "2025-04-30", "description": "その他 雑費",              "amount": -800,   "category": "その他"},
    ]
    with open(sample_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "description", "amount", "category"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"[setup] サンプルPRiMPO CSV {len(rows)}件 → {sample_path}")
    return sample_path


def run_full_test():
    """全機能をテストする"""
    print("=" * 60)
    print("  勘定科目分類エンジン 動作テスト")
    print("=" * 60)

    # 1. サンプルデータ生成
    print("\n[1/5] サンプルデータ生成")
    generate_sample_training_csv()
    sample_csv = generate_sample_primpo_csv()

    # 2. 学習
    print("\n[2/5] モデル学習")
    cmd_train()

    # 3. 評価
    print("\n[3/5] 精度評価")
    cmd_evaluate()

    # 4. サンプルCSV分類
    print("\n[4/5] サンプルCSV分類テスト")
    from classifier import cmd_classify
    out = Path(__file__).parent / "output_classified.csv"
    cmd_classify(str(sample_csv), str(out))

    # 5. 結果表示
    print("\n[5/5] 分類結果プレビュー")
    print(f"{'摘要':<30} {'予測科目':<15} {'信頼度':>6}  {'手法':<15} 要確認")
    print("-" * 85)
    with open(out, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            desc   = row.get("description", "")[:28]
            acc    = row.get("predicted_account", "")
            conf   = float(row.get("confidence", 0))
            method = row.get("method", "")
            review = row.get("needs_review", "")
            bar    = "⚠" if review == "要確認" else "✓"
            print(f"{desc:<30} {acc:<15} {conf:>6.2f}  {method:<15} {bar}")

    print(f"\n出力ファイル: {out}")
    print("\n次のステップ:")
    print("  1. output_classified.csv を開く")
    print("  2. correct_account 列に正解科目を入力")
    print("  3. python classifier.py --learn output_classified.csv")
    print("  4. python classifier.py --train")
    print("  5. 繰り返すほど精度が向上します")


if __name__ == "__main__":
    run_full_test()
