"""SQLAlchemy models for the CRM."""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY

from database import Base


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    status = Column(String(20), default="in_progress")  # in_progress / completed / failed
    threads_processed = Column(Integer, default=0)
    emails_processed = Column(Integer, default=0)
    drafts_created = Column(Integer, default=0)
    tasks_created = Column(Integer, default=0)
    summary = Column(Text)
    cost_usd = Column(Float)
    current_thread_id = Column(Integer)
    case_id = Column(Integer, ForeignKey("cases.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    type = Column(String(10))  # BTR / PRS
    units = Column(Integer)
    manager = Column(String(255))
    manager_email = Column(String(255))
    description = Column(Text)
    challenge_id = Column(String(50), unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True)
    first_name = Column(String(255))
    last_name = Column(String(255))
    email = Column(String(255))
    type = Column(String(50))  # tenant/landlord/contractor/prospect/internal/legal
    property_id = Column(Integer, ForeignKey("properties.id"))
    company = Column(String(255))
    unit = Column(String(100))
    role = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True)
    name = Column(String(500), nullable=False)
    status = Column(String(20), default="new")
    priority = Column(String(20), default="medium")
    description = Column(Text)
    property_id = Column(Integer, ForeignKey("properties.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True)
    subject = Column(String(500))
    from_address = Column(String(255))
    to_addresses = Column(ARRAY(String))
    cc_addresses = Column(ARRAY(String))
    body = Column(Text)
    body_plain = Column(Text)
    date_sent = Column(DateTime(timezone=True))
    status = Column(String(20), default="archived")
    is_read = Column(Boolean, default=False)
    is_replied = Column(Boolean, default=False)
    is_important = Column(Boolean, default=False)
    message_id = Column(String(255))
    in_reply_to = Column(String(255))
    thread_id = Column(String(100))
    thread_position = Column(Integer)
    challenge_id = Column(String(50), unique=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    name = Column(String(500), nullable=False)
    status = Column(String(20), default="not_started")
    priority = Column(String(20), default="normal")
    description = Column(Text)
    date_start = Column(DateTime(timezone=True))
    date_end = Column(DateTime(timezone=True))
    case_id = Column(Integer, ForeignKey("cases.id"))
    contact_id = Column(Integer, ForeignKey("contacts.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True)
    content = Column(Text)
    case_id = Column(Integer, ForeignKey("cases.id"))
    shift_id = Column(Integer, ForeignKey("shifts.id"))
    task_id = Column(Integer, ForeignKey("tasks.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class Thread(Base):
    __tablename__ = "threads"

    id = Column(Integer, primary_key=True)
    thread_id = Column(String(100), unique=True, nullable=False)
    subject = Column(String(500))
    last_activity_at = Column(DateTime(timezone=True))
    email_count = Column(Integer, default=0)
    is_read = Column(Boolean, default=False)
    case_id = Column(Integer, ForeignKey("cases.id"))
    property_id = Column(Integer, ForeignKey("properties.id"))
    contact_id = Column(Integer, ForeignKey("contacts.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
