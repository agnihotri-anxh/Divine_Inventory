from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import relationship
from database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    sku_code = Column(String, unique=True, nullable=False)
    product_name = Column(String, nullable=False)
    category = Column(String)
    brand = Column(String)
    unit = Column(String, default="PCS")
    minimum_stock = Column(Integer, default=0)
    reorder_stock = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True)
    warehouse_name = Column(String, nullable=False)
    location = Column(String)
    warehouse_type = Column(String, default="MAIN")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InventoryBalance(Base):
    __tablename__ = "inventory_balance"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    available_qty = Column(Integer, default=0)
    reserved_qty = Column(Integer, default=0)
    damaged_qty = Column(Integer, default=0)
    expired_qty = Column(Integer, default=0)
    returned_qty = Column(Integer, default=0)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    product = relationship("Product", lazy="joined")
    warehouse = relationship("Warehouse", lazy="joined")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True)
    movement_id = Column(String, unique=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    movement_type = Column(String, nullable=False)
    qty = Column(Integer, nullable=False)
    reference_type = Column(String)
    reference_id = Column(String)
    source_location = Column(String)
    destination_location = Column(String)
    created_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", lazy="joined")
    warehouse = relationship("Warehouse", lazy="joined")


class InventoryLedger(Base):
    __tablename__ = "inventory_ledger"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    movement_id = Column(String, nullable=False)
    opening_qty = Column(Integer, nullable=False)
    change_qty = Column(Integer, nullable=False)
    closing_qty = Column(Integer, nullable=False)
    transaction_time = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", lazy="joined")
    warehouse = relationship("Warehouse", lazy="joined")


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id = Column(Integer, primary_key=True)
    order_no = Column(String, unique=True, nullable=False)
    channel = Column(String, default="MANUAL")
    status = Column(String, default="CONFIRMED")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("SalesOrderItem", back_populates="order", lazy="joined")


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    qty = Column(Integer, nullable=False)

    order = relationship("SalesOrder", back_populates="items")
    product = relationship("Product", lazy="joined")
    warehouse = relationship("Warehouse", lazy="joined")


class Return(Base):
    __tablename__ = "returns"

    id = Column(Integer, primary_key=True)
    return_number = Column(String, unique=True, nullable=False)
    order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    qty = Column(Integer, nullable=False)
    return_reason = Column(Text)
    qc_status = Column(String, default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", lazy="joined")
    warehouse = relationship("Warehouse", lazy="joined")


class StockReconciliation(Base):
    __tablename__ = "stock_reconciliation"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    system_qty = Column(Integer, nullable=False)
    physical_qty = Column(Integer, nullable=False)
    variance = Column(Integer, nullable=False)
    status = Column(String, default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", lazy="joined")
    warehouse = relationship("Warehouse", lazy="joined")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    alert_type = Column(String, nullable=False)
    current_stock = Column(Integer)
    threshold = Column(Integer)
    status = Column(String, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", lazy="joined")
