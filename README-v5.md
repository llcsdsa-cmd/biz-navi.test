# Biz-Navi (Biz-Insight Navigator)

> 軽貨物ドライバー向け 経営支援OS  
> 「配送していたら、気づけば青色申告まで終わっていた。」

---

## 概要

Biz-Navi は、
軽貨物ドライバー・黒ナンバー個人事業主向けに開発している
スマホ完結型の経営支援アプリです。

一般的な会計ソフトとは異なり、

- 配送業務
- 日報
- 経費入力
- OCR取込
- 家事按分
- 青色申告準備

を自然に接続し、

「会計を頑張る」のではなく、
「配送業務をしていたら自然に会計が終わる」

体験を目指しています。

---

# コンセプト

Biz-Navi は
「会計ソフト」ではありません。

## 軽貨物ドライバー向け 経営支援OS

です。

---

# ターゲット

- 軽貨物個人事業主
- Amazon Flex ドライバー
- PickGo ドライバー
- 黒ナンバー事業者
- 青色申告初心者
- freee や会計ソフトで挫折した人
- Excel管理に限界を感じている人

---

# 特徴

## ✅ スマホ1台で完結

- PWA対応
- タブレット対応
- PC不要設計
- タッチ操作最適化

---

## ✅ 会計知識不要

難しい会計用語を極力排除。

例：

| 一般的な会計用語 | Biz-Navi |
|---|---|
| 借方 | 何を買った？ |
| 貸方 | どの財布から払った？ |

---

## ✅ 裏側では複式簿記

ユーザーに複雑な操作を要求せず、
内部では複式簿記として処理。

青色申告へ自然に接続します。

---

## ✅ 軽貨物特化

軽貨物ドライバー特有の：

- 燃料費
- 高速代
- 車両費
- 走行距離
- 家事按分

などを前提設計。

---

## ✅ 日報 → 按分 → 確定申告

日報入力から：

- 走行距離管理
- 家事按分率
- 車両系経費按分

を自動計算。

---

## ✅ OCR連携

PRiMPO等で作成したCSVを取り込み：

- レシート
- 領収書
- 銀行CSV
- カードCSV

などを自動分類。

---

## ✅ 自動分類エンジン

軽貨物特化辞書を搭載。

例：

- ENEOS → 燃料費
- ETC → 旅費交通費
- ダイソー → 消耗品費

※「AI判断」ではなく「自動分類補助」として設計しています。

---

## ✅ 電帳法対応

- SHA-256ハッシュ
- タイムスタンプ
- 訂正ログ

に対応。

---

# 現在実装済みの主な機能

- ダッシュボード
- 仕訳帳
- 総勘定元帳
- 日報
- 青色申告サポート
- 消費税管理
- 固定資産管理
- 電帳法対応
- Google Driveバックアップ
- Dropbox / OneDrive対応
- CSV入出力
- 自動分類エンジン
- 家事按分計算

---

# 開発中機能

- LINE Bot連携
- ワンタップ承認UI
- ゲーム型オンボーディング
- Amazon Flex CSV対応
- PickGo CSV対応
- 「今日やること」UI
- 自動化率可視化

---

# 技術構成

## Frontend

- HTML
- CSS
- JavaScript
- Chart.js

---

## Backend / Local

- localStorage
- Google Drive API
- OAuth2

---

## AI / 分類

- Python
- scikit-learn
- TF-IDF
- LinearSVC
- MeCab

---

# 設計思想

## Progressive Disclosure

必要になるまで
高度機能を見せません。

例：

- 免税事業者には消費税項目を簡略表示
- 初級ユーザーには総勘定元帳を非表示

など。

---

## 「会計アプリ感」を減らす

Biz-Navi は：

- 「今やること」
- 「未確認」
- 「今日の利益」

を重視。

配送業務アプリとしてのUXを優先しています。

---

# データ保存について

Biz-Navi は
サーバーレス設計を基本としています。

財務データは：

- ユーザー端末
- Google Drive
- Dropbox
- OneDrive

などへ保存。

運営側へ財務データを送信しない設計を目指しています。

---

# 法務・免責について

Biz-Navi は：

- 税務判断を行いません
- 最終判断は利用者自身または税理士等が行います
- 自動分類結果の正確性を保証しません

正式リリース前に：

- 利用規約
- 免責事項
- 税理士法確認

を実施予定です。

---

# 料金予定

## 基本プラン（月額500円）

- 経費入力
- 日報
- 自動分類補助
- 青色申告サポート

など。

---

## 拡張プラン（月額1000円）

- 節税チェック
- 補助金提案
- 高度分析

など。

---

# 開発状況

現在テスト開発中です。

実装状況：

- コア機能：約85%
- UI/UX：約85%
- オンボーディング：約15%
- LINE連携：約10%

---

# フィードバック募集中

軽貨物ドライバーの方、
実際の運用目線でのフィードバック大歓迎です。

「現場で本当に使えるもの」
を目指して改善を続けています。

---

# ライセンス

現在調整中。

---

# 注意事項

本アプリは開発中です。

画面・仕様・機能は
正式リリース時に変更される可能性があります。

---

---

# English Version

# Biz-Navi (Biz-Insight Navigator)

> Business Support OS for Light Cargo Drivers  
> “Just by doing deliveries, your bookkeeping and blue tax return are almost done.”

---

## Overview

Biz-Navi is a mobile-first business support application
designed specifically for Japanese light cargo drivers and sole proprietors.

Unlike traditional accounting software,
Biz-Navi naturally connects:

- Daily delivery work
- Work logs
- Expense tracking
- OCR receipt import
- Vehicle expense allocation
- Blue tax return preparation

The goal is:

> Not “working on accounting,”  
> but “finishing accounting naturally through daily work.”

---

# Concept

Biz-Navi is NOT just accounting software.

It is designed as a:

## Business Support OS for Light Cargo Drivers

---

# Target Users

- Light cargo sole proprietors
- Amazon Flex drivers
- PickGo drivers
- Commercial plate owner-operators
- Beginners in bookkeeping/tax filing
- Users frustrated with traditional accounting apps
- Drivers currently managing everything in Excel

---

# Features

## ✅ Smartphone-First Design

- PWA support
- Tablet compatible
- No PC required
- Optimized for touch operation

---

## ✅ No Accounting Knowledge Required

Complex accounting terminology is simplified.

Example:

| Traditional Accounting | Biz-Navi |
|---|---|
| Debit | What did you buy? |
| Credit | Which wallet paid for it? |

---

## ✅ Double-Entry Bookkeeping in the Background

Users are not forced to understand bookkeeping mechanics,
while the system internally records proper double-entry accounting data.

This naturally connects to blue tax return preparation.

---

## ✅ Specialized for Light Cargo Drivers

Built specifically for common driver expenses:

- Fuel
- Highway tolls
- Vehicle maintenance
- Mileage tracking
- Business/private expense allocation

---

## ✅ Work Logs → Expense Allocation → Tax Preparation

Daily work logs automatically help calculate:

- Mileage tracking
- Business-use ratio
- Vehicle expense allocation

---

## ✅ OCR Integration

Import CSV files created by OCR apps such as PRiMPO:

- Receipts
- Invoices
- Bank CSV files
- Credit card statements

and classify them automatically.

---

## ✅ Auto Classification Engine

Includes a driver-focused keyword dictionary.

Examples:

- ENEOS → Fuel Expense
- ETC → Travel Expense
- Daiso → Office Supplies

The system is intentionally described as:

> “Automatic Classification Assistance”

instead of “AI Judgment.”

---

## ✅ Electronic Record Retention Compliance

Supports:

- SHA-256 hashing
- Timestamping
- Revision logs

for electronic bookkeeping compliance.

---

# Implemented Features

- Dashboard
- Journal entries
- General ledger
- Daily work logs
- Blue tax return support
- Consumption tax management
- Asset management
- Electronic bookkeeping support
- Google Drive backup
- Dropbox / OneDrive support
- CSV import/export
- Auto classification engine
- Expense allocation calculation

---

# Features in Development

- LINE Bot integration
- One-tap approval UI
- Gamified onboarding
- Amazon Flex CSV support
- PickGo CSV support
- “Today’s Tasks” dashboard
- Automation rate visualization

---

# Tech Stack

## Frontend

- HTML
- CSS
- JavaScript
- Chart.js

---

## Local / Storage

- localStorage
- Google Drive API
- OAuth2

---

## Classification Engine

- Python
- scikit-learn
- TF-IDF
- LinearSVC
- MeCab

---

# Design Philosophy

## Progressive Disclosure

Advanced features are hidden until needed.

Examples:

- Consumption tax functions simplified for tax-exempt users
- General ledger hidden for beginners

---

## Reduce “Accounting Software” Feeling

Biz-Navi prioritizes:

- What to do today
- Unconfirmed items
- Today’s profit

to feel more like a work companion app than accounting software.

---

# Data Storage

Biz-Navi is designed around a serverless philosophy.

Financial data is stored on:

- User devices
- Google Drive
- Dropbox
- OneDrive

The system aims to avoid sending sensitive accounting data to the operator.

---

# Legal Notice

Biz-Navi:

- Does not provide tax judgment
- Does not replace a licensed tax accountant
- Does not guarantee classification accuracy

Before official release:

- Terms of Service
- Disclaimer
- Legal review regarding Japanese tax accountant law

will be completed.

---

# Planned Pricing

## Basic Plan — ¥500/month

Includes:

- Expense input
- Daily logs
- Auto classification support
- Blue tax return assistance

---

## Premium Plan — ¥1000/month

Includes:

- Tax-saving checks
- Subsidy suggestions
- Advanced analytics

---

# Development Status

Currently under active development.

Estimated completion:

- Core functions: ~85%
- UI/UX: ~85%
- Onboarding: ~15%
- LINE integration: ~10%

---

# Feedback Welcome

Feedback from real light cargo drivers is highly appreciated.

The goal is to build:

> “A tool that truly works in the real field.”

---

# License

Currently under consideration.

---

# Disclaimer

This application is under development.

Features, UI, and specifications may change before official release.
