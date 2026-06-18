from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import InventoryLedger, Product, Warehouse
from schemas import LedgerOut

router = APIRouter(prefix="/api/ledger", tags=["ledger"])


@router.get("")
def list_ledger(
    product_id: Optional[int] = None,
    warehouse_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(InventoryLedger).join(Product).join(Warehouse)
    if product_id:
        q = q.filter(InventoryLedger.product_id == product_id)
    if warehouse_id:
        q = q.filter(InventoryLedger.warehouse_id == warehouse_id)

    total = q.count()
    items = q.order_by(InventoryLedger.transaction_time.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"data": [LedgerOut.model_validate(i) for i in items], "total": total, "page": page, "limit": limit}
