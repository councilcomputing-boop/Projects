from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()


def fmt(dt):
    return dt.strftime('%m/%d/%Y %I:%M %p') if dt else ''


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id             = db.Column(db.Integer, primary_key=True)
    username       = db.Column(db.String(50), unique=True, nullable=False)
    email          = db.Column(db.String(120), unique=True, nullable=False)
    password_hash  = db.Column(db.String(256), nullable=True)   # null until invite accepted
    role           = db.Column(db.String(20), default='user')
    active         = db.Column(db.Boolean, default=False)       # false until invite accepted
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)
    invite_token   = db.Column(db.String(64), unique=True, nullable=True)
    invite_expires = db.Column(db.DateTime, nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    @property
    def invite_pending(self):
        return self.invite_token is not None and not self.password_hash

    def to_dict(self):
        return {
            'id':             self.id,
            'username':       self.username,
            'email':          self.email,
            'role':           self.role,
            'active':         self.active,
            'invite_pending': self.invite_pending,
            'created_at':     self.created_at.strftime('%m/%d/%Y') if self.created_at else '',
        }


class ReconciliationRun(db.Model):
    __tablename__ = 'reconciliation_runs'
    id                = db.Column(db.Integer, primary_key=True)
    carrier           = db.Column(db.String(100), nullable=False)
    statement_label   = db.Column(db.String(300))
    carrier_filename  = db.Column(db.String(300))
    ams_filename      = db.Column(db.String(300))
    carrier_net_total = db.Column(db.Float, default=0)
    ams_net_total     = db.Column(db.Float, default=0)
    diff_total        = db.Column(db.Float, default=0)
    item_count        = db.Column(db.Integer, default=0)
    match_count       = db.Column(db.Integer, default=0)
    issue_count       = db.Column(db.Integer, default=0)
    used_ocr          = db.Column(db.Boolean, default=False)
    created_at        = db.Column(db.DateTime, default=datetime.utcnow)
    items             = db.relationship('ReconciliationItem', backref='run', lazy=True, cascade='all, delete-orphan')

    def to_dict(self, include_items=False):
        return {
            'id':                self.id,
            'carrier':           self.carrier,
            'statement_label':   self.statement_label or '',
            'carrier_filename':  self.carrier_filename or '',
            'ams_filename':      self.ams_filename or '',
            'carrier_net_total': self.carrier_net_total,
            'ams_net_total':     self.ams_net_total,
            'diff_total':        self.diff_total,
            'item_count':        self.item_count,
            'match_count':       self.match_count,
            'issue_count':       self.issue_count,
            'used_ocr':          bool(self.used_ocr),
            'created_at':        fmt(self.created_at),
            'items':             [i.to_dict() for i in self.items] if include_items else [],
        }


class ReconciliationItem(db.Model):
    __tablename__ = 'reconciliation_items'
    id             = db.Column(db.Integer, primary_key=True)
    run_id         = db.Column(db.Integer, db.ForeignKey('reconciliation_runs.id'), nullable=False)
    client_name    = db.Column(db.String(300))
    carrier_policy = db.Column(db.String(100))
    ams_policy     = db.Column(db.String(100))
    carrier_net    = db.Column(db.Float)
    ams_net        = db.Column(db.Float)
    diff           = db.Column(db.Float)
    status         = db.Column(db.String(30))  # match | flag_verify | flag_policy_number | mismatch | missing_from_ams360 | missing_from_carrier
    note           = db.Column(db.Text)

    def to_dict(self):
        return {
            'id':             self.id,
            'run_id':         self.run_id,
            'client_name':    self.client_name or '',
            'carrier_policy': self.carrier_policy or '',
            'ams_policy':     self.ams_policy or '',
            'carrier_net':    self.carrier_net,
            'ams_net':        self.ams_net,
            'diff':           self.diff,
            'status':         self.status,
            'note':           self.note or '',
        }
