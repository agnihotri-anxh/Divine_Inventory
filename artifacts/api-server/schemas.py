from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ProductOut(BaseModel):
    id: int
    sku_code: str
    product_name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    unit: str
    minimum_stock: int
    reorder_stock: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    sku_code: str
    product_name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    unit: str = "PCS"
    minimum_stock: int = 0
    reorder_stock: int = 0


class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    unit: Optional[str] = None
    minimum_stock: Optional[int] = None
    reorder_stock: Optional[int] = None
    is_active: Optional[bool] = None


class WarehouseOut(BaseModel):
    id: int
    warehouse_name: str
    location: Optional[str] = None
    warehouse_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class WarehouseCreate(BaseModel):
    warehouse_name: str
    location: Optional[str] = None
    warehouse_type: str = "MAIN"


class InventoryBalanceOut(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    available_qty: int
    reserved_qty: int
    damaged_qty: int
    expired_qty: int
    returned_qty: int
    last_updated: datetime
    product: ProductOut
    warehouse: WarehouseOut

    class Config:
        from_attributes = True


class StockMovementOut(BaseModel):
    id: int
    movement_id: str
    product_id: int
    warehouse_id: int
    movement_type: str
    qty: int
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    source_location: Optional[str] = None
    destination_location: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    product: ProductOut
    warehouse: WarehouseOut

    class Config:
        from_attributes = True


class MovementCreate(BaseModel):
    movement_id: str
    product_id: int
    warehouse_id: int
    movement_type: str
    qty: int
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    source_location: Optional[str] = None
    destination_location: Optional[str] = None
    created_by: Optional[str] = None


class LedgerOut(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    movement_id: str
    opening_qty: int
    change_qty: int
    closing_qty: int
    transaction_time: datetime
    product: ProductOut
    warehouse: WarehouseOut

    class Config:
        from_attributes = True


class OrderItemCreate(BaseModel):
    product_id: int
    warehouse_id: int
    qty: int


class OrderCreate(BaseModel):
    channel: str = "MANUAL"
    items: List[OrderItemCreate]


class OrderItemOut(BaseModel):
    id: int
    order_id: int
    product_id: int
    warehouse_id: int
    qty: int
    product: ProductOut

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    order_no: str
    channel: str
    status: str
    created_at: datetime
    items: List[OrderItemOut] = []

    class Config:
        from_attributes = True


class ReturnCreate(BaseModel):
    product_id: int
    warehouse_id: int
    qty: int
    return_reason: Optional[str] = None
    order_id: Optional[int] = None


class ReturnQcUpdate(BaseModel):
    qc_status: str


class ReturnOut(BaseModel):
    id: int
    return_number: str
    order_id: Optional[int] = None
    product_id: int
    warehouse_id: int
    qty: int
    return_reason: Optional[str] = None
    qc_status: str
    created_at: datetime
    product: ProductOut
    warehouse: WarehouseOut

    class Config:
        from_attributes = True


class ReconciliationCreate(BaseModel):
    product_id: int
    warehouse_id: int
    physical_qty: int


class ReconciliationOut(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    system_qty: int
    physical_qty: int
    variance: int
    status: str
    created_at: datetime
    product: ProductOut
    warehouse: WarehouseOut

    class Config:
        from_attributes = True


class AlertOut(BaseModel):
    id: int
    product_id: int
    alert_type: str
    current_stock: Optional[int] = None
    threshold: Optional[int] = None
    status: str
    created_at: datetime
    product: ProductOut

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    data: list
    total: int
    page: int
    limit: int


class DashboardSummary(BaseModel):
    total_skus: int
    low_stock_count: int
    pending_dispatches: int
    today_returns: int
    pending_qc_count: int
    pending_reconciliations: int
    total_available_units: int
    active_alerts: int
