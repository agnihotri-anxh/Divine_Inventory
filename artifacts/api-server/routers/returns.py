import uuid
import time
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import Return, InventoryBalance, StockMovement, InventoryLedger
from schemas import ReturnOut, ReturnCreate, ReturnQcUpdate

router = APIRouter(prefix="/api/returns", tags=["returns"])


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
def list_returns(
    qc_status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Return)
    if qc_status:
        q = q.filter(Return.qc_status == qc_status)

    total = q.count()
    items = q.order_by(Return.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"data": [ReturnOut.model_validate(r) for r in items], "total": total, "page": page, "limit": limit}


@router.post("", status_code=201)
def create_return(body: ReturnCreate, db: Session = Depends(get_db)):
    return_number = f"RET-{int(time.time() * 1000)}"
    ret = Return(
        return_number=return_number,
        product_id=body.product_id,
        warehouse_id=body.warehouse_id,
        qty=body.qty,
        return_reason=body.return_reason,
        order_id=body.order_id,
        qc_status="PENDING",
    )
    db.add(ret)
    db.flush()

    balance = _ensure_balance(db, body.product_id, body.warehouse_id)
    movement_id = str(uuid.uuid4())
    db.add(StockMovement(
        movement_id=movement_id,
        product_id=body.product_id,
        warehouse_id=body.warehouse_id,
        movement_type="RETURN",
        qty=body.qty,
        reference_type="return",
        reference_id=return_number,
    ))
    balance.returned_qty += body.qty
    db.add(InventoryLedger(
        product_id=body.product_id,
        warehouse_id=body.warehouse_id,
        movement_id=movement_id,
        opening_qty=balance.available_qty,
        change_qty=0,
        closing_qty=balance.available_qty,
    ))
    db.commit()
    db.refresh(ret)
    return ReturnOut.model_validate(ret)


@router.patch("/{id}/qc")
def update_return_qc(id: int, body: ReturnQcUpdate, db: Session = Depends(get_db)):
    ret = db.query(Return).filter(Return.id == id).first()
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    ret.qc_status = body.qc_status
    balance = _ensure_balance(db, ret.product_id, ret.warehouse_id)

    movement_type = "INWARD" if body.qc_status == "GOOD" else ("DAMAGE" if body.qc_status == "DAMAGED" else "EXPIRED")
    movement_id = str(uuid.uuid4())
    change_qty = ret.qty if body.qc_status == "GOOD" else 0

    db.add(StockMovement(
        movement_id=movement_id,
        product_id=ret.product_id,
        warehouse_id=ret.warehouse_id,
        movement_type=movement_type,
        qty=ret.qty,
        reference_type="return",
        reference_id=ret.return_number,
    ))

    opening_qty = balance.available_qty
    closing_qty = opening_qty + change_qty

    if body.qc_status == "GOOD":
        balance.available_qty = closing_qty
    elif body.qc_status == "DAMAGED":
        balance.damaged_qty += ret.qty
    else:
        balance.expired_qty += ret.qty
    balance.returned_qty = max(0, balance.returned_qty - ret.qty)

    db.add(InventoryLedger(
        product_id=ret.product_id,
        warehouse_id=ret.warehouse_id,
        movement_id=movement_id,
        opening_qty=opening_qty,
        change_qty=change_qty,
        closing_qty=closing_qty,
    ))
    db.commit()
    db.refresh(ret)
    return ReturnOut.model_validate(ret)
