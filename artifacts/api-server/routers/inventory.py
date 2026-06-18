import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import InventoryBalance, StockMovement, InventoryLedger, Product, Warehouse
from schemas import InventoryBalanceOut, StockMovementOut, MovementCreate

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

OUTWARD_TYPES = {"SALE", "DISPATCH", "TRANSFER_OUT", "DAMAGE", "EXPIRED"}


@router.get("")
def list_inventory(
    warehouse_id: Optional[int] = None,
    product_id: Optional[int] = None,
    low_stock: Optional[bool] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(InventoryBalance).join(Product).join(Warehouse)
    if warehouse_id:
        q = q.filter(InventoryBalance.warehouse_id == warehouse_id)
    if product_id:
        q = q.filter(InventoryBalance.product_id == product_id)
    if low_stock:
        q = q.filter(InventoryBalance.available_qty <= Product.minimum_stock)

    total = q.count()
    items = q.order_by(Product.product_name).offset((page - 1) * limit).limit(limit).all()
    return {"data": [InventoryBalanceOut.model_validate(i) for i in items], "total": total, "page": page, "limit": limit}


@router.get("/movements")
def list_movements(
    product_id: Optional[int] = None,
    warehouse_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(StockMovement).join(Product).join(Warehouse)
    if product_id:
        q = q.filter(StockMovement.product_id == product_id)
    if warehouse_id:
        q = q.filter(StockMovement.warehouse_id == warehouse_id)
    if movement_type:
        q = q.filter(StockMovement.movement_type == movement_type)

    total = q.count()
    items = q.order_by(StockMovement.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"data": [StockMovementOut.model_validate(m) for m in items], "total": total, "page": page, "limit": limit}


@router.post("/movements", status_code=201)
def create_movement(body: MovementCreate, db: Session = Depends(get_db)):
    # Idempotency check
    existing = db.query(StockMovement).filter(StockMovement.movement_id == body.movement_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Movement already processed (idempotency key exists)")

    # Get or create balance
    balance = db.query(InventoryBalance).filter(
        InventoryBalance.product_id == body.product_id,
        InventoryBalance.warehouse_id == body.warehouse_id,
    ).first()
    if not balance:
        balance = InventoryBalance(product_id=body.product_id, warehouse_id=body.warehouse_id)
        db.add(balance)
        db.flush()

    is_outward = body.movement_type in OUTWARD_TYPES
    if is_outward and balance.available_qty < body.qty:
        raise HTTPException(status_code=422, detail=f"Insufficient stock. Available: {balance.available_qty}, Requested: {body.qty}")

    opening_qty = balance.available_qty
    change_qty = -body.qty if is_outward else body.qty
    closing_qty = opening_qty + change_qty

    movement = StockMovement(**body.model_dump())
    db.add(movement)

    balance.available_qty = closing_qty
    if body.movement_type == "DAMAGE":
        balance.damaged_qty += body.qty
    if body.movement_type == "EXPIRED":
        balance.expired_qty += body.qty
    if body.movement_type == "RETURN":
        balance.returned_qty += body.qty

    ledger = InventoryLedger(
        product_id=body.product_id,
        warehouse_id=body.warehouse_id,
        movement_id=body.movement_id,
        opening_qty=opening_qty,
        change_qty=change_qty,
        closing_qty=closing_qty,
    )
    db.add(ledger)
    db.commit()
    db.refresh(movement)
    return StockMovementOut.model_validate(movement)
