import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import StockReconciliation, InventoryBalance, StockMovement, InventoryLedger
from schemas import ReconciliationOut, ReconciliationCreate

router = APIRouter(prefix="/api/reconciliation", tags=["reconciliation"])


def _ensure_balance(db, product_id, warehouse_id):
    balance = db.query(InventoryBalance).filter(
        InventoryBalance.product_id == product_id,
        InventoryBalance.warehouse_id == warehouse_id,
    ).first()
    if not balance:
        balance = InventoryBalance(product_id=product_id, warehouse_id=warehouse_id)
        db.add(balance)
        db.flush()
    return balance


@router.get("")
def list_reconciliation(
    status: Optional[str] = None,
    warehouse_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(StockReconciliation)
    if status:
        q = q.filter(StockReconciliation.status == status)
    if warehouse_id:
        q = q.filter(StockReconciliation.warehouse_id == warehouse_id)

    total = q.count()
    items = q.order_by(StockReconciliation.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"data": [ReconciliationOut.model_validate(r) for r in items], "total": total, "page": page, "limit": limit}


@router.post("", status_code=201)
def create_reconciliation(body: ReconciliationCreate, db: Session = Depends(get_db)):
    balance = _ensure_balance(db, body.product_id, body.warehouse_id)
    system_qty = balance.available_qty
    variance = body.physical_qty - system_qty

    rec = StockReconciliation(
        product_id=body.product_id,
        warehouse_id=body.warehouse_id,
        system_qty=system_qty,
        physical_qty=body.physical_qty,
        variance=variance,
        status="PENDING",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return ReconciliationOut.model_validate(rec)


@router.patch("/{id}/approve")
def approve_reconciliation(id: int, db: Session = Depends(get_db)):
    rec = db.query(StockReconciliation).filter(StockReconciliation.id == id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Reconciliation not found")
    if rec.status == "APPROVED":
        raise HTTPException(status_code=400, detail="Already approved")

    if rec.variance != 0:
        balance = _ensure_balance(db, rec.product_id, rec.warehouse_id)
        movement_id = str(uuid.uuid4())
        opening_qty = balance.available_qty
        closing_qty = opening_qty + rec.variance

        db.add(StockMovement(
            movement_id=movement_id,
            product_id=rec.product_id,
            warehouse_id=rec.warehouse_id,
            movement_type="ADJUSTMENT",
            qty=abs(rec.variance),
            reference_type="reconciliation",
            reference_id=str(rec.id),
        ))
        balance.available_qty = closing_qty
        db.add(InventoryLedger(
            product_id=rec.product_id,
            warehouse_id=rec.warehouse_id,
            movement_id=movement_id,
            opening_qty=opening_qty,
            change_qty=rec.variance,
            closing_qty=closing_qty,
        ))

    rec.status = "APPROVED"
    db.commit()
    db.refresh(rec)
    return ReconciliationOut.model_validate(rec)
