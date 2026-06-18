import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import products, warehouses, inventory, ledger, orders, returns, reconciliation, alerts, dashboard

app = FastAPI(title="Divine Hindu Inventory API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(warehouses.router)
app.include_router(inventory.router)
app.include_router(ledger.router)
app.include_router(orders.router)
app.include_router(returns.router)
app.include_router(reconciliation.router)
app.include_router(alerts.router)
app.include_router(dashboard.router)


@app.get("/api/healthz")
def health():
    return {"status": "ok"}
