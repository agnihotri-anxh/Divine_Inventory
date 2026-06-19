from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Warehouse
from schemas import WarehouseOut, WarehouseCreate

router = APIRouter(prefix="/api/warehouses", tags=["warehouses"])


@router.get("")
def list_warehouses(db: Session = Depends(get_db)):
    items = db.query(Warehouse).order_by(Warehouse.warehouse_name).all()
    return [WarehouseOut.model_validate(w) for w in items]


@router.post("", status_code=201)
def create_warehouse(body: WarehouseCreate, db: Session = Depends(get_db)):
    warehouse = Warehouse(**body.model_dump())
    db.add(warehouse)
    db.commit()
    db.refresh(warehouse)
    return WarehouseOut.model_validate(warehouse)


@router.get("/{id}")
def get_warehouse(id: int, db: Session = Depends(get_db)):
    warehouse = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return WarehouseOut.model_validate(warehouse)
