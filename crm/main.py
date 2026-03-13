"""CRM API — lightweight FastAPI service for PropTech email triage."""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import asc, desc, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import engine, get_db, init_db
from models import Case, Contact, Email, Note, Property, Shift, Task, Thread

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("crm")

# ---------------------------------------------------------------------------
# Entity registry
# ---------------------------------------------------------------------------
ENTITIES: dict[str, type] = {
    "properties": Property,
    "contacts": Contact,
    "emails": Email,
    "cases": Case,
    "tasks": Task,
    "notes": Note,
    "threads": Thread,
    "shifts": Shift,
}

# Which query-param filters each entity supports
FILTERS: dict[str, list[str]] = {
    "properties": ["type", "challenge_id"],
    "contacts": ["type", "property_id", "email"],
    "emails": [
        "status", "is_read", "is_replied", "thread_id", "case_id", "challenge_id",
    ],
    "cases": ["status", "priority", "property_id"],
    "tasks": ["status", "priority", "case_id", "contact_id"],
    "notes": ["case_id"],
    "threads": ["is_read", "case_id", "property_id", "contact_id"],
    "shifts": ["status"],
}

# Which ?include= values each entity supports, and the FK / query to resolve them.
# Each value is (target_model, fk_field_on_parent | None, is_list).
# If fk_field_on_parent is None, the relationship is reverse (child → parent).
INCLUDES: dict[str, dict[str, tuple[type, str | None, bool]]] = {
    "cases": {
        "emails": (Email, None, True),       # Email.case_id → Case.id
        "tasks": (Task, None, True),         # Task.case_id → Case.id
        "notes": (Note, None, True),         # Note.case_id → Case.id
        "property": (Property, "property_id", False),
    },
    "threads": {
        "emails": (Email, None, True),       # Email.thread_id → Thread.thread_id
        "contact": (Contact, "contact_id", False),
    },
    "emails": {
        "contact": (Contact, None, False),   # special: resolve via from_address
    },
    "shifts": {
        "case": (Case, "case_id", False),
    },
}


def serialize(obj) -> dict:
    """Convert a SQLAlchemy model instance to a plain dict."""
    d = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        d[col.name] = val
    return d


def _coerce_value(model, key: str, value):
    """Coerce a JSON value to the expected Python type for a column."""
    col = model.__table__.columns.get(key)
    if col is None or value is None:
        return value
    from sqlalchemy import DateTime, Boolean, Integer
    if isinstance(col.type, DateTime) and isinstance(value, str):
        from datetime import datetime as dt
        # Parse ISO 8601 strings
        value = value.replace("Z", "+00:00")
        try:
            return dt.fromisoformat(value)
        except ValueError:
            return value  # let the DB reject it with a clearer error
    if isinstance(col.type, Integer) and not isinstance(value, int):
        try:
            return int(value)
        except (ValueError, TypeError):
            return value
    if isinstance(col.type, Boolean) and not isinstance(value, bool):
        if isinstance(value, str):
            return value.lower() in ("true", "1", "yes")
    return value


async def _resolve_includes(
    db: AsyncSession, entity: str, obj_dict: dict, include_list: list[str]
) -> dict:
    """Resolve ?include= parameters and attach nested data to obj_dict."""
    entity_includes = INCLUDES.get(entity, {})
    for inc_name in include_list:
        spec = entity_includes.get(inc_name)
        if not spec:
            continue
        target_model, fk_field, is_list = spec

        if entity == "threads" and inc_name == "emails":
            # Special: match on thread_id string, order by thread_position
            q = (
                select(target_model)
                .where(target_model.thread_id == obj_dict["thread_id"])
                .order_by(asc(target_model.thread_position))
            )
            result = await db.execute(q)
            obj_dict[inc_name] = [serialize(r) for r in result.scalars().all()]
        elif entity == "emails" and inc_name == "contact":
            # Special: resolve from_address → Contact.email
            from_addr = obj_dict.get("from_address")
            if from_addr:
                q = select(Contact).where(Contact.email == from_addr)
                result = await db.execute(q)
                contact = result.scalar_one_or_none()
                obj_dict[inc_name] = serialize(contact) if contact else None
            else:
                obj_dict[inc_name] = None
        elif is_list:
            # Reverse FK: target has a case_id/property_id pointing at this entity
            fk_col = getattr(target_model, "case_id", None)
            q = select(target_model).where(fk_col == obj_dict["id"])
            result = await db.execute(q)
            obj_dict[inc_name] = [serialize(r) for r in result.scalars().all()]
        elif fk_field:
            # Forward FK: this entity has a FK to target
            fk_val = obj_dict.get(fk_field)
            if fk_val:
                q = select(target_model).where(target_model.id == fk_val)
                result = await db.execute(q)
                related = result.scalar_one_or_none()
                if related:
                    related_dict = serialize(related)
                    # Special: shifts include=case also loads the case's notes (journal)
                    if entity == "shifts" and inc_name == "case":
                        await _resolve_includes(db, "cases", related_dict, ["notes"])
                    obj_dict[inc_name] = related_dict
                else:
                    obj_dict[inc_name] = None
            else:
                obj_dict[inc_name] = None
    return obj_dict


async def _upsert_thread(db: AsyncSession, thread_id_str: str):
    """Recompute Thread row from its emails. Creates thread if it doesn't exist."""
    if not thread_id_str:
        return

    # Aggregate from emails with this thread_id.
    # Exclude drafts from is_read computation — drafts are outgoing and shouldn't
    # make a thread appear "unread". A thread is unread if any non-draft email is unread.
    q = select(
        func.count(Email.id).label("cnt"),
        func.max(Email.date_sent).label("last_activity"),
        func.min(Email.subject).label("subject"),
        func.max(Email.case_id).label("case_id"),
    ).where(Email.thread_id == thread_id_str)
    row = (await db.execute(q)).one()

    # is_read: true only when all non-draft emails are read
    read_q = select(
        func.bool_and(Email.is_read).label("all_read"),
    ).where(
        Email.thread_id == thread_id_str,
        Email.status != "draft",
    )
    read_row = (await db.execute(read_q)).one()
    # If there are no non-draft emails, treat as read
    all_read = read_row.all_read if read_row.all_read is not None else True

    if row.cnt == 0:
        # No emails left — delete thread if it exists
        existing = await db.execute(
            select(Thread).where(Thread.thread_id == thread_id_str)
        )
        thread = existing.scalar_one_or_none()
        if thread:
            await db.delete(thread)
        return

    # Resolve contact_id and property_id from the latest email's from_address
    latest_email_q = (
        select(Email.from_address)
        .where(Email.thread_id == thread_id_str)
        .order_by(desc(Email.date_sent))
        .limit(1)
    )
    latest_from = (await db.execute(latest_email_q)).scalar_one_or_none()
    contact_id = None
    property_id = None
    if latest_from:
        contact_q = select(Contact).where(Contact.email == latest_from)
        contact = (await db.execute(contact_q)).scalar_one_or_none()
        if contact:
            contact_id = contact.id
            property_id = contact.property_id

    # Also try to get property_id from the case
    if not property_id and row.case_id:
        case_q = select(Case.property_id).where(Case.id == row.case_id)
        property_id = (await db.execute(case_q)).scalar_one_or_none()

    existing = await db.execute(
        select(Thread).where(Thread.thread_id == thread_id_str)
    )
    thread = existing.scalar_one_or_none()
    if thread:
        thread.subject = row.subject
        thread.last_activity_at = row.last_activity
        thread.email_count = row.cnt
        thread.is_read = bool(all_read)
        thread.case_id = row.case_id
        thread.contact_id = contact_id
        thread.property_id = property_id
        thread.updated_at = datetime.now(timezone.utc)
    else:
        thread = Thread(
            thread_id=thread_id_str,
            subject=row.subject,
            last_activity_at=row.last_activity,
            email_count=row.cnt,
            is_read=bool(all_read),
            case_id=row.case_id,
            contact_id=contact_id,
            property_id=property_id,
        )
        db.add(thread)


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(_app: FastAPI):
    log.info("Initialising database…")
    await init_db()
    log.info("Database ready")
    yield
    await engine.dispose()


app = FastAPI(title="PropTech CRM API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Fixed routes (must be defined BEFORE the generic {entity} routes)
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/counts")
async def counts(db: AsyncSession = Depends(get_db)):
    email_total = (
        await db.execute(select(func.count()).select_from(Email))
    ).scalar()
    open_tasks = (
        await db.execute(
            select(func.count()).select_from(Task).where(Task.status != "completed")
        )
    ).scalar()
    closed_cases = (
        await db.execute(
            select(func.count()).select_from(Case).where(Case.status == "closed")
        )
    ).scalar()
    return {
        "emails": email_total,
        "open_tasks": open_tasks,
        "closed_cases": closed_cases,
    }


# ---------------------------------------------------------------------------
# Shift endpoints
# ---------------------------------------------------------------------------
@app.get("/api/shift/next")
async def shift_next(db: AsyncSession = Depends(get_db)):
    """Return the next unread thread with full case context."""
    # Oldest unread thread first
    q = (
        select(Thread)
        .where(Thread.is_read == False)  # noqa: E712
        .order_by(asc(Thread.last_activity_at))
        .limit(1)
    )
    thread = (await db.execute(q)).scalar_one_or_none()
    if not thread:
        return {"thread": None, "case": None}

    thread_dict = serialize(thread)

    # Include emails and contact on the thread
    await _resolve_includes(db, "threads", thread_dict, ["emails", "contact"])

    # Build case context if thread has a case
    case_dict = None
    if thread.case_id:
        case_obj = (
            await db.execute(select(Case).where(Case.id == thread.case_id))
        ).scalar_one_or_none()
        if case_obj:
            case_dict = serialize(case_obj)
            await _resolve_includes(db, "cases", case_dict, ["emails", "tasks", "notes", "property"])

    return {"thread": thread_dict, "case": case_dict}


@app.post("/api/shift/complete")
async def shift_complete(request: Request, db: AsyncSession = Depends(get_db)):
    """Batch-mark emails as read and optionally link thread to a case.

    Body: {"email_ids": [1,2,3], "thread_id": "thread_001", "case_id": 5}
    """
    data = await request.json()
    email_ids = data.get("email_ids", [])
    thread_id_str = data.get("thread_id")
    case_id = data.get("case_id")

    updated = 0
    if email_ids:
        values = {"is_read": True, "updated_at": datetime.now(timezone.utc)}
        if case_id:
            values["case_id"] = case_id
        stmt = update(Email).where(Email.id.in_(email_ids)).values(**values)
        result = await db.execute(stmt)
        updated = result.rowcount

    # If case_id provided, also link the thread to the case
    if thread_id_str and case_id:
        thread_result = await db.execute(
            select(Thread).where(Thread.thread_id == thread_id_str)
        )
        thread = thread_result.scalar_one_or_none()
        if thread:
            thread.case_id = case_id
            thread.updated_at = datetime.now(timezone.utc)

    await db.commit()

    # Recompute thread state
    if thread_id_str:
        await _upsert_thread(db, thread_id_str)
        await db.commit()

    log.info("Shift complete: marked %d emails read, thread=%s case=%s", updated, thread_id_str, case_id)
    return {"emails_updated": updated}


# ---------------------------------------------------------------------------
# Bulk email update
# ---------------------------------------------------------------------------
@app.patch("/api/emails/bulk")
async def bulk_update_emails(request: Request, db: AsyncSession = Depends(get_db)):
    """Batch update emails by ID list.

    Body: {"ids": [1,2,3], "updates": {"is_read": true}}
    """
    data = await request.json()
    ids = data.get("ids", [])
    updates = data.get("updates", {})

    if not ids or not updates:
        raise HTTPException(400, "Both 'ids' and 'updates' are required")

    # Only allow valid Email columns
    valid_updates = {}
    for k, v in updates.items():
        if hasattr(Email, k) and k != "id":
            valid_updates[k] = _coerce_value(Email, k, v)
    valid_updates["updated_at"] = datetime.now(timezone.utc)

    stmt = update(Email).where(Email.id.in_(ids)).values(**valid_updates)
    result = await db.execute(stmt)
    await db.commit()

    # Recompute threads for affected emails
    thread_ids_q = select(Email.thread_id).where(Email.id.in_(ids)).distinct()
    thread_ids = (await db.execute(thread_ids_q)).scalars().all()
    for tid in thread_ids:
        if tid:
            await _upsert_thread(db, tid)
    await db.commit()

    log.info("Bulk updated %d emails", result.rowcount)
    return {"updated": result.rowcount}


# ---------------------------------------------------------------------------
# Generic CRUD routes
# ---------------------------------------------------------------------------
@app.get("/api/{entity}")
async def list_entities(
    entity: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, ge=1, le=500),
    offset: int = Query(0, ge=0),
    order_by: str = Query("created_at"),
    order: str = Query("desc"),
    search: str | None = Query(None),
    include: str | None = Query(None),
):
    model = ENTITIES.get(entity)
    if not model:
        raise HTTPException(404, f"Unknown entity: {entity}")

    query = select(model)
    count_query = select(func.count()).select_from(model)

    # Apply entity-specific filters from query params
    for field in FILTERS.get(entity, []):
        val = request.query_params.get(field)
        if val is not None:
            col = getattr(model, field, None)
            if col is not None:
                # Coerce query-param strings to column types
                if hasattr(col.type, "python_type"):
                    if col.type.python_type is bool:
                        val = val.lower() in ("true", "1", "yes")
                    elif col.type.python_type is int:
                        try:
                            val = int(val)
                        except (ValueError, TypeError):
                            raise HTTPException(
                                422, f"Invalid integer value for '{field}': {val}"
                            )
                query = query.where(col == val)
                count_query = count_query.where(col == val)

    # Date range filters: ?date_end_before=2026-03-20&date_end_after=2026-03-10
    for suffix, op in [("_before", "<="), ("_after", ">=")]:
        for date_field in ["date_end", "date_start", "date_sent"]:
            param_name = f"{date_field}{suffix}"
            val = request.query_params.get(param_name)
            if val is not None:
                col = getattr(model, date_field, None)
                if col is not None:
                    try:
                        dt_val = datetime.fromisoformat(val.replace("Z", "+00:00"))
                    except ValueError:
                        raise HTTPException(422, f"Invalid date for '{param_name}': {val}")
                    clause = col <= dt_val if op == "<=" else col >= dt_val
                    query = query.where(clause)
                    count_query = count_query.where(clause)

    # Full-text search (emails only)
    if search and entity == "emails":
        fts_filter = text(
            "to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(body,''))"
            " @@ plainto_tsquery('english', :search)"
        ).bindparams(search=search)
        query = query.where(fts_filter)
        count_query = count_query.where(fts_filter)

    # Ordering
    order_col = getattr(model, order_by, None) or model.created_at
    query = query.order_by(desc(order_col) if order == "desc" else asc(order_col))

    total = (await db.execute(count_query)).scalar()
    result = await db.execute(query.offset(offset).limit(limit))
    items = [serialize(row) for row in result.scalars().all()]

    # Resolve includes if requested
    if include:
        include_list = [s.strip() for s in include.split(",") if s.strip()]
        for item in items:
            await _resolve_includes(db, entity, item, include_list)

    return {"list": items, "total": total}


@app.get("/api/{entity}/{item_id}")
async def get_entity_by_id(
    entity: str,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    include: str | None = Query(None),
):
    model = ENTITIES.get(entity)
    if not model:
        raise HTTPException(404, f"Unknown entity: {entity}")

    result = await db.execute(select(model).where(model.id == item_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, f"{entity} {item_id} not found")

    obj_dict = serialize(obj)

    if include:
        include_list = [s.strip() for s in include.split(",") if s.strip()]
        await _resolve_includes(db, entity, obj_dict, include_list)

    return obj_dict


@app.post("/api/{entity}", status_code=201)
async def create_entity(
    entity: str, request: Request, db: AsyncSession = Depends(get_db)
):
    model = ENTITIES.get(entity)
    if not model:
        raise HTTPException(404, f"Unknown entity: {entity}")

    data = await request.json()
    # Only set attributes that exist on the model, coerce types
    valid = {
        k: _coerce_value(model, k, v)
        for k, v in data.items()
        if hasattr(model, k) and k != "id"
    }
    obj = model(**valid)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    log.info("Created %s %d", entity, obj.id)

    # Auto-upsert thread when an email is created
    if entity == "emails" and obj.thread_id:
        await _upsert_thread(db, obj.thread_id)
        await db.commit()

    return serialize(obj)


@app.patch("/api/{entity}/{item_id}")
async def update_entity(
    entity: str, item_id: int, request: Request, db: AsyncSession = Depends(get_db)
):
    model = ENTITIES.get(entity)
    if not model:
        raise HTTPException(404, f"Unknown entity: {entity}")

    result = await db.execute(select(model).where(model.id == item_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, f"{entity} {item_id} not found")

    data = await request.json()
    for k, v in data.items():
        if hasattr(obj, k) and k != "id":
            setattr(obj, k, _coerce_value(model, k, v))
    obj.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(obj)
    log.info("Updated %s %d", entity, obj.id)

    # Auto-upsert thread when an email is updated
    if entity == "emails" and obj.thread_id:
        await _upsert_thread(db, obj.thread_id)
        await db.commit()

    return serialize(obj)


@app.delete("/api/{entity}/{item_id}")
async def delete_entity_by_id(
    entity: str, item_id: int, db: AsyncSession = Depends(get_db)
):
    model = ENTITIES.get(entity)
    if not model:
        raise HTTPException(404, f"Unknown entity: {entity}")

    result = await db.execute(select(model).where(model.id == item_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, f"{entity} {item_id} not found")

    # Capture thread_id before deletion for upsert
    thread_id_str = getattr(obj, "thread_id", None) if entity == "emails" else None

    await db.delete(obj)
    await db.commit()
    log.info("Deleted %s %d", entity, item_id)

    if thread_id_str:
        await _upsert_thread(db, thread_id_str)
        await db.commit()

    return {"deleted": True}


@app.delete("/api/{entity}")
async def delete_all_of_entity(
    entity: str, db: AsyncSession = Depends(get_db)
):
    model = ENTITIES.get(entity)
    if not model:
        raise HTTPException(404, f"Unknown entity: {entity}")

    result = await db.execute(text(f"DELETE FROM {model.__tablename__}"))
    await db.commit()
    log.info("Deleted all %s (%d rows)", entity, result.rowcount)
    return {"deleted": True, "count": result.rowcount}
