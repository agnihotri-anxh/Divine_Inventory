from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import Alert
from schemas import AlertOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
def list_alerts(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Alert)
    if status:
        q = q.filter(Alert.status == status)

    total = q.count()
    items = q.order_by(Alert.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"data": [AlertOut.model_validate(a) for a in items], "total": total, "page": page, "limit": limit}
