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
    id                   = db.Column(db.Integer, primary_key=True)
    bond_number          = db.Column(db.String(50), unique=True, nullable=True)
    bond_type            = db.Column(db.String(50), nullable=False)
    principal            = db.Column(db.String(200), nullable=False)
    obligee              = db.Column(db.String(200), nullable=False)
    producer             = db.Column(db.String(200))
    project              = db.Column(db.String(300))
    project_description  = db.Column(db.Text)
    surety               = db.Column(db.String(200), nullable=False)
    bond_amount          = db.Column(db.Float)
    bid_bond_percent     = db.Column(db.Float)
    bid_date             = db.Column(db.String(10))
    expiration_date      = db.Column(db.String(10))
    decision_date        = db.Column(db.String(10))
    status               = db.Column(db.String(20), default='Pending')
    notes                = db.Column(db.Text)
    work_on_hand         = db.Column(db.Text)
    work_on_hand_low     = db.Column(db.Boolean, default=False)
    low_bid              = db.Column(db.Boolean, default=False)
    created_by           = db.Column(db.String(50))
    created_at           = db.Column(db.DateTime, default=datetime.utcnow)
    updated_by           = db.Column(db.String(50))
    updated_at           = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'id':                  self.id,
            'bond_number':         self.bond_number,
            'bond_type':           self.bond_type,
            'principal':           self.principal,
            'obligee':             self.obligee,
            'producer':            self.producer or '',
            'project':             self.project or '',
            'project_description': self.project_description or '',
            'surety':              self.surety,
            'bond_amount':         self.bond_amount,
            'bid_bond_percent':    self.bid_bond_percent,
            'bid_date':            self.bid_date or '',
            'expiration_date':     self.expiration_date or '',
            'decision_date':       self.decision_date or '',
            'status':              self.status,
            'notes':               self.notes or '',
            'work_on_hand':        self.work_on_hand or '',
            'work_on_hand_low':    bool(self.work_on_hand_low),
            'low_bid':             bool(self.low_bid),
            'created_by':          self.created_by or '',
            'created_at':          fmt(self.created_at),
            'updated_by':          self.updated_by or '',
            'updated_at':          fmt(self.updated_at),
        }


class Reconciliation(db.Model):
    __tablename__ = 'reconciliations'
    id         = db.Column(db.Integer, primary_key=True)
    carrier    = db.Column(db.String(200), nullable=False)
    period     = db.Column(db.String(7))   # YYYY-MM
    status     = db.Column(db.String(20), default='In Progress')
    notes      = db.Column(db.Text)
    created_by = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    items      = db.relationship('ReconciliationItem', backref='recon', lazy=True, cascade='all, delete-orphan')

    def to_dict(self, include_items=False):
        items = [i.to_dict() for i in self.items] if include_items else []
        matched    = sum(1 for i in self.items if i.status == 'Matched')
        discrepant = sum(1 for i in self.items if i.status == 'Discrepancy')
        missing    = sum(1 for i in self.items if i.status == 'Missing')
        return {
            'id':         self.id,
            'carrier':    self.carrier,
            'period':     self.period or '',
            'status':     self.status,
            'notes':      self.notes or '',
            'created_by': self.created_by or '',
            'created_at': self.created_at.strftime('%m/%d/%Y') if self.created_at else '',
            'item_count': len(self.items),
            'matched':    matched,
            'discrepant': discrepant,
            'missing':    missing,
            'items':      items,
        }


class ReconciliationItem(db.Model):
    __tablename__ = 'recon_items'
    id             = db.Column(db.Integer, primary_key=True)
    recon_id       = db.Column(db.Integer, db.ForeignKey('reconciliations.id'), nullable=False)
    bond_number    = db.Column(db.String(50))
    principal      = db.Column(db.String(200))
    carrier_amount = db.Column(db.Float)
    our_amount     = db.Column(db.Float)
    status         = db.Column(db.String(20), default='Pending')  # Matched | Discrepancy | Missing
    notes          = db.Column(db.Text)

    def to_dict(self):
        return {
            'id':             self.id,
            'recon_id':       self.recon_id,
            'bond_number':    self.bond_number or '',
            'principal':      self.principal or '',
            'carrier_amount': self.carrier_amount,
            'our_amount':     self.our_amount,
            'status':         self.status,
            'notes':          self.notes or '',
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
