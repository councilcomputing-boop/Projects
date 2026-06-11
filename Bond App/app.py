from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from database import db, User, Bond, AuditLog
from email_service import send_bond_notification, send_invite_email
from datetime import datetime, timedelta
import os
import json
import secrets
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change-this-before-deploying')

db_url = os.environ.get('DATABASE_URL', 'sqlite:///bonds.db')
# Railway PostgreSQL URLs start with postgres://, SQLAlchemy needs postgresql://
if db_url.startswith('postgres://'):
    db_url = db_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access Bond Tracker.'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


def log_action(bond, action, old_data=None):
    entry = AuditLog(
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
    return render_template('index.html', user=current_user)


@app.route('/admin')
@login_required
def admin():
    if current_user.role != 'admin':
        return redirect(url_for('index'))
    users = User.query.order_by(User.created_at).all()
    return render_template('admin.html', user=current_user, users=users)


# ── Bond API ───────────────────────────────────────────────────────────

@app.route('/api/bonds', methods=['GET'])
@login_required
def get_bonds():
    bonds = Bond.query.order_by(Bond.created_at.desc()).all()
    return jsonify([b.to_dict() for b in bonds])


@app.route('/api/bonds', methods=['POST'])
@login_required
def create_bond():
    data = request.get_json()

    if Bond.query.filter_by(bond_number=data.get('bond_number', '').strip()).first():
        return jsonify({'error': 'Bond number already exists.'}), 400

    bond = Bond(
        bond_number   = data['bond_number'].strip(),
        bond_type     = data['bond_type'],
        principal     = data['principal'].strip(),
        obligee       = data['obligee'].strip(),
        surety        = data['surety'].strip(),
        bond_amount   = data.get('bond_amount') or None,
        bid_date      = data.get('bid_date') or None,
        decision_date = data.get('decision_date') or None,
        status        = data.get('status', 'Pending'),
        notes         = data.get('notes', '').strip(),
        created_by    = current_user.username,
        created_at    = datetime.utcnow(),
    )
    db.session.add(bond)
    db.session.flush()
    log_action(bond, 'created')
    db.session.commit()

    send_bond_notification('created', bond, current_user.username)
    return jsonify(bond.to_dict()), 201


@app.route('/api/bonds/<int:bond_id>', methods=['PUT'])
@login_required
def update_bond(bond_id):
    bond     = Bond.query.get_or_404(bond_id)
    data     = request.get_json()
    old_data = bond.to_dict()
    old_status = bond.status

    new_num = data.get('bond_number', bond.bond_number).strip()
    if new_num != bond.bond_number and Bond.query.filter_by(bond_number=new_num).first():
        return jsonify({'error': 'Bond number already exists.'}), 400

    bond.bond_number   = new_num
    bond.bond_type     = data.get('bond_type',     bond.bond_type)
    bond.principal     = data.get('principal',     bond.principal).strip()
    bond.obligee       = data.get('obligee',       bond.obligee).strip()
    bond.surety        = data.get('surety',        bond.surety).strip()
    bond.bond_amount   = data.get('bond_amount')   or bond.bond_amount
    bond.bid_date      = data.get('bid_date')      or bond.bid_date
    bond.decision_date = data.get('decision_date') or bond.decision_date
    bond.status        = data.get('status',        bond.status)
    bond.notes         = data.get('notes',         bond.notes or '').strip()
    bond.updated_by    = current_user.username
    bond.updated_at    = datetime.utcnow()

    log_action(bond, 'updated', old_data)
    db.session.commit()

    if bond.status != old_status:
        send_bond_notification('status_changed', bond, current_user.username, old_status=old_status)
    else:
        send_bond_notification('updated', bond, current_user.username)

    return jsonify(bond.to_dict())


@app.route('/api/bonds/<int:bond_id>', methods=['DELETE'])
@login_required
def delete_bond(bond_id):
    bond     = Bond.query.get_or_404(bond_id)
    old_data = bond.to_dict()

    entry = AuditLog(
        bond_id     = bond.id,
        bond_number = bond.bond_number,
        action      = 'deleted',
        changed_by  = current_user.username,
        old_values  = json.dumps(old_data),
    )
    db.session.add(entry)
    send_bond_notification('deleted', bond, current_user.username)
    db.session.delete(bond)
    db.session.commit()
    return jsonify({'ok': True})


# ── Audit log API ──────────────────────────────────────────────────────

@app.route('/api/audit')
@login_required
def get_audit():
    logs = AuditLog.query.order_by(AuditLog.changed_at.desc()).limit(500).all()
    return jsonify([l.to_dict() for l in logs])


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

    if User.query.filter_by(username=data.get('username', '').strip()).first():
        return jsonify({'error': 'Username already exists.'}), 400
    if User.query.filter_by(email=data.get('email', '').strip()).first():
        return jsonify({'error': 'Email already exists.'}), 400

    token = secrets.token_urlsafe(32)
    user  = User(
        username       = data['username'].strip(),
        email          = data['email'].strip(),
        role           = data.get('role', 'user'),
        active         = False,
        invite_token   = token,
        invite_expires = datetime.utcnow() + timedelta(hours=72),
    )
    db.session.add(user)
    db.session.commit()

    invite_link = url_for('accept_invite', token=token, _external=True)
    try:
        send_invite_email(user.email, user.username, invite_link)
    except Exception as e:
        print(f'[invite] Email failed but user created: {e}')

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
    try:
        send_invite_email(user.email, user.username, invite_link)
    except Exception as e:
        return jsonify({'error': f'User updated but email failed: {e}'}), 500

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
    app.run(debug=True, port=5000)
