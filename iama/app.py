import csv
import io
import os
import secrets
import threading
from datetime import datetime, timedelta

from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify, redirect, url_for, Response
from flask_login import LoginManager, login_user, logout_user, login_required, current_user

from database import db, User, ReconciliationRun, ReconciliationItem
from email_service import send_invite_email
from reconcile import ams360, cna, engine
from reconcile.registry import CARRIERS

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change-this-before-deploying')

db_url = os.environ.get('DATABASE_URL', 'sqlite:///reconciliation.db')
if db_url.startswith('postgres://'):
    db_url = db_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access Direct Bill Reconciliation.'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


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
        if user and user.active and user.check_password(password):
            login_user(user, remember=True)
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
    logout_user()
    return redirect(url_for('login'))


# ── Pages ──────────────────────────────────────────────────────────────

@app.route('/')
@login_required
def index():
    runs = ReconciliationRun.query.order_by(ReconciliationRun.created_at.desc()).limit(50).all()
    return render_template('index.html', user=current_user, runs=[r.to_dict() for r in runs], carriers=list(CARRIERS.keys()))


@app.route('/admin')
@login_required
def admin():
    if current_user.role != 'admin':
        return redirect(url_for('index'))
    users   = User.query.order_by(User.created_at).all()
    app_url = os.environ.get('APP_URL', request.host_url.rstrip('/'))
    return render_template('admin.html', user=current_user, users=users, app_url=app_url)


# ── API ────────────────────────────────────────────────────────────────

@app.route('/api/reconcile', methods=['POST'])
@login_required
def api_reconcile():
    carrier = (request.form.get('carrier') or '').strip()
    if carrier not in CARRIERS:
        return jsonify({'error': f'Unsupported carrier "{carrier}". Supported: {", ".join(CARRIERS)}'}), 400

    carrier_file = request.files.get('carrier_file')
    ams_file = request.files.get('ams_file')
    if not carrier_file or not ams_file:
        return jsonify({'error': 'Both files are required.'}), 400

    try:
        carrier_by_policy, used_ocr = CARRIERS[carrier]['parse'](carrier_file.stream)
    except Exception as e:
        return jsonify({'error': f'Could not read the carrier statement: {e}'}), 400

    try:
        ams_filename = ams_file.filename or ''
        if ams_filename.lower().endswith(('.xlsx', '.xls', '.csv')):
            ams_rows = ams360.parse_spreadsheet(ams_file.stream, ams_filename)
        else:
            ams_rows = ams360.parse_pdf(ams_file.stream)
    except Exception as e:
        return jsonify({'error': f'Could not read the AMS360 export: {e}'}), 400

    if not ams_rows:
        return jsonify({'error': 'Could not find any transaction rows in the AMS360 file.'}), 400
    if not carrier_by_policy:
        return jsonify({'error': 'Could not recognize any policies in the carrier statement.'}), 400

    results = engine.reconcile(carrier_by_policy, ams_rows)
    summary = engine.summarize(results)

    run = ReconciliationRun(
        carrier=carrier,
        statement_label=carrier_file.filename or '',
        carrier_filename=carrier_file.filename or '',
        ams_filename=ams_file.filename or '',
        carrier_net_total=summary['carrier_net_total'],
        ams_net_total=summary['ams_net_total'],
        diff_total=summary['diff_total'],
        item_count=summary['item_count'],
        match_count=summary['match_count'],
        issue_count=summary['issue_count'],
        used_ocr=used_ocr,
    )
    db.session.add(run)
    db.session.flush()

    for r in results:
        db.session.add(ReconciliationItem(
            run_id=run.id,
            client_name=r['name'],
            carrier_policy=r['carrier_policy'],
            ams_policy=r['ams_policy'],
            carrier_net=r['carrier_net'],
            ams_net=r['ams_net'],
            diff=r['diff'],
            status=r['status'],
            note=r['note'],
        ))
    db.session.commit()

    return jsonify({'run': run.to_dict(include_items=True), 'labels': engine.STATUS_LABELS})


@app.route('/api/runs/<int:run_id>')
@login_required
def api_get_run(run_id):
    run = ReconciliationRun.query.get_or_404(run_id)
    return jsonify({'run': run.to_dict(include_items=True), 'labels': engine.STATUS_LABELS})


@app.route('/api/runs/<int:run_id>/export.csv')
@login_required
def api_export_run(run_id):
    run = ReconciliationRun.query.get_or_404(run_id)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(['Status', 'Client', 'Carrier Policy', 'AMS360 Policy', 'Carrier Net $', 'AMS360 Net $', 'Difference', 'Notes'])
    for item in run.items:
        writer.writerow([
            engine.STATUS_LABELS.get(item.status, item.status), item.client_name,
            item.carrier_policy, item.ams_policy, item.carrier_net, item.ams_net, item.diff, item.note,
        ])
    resp = Response(buf.getvalue(), mimetype='text/csv')
    fname = f'reconciliation-{run.id}-{datetime.utcnow().strftime("%Y%m%d")}.csv'
    resp.headers['Content-Disposition'] = f'attachment; filename={fname}'
    return resp


# ── User API (admin only) ──────────────────────────────────────────────

@app.route('/api/users', methods=['POST'])
@login_required
def create_user():
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()

    if User.query.filter_by(username=data.get('username', '').strip()).first():
        return jsonify({'error': 'Username already exists.'}), 400
    if User.query.filter_by(email=data.get('email', '').strip()).first():
        return jsonify({'error': 'Email already exists.'}), 400

    user = User(
        username = data['username'].strip(),
        email    = data['email'].strip(),
        role     = data.get('role', 'user'),
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
    user = User.query.get_or_404(user_id)
    data = request.get_json()

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
    user = User.query.get_or_404(user_id)
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
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists.'}), 400

    token = secrets.token_urlsafe(32)
    user  = User(
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

    if not user:
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
                                   error='Password must be at least 8 characters.')
        if password != confirm:
            return render_template('accept_invite.html', token=token, username=user.username,
                                   error='Passwords do not match.')

        user.set_password(password)
        user.active         = True
        user.invite_token   = None
        user.invite_expires = None
        db.session.commit()
        login_user(user)
        return redirect(url_for('index'))

    return render_template('accept_invite.html', token=token, username=user.username)


@app.route('/api/users/<int:user_id>/resend-invite', methods=['POST'])
@login_required
def resend_invite(user_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    user = User.query.get_or_404(user_id)
    if user.password_hash:
        return jsonify({'error': 'User has already accepted their invite.'}), 400

    token = secrets.token_urlsafe(32)
    user.invite_token   = token
    user.invite_expires = datetime.utcnow() + timedelta(hours=72)
    db.session.commit()

    invite_link = url_for('accept_invite', token=token, _external=True)
    threading.Thread(target=send_invite_email, args=(user.email, user.username, invite_link), daemon=True).start()

    return jsonify({'ok': True})


@app.route('/api/me/password', methods=['PUT'])
@login_required
def change_password():
    data = request.get_json()
    if not current_user.check_password(data.get('current_password', '')):
        return jsonify({'error': 'Current password is incorrect.'}), 400
    current_user.set_password(data['new_password'])
    db.session.commit()
    return jsonify({'ok': True})


# ── Startup ────────────────────────────────────────────────────────────

with app.app_context():
    db.create_all()
    if not User.query.first():
        _admin = User(username='admin', email='admin@company.com', role='admin', active=True)
        _admin.set_password('changeme123')
        db.session.add(_admin)
        db.session.commit()
        print('Default admin created — username: admin  password: changeme123')
        print('IMPORTANT: Change this password immediately after first login.')

if __name__ == '__main__':
    app.run(debug=True, port=5050)
