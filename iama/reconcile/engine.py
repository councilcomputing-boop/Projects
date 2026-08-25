import re

STATUS_LABELS = {
    'match': 'Match',
    'flag_verify': 'Verify detail',
    'flag_policy_number': 'Policy # differs',
    'mismatch': 'Amount mismatch',
    'missing_from_ams360': 'Missing from AMS360',
    'missing_from_carrier': 'Missing from carrier',
}


def _norm_name(s):
    s = re.sub(r'[^a-z0-9]', '', str(s).lower())
    return re.sub(r'\b(inc|llc|ltd|co|corp|corporation|company|and)\b', '', s)


def reconcile(cna_by_policy, ams_rows):
    """Match CNA carrier policies against AMS360 transaction rows.

    cna_by_policy: dict from reconcile.cna.aggregate_policies()
    ams_rows: list from reconcile.ams360.parse_pdf()/parse_spreadsheet()
    """
    ams_by_policy = {}
    for r in ams_rows:
        b = ams_by_policy.setdefault(r['policy_core'], {'name': r['name'], 'comm': 0.0, 'prem': 0.0})
        b['comm'] += r['agcy_comm']
        b['prem'] += r.get('prem_fee', 0.0)

    results = []
    used_ams = set()

    for digits, cp in cna_by_policy.items():
        match_key = None
        match_type = None
        if digits in ams_by_policy:
            match_key = digits
            match_type = 'policy_number'
        else:
            cn_name = _norm_name(cp['name'])
            for key, b in ams_by_policy.items():
                if key in used_ams:
                    continue
                ams_name = _norm_name(b['name'])
                name_close = len(cn_name) > 4 and (ams_name in cn_name or cn_name in ams_name or
                                                    ams_name[:8] == cn_name[:8])
                amount_close = abs(b['comm'] - cp['net']) < 0.01
                if name_close and amount_close:
                    match_key = key
                    match_type = 'name_amount_fallback'
                    break

        if match_key:
            used_ams.add(match_key)
            b = ams_by_policy[match_key]
            diff = cp['net'] - b['comm']
            if abs(diff) >= 0.01:
                status = 'mismatch'
            elif match_type == 'name_amount_fallback':
                status = 'flag_policy_number'
            elif cp.get('detail_sum_off'):
                status = 'flag_verify'
            else:
                status = 'match'
            note = ''
            if status == 'flag_policy_number':
                note = 'Policy # differs between statements, but client/amount line up — verify by eye.'
            elif status == 'flag_verify':
                note = ("Carrier PDF: detail lines under this policy don't add up to its own subtotal — "
                        "likely an OCR misread on a line item, not necessarily a real discrepancy.")
            results.append({
                'status': status, 'name': cp['name'], 'carrier_policy': cp['policy'], 'ams_policy': match_key,
                'carrier_net': cp['net'], 'ams_net': b['comm'], 'diff': diff, 'note': note,
            })
        else:
            results.append({
                'status': 'missing_from_ams360', 'name': cp['name'], 'carrier_policy': cp['policy'], 'ams_policy': '',
                'carrier_net': cp['net'], 'ams_net': None, 'diff': cp['net'], 'note': 'Not found in the AMS360 export.',
            })

    for key, b in ams_by_policy.items():
        if key not in used_ams:
            results.append({
                'status': 'missing_from_carrier', 'name': b['name'], 'carrier_policy': '', 'ams_policy': key,
                'carrier_net': None, 'ams_net': b['comm'], 'diff': -b['comm'],
                'note': 'Not found in the carrier statement.',
            })

    return results


def summarize(results):
    carrier_total = sum(r['carrier_net'] for r in results if r['carrier_net'] is not None)
    ams_total = sum(r['ams_net'] for r in results if r['ams_net'] is not None)
    match_count = sum(1 for r in results if r['status'] == 'match')
    issue_count = sum(1 for r in results if r['status'] != 'match')
    return {
        'carrier_net_total': carrier_total,
        'ams_net_total': ams_total,
        'diff_total': carrier_total - ams_total,
        'item_count': len(results),
        'match_count': match_count,
        'issue_count': issue_count,
    }
