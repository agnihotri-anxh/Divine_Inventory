from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Optional
from datetime import date, datetime, timezone
from database import get_db
from models import Product, InventoryBalance, Warehouse, Return, SalesOrder, StockReconciliation, Alert, StockMovement
from schemas import DashboardSummary, StockMovementOut

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    today_start = datetime.combine(date.today(), datetime.min.time())

    total_skus = db.query(func.count(Product.id)).filter(Product.is_active == True).scalar() or 0
    low_stock_count = db.query(func.count(InventoryBalance.id)).join(Product).filter(
        InventoryBalance.available_qty <= Product.minimum_stock
    ).scalar() or 0
    pending_dispatches = db.query(func.count(SalesOrder.id)).filter(SalesOrder.status == "CONFIRMED").scalar() or 0
    today_returns = db.query(func.count(Return.id)).filter(Return.created_at >= today_start).scalar() or 0
    pending_qc = db.query(func.count(Return.id)).filter(Return.qc_status == "PENDING").scalar() or 0
    pending_recon = db.query(func.count(StockReconciliation.id)).filter(StockReconciliation.status == "PENDING").scalar() or 0
    total_units = db.query(func.coalesce(func.sum(InventoryBalance.available_qty), 0)).scalar() or 0
    active_alerts = db.query(func.count(Alert.id)).filter(Alert.status == "ACTIVE").scalar() or 0

    return DashboardSummary(
        total_skus=total_skus,
        low_stock_count=low_stock_count,
        pending_dispatches=pending_dispatches,
        today_returns=today_returns,
        pending_qc_count=pending_qc,
        pending_reconciliations=pending_recon,
        total_available_units=total_units,
        active_alerts=active_alerts,
    )


@router.get("/low-stock")
def get_low_stock(db: Session = Depends(get_db)):
    rows = (
        db.query(InventoryBalance, Product, Warehouse)
        .join(Product, InventoryBalance.product_id == Product.id)
        .join(Warehouse, InventoryBalance.warehouse_id == Warehouse.id)
        .filter(InventoryBalance.available_qty <= Product.minimum_stock)
        .order_by(InventoryBalance.available_qty)
        .all()
    )
    return [
        {
            "product_id": p.id,
            "sku_code": p.sku_code,
            "product_name": p.product_name,
            "warehouse_id": w.id,
            "warehouse_name": w.warehouse_name,
            "available_qty": b.available_qty,
            "minimum_stock": p.minimum_stock,
            "reorder_stock": p.reorder_stock,
        }
        for b, p, w in rows
    ]


@router.get("/recent-activity")
def get_recent_activity(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    items = (
        db.query(StockMovement)
        .order_by(StockMovement.created_at.desc())
        .limit(limit)
        .all()
    )
    return [StockMovementOut.model_validate(m) for m in items]


@router.get("/warehouse-breakdown")
def get_warehouse_breakdown(db: Session = Depends(get_db)):
    rows = (
        db.query(
            Warehouse,
            func.coalesce(func.sum(InventoryBalance.available_qty), 0).label("total_available"),
            func.coalesce(func.sum(InventoryBalance.reserved_qty), 0).label("total_reserved"),
            func.coalesce(func.sum(InventoryBalance.damaged_qty), 0).label("total_damaged"),
            func.count(InventoryBalance.id).label("sku_count"),
        )
        .outerjoin(InventoryBalance, Warehouse.id == InventoryBalance.warehouse_id)
        .group_by(Warehouse.id)
        .order_by(Warehouse.warehouse_name)
        .all()
    )
    return [
        {
            "warehouse_id": w.id,
            "warehouse_name": w.warehouse_name,
            "warehouse_type": w.warehouse_type,
            "total_available": total_available,
            "total_reserved": total_reserved,
            "total_damaged": total_damaged,
            "sku_count": sku_count,
        }
        for w, total_available, total_reserved, total_damaged, sku_count in rows
    ]
