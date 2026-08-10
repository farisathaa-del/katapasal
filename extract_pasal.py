#!/usr/bin/env python3
"""Extract full pasal text from Indonesian legal PDFs → pasal.json — v3"""
import fitz, re, json
from pathlib import Path

PDF_BASE = "/mnt/c/Users/F A R I S/OneDrive/Second Brain (Obsidian)/03 - Resources/Peraturan Hukum/PDF"

# ── Helpers ──────────────────────────────────────────────────────────

def extract_full_text(pdf_path):
    doc = fitz.open(pdf_path)
    pages = [doc[i].get_text() for i in range(doc.page_count)]
    doc.close()
    return "\n\n".join(pages)

def fix_ocr(text):
    """Fix common OCR artifacts — two-pass for robustness."""
    # Pass 1: structural fixes
    # "Pasa1" → "Pasal" (l misread as 1)
    text = re.sub(r'Pasa1\b', 'Pasal', text)
    text = re.sub(r'PasaL\b', 'Pasal', text)
    # "Pasal l0" → "Pasal 10" etc
    text = re.sub(r'(?<=Pasal )l(?=[0-9])', '1', text)
    # "(21" → "(2)", "(41" → "(4)" — ) misread as 1 after digit
    text = re.sub(r'\((\d)1(?=[\s,;)])', r'(\1)', text)
    # "(l)" → "(1)", "(l " → "(1) " — l misread as 1 in parens
    text = re.sub(r'\(l\)', '(1)', text)
    text = re.sub(r'\(l \)', '(1) ', text)
    text = re.sub(r'\(l,', '(1),', text)
    text = re.sub(r'\(s\)', '(5)', text)  # s misread as 5
    # "Pasal TT" → "Pasal 77"
    text = re.sub(r'\bPasal TT\b', 'Pasal 77', text)
    # "6OO" → "600" etc in Pasal headers
    text = re.sub(r'(?<=Pasal )(\d+O\d*)\b', lambda m: m.group(1).replace('O', '0'), text)
    # Remove page headers/footers
    text = re.sub(r'(?m)^\s*(PRESIDEN|FRESIDEN|R,?EPUBL[IU]K INDONESIA|BUK INDONESIA|REPUE?LIK INDONESIA|REFUBLIK INDONESIA)\s*$', '', text)
    text = re.sub(r'(?m)^\s*SK\s*No\s*\d+\s*A?\s*$', '', text)
    text = re.sub(r'(?m)^\s*SK\s*No\d+\s*A?\s*$', '', text)
    text = re.sub(r'(?m)^\s*-\d+-\s*$', '', text)
    # Remove inline SK stamps
    text = re.sub(r'\n\s*SK\s*No\s*\d+\s*A?\s*\n', '\n', text)
    text = re.sub(r'\n\s*SK\s*No\d+\s*A?\s*\n', '\n', text)
    # "undang.undang" → "undang-undang"
    text = re.sub(r'undang\.undang', 'undang-undang', text, flags=re.IGNORECASE)
    # Garbled watermarks
    text = re.sub(r'(?m)^\s*[a-zA-Z0-9]{2,}=[a-zA-Z0-9]{3,}\s*$', '', text)
    text = re.sub(r'(?m)^\s*[A-Z]{2,}[a-z]+\s*[A-Z]{2,}[a-z]+\s*$', '', text)
    # Normalize excessive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text

def fix_pasal_text(text):
    """Clean a single pasal's text — aggressive OCR cleanup."""
    # Fix remaining (21 / (41 etc that fix_ocr might have missed
    text = re.sub(r'\((\d)1(?=[\s,;)])', r'(\1)', text)
    # Fix "(l)" → "(1)" remaining
    text = re.sub(r'\(l\)', '(1)', text)
    # Remove stray "SK No..." stamps
    text = re.sub(r'SK\s*No\s*\d+\s*A?\s*', '', text)
    # Remove page numbers like "-13-"
    text = re.sub(r'\n\s*-\d+-\s*\n', '\n', text)
    # Clean up
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def roman_to_int(s):
    """Convert Roman numeral to int (for pasal headers)."""
    vals = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}
    result = 0
    for i, c in enumerate(s):
        if i + 1 < len(s) and vals.get(c, 0) < vals.get(s[i+1], 0):
            result -= vals.get(c, 0)
        else:
            result += vals.get(c, 0)
    return result

def find_body_section(text):
    """Find where the actual pasal body starts (after preamble/TOC)."""
    # Look for first "Pasal" in body — after BAB sections
    # Skip early preamble text, find "BAB" markers
    bab_match = re.search(r'(?m)^\s*BAB\s+I\b', text)
    if bab_match:
        return bab_match.start()
    return 0

def find_penjelasan_offset(text):
    """Find where PENJELASAN section starts."""
    idx = text.find('\nPENJELASAN\n')
    if idx == -1:
        idx = text.find('\nPENJELASAN\nATAS')
    if idx == -1:
        idx = text.find('PENJELASAN\nATAS')
    return idx if idx > 0 else len(text)

def extract_pasals(text, source, max_pasal, min_pasal=1, use_roman=False):
    """Generic pasal extraction from pre-processed text."""
    entries = {}

    # Build pattern that handles both digit and Roman numeral pasals
    if use_roman:
        pat = r'(?m)^\s*Pasal\s+(?:([IVXLCDM]{1,4})|(\d+[A-Z]?))\s*(.*)'
    else:
        pat = r'(?m)^\s*Pasal\s+(\d+[A-Z]?)\s*(.*)'

    for m in re.finditer(pat, text):
        if use_roman:
            num_str = m.group(1) or m.group(2)
            rest = m.group(3)
        else:
            num_str = m.group(1)
            rest = m.group(2)

        # Parse number
        try:
            if use_roman and re.match(r'^[IVXLCDM]+$', num_str):
                num = roman_to_int(num_str)
            else:
                # Handle "9 I" → 91, "9O" → 90, etc
                cleaned = num_str.replace('O', '0').replace(' ', '')
                num = int(cleaned)
        except (ValueError, TypeError):
            continue

        if num < min_pasal or num > max_pasal:
            continue
        # Skip TOC entries
        if '...' in rest[:10] or '..' in rest[:10]:
            continue
        if rest.strip().startswith('.'):
            continue

        # Get text from this match to next "Pasal" header
        start = m.start()
        next_match = re.search(r'(?m)^\s*Pasal\s+(?:[IVXLCDM]{1,4}|\d+[A-Z]?)\b', text[m.end():])
        end = m.end() + next_match.start() if next_match else len(text)
        pasal_text = text[start:end].strip()

        # Skip very short entries (< 25 chars means probably "Cukup jelas" explanation)
        if len(pasal_text) < 25:
            continue
        # Skip entries that are just references (start with "Pasal N berbunyi" etc)
        if 'berbunyi sebagai' in pasal_text[:100]:
            continue
        if 'dan Pasal' in pasal_text[:80]:
            continue
        # Skip "Cukup jelas" only entries
        if re.match(r'^Pasal\s+\d+\s*\nCukup jelas', pasal_text):
            continue

        # Take longest for each pasal number (deduplicate TOC vs body)
        if num not in entries or len(pasal_text) > len(entries[num]):
            entries[num] = pasal_text

    result = []
    for k in sorted(entries.keys()):
        result.append({
            "source": source,
            "pasal": k,
            "txt": fix_pasal_text(entries[k])
        })
    return result

# ── Per-source extraction ───────────────────────────────────────────

def extract_kuhap2025(pdf_path):
    text = fix_ocr(extract_full_text(pdf_path))
    body_start = find_body_section(text)
    penjelasan = find_penjelasan_offset(text)
    text = text[body_start:penjelasan]
    return extract_pasals(text, "KUHAP 2025", max_pasal=369, use_roman=True)

def extract_kuhp2023(pdf_path):
    text = fix_ocr(extract_full_text(pdf_path))
    body_start = find_body_section(text)
    penjelasan = find_penjelasan_offset(text)
    text = text[body_start:penjelasan]
    return extract_pasals(text, "KUHP 2023", max_pasal=650)

def extract_kuhap1981(pdf_path):
    text = fix_ocr(extract_full_text(pdf_path))
    body_start = find_body_section(text)
    penjelasan = find_penjelasan_offset(text)
    text = text[body_start:penjelasan]
    return extract_pasals(text, "KUHAP 1981", max_pasal=210, use_roman=True)

def extract_penyesuaian(pdf_path):
    """Extract amendments from Pasal VII."""
    text = fix_ocr(extract_full_text(pdf_path))
    # Find Pasal VII body
    idx = text.find('Pasal VII\n')
    if idx == -1:
        idx = text.find('Pasal VII')
    if idx == -1:
        return []
    chunk = text[idx:]
    # End at next major section
    for marker in ['\nPasal VIII\n', '\nBAB IV\n', '\nBAB V\n']:
        end_idx = chunk.find(marker, 100)
        if end_idx > 0:
            chunk = chunk[:end_idx]
            break

    # Split on numbered items: "N. " at line start
    amendments = []
    am_positions = [(int(m.group(1)), m.start()) for m in re.finditer(r'(?m)^\s*(\d+)\.\s', chunk)]

    for i, (am_num, start) in enumerate(am_positions):
        end = am_positions[i + 1][1] if i + 1 < len(am_positions) else len(chunk)
        am_text = chunk[start:end].strip()
        if len(am_text) < 30:
            continue
        amendments.append({
            "source": "Penyesuaian 2026 Pasal VII",
            "pasal": am_num,
            "txt": fix_pasal_text(am_text)
        })
    return amendments

def extract_denda(pdf_path):
    """Extract Pasal 78-80 (denda kategori) from KUHP 2023."""
    text = fix_ocr(extract_full_text(pdf_path))
    entries = []
    for pn in [78, 79, 80]:
        m = re.search(rf'(?m)^\s*Pasal\s+{pn}\b', text)
        if m:
            next_m = re.search(rf'(?m)^\s*Pasal\s+{pn + 1}\b', text[m.end():])
            end = m.end() + next_m.start() if next_m else min(m.end() + 3000, len(text))
            t = fix_pasal_text(text[m.start():end])
            if len(t) > 25:
                entries.append({"source": "Kategori Denda", "pasal": pn, "txt": t})
    return entries

# ── Main ────────────────────────────────────────────────────────────

def main():
    all_entries = []

    for label, func, args in [
        ("KUHAP 2025", extract_kuhap2025, (f"{PDF_BASE}/UU 20-2025 KUHAP Baru.pdf",)),
        ("KUHP 2023", extract_kuhp2023, (f"{PDF_BASE}/UU 1-2023 KUHP Baru.pdf",)),
        ("KUHAP 1981", extract_kuhap1981, (f"{PDF_BASE}/UU Nomor 8 Tahun 1981 (1).pdf",)),
        ("Penyesuaian 2026", extract_penyesuaian, (f"{PDF_BASE}/UU 1-2026 Penyesuaian Pidana.pdf",)),
        ("Kategori Denda", extract_denda, (f"{PDF_BASE}/UU 1-2023 KUHP Baru.pdf",)),
    ]:
        e = func(*args)
        print(f"{label}: {len(e)} entries" + (f", range {e[0]['pasal']}-{e[-1]['pasal']}" if e else ""))
        all_entries.extend(e)

    # Write
    out = Path(__file__).parent / "data" / "pasal.json"
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(all_entries, f, ensure_ascii=False, indent=2)

    # Stats
    print(f"\n{'='*50}")
    print(f"Total: {len(all_entries)} entries")
    sources = {}
    for e in all_entries:
        sources[e["source"]] = sources.get(e["source"], 0) + 1
    for s, c in sorted(sources.items()):
        print(f"  {s}: {c}")

    lens = [len(e["txt"]) for e in all_entries]
    if lens:
        print(f"\nLength: min={min(lens)}, max={max(lens)}, avg={sum(lens)//len(lens)}")

    # Quality checks
    import re as re_check
    issues = []
    for e in all_entries:
        txt = e["txt"]
        if re_check.search(r'Pasa[1L]', txt):
            issues.append(f"OCR Pasa1: {e['source']} p{e['pasal']}")
        if re_check.search(r'\(\d1\b', txt):
            issues.append(f"OCR (21: {e['source']} p{e['pasal']}")
        if 'SK' in txt and 'No' in txt:
            issues.append(f"OCR SK No: {e['source']} p{e['pasal']}")
    if issues:
        print(f"\nOCR issues: {len(issues)}")
        for i in issues[:10]:
            print(f"  {i}")

    short = [e for e in all_entries if len(e["txt"]) < 50]
    if short:
        print(f"\nShort (<50): {len(short)}")
        for e in short[:5]:
            print(f"  {e['source']} p{e['pasal']}: {e['txt'][:60]}")

    trunc = [e for e in all_entries if e['txt'].rstrip().endswith('...')]
    print(f"Trailing ...: {len(trunc)}")

    print(f"\nWritten: {out}")

if __name__ == "__main__":
    main()
