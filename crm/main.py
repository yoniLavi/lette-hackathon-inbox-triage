"""CRM API — lightweight FastAPI service for PropTech email triage."""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import asc, desc, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from database import engine, get_db, init_db
from models import Case, Contact, Email, Note, Property, Task

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
    from sqlalchemy import DateTime, Boolean
    if isinstance(col.type, DateTime) and isinstance(value, str):
        from datetime import datetime as dt
        # Parse ISO 8601 strings
        value = value.replace("Z", "+00:00")
        return dt.fromisoformat(value)
    return value


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
                        val = int(val)
                query = query.where(col == val)
                count_query = count_query.where(col == val)

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

    return {"list": items, "total": total}


@app.get("/api/{entity}/{item_id}")
async def get_entity_by_id(
    entity: str, item_id: int, db: AsyncSession = Depends(get_db)
):
    model = ENTITIES.get(entity)
    if not model:
        raise HTTPException(404, f"Unknown entity: {entity}")

    result = await db.execute(select(model).where(model.id == item_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, f"{entity} {item_id} not found")
    return serialize(obj)


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

    await db.delete(obj)
    await db.commit()
    log.info("Deleted %s %d", entity, item_id)
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
