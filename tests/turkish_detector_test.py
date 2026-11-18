"""Run with python3 -m unittest discover -s tests -p turkish_detector_test.py."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "desklib"))
from turkish_text import normalize_turkish


class TurkishTextTests(unittest.TestCase):
    def test_preserves_turkish_case_and_combining_accents(self):
        self.assertEqual(normalize_turkish("Işık İZMİR gu\u0308zel"), "Işık İZMİR güzel")

    def test_removes_formatting_and_standardizes_punctuation(self):
        self.assertEqual(
            normalize_turkish('## Başlık: Örnek\n\n1. **“Şiir”** — çocukluk… [12]\n- İkinci\u200b satır.'),
            '"Şiir" - çocukluk... İkinci satır.',
        )

    def test_removes_preamble_and_trailing_metadata(self):
        self.assertEqual(
            normalize_turkish("Elbette! İşte: Bu bir deneme metnidir. Not: Ek bilgi."),
            "Bu bir deneme metnidir.",
        )

    def test_substantive_body_and_nonnumeric_brackets_survive(self):
        text = "Şair [kurtların] çocukluğu temsil ettiğini söyler."
        self.assertEqual(normalize_turkish(text), text)
        self.assertEqual(normalize_turkish("Başlık: Bu bir öğrenci tarafından yazılmış uzun bir başlık satırıdır ve ayrıca çeşitli başka açıklamalar içerir."), "Başlık: Bu bir öğrenci tarafından yazılmış uzun bir başlık satırıdır ve ayrıca çeşitli başka açıklamalar içerir.")


if __name__ == "__main__":
    unittest.main()
