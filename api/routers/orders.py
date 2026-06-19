import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import SalesOrder, SalesOrderItem, InventoryBalance, StockMovement, InventoryLedger, Product
from schemas import OrderOut, OrderCreate
import time

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("")
def list_orders(
    status: Optional[str] = None,
    channel: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(SalesOrder)
    if status:
        q = q.filter(SalesOrder.status == status)
    if channel:
        q = q.filter(SalesOrder.channel == channel)

    total = q.count()
    items = q.order_by(SalesOrder.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"data": [OrderOut.model_validate(o) for o in items], "total": total, "page": page, "limit": limit}


@router.post("", status_code=201)
def create_order(body: OrderCreate, db: Session = Depends(get_db)):
    # Verify stock
    for item in body.items:
        balance = db.query(InventoryBalance).filter(
            InventoryBalance.product_id == item.product_id,
            InventoryBalance.warehouse_id == item.warehouse_id,
        ).first()
        if not balance or balance.available_qty < item.qty:
            avail = balance.available_qty if balance else 0
            raise HTTPException(status_code=422, detail=f"Insufficient stock for product {item.product_id}. Available: {avail}, Requested: {item.qty}")

    order_no = f"ORD-{int(time.time() * 1000)}"
    order = SalesOrder(order_no=order_no, channel=body.channel, status="CONFIRMED")
    db.add(order)
    db.flush()

    for item in body.items:
        db.add(SalesOrderItem(order_id=order.id, product_id=item.product_id, warehouse_id=item.warehouse_id, qty=item.qty))

        balance = db.query(InventoryBalance).filter(
            InventoryBalance.product_id == item.product_id,
            InventoryBalance.warehouse_id == item.warehouse_id,
        ).first()
        opening_qty = balance.available_qty
        closing_qty = opening_qty - item.qty
        movement_id = str(uuid.uuid4())

        db.add(StockMovement(
            movement_id=movement_id,
            product_id=item.product_id,
            warehouse_id=item.warehouse_id,
            movement_type="SALE",
            qty=item.qty,
            reference_type="order",
            reference_id=order_no,
        ))
        balance.available_qty = closing_qty
        db.add(InventoryLedger(
            product_id=item.product_id,
            warehouse_id=item.warehouse_id,
            movement_id=movement_id,
            opening_qty=opening_qty,
            change_qty=-item.qty,
            closing_qty=closing_qty,
        ))

    db.commit()
    db.refresh(order)
    return OrderOut.model_validate(order)


@router.get("/{id}")
def get_order(id: int, db: Session = Depends(get_db)):
    order = db.query(SalesOrder).filter(SalesOrder.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderOut.model_validate(order)
