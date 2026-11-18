"""SENTINEL tr_v2_norm_1 input preparation.

Transformation specification published in
https://huggingface.co/spaces/ads2009/sentinel-ai/blob/main/backend.py.
Preserve Turkish case and accents. No translation or generative rewriting.
"""
import re
import unicodedata

PUNCTUATION = str.maketrans({
    **dict.fromkeys('“”„«»″', '"'),
    **dict.fromkeys("‘’‚‹›′´`", "'"),
    **dict.fromkeys("–—‒―−", "-"),
    "…": "...", "\t": " ",
})
PREFIX = re.compile(
    r"^(?:[Ee]lbette|[Tt]abii?(?: ki)?|[Kk]esinlikle|[Hh]arika|[Mm]emnuniyetle|[İi]şte|[Aa]şağıda|"
    r"[Ss]ize|[Bb]u metin|[Yy]eniden yazılmış)\b[^.!?:]{0,160}[.!?:]\s+"
)
HEADING = re.compile(r"^(?:başlık|baslik|title|devam|metin|özet|yeniden yazılmış metin|devamı)\s*:", re.I)
DATELINE = re.compile(
    r"^[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü' ]{1,40}\s*\((?:AA|DHA|İHA|IHA|ANKA|Reuters|AFP|AP|"
    r"Sputnik|BBC|DW|NTV|CNN TÜRK)\)\s*-?\s*"
)


def normalize_turkish(text):
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"[\u200b-\u200f\u202a-\u202e\ufeff\u00ad]", "", text)
    text = text.replace("\xa0", " ").translate(PUNCTUATION)
    text = re.sub(r"\[\d+\]", "", text)
    content = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        line = re.sub(r"^(?:#{1,6}\s*|[-*•▪●◦]\s+|\d{1,2}[.)]\s+)", "", line)
        if HEADING.match(line) and len(line.split()) < 14:
            continue
        content.append(line)
    text = re.sub(r"[*_#]+", "", " ".join(content))
    text = re.sub(r"\s+", " ", text).strip()
    for _ in range(2):
        text = PREFIX.sub("", text, count=1)
    text = DATELINE.sub("", text, count=1)
    text = re.sub(r"\s(?:Not|Açıklama|Kaynak|Kaynaklar|Kelime sayısı)\s*:\s.*$", "", text)
    text = re.sub(r"\s*\((?:yaklaşık\s*)?\d+\s*kelime\)\s*$", "", text)
    text = re.sub(r"\s+([.,;:!?%)\]])", r"\1", text)
    text = re.sub(r"([(\[])\s+", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()
