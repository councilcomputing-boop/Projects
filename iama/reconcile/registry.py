"""Registry of supported carrier statement parsers.

Each entry maps a carrier key to a `parse(file_stream) -> (policies_by_number, used_ocr)`
callable, matching the shape produced by reconcile.cna.parse_pdf. To support another
carrier's statement layout, add a new reconcile/<carrier>.py with the same parse_pdf
signature and register it here — the matching engine and Flask routes need no changes.
"""

from . import cna

CARRIERS = {
    'CNA': {
        'label': 'CNA',
        'parse': cna.parse_pdf,
    },
}
