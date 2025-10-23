from backend.app.utils.reference_parser import normalize_book

samples = [
    "1Co", "2Co", "Ga", "Joh", "Lu", "Mr", "1Jo", "2Jo", "3Jo",
    "1 Corinthians", "Romans"
]
for s in samples:
    print(s, "=>", normalize_book(s))
