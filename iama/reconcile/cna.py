import os
import re
import shutil

import pdfplumber

from .ams360 import _to_num, _cluster_lines

MONEY = r'\(?-?[\d,]+\.\d{2}\)?'
HEADER_RE = re.compile(
    rf'^(.*?)\s+([A-Z]{{1,4}}-\d{{5,10}}\S*)\s+(\d{{1,2}}/\d{{1,2}}/\d{{2,4}})\s+({MONEY})\s+({MONEY})\s*$'
)
TRANS_TYPES = ["Renewal", "New Business", "Endorsement", "Cancellation", "Audit Prm Incr",
               "Audit Prm Decr", "Reinstatement", "Non-Renewal", "Rewrite"]
DETAIL_RE = re.compile(
    rf'^({"|".join(TRANS_TYPES)})\s+(\d{{1,2}}/\d{{1,2}}/\d{{2,4}})\s+(\d{{1,2}}/\d{{1,2}}/\d{{2,4}})\s+'
    rf'({MONEY})\s+({MONEY})\s+([\d.,]+)\s+({MONEY})\s+({MONEY})\s*$'
)
SKIP_RE = re.compile(
    r'^(INSURANCE AGENCY|AMERICA INC|PO ?BOX|POC BOX|Consolidation|Direct Bill Commissions$|'
    r'\d{3}-\d{6} -|Commission Commission|Name of Insured|N fl d|ES CU LIES|Page \d|'
    r'Continental Casualty|CNA is a registered|Agency \d+ Total|Total amount due|'
    r'You will receive|Trans Type Trans Date)'
)


def extract_pdf_lines_with_positions(file_obj):
    """Returns (lines, total_words). Used to decide whether OCR is needed."""
    lines = []
    total_words = 0
    with pdfplumber.open(file_obj) as pdf:
        for page in pdf.pages:
            total_words += len(page.extract_words())
            lines.extend(_cluster_lines(page))
    return lines, total_words


def ocr_pdf_to_lines(file_obj, dpi=300, progress_cb=None):
    """OCR fallback for carrier PDFs with no text layer (e.g. CNA).

    NOTE: requires the `tesseract` binary + pytesseract to be installed in
    the deployment environment (see nixpacks.toml). This code path has not
    been exercised end-to-end in the local dev sandbox used to build it —
    only validated via a separate Node/Tesseract.js prototype against the
    same real file. Verify on first real deploy.
    """
    import pytesseract

    if not shutil.which(pytesseract.pytesseract.tesseract_cmd):
        for candidate in (
            r'C:\Program Files\Tesseract-OCR\tesseract.exe',
            r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
        ):
            if os.path.exists(candidate):
                pytesseract.pytesseract.tesseract_cmd = candidate
                break
        else:
            raise RuntimeError(
                'Tesseract OCR is not installed on this machine. Install it from '
                'https://github.com/UB-Mannheim/tesseract/wiki, then try again.'
            )

    lines = []
    with pdfplumber.open(file_obj) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            if progress_cb:
                progress_cb(f'OCR: rendering page {page_num}/{len(pdf.pages)}')
            im = page.to_image(resolution=dpi).original
            data = pytesseract.image_to_data(im, output_type=pytesseract.Output.DICT)
            by_line = {}
            n = len(data['text'])
            for i in range(n):
                text = data['text'][i].strip()
                if not text:
                    continue
                key = (data['block_num'][i], data['par_num'][i], data['line_num'][i])
                by_line.setdefault(key, []).append({'x': data['left'][i], 'y': data['top'][i], 'text': text})
            page_lines = []
            for words in by_line.values():
                words.sort(key=lambda w: w['x'])
                y = min(w['y'] for w in words)
                page_lines.append((y, ' '.join(w['text'] for w in words)))
            page_lines.sort(key=lambda t: t[0])
            lines.extend(text for _, text in page_lines)
    return lines


def parse_lines(lines):
    """Classify CNA statement lines into policy header blocks + detail rows."""
    policies = []
    current = None
    for raw in lines:
        text = raw.strip()
        if not text or SKIP_RE.search(text):
            continue

        h = HEADER_RE.match(text)
        if h:
            name, policy, eff_date, cna_amt, agent_amt = h.groups()
            current = {
                'name': name.strip(), 'policy': policy, 'eff_date': eff_date,
                'header_cna': _to_num(cna_amt), 'header_agent': _to_num(agent_amt),
                'details': [],
            }
            policies.append(current)
            continue

        d = DETAIL_RE.match(text)
        if d:
            trans_type, trans_date, eff_date, gross, net, comm_pct, cna_amt, agent_amt = d.groups()
            if current is not None:
                current['details'].append({
                    'trans_type': trans_type, 'trans_date': trans_date, 'eff_date': eff_date,
                    'gross': _to_num(gross), 'net': _to_num(net),
                    'comm_pct': _to_num(comm_pct.replace(',', '.')),
                    'cna_amt': _to_num(cna_amt), 'agent_amt': _to_num(agent_amt),
                })
            continue

        if current is not None and not re.search(r'\d', text) and len(text) <= 20 and 'amount due' not in text.lower():
            current['name'] = (current['name'] + ' ' + text).strip()

    return policies


def normalize_policy_digits(policy_str):
    m = re.search(r'(\d{6,})', str(policy_str))
    return m.group(1) if m else None


def aggregate_policies(policies):
    """Aggregate header blocks sharing the same policy digits, and flag when
    a policy's own detail rows don't sum to its printed header total (a sign
    the OCR misread a digit somewhere in the detail lines, not necessarily
    the header total actually used for matching)."""
    by_policy = {}
    for p in policies:
        digits = normalize_policy_digits(p['policy']) or p['policy']
        b = by_policy.setdefault(digits, {
            'name': p['name'], 'policy': p['policy'], 'net': 0.0,
            'header_cna': 0.0, 'header_agent': 0.0, 'detail_sum_off': False,
        })
        b['net'] += p['header_agent'] - p['header_cna']
        b['header_cna'] += p['header_cna']
        b['header_agent'] += p['header_agent']
        if p['details']:
            det_cna = sum(d['cna_amt'] for d in p['details'])
            det_agent = sum(d['agent_amt'] for d in p['details'])
            if abs(det_cna - p['header_cna']) > 0.02 or abs(det_agent - p['header_agent']) > 0.02:
                b['detail_sum_off'] = True
    return by_policy


def parse_pdf(file_obj, progress_cb=None):
    """Parse a CNA carrier statement PDF. Tries the real text layer first;
    falls back to OCR if the PDF has (almost) no extractable text, which is
    the case for CNA's statements (vector-drawn glyphs, no text layer)."""
    lines, total_words = extract_pdf_lines_with_positions(file_obj)
    used_ocr = False
    if total_words < 20:
        used_ocr = True
        file_obj.seek(0)
        lines = ocr_pdf_to_lines(file_obj, progress_cb=progress_cb)
    policies = parse_lines(lines)
    return aggregate_policies(policies), used_ocr
