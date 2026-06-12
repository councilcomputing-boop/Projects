from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import json

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


class Bond(db.Model):
    __tablename__ = 'bonds'
    id            = db.Column(db.Integer, primary_key=True)
    bond_number   = db.Column(db.String(50), unique=True, nullable=True)
    bond_type     = db.Column(db.String(50), nullable=False)
    principal     = db.Column(db.String(200), nullable=False)
    obligee       = db.Column(db.String(200), nullable=False)
    surety        = db.Column(db.String(200), nullable=False)
    bond_amount   = db.Column(db.Float)
    bid_date        = db.Column(db.String(10))
    expiration_date = db.Column(db.String(10))
    decision_date   = db.Column(db.String(10))
    status        = db.Column(db.String(20), default='Pending')
    notes         = db.Column(db.Text)
    created_by    = db.Column(db.String(50))
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_by    = db.Column(db.String(50))
    updated_at    = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'id':            self.id,
            'bond_number':   self.bond_number,
            'bond_type':     self.bond_type,
            'principal':     self.principal,
            'obligee':       self.obligee,
            'surety':        self.surety,
            'bond_amount':   self.bond_amount,
            'bid_date':        self.bid_date or '',
            'expiration_date': self.expiration_date or '',
            'decision_date':   self.decision_date or '',
            'status':        self.status,
            'notes':         self.notes or '',
            'created_by':    self.created_by or '',
            'created_at':    fmt(self.created_at),
            'updated_by':    self.updated_by or '',
            'updated_at':    fmt(self.updated_at),
        }


class AuditLog(db.Model):
    __tablename__ = 'audit_log'
    id          = db.Column(db.Integer, primary_key=True)
    bond_id     = db.Column(db.Integer)
    bond_number = db.Column(db.String(50))
    action      = db.Column(db.String(20))   # created | updated | deleted
    changed_by  = db.Column(db.String(50))
    changed_at  = db.Column(db.DateTime, default=datetime.utcnow)
    old_values  = db.Column(db.Text)
    new_values  = db.Column(db.Text)

    def to_dict(self):
        return {
            'id':          self.id,
            'bond_id':     self.bond_id,
            'bond_number': self.bond_number,
            'action':      self.action,
            'changed_by':  self.changed_by,
            'changed_at':  fmt(self.changed_at),
            'old_values':  json.loads(self.old_values) if self.old_values else None,
            'new_values':  json.loads(self.new_values) if self.new_values else None,
        }
