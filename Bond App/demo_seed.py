"""Builds (or rebuilds) a fully populated, fictional demo company for sales demos and screenshots.

Every name below is made up. Dates are relative to today so the demo always looks current.

Run from the command line:   python demo_seed.py [password]
Or from the Platform page:   "Load / Reset Demo Company" button (superadmin only).
"""
import json
import random
from datetime import date, datetime, timedelta

from database import db, Company, User, Bond, AuditLog, Reconciliation, ReconciliationItem
from changelog import CHANGELOG

DEMO_COMPANY_NAME  = 'Ridgeview Insurance Partners'
DEMO_SHORT_NAME    = 'Ridgeview'
DEMO_ADMIN_USERNAME = 'demo'

PRODUCERS = ['Jordan Carter', 'Maria Lopez', 'Tom Nguyen', 'Rachel Patel', 'Ben Walsh', 'Dana Brooks']

# (username, role, display-as-active)
STAFF = [
    (DEMO_ADMIN_USERNAME, 'admin', True),
    ('jcarter',  'admin', True),
    ('mlopez',   'user',  True),
    ('tnguyen',  'user',  True),
    ('rpatel',   'user',  True),
    ('bwalsh',   'user',  False),   # shows a pending invite on the Users screen
]

PRINCIPALS = [
    'Ironwood Excavating LLC', 'Bluestem Paving Co.', 'Granite Peak Builders', 'Prairie Line Electric',
    'Riverbend Mechanical, Inc.', 'Northgate Roofing & Sheet Metal', 'Cedar Hollow Construction',
    'Summit Concrete & Grading', 'Tri-County Utilities Inc.', 'Lakeshore Site Works',
    'Redline Steel Erectors', 'Oak Valley Landscaping',
]

OBLIGEES = [
    'City of Fairview', 'Harlan County Board of Commissioners', 'State Department of Transportation',
    'Westbrook School District No. 12', 'Millbrook Water Authority', 'Riverside Parks & Recreation',
    'Clay Township Trustees', 'Jefferson County Housing Authority', 'Town of Maple Grove',
]

PROJECTS = [
    ('Main Street Reconstruction - Phase 2', 'Full-depth pavement reconstruction, curb and gutter, ADA ramps and storm inlets along 0.8 miles of Main Street.'),
    ('Elm Avenue Water Main Replacement', 'Replace 4,200 LF of 6" cast iron water main with 8" ductile iron, including services and hydrants.'),
    ('Westbrook Elementary HVAC Upgrade', 'Remove and replace rooftop units, new controls and ductwork modifications across two wings.'),
    ('County Road 14 Resurfacing', 'Mill and overlay 6.2 miles of County Road 14 with shoulder restoration and pavement markings.'),
    ('Riverside Park Trail Extension', '1.4 mile multi-use trail with a prefabricated pedestrian bridge and lighting.'),
    ('Wastewater Plant Clarifier Rehab', 'Rehabilitate two secondary clarifiers including drives, weirs and concrete repair.'),
    ('Fire Station No. 3 Addition', 'Two-bay apparatus addition with living quarters, site work and generator.'),
    ('Downtown Streetscape Improvements', 'Sidewalks, decorative lighting, street trees and site furnishings for four downtown blocks.'),
    ('Highway 50 Bridge Deck Overlay', 'Latex-modified concrete overlay and joint replacement on twin bridges over Cedar Creek.'),
    ('Municipal Pool Renovation', 'Pool shell repair, new filtration system, bathhouse renovation and splash pad.'),
    ('Storm Sewer Separation - Area B', 'Install 3,100 LF of new storm sewer to separate combined sewers in the Area B neighborhood.'),
    ('Public Works Salt Storage Building', 'Pre-engineered 5,000-ton salt storage building with concrete push walls.'),
    ('Housing Authority Roof Replacement', 'Tear-off and replace roofing on 14 residential buildings with new gutters.'),
    ('Middle School Site Electrical', 'Parking lot lighting, new service entrance and site power distribution.'),
]

SURETIES = [
    'Travelers', 'Liberty Mutual Surety', 'CNA Surety', 'Merchants Bonding Company',
    'Great American Insurance Group', 'RLI Surety', 'Berkley Surety', 'Employers Mutual Casualty Co.',
]

APPROVE_NOTES = [
    'Approved by underwriter. WIP schedule and interim financials current.',
    'Approved - within aggregate program. No additional indemnity required.',
    'Approved with updated CPA-reviewed statement on file.',
    'Approved. Underwriter requested job cost report at 50% completion.',
]
DECLINE_NOTES = [
    'Declined - backlog exceeds program limits until two current jobs close out.',
    'Declined - project outside contractor\'s typical scope and geography.',
    'Declined by surety pending year-end financials.',
]
WAIVE_NOTES = [
    'Final bond waived by owner - contract under statutory threshold.',
    'Owner accepted letter of credit in lieu of performance bond.',
]

WORK_ON_HAND = [
    "Job                          Bonded  Amount        Complete  Remaining\n"
    "County Rd 9 Overlay          Y       $1,240,000    85%       $186,000\n"
    "Fairview Sidewalk Program    Y       $  612,500    40%       $367,500\n"
    "Private - Retail Lot Paving          $  298,000    10%       $268,200\n"
    "TOTAL                                $2,150,500              $821,700",
    "Job                          Bonded  Amount        Complete  Remaining\n"
    "Millbrook Lift Station       Y       $2,880,000    62%       $1,094,400\n"
    "Clay Twp Water Tower Paint   Y       $  455,000    95%       $   22,750\n"
    "TOTAL                                $3,335,000              $1,117,150",
    "Job                          Bonded  Amount        Complete  Remaining\n"
    "Westbrook HS Gym Roof        Y       $  940,000    30%       $658,000\n"
    "Harlan Co. Annex Reroof      Y       $  388,000    75%       $ 97,000\n"
    "Private - Warehouse Reroof           $  510,000    50%       $255,000\n"
    "TOTAL                                $1,838,000              $1,010,000",
]


def _snapshot(bond):
    return bond.to_dict()


def _wipe_company(company):
    """Delete every row belonging to the demo company (and nothing else)."""
    cid = company.id
    rec_ids = [r.id for r in Reconciliation.query.filter_by(company_id=cid).all()]
    if rec_ids:
        ReconciliationItem.query.filter(ReconciliationItem.recon_id.in_(rec_ids)).delete(synchronize_session=False)
    Reconciliation.query.filter_by(company_id=cid).delete(synchronize_session=False)
    AuditLog.query.filter_by(company_id=cid).delete(synchronize_session=False)
    Bond.query.filter_by(company_id=cid).delete(synchronize_session=False)
    User.query.filter_by(company_id=cid).delete(synchronize_session=False)
    db.session.flush()


def seed_demo_company(password, today=None):
    """Create or fully reset the demo company. Returns login details."""
    rng   = random.Random(20261119)
    today = today or date.today()

    company = Company.query.filter_by(name=DEMO_COMPANY_NAME).first()
    if company:
        _wipe_company(company)
    else:
        # The demo admin username is global — refuse if a real customer already owns it.
        clash = User.query.filter_by(username=DEMO_ADMIN_USERNAME).first()
        if clash:
            raise ValueError(f'Username "{DEMO_ADMIN_USERNAME}" already belongs to another company.')
        company = Company(name=DEMO_COMPANY_NAME)
        db.session.add(company)
    company.short_name = DEMO_SHORT_NAME
    company.producers  = '\n'.join(PRODUCERS)
    company.active     = True
    db.session.flush()

    # ── Staff ────────────────────────────────────────────────
    usernames = []
    for i, (uname, role, is_active) in enumerate(STAFF):
        clash = User.query.filter_by(username=uname).first()
        if clash:
            continue   # never touch another company's user
        u = User(company_id=company.id, username=uname, email=f'{uname}@ridgeview-demo.local', role=role,
                 active=is_active, created_at=datetime.combine(today - timedelta(days=400 - i * 20), datetime.min.time()))
        if is_active:
            u.set_password(password)
            u.last_seen_version = CHANGELOG[0]['version']   # no "What's New" popup over the demo
            usernames.append(uname)
        else:
            u.invite_token   = f'demo-invite-{rng.randrange(10**12)}'
            u.invite_expires = datetime.utcnow() + timedelta(hours=72)
        db.session.add(u)
    db.session.flush()
    staff = [u for u in usernames if u != DEMO_ADMIN_USERNAME] or [DEMO_ADMIN_USERNAME]

    # ── Bonds ────────────────────────────────────────────────
    def at(d, hour=None):
        return datetime.combine(d, datetime.min.time()) + timedelta(hours=hour if hour is not None else rng.randint(13, 22),
                                                                    minutes=rng.randint(0, 59))

    def audit(bond, action, when, who, old=None):
        db.session.add(AuditLog(
            company_id=company.id, bond_id=bond.id, bond_number=bond.bond_number, action=action,
            changed_by=who, changed_at=when,
            old_values=json.dumps(old) if old else None,
            new_values=json.dumps(_snapshot(bond)),
        ))

    bonds_made = 0
    project_cycle = list(PROJECTS)
    rng.shuffle(project_cycle)

    for n in range(44):
        days_ago   = int((n / 44) ** 1.8 * 390) + rng.randint(0, 6)      # denser in recent months
        bid_date   = today - timedelta(days=days_ago) + timedelta(days=rng.choice([0, 3, 7, 10]) if days_ago < 20 else 0)
        created    = today - timedelta(days=days_ago + rng.randint(2, 9))
        roll       = rng.random()
        bond_type  = 'Bid Bond' if roll < 0.62 else 'License Bond' if roll < 0.78 else 'Maintenance Bond' if roll < 0.92 else 'Other'
        project, desc = project_cycle[n % len(project_cycle)]
        principal  = PRINCIPALS[rng.randrange(len(PRINCIPALS))]
        who        = rng.choice(staff)

        if bond_type == 'Bid Bond':
            amount = round(rng.uniform(250_000, 6_500_000), -3)
            pct    = rng.choice([5, 5, 10, 10, 10, 20])
        elif bond_type == 'License Bond':
            amount, pct = rng.choice([10_000, 15_000, 25_000, 50_000]), None
            project, desc = rng.choice(['Contractor License Bond', 'Right-of-Way Permit Bond', 'Excavation Permit Bond']), ''
        elif bond_type == 'Maintenance Bond':
            amount, pct = round(rng.uniform(80_000, 900_000), -3), None
        else:
            amount, pct = round(rng.uniform(20_000, 250_000), -3), None
            project, desc = rng.choice(['Supply Bond - Ready-Mix Contract', 'Subdivision Improvement Bond']), ''

        decided = days_ago > 24 or (days_ago > 6 and rng.random() < 0.35)
        if not decided:
            status, notes, decision = 'Pending', '', None
        else:
            rng.random()   # keep the random sequence stable
            status = 'Not Approved' if n % 9 == 4 else 'Approved'   # a few declines, always
            notes  = rng.choice(APPROVE_NOTES if status == 'Approved' else DECLINE_NOTES)
            decision = created + timedelta(days=rng.randint(1, 4))

        low_bid = None
        if bond_type == 'Bid Bond' and decided and status == 'Approved' and bid_date < today:
            lb = rng.random()
            low_bid = 'low' if lb < 0.42 else 'not-low' if lb < 0.88 else 'did-not-bid'

        woh = rng.choice(WORK_ON_HAND) if bond_type == 'Bid Bond' and rng.random() < 0.45 else ''

        bond = Bond(
            company_id=company.id, bond_number=None, bond_type=bond_type, principal=principal,
            obligee=rng.choice(OBLIGEES), producer=rng.choice(PRODUCERS), project=project,
            project_description=desc, surety=rng.choice(SURETIES), bond_amount=amount,
            bid_bond_percent=pct, bid_date=bid_date.isoformat() if bond_type == 'Bid Bond' else None,
            decision_date=None, status='Pending', notes='', work_on_hand=woh,
            work_on_hand_low=bool(woh) and rng.random() < 0.3, low_bid=None,
            created_by=who, created_at=at(created),
        )
        db.session.add(bond)
        db.session.flush()
        audit(bond, 'created', bond.created_at, who)
        bonds_made += 1

        if decided:
            old = _snapshot(bond)
            approver = rng.choice(staff)
            bond.status        = status
            bond.notes         = notes
            bond.decision_date = decision.isoformat()
            bond.updated_by    = approver
            bond.updated_at    = at(decision)
            audit(bond, 'updated', bond.updated_at, approver, old)

        if low_bid:
            old = _snapshot(bond)
            when = at(bid_date + timedelta(days=1))
            bond.low_bid, bond.updated_by, bond.updated_at = low_bid, who, when
            audit(bond, 'updated', when, who, old)

            # Low bidders get a Final Bond, like the real workflow.
            if low_bid == 'low':
                f_created = bid_date + timedelta(days=rng.randint(10, 25))
                if f_created <= today:
                    final_status = 'Pending' if (today - f_created).days < 10 else rng.choice(['Approved'] * 3 + ['Waived'])
                    final = Bond(
                        company_id=company.id, bond_number=None, bond_type='Final Bond', principal=bond.principal,
                        obligee=bond.obligee, producer=bond.producer, project=bond.project,
                        project_description=bond.project_description, surety=bond.surety,
                        bond_amount=bond.bond_amount, bid_date=bond.bid_date, decision_date=None,
                        status='Pending', notes='', work_on_hand=bond.work_on_hand,
                        work_on_hand_low=bond.work_on_hand_low, low_bid='low',
                        created_by=who, created_at=at(f_created),
                    )
                    db.session.add(final)
                    db.session.flush()
                    audit(final, 'created', final.created_at, who)
                    bonds_made += 1
                    if final_status != 'Pending':
                        old = _snapshot(final)
                        d = f_created + timedelta(days=rng.randint(1, 3))
                        final.status        = final_status
                        final.notes         = rng.choice(WAIVE_NOTES if final_status == 'Waived' else APPROVE_NOTES)
                        final.decision_date = d.isoformat()
                        final.updated_by    = approver
                        final.updated_at    = at(d)
                        audit(final, 'updated', final.updated_at, approver, old)

    db.session.commit()
    return {
        'company':  company.to_dict(),
        'username': DEMO_ADMIN_USERNAME,
        'password': password,
        'bonds':    bonds_made,
    }


# ── Sample bid request PDF for demoing "Upload PDF" without paying for AI ──
# When this exact file is uploaded, the app returns SAMPLE_PDF_EXTRACTION
# instead of calling the AI. Regenerate with:  python demo_seed.py --sample-pdf

import os
SAMPLE_PDF_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               'static', 'demo', 'sample-bid-request.pdf')

SAMPLE_PDF_EXTRACTION = {
    'bond_type':           'Bid Bond',
    'principal':           'Bluestem Paving Co.',
    'obligee':             'City of Fairview',
    'surety':              'Merchants Bonding Company',
    'bond_amount':         1875000,
    'bid_bond_percent':    5,
    'bid_date':            '2027-01-14',
    'decision_date':       None,
    'project':             'Lakeview Drive Reconstruction',
    'project_description': 'Full-depth reconstruction of 0.6 miles of Lakeview Drive including new curb and gutter, '
                           'storm sewer, ADA sidewalk ramps and pavement markings.',
    'work_on_hand': ("Job                          Bonded  Amount        Complete  Remaining\n"
                     "County Rd 9 Overlay          Y       $1,240,000    85%       $186,000\n"
                     "Fairview Sidewalk Program    Y       $612,500      40%       $367,500\n"
                     "Private - Retail Lot Paving          $298,000      10%       $268,200\n"
                     "TOTAL                                $2,150,500              $821,700"),
}


def build_sample_pdf(path=SAMPLE_PDF_PATH):
    from fpdf import FPDF
    pdf = FPDF(unit='mm', format='Letter')
    pdf.set_margins(18, 16, 18)
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 16)
    pdf.cell(0, 9, 'Bluestem Paving Co.', new_x='LMARGIN', new_y='NEXT')
    pdf.set_font('Helvetica', '', 9)
    pdf.cell(0, 5, '4410 Quarry Road  |  Fairview  |  (555) 014-2290', new_x='LMARGIN', new_y='NEXT')
    pdf.ln(6)
    pdf.set_font('Helvetica', 'B', 13)
    pdf.cell(0, 8, 'BID BOND REQUEST', new_x='LMARGIN', new_y='NEXT')
    pdf.set_font('Helvetica', '', 9)
    pdf.cell(0, 5, 'To: Ridgeview Insurance Partners - Surety Department', new_x='LMARGIN', new_y='NEXT')
    pdf.ln(4)

    rows = [
        ('Principal (Contractor)', 'Bluestem Paving Co.'),
        ('Obligee (Owner)',        'City of Fairview'),
        ('Project',                'Lakeview Drive Reconstruction'),
        ('Bid Date',               'January 14, 2027 at 2:00 PM'),
        ('Estimated Contract Amount', '$1,875,000'),
        ('Bid Bond Required',      '5% of total bid amount'),
        ('Preferred Surety',       'Merchants Bonding Company'),
    ]
    for label, value in rows:
        pdf.set_font('Helvetica', 'B', 10); pdf.cell(62, 7, label)
        pdf.set_font('Helvetica', '', 10);  pdf.cell(0, 7, value, new_x='LMARGIN', new_y='NEXT')
    pdf.ln(3)
    pdf.set_font('Helvetica', 'B', 10); pdf.cell(0, 7, 'Scope of Work', new_x='LMARGIN', new_y='NEXT')
    pdf.set_font('Helvetica', '', 10)
    pdf.multi_cell(0, 5.5, SAMPLE_PDF_EXTRACTION['project_description'])
    pdf.ln(5)

    pdf.set_font('Helvetica', 'B', 10); pdf.cell(0, 7, 'Current Work on Hand', new_x='LMARGIN', new_y='NEXT')
    widths = [70, 18, 30, 24, 30]
    head = ['Job', 'Bonded', 'Amount', 'Complete', 'Remaining']
    data = [
        ['County Rd 9 Overlay', 'Y', '$1,240,000', '85%', '$186,000'],
        ['Fairview Sidewalk Program', 'Y', '$612,500', '40%', '$367,500'],
        ['Private - Retail Lot Paving', '', '$298,000', '10%', '$268,200'],
        ['TOTAL', '', '$2,150,500', '', '$821,700'],
    ]
    pdf.set_fill_color(13, 27, 42); pdf.set_text_color(255, 255, 255); pdf.set_font('Helvetica', 'B', 9)
    for h, w in zip(head, widths):
        pdf.cell(w, 7, h, border=1, fill=True)
    pdf.ln(7)
    pdf.set_text_color(0, 0, 0)
    for r in data:
        pdf.set_font('Helvetica', 'B' if r[0] == 'TOTAL' else '', 9)
        for v, w in zip(r, widths):
            pdf.cell(w, 7, v, border=1)
        pdf.ln(7)
    pdf.ln(10)
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 6, 'Requested by: Sam Whitfield, Estimator', new_x='LMARGIN', new_y='NEXT')
    pdf.cell(0, 6, 'Signature: ______________________________', new_x='LMARGIN', new_y='NEXT')
    pdf.ln(6)
    pdf.set_font('Helvetica', 'I', 8); pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 5, 'Sample document for BondDesk demonstrations. All names are fictional.')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pdf.output(path)
    return path


def sample_pdf_sha256():
    import hashlib
    try:
        with open(SAMPLE_PDF_PATH, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()
    except OSError:
        return None


if __name__ == '__main__':
    import sys
    if '--sample-pdf' in sys.argv:
        print('wrote', build_sample_pdf())
        sys.exit(0)
    from app import app
    pw = sys.argv[1] if len(sys.argv) > 1 else 'DemoPass2026'
    with app.app_context():
        print(seed_demo_company(password=pw))
