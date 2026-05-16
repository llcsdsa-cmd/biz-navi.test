"""
tokenizer.py — 日本語テキスト分析モジュール（軽貨物ドライバー特化版）
MeCabが使える環境では自動的にMeCabを使用し、
使えない場合は正規表現ベースのトークナイザーにフォールバックする。
"""

import re
import unicodedata

# ===== MeCab自動切替 =====
try:
    import MeCab
    _mecab = MeCab.Tagger("-Ochasen")
    USE_MECAB = True
    print("[tokenizer] MeCab を使用します")
except ImportError:
    USE_MECAB = False
    print("[tokenizer] MeCab未検出 → 正規表現トークナイザーを使用します")


def normalize(text: str) -> str:
    """全角→半角、大文字統一、余分なスペース除去"""
    text = unicodedata.normalize("NFKC", text)
    return text.strip().lower()


def tokenize_mecab(text: str) -> list[str]:
    """
    MeCabで形態素解析 → 名詞・動詞・形容詞、および英数字を抽出
    （英数字の連続が1文字ずつ分解されて消滅するバグを回避する修正済み）
    """
    tokens = []
    
    # === 1. テキスト内の「英数字の連続」をそのまま救出 ===
    # これにより ENEOS や ETC、30.5L などの消滅を防ぎます
    english_words = re.findall(r'[a-zA-Z0-9]+', text)
    tokens.extend([w.lower() for w in english_words if len(w) >= 2])
    
    # === 2. MeCabによる日本語の分解 ===
    node = _mecab.parseToNode(text)
    while node:
        feature = node.feature.split(",")
        pos = feature[0]  # 品詞
        if pos in ("名詞", "動詞", "形容詞") and node.surface:
            # 原形があれば原形、なければ表層形
            base = feature[6] if len(feature) > 6 and feature[6] != "*" else node.surface
            
            # 1文字のアルファベットはゴミになりやすいため除外
            if re.match(r'^[a-zA-Z]$', base):
                node = node.next
                continue
                
            tokens.append(base)
        node = node.next
        
    return tokens


def tokenize_regex(text: str) -> list[str]:
    """
    正規表現ベースのトークナイザー（MeCab代替）
    日本語文字列を意味ある単位に分割する
    """
    text = normalize(text)
    tokens = []

    # カタカナ語をそのまま1トークンに
    katakana = re.findall(r'[ァ-ヶー]+', text)
    tokens.extend(katakana)

    # アルファベット・英数字語
    alpha = re.findall(r'[a-z0-9]+', text)
    tokens.extend(alpha)

    # 漢字・ひらがなの連続（2文字以上）
    kanji = re.findall(r'[一-龥ぁ-ん]{2,}', text)
    tokens.extend(kanji)

    # 1文字の漢字も追加
    single_kanji = re.findall(r'[一-龥]', text)
    tokens.extend(single_kanji)

    return [t for t in tokens if t]


def tokenize(text: str) -> list[str]:
    """環境に応じてMeCabまたは正規表現でトークナイズ"""
    if not text or not text.strip():
        return []
    text = normalize(text)
    if USE_MECAB:
        return tokenize_mecab(text)
    return tokenize_regex(text)


def tokens_to_string(tokens: list[str]) -> str:
    """TF-IDFベクタライザー用にスペース区切り文字列に変換"""
    return " ".join(tokens)


def extract_features(text: str) -> dict:
    """
    分類に有用な特徴量を辞書で返す
    """
    text_n = normalize(text)
    tokens = tokenize(text)
    return {
        "tokens": tokens,
        "token_str": tokens_to_string(tokens),
        "has_price": bool(re.search(r'[¥￥]\s*[\d,]+|[\d,]+円', text_n)),
        "has_date": bool(re.search(r'\d{1,2}[/\-月]\d{1,2}', text_n)),
        "is_receipt": any(w in text_n for w in ["レシート", "領収", "receipt"]),
        "shop_type": _guess_shop_type(text_n),
    }


def _guess_shop_type(text: str) -> str:
    """テキストから店舗種別を推定するヒューリスティック"""
    patterns = [
        # ★軽貨物ドライバー用に追加
        (r'出光|エネオス|eneos|コスモ|キグナス|宇佐美|シェル|太陽石油',      "ガソリンスタンド"),
        (r'コンビニ|セブン|ローソン|ファミマ|ミニストップ',        "コンビニ"),
        (r'スーパー|イオン|ライフ|マルエツ|西友|業務スーパー',      "スーパー"),
        (r'駅|jr|suica|icoca|交通|バス|タクシー|電車',           "交通"),
        (r'amazon|楽天|yahoo|ヤフー|メルカリ|通販',              "EC"),
        (r'電気|ガス|水道|光熱|東電|東ガス|関電',               "光熱費"),
        (r'携帯|ドコモ|au|ソフトバンク|wifi|インターネット|通信',  "通信"),
        (r'家賃|賃料|マンション|アパート|住宅',                   "家賃"),
        (r'飲食|レストラン|居酒屋|カフェ|ランチ|食事',            "飲食"),
        (r'文房具|コクヨ|プリンタ|インク|紙|トナー',              "事務用品"),
        (r'書籍|本|amazon|kindle|学習|研修|セミナー',            "書籍・研修"),
        (r'保険|共済',                                          "保険"),
        (r'広告|宣伝|pr|マーケ|sns',                           "広告"),
    ]
    for pattern, label in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return label
    return "その他"
