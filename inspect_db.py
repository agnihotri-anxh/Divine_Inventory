import os
import sys
from dotenv import load_dotenv

# Add the api-server directory to sys.path to resolve local imports
api_server_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "artifacts/api-server"))
sys.path.insert(0, api_server_path)

from database import SessionLocal
from models import Product, InventoryBalance, Warehouse, Return, SalesOrder, StockReconciliation, Alert
from sqlalchemy import func

load_dotenv()
db = SessionLocal()

try:
    total_skus = db.query(func.count(Product.id)).filter(Product.is_active == True).scalar() or 0
    low_stock_count = db.query(func.count(InventoryBalance.id)).join(Product).filter(
        InventoryBalance.available_qty <= Product.minimum_stock
    ).scalar() or 0
    pending_dispatches = db.query(func.count(SalesOrder.id)).filter(SalesOrder.status == "CONFIRMED").scalar() or 0
    pending_qc = db.query(func.count(Return.id)).filter(Return.qc_status == "PENDING").scalar() or 0
    pending_recon = db.query(func.count(StockReconciliation.id)).filter(StockReconciliation.status == "PENDING").scalar() or 0
    total_units = db.query(func.coalesce(func.sum(InventoryBalance.available_qty), 0)).scalar() or 0
    active_alerts = db.query(func.count(Alert.id)).filter(Alert.status == "ACTIVE").scalar() or 0

    print("Dashboard Summary Query Results:")
    print(f"- total_skus: {total_skus}")
    print(f"- low_stock_count: {low_stock_count}")
    print(f"- pending_dispatches: {pending_dispatches}")
    print(f"- pending_qc: {pending_qc}")
    print(f"- pending_recon: {pending_recon}")
    print(f"- total_units: {total_units}")
    print(f"- active_alerts: {active_alerts}")
    
    # Query warehouses
    warehouses = db.query(Warehouse).all()
    print(f"Warehouses in DB ({len(warehouses)} total):")
    for w in warehouses:
        print(f"  - ID: {w.id}, Name: {w.warehouse_name}, Type: {w.warehouse_type}")
        
except Exception as e:
    print("Error querying database:")
    import traceback
    traceback.print_exc()
finally:
    db.close()

