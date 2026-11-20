from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from database import db, Company, User, Bond, AuditLog, Reconciliation, ReconciliationItem
from email_service import send_invite_email
from changelog import CHANGELOG
from datetime import datetime, timedelta
import os
import json
import secrets
import threading
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change-this-before-deploying')

db_url = os.environ.get('DATABASE_URL', 'sqlite:///bonds.db')
# Railway PostgreSQL URLs start with postgres://, SQLAlchemy needs postgresql://
if db_url.startswith('postgres://'):
    db_url = db_url.replace('postgres://', 'postgresql://', 1)
# Pin the driver to psycopg2 (what's actually installed via psycopg2-binary) —
# without a driver suffix, SQLAlchemy's default dialect resolution can pick
# psycopg (v3), which isn't installed, crashing every worker on boot.
if db_url.startswith('postgresql://'):
    db_url = db_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access BondDesk.'

# Name given to the company that existing (pre-multi-company) data is moved into.
DEFAULT_COMPANY_NAME       = os.environ.get('DEFAULT_COMPANY_NAME', 'Insurance Agency of Mid America')
DEFAULT_COMPANY_SHORT_NAME = os.environ.get('DEFAULT_COMPANY_SHORT_NAME', 'IAMA')
DEFAULT_COMPANY_PRODUCERS  = [
    'Larry Bixler', 'Logan Buckner', 'Cody McNeill', 'Mike McNeill', 'Kyle Reser',
    'John Rogers', 'Mike Shannon', 'Todd Triplett', 'Kyle Vandruff',
]
COMPANY_ROLES = ('user', 'admin')   # roles a company admin may hand out; 'superadmin' is never assignable via the API


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# ── Company isolation ──────────────────────────────────────────────────
# Every query for company-owned data goes through these two helpers so a
# user can only ever read or change rows that belong to their own company.

def active_company_id():
    """The company whose data this request may touch.
    Normal users: their own company. Superadmin: only the company they chose
    to view (read-only) from the Platform page, otherwise none."""
    if current_user.is_superadmin:
        return session.get('view_company_id')
    return current_user.company_id


def active_company():
    cid = active_company_id()
    return db.session.get(Company, cid) if cid else None


def company_query(model):
    """Query for `model` limited to the active company."""
    return model.query.filter(model.company_id == active_company_id())


def get_owned_or_404(model, obj_id):
    """Fetch one row by id, 404 if it doesn't exist OR belongs to another company."""
    return company_query(model).filter(model.id == obj_id).first_or_404()


def can_log_in(user):
    if not user or not user.active:
        return False
    if user.is_superadmin:
        return True
    return user.company is not None and bool(user.company.active)


# Endpoints a superadmin may use. Superadmins have no company, so every
# company page/API is closed to them — they manage companies from /platform.
SUPERADMIN_ENDPOINTS = {
    'platform', 'platform_create_company', 'platform_update_company',
    'platform_invite_admin', 'platform_seed_demo', 'platform_view_company', 'platform_exit_view',
    'logout', 'login', 'landing', 'accept_invite', 'change_password', 'static',
}
# Extra endpoints a superadmin may use while viewing a company — read-only only.
VIEW_ONLY_ENDPOINTS = {'index', 'get_bonds', 'get_audit', 'generate_report', 'generate_excel'}
# In the DEMO company only, the superadmin may also work bonds like an agent.
DEMO_EDIT_ENDPOINTS = {'create_bond', 'update_bond', 'toggle_low_bid', 'delete_bond',
                       'create_final_bond', 'extract_bond_pdf'}


def viewing_demo():
    from demo_seed import DEMO_COMPANY_NAME
    c = active_company() if current_user.is_authenticated and current_user.is_superadmin else None
    return c is not None and c.name == DEMO_COMPANY_NAME


@app.before_request
def enforce_access():
    if not current_user.is_authenticated:
        return None
    # Deactivated user, or their company was switched off -> sign them out.
    if not can_log_in(current_user):
        logout_user()
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Your account is not active.'}), 401
        return redirect(url_for('login'))
    allowed = SUPERADMIN_ENDPOINTS
    if current_user.is_superadmin and session.get('view_company_id'):
        allowed = allowed | VIEW_ONLY_ENDPOINTS | (DEMO_EDIT_ENDPOINTS if viewing_demo() else set())
    if current_user.is_superadmin and request.endpoint not in allowed:
        if request.path.startswith('/api/') or request.path.startswith('/reports/'):
            return jsonify({'error': 'Platform admins do not have a company workspace.'}), 403
        return redirect(url_for('platform'))
    return None


def log_action(bond, action, old_data=None):
    entry = AuditLog(
        company_id  = bond.company_id,
        bond_id     = bond.id,
        bond_number = bond.bond_number,
        action      = action,
        changed_by  = current_user.username,
        old_values  = json.dumps(old_data) if old_data else None,
        new_values  = json.dumps(bond.to_dict()),
    )
    db.session.add(entry)


# ── Auth ───────────────────────────────────────────────────────────────

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    if request.method == 'POST':
        data     = request.get_json() or request.form
        username = (data.get('username') or '').strip()
        password = data.get('password') or ''

        user = User.query.filter_by(username=username).first()
        if user and can_log_in(user) and user.check_password(password):
            session.pop('view_company_id', None)
            login_user(user, remember=True)
            user.last_login_at = datetime.utcnow()
            db.session.commit()
            if request.is_json:
                return jsonify({'ok': True})
            return redirect(url_for('index'))

        error = 'Invalid username or password.'
        if request.is_json:
            return jsonify({'ok': False, 'error': error}), 401
        return render_template('login.html', error=error)

    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    session.pop('view_company_id', None)
    logout_user()
    return redirect(url_for('login'))


# ── Pages ──────────────────────────────────────────────────────────────

@app.route('/about')
def landing():
    return render_template('landing.html')


@app.route('/')
@login_required
def index():
    company = active_company()
    if company is None:
        return redirect(url_for('platform'))
    demo_edit = viewing_demo()
    return render_template('index.html', user=current_user, company=company,
                           read_only=current_user.is_superadmin and not demo_edit,
                           demo_edit=demo_edit)


@app.route('/admin')
@login_required
def admin():
    if current_user.role != 'admin':
        return redirect(url_for('index'))
    users   = company_query(User).order_by(User.created_at).all()
    app_url = os.environ.get('APP_URL', request.host_url.rstrip('/'))
    return render_template('admin.html', user=current_user, users=users, app_url=app_url,
                           company=current_user.company)


@app.route('/api/company', methods=['PUT'])
@login_required
def update_company_settings():
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}
    company = current_user.company
    if 'producers' in data:
        names = data['producers'] if isinstance(data['producers'], list) else str(data['producers']).splitlines()
        company.producers = '\n'.join(str(n).strip() for n in names if str(n).strip())
    db.session.commit()
    return jsonify(company.to_dict())


# ── Bond API ───────────────────────────────────────────────────────────

@app.route('/api/bonds', methods=['GET'])
@login_required
def get_bonds():
    bonds = company_query(Bond).order_by(Bond.created_at.desc()).all()
    return jsonify([b.to_dict() for b in bonds])


@app.route('/api/bonds', methods=['POST'])
@login_required
def create_bond():
    data = request.get_json()

    bond = Bond(
        company_id           = active_company_id(),
        bond_number          = None,
        bond_type            = data['bond_type'],
        principal            = data['principal'].strip(),
        obligee              = data['obligee'].strip(),
        producer             = data.get('producer', '').strip(),
        project              = data.get('project', '').strip(),
        project_description  = data.get('project_description', '').strip(),
        surety               = data['surety'].strip(),
        bond_amount          = data.get('bond_amount') or None,
        bid_bond_percent     = data.get('bid_bond_percent') or None,
        bid_date             = data.get('bid_date') or None,
        expiration_date      = data.get('expiration_date') or None,
        decision_date        = data.get('decision_date') or None,
        status               = data.get('status', 'Pending'),
        notes                = data.get('notes', '').strip(),
        work_on_hand         = data.get('work_on_hand', '').strip(),
        work_on_hand_low     = bool(data.get('work_on_hand_low', False)),
        low_bid              = data.get('low_bid'),
        created_by           = current_user.username,
        created_at           = datetime.utcnow(),
    )
    db.session.add(bond)
    db.session.flush()
    log_action(bond, 'created')
    db.session.commit()

    return jsonify(bond.to_dict()), 201


@app.route('/api/bonds/<int:bond_id>', methods=['PUT'])
@login_required
def update_bond(bond_id):
    bond     = get_owned_or_404(Bond, bond_id)
    data     = request.get_json()
    old_data = bond.to_dict()
    old_status = bond.status

    bond.bond_number         = bond.bond_number
    bond.bond_type           = data.get('bond_type',           bond.bond_type)
    bond.principal           = data.get('principal',           bond.principal).strip()
    bond.obligee             = data.get('obligee',             bond.obligee).strip()
    bond.producer            = data.get('producer',            bond.producer or '').strip()
    bond.project             = data.get('project',             bond.project or '').strip()
    bond.project_description = data.get('project_description', bond.project_description or '').strip()
    bond.surety              = data.get('surety',              bond.surety).strip()
    bond.bond_amount         = data.get('bond_amount')         or bond.bond_amount
    bond.bid_bond_percent    = data.get('bid_bond_percent')    or None
    bond.bid_date            = data.get('bid_date')            or bond.bid_date
    bond.expiration_date     = data.get('expiration_date')     or None
    bond.decision_date       = data.get('decision_date')       or bond.decision_date
    bond.status              = data.get('status',              bond.status)
    bond.notes               = data.get('notes',               bond.notes or '').strip()
    bond.work_on_hand        = data.get('work_on_hand',        bond.work_on_hand or '').strip()
    bond.work_on_hand_low    = bool(data.get('work_on_hand_low', bond.work_on_hand_low or False))
    bond.low_bid             = data.get('low_bid', bond.low_bid)
    bond.updated_by          = current_user.username
    bond.updated_at          = datetime.utcnow()

    log_action(bond, 'updated', old_data)
    db.session.commit()

    return jsonify(bond.to_dict())


@app.route('/api/bonds/<int:bond_id>/low-bid', methods=['PUT'])
@login_required
def toggle_low_bid(bond_id):
    bond = get_owned_or_404(Bond, bond_id)
    old_data = bond.to_dict()
    data = request.get_json()

    bond.low_bid    = data.get('low_bid')
    bond.updated_by = current_user.username
    bond.updated_at = datetime.utcnow()

    log_action(bond, 'updated', old_data)
    db.session.commit()

    return jsonify(bond.to_dict())


@app.route('/api/bonds/<int:bond_id>', methods=['DELETE'])
@login_required
def delete_bond(bond_id):
    bond     = get_owned_or_404(Bond, bond_id)
    old_data = bond.to_dict()

    entry = AuditLog(
        company_id  = bond.company_id,
        bond_id     = bond.id,
        bond_number = bond.bond_number,
        action      = 'deleted',
        changed_by  = current_user.username,
        old_values  = json.dumps(old_data),
    )
    db.session.add(entry)
    db.session.delete(bond)
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/bonds/<int:bond_id>/create-final', methods=['POST'])
@login_required
def create_final_bond(bond_id):
    orig = get_owned_or_404(Bond, bond_id)
    bond = Bond(
        company_id          = orig.company_id,
        bond_number         = None,
        bond_type           = 'Final Bond',
        principal           = orig.principal,
        obligee             = orig.obligee,
        producer            = orig.producer,
        project             = orig.project,
        project_description = orig.project_description,
        surety              = orig.surety,
        bond_amount         = orig.bond_amount,
        bid_date            = orig.bid_date,
        decision_date       = None,
        status              = 'Pending',
        notes               = '',
        work_on_hand        = orig.work_on_hand,
        work_on_hand_low    = orig.work_on_hand_low,
        low_bid             = orig.low_bid,
        created_by          = current_user.username,
        created_at          = datetime.utcnow(),
    )
    db.session.add(bond)
    db.session.flush()
    log_action(bond, 'created')
    db.session.commit()
    return jsonify(bond.to_dict()), 201


# ── Audit log API ──────────────────────────────────────────────────────

@app.route('/api/audit')
@login_required
def get_audit():
    logs = company_query(AuditLog).order_by(AuditLog.changed_at.desc()).limit(500).all()
    return jsonify([l.to_dict() for l in logs])


# ── Reconciliation API ─────────────────────────────────────────────────

@app.route('/api/reconciliations', methods=['GET'])
@login_required
def get_reconciliations():
    recs = company_query(Reconciliation).order_by(Reconciliation.created_at.desc()).all()
    return jsonify([r.to_dict() for r in recs])


@app.route('/api/reconciliations', methods=['POST'])
@login_required
def create_reconciliation():
    data = request.get_json()
    rec = Reconciliation(
        company_id = active_company_id(),
        carrier    = data.get('carrier', '').strip(),
        period     = data.get('period', ''),
        status     = data.get('status', 'In Progress'),
        notes      = data.get('notes', '').strip(),
        created_by = current_user.username,
    )
    db.session.add(rec)
    db.session.commit()
    return jsonify(rec.to_dict(include_items=True)), 201


@app.route('/api/reconciliations/<int:rec_id>', methods=['GET'])
@login_required
def get_reconciliation(rec_id):
    rec = get_owned_or_404(Reconciliation, rec_id)
    return jsonify(rec.to_dict(include_items=True))


@app.route('/api/reconciliations/<int:rec_id>', methods=['PUT'])
@login_required
def update_reconciliation(rec_id):
    rec = get_owned_or_404(Reconciliation, rec_id)
    data = request.get_json()
    rec.carrier = data.get('carrier', rec.carrier).strip()
    rec.period  = data.get('period',  rec.period)
    rec.status  = data.get('status',  rec.status)
    rec.notes   = data.get('notes',   rec.notes or '').strip()
    db.session.commit()
    return jsonify(rec.to_dict(include_items=True))


@app.route('/api/reconciliations/<int:rec_id>', methods=['DELETE'])
@login_required
def delete_reconciliation(rec_id):
    rec = get_owned_or_404(Reconciliation, rec_id)
    db.session.delete(rec)
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/reconciliations/<int:rec_id>/items', methods=['POST'])
@login_required
def add_recon_item(rec_id):
    get_owned_or_404(Reconciliation, rec_id)
    data = request.get_json()
    ca = data.get('carrier_amount') or None
    oa = data.get('our_amount') or None
    if ca is not None: ca = float(ca)
    if oa is not None: oa = float(oa)
    auto_status = 'Pending'
    if ca is not None and oa is not None:
        auto_status = 'Matched' if abs(ca - oa) < 0.01 else 'Discrepancy'
    elif data.get('status') == 'Missing':
        auto_status = 'Missing'
    item = ReconciliationItem(
        recon_id       = rec_id,
        bond_number    = data.get('bond_number', '').strip(),
        principal      = data.get('principal', '').strip(),
        carrier_amount = ca,
        our_amount     = oa,
        status         = data.get('status') or auto_status,
        notes          = data.get('notes', '').strip(),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@app.route('/api/reconciliations/<int:rec_id>/items/<int:item_id>', methods=['PUT'])
@login_required
def update_recon_item(rec_id, item_id):
    get_owned_or_404(Reconciliation, rec_id)
    item = ReconciliationItem.query.filter_by(id=item_id, recon_id=rec_id).first_or_404()
    data = request.get_json()
    ca = data.get('carrier_amount') or None
    oa = data.get('our_amount') or None
    if ca is not None: ca = float(ca)
    if oa is not None: oa = float(oa)
    item.bond_number    = data.get('bond_number', item.bond_number or '').strip()
    item.principal      = data.get('principal',   item.principal or '').strip()
    item.carrier_amount = ca if ca is not None else item.carrier_amount
    item.our_amount     = oa if oa is not None else item.our_amount
    if ca is not None and oa is not None:
        item.status = 'Matched' if abs(ca - oa) < 0.01 else 'Discrepancy'
    item.status = data.get('status') or item.status
    item.notes  = data.get('notes', item.notes or '').strip()
    db.session.commit()
    return jsonify(item.to_dict())


@app.route('/api/reconciliations/<int:rec_id>/items/<int:item_id>', methods=['DELETE'])
@login_required
def delete_recon_item(rec_id, item_id):
    get_owned_or_404(Reconciliation, rec_id)
    item = ReconciliationItem.query.filter_by(id=item_id, recon_id=rec_id).first_or_404()
    db.session.delete(item)
    db.session.commit()
    return jsonify({'ok': True})


# ── User API (admin only) ──────────────────────────────────────────────

@app.route('/api/users', methods=['POST'])
@login_required
def create_user():
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()

    if data.get('role', 'user') not in COMPANY_ROLES:
        return jsonify({'error': 'Invalid role.'}), 400
    if User.query.filter_by(username=data.get('username', '').strip()).first():
        return jsonify({'error': 'That username is taken.'}), 400
    if User.query.filter_by(email=data.get('email', '').strip()).first():
        return jsonify({'error': 'That email is already in use.'}), 400

    user = User(
        company_id = current_user.company_id,
        username   = data['username'].strip(),
        email      = data['email'].strip(),
        role       = data.get('role', 'user'),
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@app.route('/api/users/<int:user_id>', methods=['PUT'])
@login_required
def update_user(user_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    user = get_owned_or_404(User, user_id)
    data = request.get_json()
    if data.get('role', user.role) not in COMPANY_ROLES:
        return jsonify({'error': 'Invalid role.'}), 400

    user.email  = data.get('email', user.email).strip()
    user.role   = data.get('role', user.role)
    user.active = data.get('active', user.active)
    if data.get('password'):
        user.set_password(data['password'])
    db.session.commit()
    return jsonify(user.to_dict())


@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    if user_id == current_user.id:
        return jsonify({'error': 'You cannot delete your own account.'}), 400
    user = get_owned_or_404(User, user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/users/invite', methods=['POST'])
@login_required
def invite_user():
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()

    username = data.get('username', '').strip()
    if not username:
        return jsonify({'error': 'Username is required.'}), 400
    if data.get('role', 'user') not in COMPANY_ROLES:
        return jsonify({'error': 'Invalid role.'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'That username is taken.'}), 400

    token = secrets.token_urlsafe(32)
    user  = User(
        company_id     = current_user.company_id,
        username       = username,
        email          = f'{username}@noemail.local',
        role           = data.get('role', 'user'),
        active         = False,
        invite_token   = token,
        invite_expires = datetime.utcnow() + timedelta(hours=72),
    )
    db.session.add(user)
    db.session.commit()

    invite_link = url_for('accept_invite', token=token, _external=True)
    return jsonify({'ok': True, 'invite_link': invite_link}), 201


@app.route('/invite/<token>', methods=['GET', 'POST'])
def accept_invite(token):
    user = User.query.filter_by(invite_token=token).first()

    if not user or (not user.is_superadmin and (not user.company or not user.company.active)):
        return render_template('accept_invite.html', error='This invite link is invalid.')
    if user.invite_expires and datetime.utcnow() > user.invite_expires:
        return render_template('accept_invite.html', error='This invite link has expired. Ask your administrator to resend the invite.')
    if user.password_hash:
        return render_template('accept_invite.html', error='This invite has already been used. Please log in.')

    if request.method == 'POST':
        password = request.form.get('password', '')
        confirm  = request.form.get('confirm', '')
        if len(password) < 8:
            return render_template('accept_invite.html', token=token, username=user.username,
                                   company=user.company, error='Password must be at least 8 characters.')
        if password != confirm:
            return render_template('accept_invite.html', token=token, username=user.username,
                                   company=user.company, error='Passwords do not match.')

        user.set_password(password)
        user.active         = True
        user.invite_token   = None
        user.invite_expires = None
        user.last_login_at  = datetime.utcnow()
        db.session.commit()
        login_user(user)
        return redirect(url_for('index'))

    return render_template('accept_invite.html', token=token, username=user.username, company=user.company)


@app.route('/api/users/<int:user_id>/resend-invite', methods=['POST'])
@login_required
def resend_invite(user_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    user = get_owned_or_404(User, user_id)
    if user.password_hash:
        return jsonify({'error': 'User has already accepted their invite.'}), 400

    token = secrets.token_urlsafe(32)
    user.invite_token   = token
    user.invite_expires = datetime.utcnow() + timedelta(hours=72)
    db.session.commit()

    invite_link = url_for('accept_invite', token=token, _external=True)
    threading.Thread(target=send_invite_email,
                     args=(user.email, user.username, invite_link, user.company.app_title, user.company.name),
                     daemon=True).start()

    return jsonify({'ok': True})


def report_prefix():
    """Safe filename prefix for downloaded reports, e.g. 'IAMA'."""
    c = active_company()
    raw = (c.short_name or c.name or 'BondDesk') if c else 'BondDesk'
    return ''.join(ch for ch in raw if ch.isalnum()) or 'BondDesk'


@app.route('/reports/pdf')
@login_required
def generate_report():
    from fpdf import FPDF
    from flask import make_response

    status_filter    = request.args.get('status', '')
    type_filter      = request.args.get('bond_type', '')
    producer_filter  = request.args.get('producer', '')
    surety_filter    = request.args.get('surety', '')
    principal_filter = request.args.get('principal', '')
    low_bid_filter   = request.args.get('low_bid', '')
    from_date        = request.args.get('from_date', '')
    to_date          = request.args.get('to_date', '')

    query = company_query(Bond)
    if status_filter:
        query = query.filter(Bond.status == status_filter)
    if type_filter:
        query = query.filter(Bond.bond_type == type_filter)
    if producer_filter:
        query = query.filter(Bond.producer == producer_filter)
    if surety_filter:
        query = query.filter(Bond.surety == surety_filter)
    if principal_filter:
        query = query.filter(Bond.principal == principal_filter)
    if low_bid_filter:
        query = query.filter(Bond.low_bid == None) if low_bid_filter == 'no-result' else query.filter(Bond.low_bid == low_bid_filter)
    if from_date:
        query = query.filter(Bond.bid_date >= from_date)
    if to_date:
        query = query.filter(Bond.bid_date <= to_date)

    bonds = query.order_by(Bond.bid_date.asc(), Bond.bond_number.asc()).all()

    pdf = FPDF(orientation='L', unit='mm', format='A4')
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(15, 15, 15)
    pdf.add_page()

    # ── Header ──────────────────────────────────────────────
    company = active_company()
    latin1  = lambda s: ''.join(c if ord(c) < 256 else '?' for c in (s or ''))
    pdf.set_font('Helvetica', 'B', 18)
    pdf.set_text_color(13, 27, 42)
    pdf.cell(0, 10, latin1(company.app_title), align='C')
    pdf.ln(10)

    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(95, 99, 104)
    pdf.cell(0, 6, latin1(company.name), align='C')
    pdf.ln(6)

    pdf.ln(2)

    filter_parts = [status_filter if status_filter else 'All Statuses']
    if type_filter:      filter_parts.append(type_filter)
    if producer_filter:  filter_parts.append(f'Producer: {producer_filter}')
    if surety_filter:    filter_parts.append(f'Surety: {surety_filter}')
    if principal_filter: filter_parts.append(f'Principal: {principal_filter}')
    if low_bid_filter:
        bid_labels = {'low': 'Low', 'not-low': 'Not Low', 'did-not-bid': 'Did Not Bid', 'no-result': 'No Result'}
        filter_parts.append(f'Bid Result: {bid_labels.get(low_bid_filter, low_bid_filter)}')
    if from_date or to_date:
        d = ''
        if from_date: d += f'From {from_date}'
        if to_date:   d += f'  To {to_date}'
        filter_parts.append(d.strip())

    pdf.set_font('Helvetica', 'B', 12)
    pdf.set_text_color(13, 27, 42)
    pdf.cell(0, 8, f'Bond Report  -  {", ".join(filter_parts)}', align='C')
    pdf.ln(8)

    pdf.set_font('Helvetica', '', 9)
    pdf.set_text_color(95, 99, 104)
    pdf.cell(0, 5, f'Generated {datetime.utcnow().strftime("%m/%d/%Y %I:%M %p")} UTC  |  {len(bonds)} bond(s)', align='C')
    pdf.ln(8)

    # ── Table header ────────────────────────────────────────
    cols = [
        ('Bond #',   24), ('Type',     24), ('Principal', 42),
        ('Obligee',  34), ('Project',  40), ('Surety',    30),
        ('Amount',   22), ('Bid Date', 22), ('Status',    29),
    ]

    pdf.set_fill_color(13, 27, 42)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font('Helvetica', 'B', 8)
    for label, w in cols:
        pdf.cell(w, 8, label, fill=True, align='C')
    pdf.ln(8)

    # ── Rows ────────────────────────────────────────────────
    status_colors = {
        'Approved':     (46, 125, 50),
        'Not Approved': (198, 40, 40),
        'Pending':      (230, 81, 0),
        'Waived':       (84, 110, 122),
        'Final Bond':   (13, 71, 161),
    }
    pdf.set_font('Helvetica', '', 8)

    for i, bond in enumerate(bonds):
        fill = i % 2 == 0
        if fill:
            pdf.set_fill_color(248, 249, 250)

        amt = f'${bond.bond_amount:,.0f}' if bond.bond_amount else '-'
        if bond.bond_amount and bond.bid_bond_percent and bond.bond_type == 'Bid Bond':
            pct_amt = bond.bond_amount * bond.bid_bond_percent / 100
            amt += f' ({bond.bid_bond_percent:.0f}%=${pct_amt:,.0f})'
        bid = bond.bid_date or '-'

        def safe(s):
            return ''.join(c if ord(c) < 256 else '?' for c in (s or ''))

        def trunc(s, n):
            s = safe(s)
            return s[:n-1] + '...' if len(s) > n else s

        row_vals = [
            (trunc(bond.bond_number or 'N/A', 12), cols[0][1], 'L'),
            (trunc(bond.bond_type,   12),           cols[1][1], 'L'),
            (trunc(bond.principal,   23),           cols[2][1], 'L'),
            (trunc(bond.obligee,     19),           cols[3][1], 'L'),
            (trunc(bond.project or '', 22),         cols[4][1], 'L'),
            (trunc(bond.surety,      16),           cols[5][1], 'L'),
            (trunc(amt,              12),           cols[6][1], 'R'),
            (bid,                                   cols[7][1], 'C'),
        ]

        pdf.set_text_color(60, 64, 67)
        for text, w, align in row_vals:
            pdf.cell(w, 7, text, border='B', fill=fill, align=align)

        sc = status_colors.get(bond.status, (60, 64, 67))
        pdf.set_text_color(*sc)
        pdf.cell(cols[8][1], 7, bond.status, border='B', fill=fill, align='C')
        pdf.set_text_color(60, 64, 67)
        pdf.ln(7)

    # ── Summary ─────────────────────────────────────────────
    pdf.ln(4)
    pdf.set_font('Helvetica', '', 9)
    pdf.set_text_color(95, 99, 104)
    approved = sum(1 for b in bonds if b.status == 'Approved')
    not_appr = sum(1 for b in bonds if b.status == 'Not Approved')
    pending  = sum(1 for b in bonds if b.status == 'Pending')
    waived   = sum(1 for b in bonds if b.status == 'Waived')
    woh_low  = sum(1 for b in bonds if b.work_on_hand_low)
    pdf.cell(0, 6,
        f'Total: {len(bonds)}   |   Approved: {approved}   |   Not Approved: {not_appr}   |   Pending: {pending}   |   Waived: {waived}   |   Work on Hand Low: {woh_low}',
        align='C')

    pdf_bytes = bytes(pdf.output())
    fname = f'{report_prefix()}-BondReport-{datetime.utcnow().strftime("%Y%m%d")}.pdf'
    resp = make_response(pdf_bytes)
    resp.headers['Content-Type'] = 'application/pdf'
    resp.headers['Content-Disposition'] = f'attachment; filename={fname}'
    return resp


@app.route('/reports/excel')
@login_required
def generate_excel():
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from flask import make_response
    import io

    status_filter    = request.args.get('status', '')
    type_filter      = request.args.get('bond_type', '')
    producer_filter  = request.args.get('producer', '')
    surety_filter    = request.args.get('surety', '')
    principal_filter = request.args.get('principal', '')
    low_bid_filter   = request.args.get('low_bid', '')
    from_date        = request.args.get('from_date', '')
    to_date          = request.args.get('to_date', '')

    query = company_query(Bond)
    if status_filter:
        query = query.filter(Bond.status == status_filter)
    if type_filter:
        query = query.filter(Bond.bond_type == type_filter)
    if producer_filter:
        query = query.filter(Bond.producer == producer_filter)
    if surety_filter:
        query = query.filter(Bond.surety == surety_filter)
    if principal_filter:
        query = query.filter(Bond.principal == principal_filter)
    if low_bid_filter:
        query = query.filter(Bond.low_bid == None) if low_bid_filter == 'no-result' else query.filter(Bond.low_bid == low_bid_filter)
    if from_date:
        query = query.filter(Bond.bid_date >= from_date)
    if to_date:
        query = query.filter(Bond.bid_date <= to_date)
    bonds = query.order_by(Bond.bid_date.asc(), Bond.bond_number.asc()).all()

    wb = Workbook()
    ws = wb.active
    ws.title = 'Bond Report'

    headers = ['Bond #', 'Bond Type', 'Principal', 'Obligee', 'Producer', 'Project', 'Project Description',
               'Surety', 'Amount', 'Bid Bond %', 'Bid Result', 'Bid Date', 'Decision Date',
               'Status', 'Notes', 'Work on Hand', 'Work on Hand Low']

    hdr_fill = PatternFill(start_color='0D1B2A', end_color='0D1B2A', fill_type='solid')
    hdr_font = Font(color='FFFFFF', bold=True, size=10)
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill = hdr_fill
        cell.font = hdr_font
        cell.alignment = Alignment(horizontal='center')

    status_fills = {
        'Approved':     PatternFill(start_color='E8F5E9', end_color='E8F5E9', fill_type='solid'),
        'Not Approved': PatternFill(start_color='FFEBEE', end_color='FFEBEE', fill_type='solid'),
        'Pending':      PatternFill(start_color='FFF3E0', end_color='FFF3E0', fill_type='solid'),
        'Waived':       PatternFill(start_color='ECEFF1', end_color='ECEFF1', fill_type='solid'),
    }

    for ri, bond in enumerate(bonds, 2):
        row_data = [
            bond.bond_number or 'N/A', bond.bond_type, bond.principal,
            bond.obligee, bond.producer or '', bond.project or '', bond.project_description or '',
            bond.surety,
            bond.bond_amount,
            f'{bond.bid_bond_percent}%' if bond.bid_bond_percent else '',
            {'low': 'Low', 'not-low': 'Not Low', 'did-not-bid': 'Did Not Bid'}.get(bond.low_bid, 'No Result'),
            bond.bid_date, bond.decision_date,
            bond.status, bond.notes or '',
            bond.work_on_hand or '',
            'Yes' if bond.work_on_hand_low else 'No',
        ]
        fill = status_fills.get(bond.status)
        for ci, val in enumerate(row_data, 1):
            cell = ws.cell(row=ri, column=ci, value=val)
            if fill:
                cell.fill = fill

    for col in ws.columns:
        max_len = max((len(str(c.value)) for c in col if c.value), default=8)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 45)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f'{report_prefix()}-BondReport-{datetime.utcnow().strftime("%Y%m%d")}.xlsx'
    resp = make_response(buf.getvalue())
    resp.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    resp.headers['Content-Disposition'] = f'attachment; filename={fname}'
    return resp


@app.route('/api/bonds/extract', methods=['POST'])
@login_required
def extract_bond_pdf():
    import pdfplumber

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded.'}), 400
    file = request.files['file']
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'File must be a PDF.'}), 400

    # The demo sample PDF gets a saved answer — no AI call, no cost.
    import hashlib, io, time
    from demo_seed import SAMPLE_PDF_EXTRACTION, sample_pdf_sha256
    raw_pdf = file.read()
    if hashlib.sha256(raw_pdf).hexdigest() == sample_pdf_sha256():
        time.sleep(1.5)   # feels like the real thing on stage
        return jsonify(SAMPLE_PDF_EXTRACTION)
    file = io.BytesIO(raw_pdf)

    try:
        with pdfplumber.open(file) as pdf:
            text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
    except Exception as e:
        return jsonify({'error': f'Could not read PDF: {e}'}), 400

    if not text.strip():
        return jsonify({'error': 'No text found in this PDF — it may be a scanned image.'}), 400

    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not api_key:
        return jsonify({'error': 'ANTHROPIC_API_KEY not set in Railway variables.'}), 500

    import anthropic as _anthropic
    client = _anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=2048,
        messages=[{
            'role': 'user',
            'content': (
                'Extract bond information from this document. '
                'Return ONLY a JSON object with these exact keys:\n'
                '  bond_type (one of: Bid Bond / Final Bond / License Bond / Maintenance Bond / Other),\n'
                '  principal, obligee, surety,\n'
                '  bond_amount: the CONTRACT amount or bid amount (NOT the bond penalty or penal sum — the full contract/project dollar value, number only no $ or commas, or null),\n'
                '  bid_bond_percent: the bid bond percentage (e.g. 5, 10, or 20 — number only, or null if not stated),\n'
                '  bid_date (YYYY-MM-DD or null), decision_date (YYYY-MM-DD or null),\n'
                '  project: the name of the project or job this bond is for (short name or title, or null),\n'
                '  project_description: a brief description of the project scope or work (1-3 sentences, or null),\n'
                '  work_on_hand: find the jobs/contracts table near the bottom of the document. It has these columns: job or project name | Bonded (Y or blank) | Amount (contract dollar amount) | Complete (percentage) | Remaining balance ($). There is a TOTAL row at the bottom. Copy every row that has any data as plain text, one row per line, tab or space separated. Include the TOTAL line. If this table is not present or all rows are blank/zero return null.\n'
                'Return only the JSON, no extra text.\n\n'
                f'Document:\n{text[:4000]}'
            )
        }]
    )

    try:
        raw = message.content[0].text.strip()
        print(f'[extract] Raw AI response: {raw[:500]}')
        # Strip markdown code fences if present
        if '```' in raw:
            raw = raw.split('```')[1]
            if raw.startswith('json'):
                raw = raw[4:]
        # Find JSON object within the text
        start = raw.find('{')
        end   = raw.rfind('}')
        if start != -1 and end != -1:
            raw = raw[start:end+1]
        extracted = json.loads(raw.strip())
    except Exception as e:
        print(f'[extract] Parse error: {e} | raw: {message.content[0].text[:300]}')
        return jsonify({'error': 'Could not parse AI response. Try again.'}), 500

    return jsonify(extracted)


@app.route('/api/me/password', methods=['PUT'])
@login_required
def change_password():
    data = request.get_json()
    if not current_user.check_password(data.get('current_password', '')):
        return jsonify({'error': 'Current password is incorrect.'}), 400
    current_user.set_password(data['new_password'])
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/changelog', methods=['GET'])
@login_required
def get_changelog():
    seen = current_user.last_seen_version
    if seen:
        idx = next((i for i, e in enumerate(CHANGELOG) if e['version'] == seen), None)
        unseen = CHANGELOG[:idx] if idx is not None else CHANGELOG[:1]
    else:
        unseen = CHANGELOG[:1]
    return jsonify({'latest_version': CHANGELOG[0]['version'], 'unseen': unseen})


@app.route('/api/me/seen-version', methods=['POST'])
@login_required
def mark_version_seen():
    current_user.last_seen_version = CHANGELOG[0]['version']
    db.session.commit()
    return jsonify({'ok': True})


# ── Platform (superadmin only) ─────────────────────────────────────────
# The platform owner creates companies and their first admin here. Superadmins
# never see a company's bonds — only names and counts.

def _require_superadmin():
    if not current_user.is_superadmin:
        return jsonify({'error': 'Unauthorized'}), 403
    return None


def _new_invite(company_id, username, role):
    token = secrets.token_urlsafe(32)
    user = User(
        company_id     = company_id,
        username       = username,
        email          = f'{username}@noemail.local',
        role           = role,
        active         = False,
        invite_token   = token,
        invite_expires = datetime.utcnow() + timedelta(hours=72),
    )
    db.session.add(user)
    return user, url_for('accept_invite', token=token, _external=True)


@app.route('/platform')
@login_required
def platform():
    if not current_user.is_superadmin:
        return redirect(url_for('index'))
    session.pop('view_company_id', None)
    from sqlalchemy import func
    from database import fmt
    now = datetime.utcnow()

    def per_company(model, col, where=None):
        q = db.session.query(model.company_id, col)
        if where is not None:
            q = q.filter(where)
        return dict(q.group_by(model.company_id).all())

    users_total  = per_company(User, func.count(User.id))
    users_active = per_company(User, func.count(User.id), User.active.is_(True))
    last_login   = per_company(User, func.max(User.last_login_at))
    bonds_total  = per_company(Bond, func.count(Bond.id))
    bonds_7d     = per_company(Bond, func.count(Bond.id), Bond.created_at >= now - timedelta(days=7))
    bonds_30d    = per_company(Bond, func.count(Bond.id), Bond.created_at >= now - timedelta(days=30))
    last_change  = per_company(AuditLog, func.max(AuditLog.changed_at), AuditLog.action != 'viewed')

    companies = Company.query.order_by(Company.name).all()
    rows = [dict(c.to_dict(),
                 users=users_total.get(c.id, 0), users_active=users_active.get(c.id, 0),
                 bonds=bonds_total.get(c.id, 0), bonds_7d=bonds_7d.get(c.id, 0), bonds_30d=bonds_30d.get(c.id, 0),
                 last_login=fmt(last_login.get(c.id)), last_activity=fmt(last_change.get(c.id)))
            for c in companies]
    from demo_seed import DEMO_COMPANY_NAME
    return render_template('platform.html', user=current_user, companies=rows, demo_name=DEMO_COMPANY_NAME)


@app.route('/api/platform/companies', methods=['POST'])
@login_required
def platform_create_company():
    denied = _require_superadmin()
    if denied:
        return denied
    data       = request.get_json() or {}
    name       = (data.get('name') or '').strip()
    short_name = (data.get('short_name') or '').strip()
    admin_name = (data.get('admin_username') or '').strip()
    if not name:
        return jsonify({'error': 'Company name is required.'}), 400
    if not admin_name:
        return jsonify({'error': 'Admin username is required.'}), 400
    if User.query.filter_by(username=admin_name).first():
        return jsonify({'error': 'That username is taken.'}), 400

    company = Company(name=name, short_name=short_name or None, producers='', active=True)
    db.session.add(company)
    db.session.flush()
    _, link = _new_invite(company.id, admin_name, 'admin')
    db.session.commit()
    return jsonify({'company': company.to_dict(), 'invite_link': link}), 201


@app.route('/api/platform/companies/<int:company_id>', methods=['PUT'])
@login_required
def platform_update_company(company_id):
    denied = _require_superadmin()
    if denied:
        return denied
    company = Company.query.get_or_404(company_id)
    data = request.get_json() or {}
    if 'name' in data:
        if not str(data['name']).strip():
            return jsonify({'error': 'Company name is required.'}), 400
        company.name = str(data['name']).strip()
    if 'short_name' in data:
        company.short_name = str(data['short_name']).strip() or None
    if 'active' in data:
        company.active = bool(data['active'])
    db.session.commit()
    return jsonify(company.to_dict())


@app.route('/api/platform/companies/<int:company_id>/invite-admin', methods=['POST'])
@login_required
def platform_invite_admin(company_id):
    denied = _require_superadmin()
    if denied:
        return denied
    company  = Company.query.get_or_404(company_id)
    username = ((request.get_json() or {}).get('username') or '').strip()
    if not username:
        return jsonify({'error': 'Username is required.'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'That username is taken.'}), 400
    _, link = _new_invite(company.id, username, 'admin')
    db.session.commit()
    return jsonify({'ok': True, 'invite_link': link}), 201


@app.route('/platform/view/<int:company_id>', methods=['POST'])
@login_required
def platform_view_company(company_id):
    """Open a company's screens read-only. Recorded in that company's Activity Log."""
    if not current_user.is_superadmin:
        return redirect(url_for('index'))
    company = Company.query.get_or_404(company_id)
    from demo_seed import DEMO_COMPANY_NAME
    if company.name != DEMO_COMPANY_NAME:
        db.session.add(AuditLog(
            company_id  = company.id,
            bond_id     = None,
            bond_number = None,
            action      = 'viewed',
            changed_by  = f'{current_user.username} (platform admin)',
            new_values  = json.dumps({'note': 'Opened this account read-only from the BondDesk platform'}),
        ))
        db.session.commit()
    session['view_company_id'] = company.id
    return redirect(url_for('index'))


@app.route('/platform/exit-view')
@login_required
def platform_exit_view():
    session.pop('view_company_id', None)
    return redirect(url_for('platform'))


@app.route('/api/platform/demo', methods=['POST'])
@login_required
def platform_seed_demo():
    denied = _require_superadmin()
    if denied:
        return denied
    from demo_seed import seed_demo_company
    password = secrets.token_urlsafe(9)
    result = seed_demo_company(password=password)
    return jsonify(result), 201


# ── Startup ────────────────────────────────────────────────────────────

def migrate_to_multi_company():
    """Move a single-company database to multi-company. Safe to run on every boot.

    1. Adds company_id to users / bonds / reconciliations / audit_log.
    2. The FIRST time (no companies exist yet), creates the default company and
       moves every existing row into it, so current users see no change.
    """
    from sqlalchemy import text
    is_pg  = 'postgresql' in str(db.engine.url)
    tables = ('users', 'bonds', 'reconciliations', 'audit_log')
    with db.engine.connect() as conn:
        if is_pg:
            # Several gunicorn workers may boot at once — only one migrates at a time.
            conn.execute(text('SELECT pg_advisory_lock(7310001)'))
        try:
            for t in tables:
                if is_pg:
                    conn.execute(text(f'ALTER TABLE {t} ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)'))
                else:
                    cols = {r[1] for r in conn.execute(text(f'PRAGMA table_info({t})'))}
                    if 'company_id' not in cols:
                        conn.execute(text(f'ALTER TABLE {t} ADD COLUMN company_id INTEGER REFERENCES companies(id)'))
            if is_pg:
                conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP'))
            elif 'last_login_at' not in {r[1] for r in conn.execute(text('PRAGMA table_info(users)'))}:
                conn.execute(text('ALTER TABLE users ADD COLUMN last_login_at DATETIME'))
            if is_pg:
                # bond_number was unique across the whole app; it must not collide between companies.
                conn.execute(text('ALTER TABLE bonds DROP CONSTRAINT IF EXISTS bonds_bond_number_key'))
            for t in ('bonds', 'reconciliations', 'audit_log'):
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS ix_{t}_company_id ON {t} (company_id)'))
            conn.commit()

            has_companies = conn.execute(text('SELECT 1 FROM companies LIMIT 1')).first() is not None
            if not has_companies:
                conn.execute(text(
                    'INSERT INTO companies (name, short_name, producers, active, created_at) '
                    'VALUES (:name, :short, :producers, :active, :created)'),
                    {'name': DEFAULT_COMPANY_NAME, 'short': DEFAULT_COMPANY_SHORT_NAME or None,
                     'producers': '\n'.join(DEFAULT_COMPANY_PRODUCERS), 'active': True,
                     'created': datetime.utcnow()})
                default_id = conn.execute(text('SELECT id FROM companies ORDER BY id LIMIT 1')).scalar()
                conn.execute(text("UPDATE users SET company_id = :c WHERE company_id IS NULL AND role <> 'superadmin'"), {'c': default_id})
                for t in ('bonds', 'reconciliations', 'audit_log'):
                    conn.execute(text(f'UPDATE {t} SET company_id = :c WHERE company_id IS NULL'), {'c': default_id})
                conn.commit()
                print(f'[migrate] Created company #{default_id} "{DEFAULT_COMPANY_NAME}" and moved existing data into it.')

            # Anything still without a company is NOT silently assigned to someone — flag it loudly.
            for t in ('bonds', 'reconciliations', 'audit_log'):
                orphans = conn.execute(text(f'SELECT COUNT(*) FROM {t} WHERE company_id IS NULL')).scalar()
                if orphans:
                    print(f'[migrate] WARNING: {orphans} row(s) in {t} have no company and are hidden from everyone.')
                elif is_pg:
                    conn.execute(text(f'ALTER TABLE {t} ALTER COLUMN company_id SET NOT NULL'))
            conn.commit()
        finally:
            if is_pg:
                conn.execute(text('SELECT pg_advisory_unlock(7310001)'))
                conn.commit()


def ensure_superadmin():
    """Create the platform owner account from SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD if it doesn't exist."""
    username = os.environ.get('SUPERADMIN_USERNAME', '').strip()
    password = os.environ.get('SUPERADMIN_PASSWORD', '')
    if not username or not password:
        return
    existing = User.query.filter_by(username=username).first()
    if existing:
        if not existing.is_superadmin:
            print(f'[startup] WARNING: SUPERADMIN_USERNAME "{username}" belongs to a company user — not changing it.')
        return
    sa = User(username=username, email=f'{username}@platform.local', role='superadmin', active=True, company_id=None)
    sa.set_password(password)
    db.session.add(sa)
    db.session.commit()
    print(f'[startup] Platform admin "{username}" created.')


with app.app_context():
    db.create_all()
    # Allow bond_number to be nullable (migration for existing databases)
    try:
        from sqlalchemy import text
        with db.engine.connect() as conn:
            if 'postgresql' in str(db.engine.url):
                conn.execute(text('ALTER TABLE bonds ALTER COLUMN bond_number DROP NOT NULL'))
                conn.execute(text('ALTER TABLE bonds ADD COLUMN IF NOT EXISTS expiration_date VARCHAR(10)'))
                conn.execute(text('ALTER TABLE bonds ADD COLUMN IF NOT EXISTS project VARCHAR(300)'))
                conn.execute(text('ALTER TABLE bonds ADD COLUMN IF NOT EXISTS project_description TEXT'))
                conn.execute(text('ALTER TABLE bonds ADD COLUMN IF NOT EXISTS bid_bond_percent FLOAT'))
                conn.execute(text('ALTER TABLE bonds ADD COLUMN IF NOT EXISTS work_on_hand TEXT'))
                conn.execute(text('ALTER TABLE bonds ADD COLUMN IF NOT EXISTS work_on_hand_low BOOLEAN DEFAULT FALSE'))
                conn.execute(text('ALTER TABLE bonds ADD COLUMN IF NOT EXISTS low_bid VARCHAR(20)'))
                conn.execute(text('ALTER TABLE bonds ADD COLUMN IF NOT EXISTS producer VARCHAR(200)'))
                conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64)'))
                conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_expires TIMESTAMP'))
                conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_version VARCHAR(20)'))
                conn.commit()
                # One-time: low_bid used to be BOOLEAN (True=Low/False=Not Low/NULL=No Result).
                # Widen it to VARCHAR so it can also hold 'did-not-bid', converting existing data.
                low_bid_type = conn.execute(text(
                    "SELECT data_type FROM information_schema.columns "
                    "WHERE table_name='bonds' AND column_name='low_bid'"
                )).scalar()
                if low_bid_type == 'boolean':
                    conn.execute(text('''
                        ALTER TABLE bonds ALTER COLUMN low_bid TYPE VARCHAR(20)
                        USING (CASE WHEN low_bid IS TRUE THEN 'low' WHEN low_bid IS FALSE THEN 'not-low' ELSE NULL END)
                    '''))
                    conn.commit()
            else:
                # SQLite has no "ADD COLUMN IF NOT EXISTS" — check PRAGMA table_info instead
                bond_cols = {row[1] for row in conn.execute(text('PRAGMA table_info(bonds)'))}
                bond_migrations = [
                    ('expiration_date',     'VARCHAR(10)'),
                    ('project',             'VARCHAR(300)'),
                    ('project_description', 'TEXT'),
                    ('bid_bond_percent',    'FLOAT'),
                    ('work_on_hand',        'TEXT'),
                    ('work_on_hand_low',    'BOOLEAN DEFAULT 0'),
                    ('low_bid',             'VARCHAR(20)'),
                    ('producer',            'VARCHAR(200)'),
                ]
                for col_name, col_type in bond_migrations:
                    if col_name not in bond_cols:
                        conn.execute(text(f'ALTER TABLE bonds ADD COLUMN {col_name} {col_type}'))
                user_cols = {row[1] for row in conn.execute(text('PRAGMA table_info(users)'))}
                if 'invite_token' not in user_cols:
                    conn.execute(text('ALTER TABLE users ADD COLUMN invite_token VARCHAR(64)'))
                if 'invite_expires' not in user_cols:
                    conn.execute(text('ALTER TABLE users ADD COLUMN invite_expires DATETIME'))
                if 'last_seen_version' not in user_cols:
                    conn.execute(text('ALTER TABLE users ADD COLUMN last_seen_version VARCHAR(20)'))
                # SQLite has no strict column typing — old rows may still hold 1/0 from
                # when low_bid was BOOLEAN. Rewrite them to the new text values.
                conn.execute(text("UPDATE bonds SET low_bid='low' WHERE low_bid='1'"))
                conn.execute(text("UPDATE bonds SET low_bid='not-low' WHERE low_bid='0'"))
                conn.commit()
    except Exception:
        pass
    # Not wrapped in try/except on purpose: if this fails the app must not start
    # with company data unscoped.
    migrate_to_multi_company()
    if not User.query.first():
        _admin = User(username='admin', email='admin@company.com', role='admin', active=True,
                      company_id=Company.query.order_by(Company.id).first().id)
        _admin.set_password('changeme123')
        db.session.add(_admin)
        db.session.commit()
        print('Default admin created — username: admin  password: changeme123')
        print('IMPORTANT: Change this password immediately after first login.')
    ensure_superadmin()


if __name__ == '__main__':
    app.run(debug=True, port=5000)
