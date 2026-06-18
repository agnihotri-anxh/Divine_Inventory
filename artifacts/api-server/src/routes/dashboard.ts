import { Router } from "express";
import { eq, lte, sql } from "drizzle-orm";
import { db, productsTable, inventoryBalanceTable, warehousesTable, returnsTable, salesOrdersTable, stockReconciliationTable, alertsTable, stockMovementsTable } from "@workspace/db";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalSkus, lowStock, pendingDispatches, todayReturns, pendingQc, pendingRecon, totalUnits, activeAlerts] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(eq(productsTable.isActive, true)),
    db.select({ count: sql<number>`count(*)::int` }).from(inventoryBalanceTable).innerJoin(productsTable, eq(inventoryBalanceTable.productId, productsTable.id)).where(lte(inventoryBalanceTable.availableQty, productsTable.minimumStock)),
    db.select({ count: sql<number>`count(*)::int` }).from(salesOrdersTable).where(eq(salesOrdersTable.status, "CONFIRMED")),
    db.select({ count: sql<number>`count(*)::int` }).from(returnsTable).where(sql`${returnsTable.createdAt} >= ${today}`),
    db.select({ count: sql<number>`count(*)::int` }).from(returnsTable).where(eq(returnsTable.qcStatus, "PENDING")),
    db.select({ count: sql<number>`count(*)::int` }).from(stockReconciliationTable).where(eq(stockReconciliationTable.status, "PENDING")),
    db.select({ total: sql<number>`coalesce(sum(available_qty), 0)::int` }).from(inventoryBalanceTable),
    db.select({ count: sql<number>`count(*)::int` }).from(alertsTable).where(eq(alertsTable.status, "ACTIVE")),
  ]);

  res.json({
    totalSkus: totalSkus[0].count,
    lowStockCount: lowStock[0].count,
    pendingDispatches: pendingDispatches[0].count,
    todayReturns: todayReturns[0].count,
    pendingQcCount: pendingQc[0].count,
    pendingReconciliations: pendingRecon[0].count,
    totalAvailableUnits: totalUnits[0].total,
    activeAlerts: activeAlerts[0].count,
  });
});

router.get("/dashboard/low-stock", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      productId: productsTable.id,
      skuCode: productsTable.skuCode,
      productName: productsTable.productName,
      warehouseId: warehousesTable.id,
      warehouseName: warehousesTable.warehouseName,
      availableQty: inventoryBalanceTable.availableQty,
      minimumStock: productsTable.minimumStock,
      reorderStock: productsTable.reorderStock,
    })
    .from(inventoryBalanceTable)
    .innerJoin(productsTable, eq(inventoryBalanceTable.productId, productsTable.id))
    .innerJoin(warehousesTable, eq(inventoryBalanceTable.warehouseId, warehousesTable.id))
    .where(lte(inventoryBalanceTable.availableQty, productsTable.minimumStock))
    .orderBy(inventoryBalanceTable.availableQty);

  res.json(rows);
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const query = GetRecentActivityQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const limit = query.data.limit ?? 20;

  const rows = await db
    .select({
      id: stockMovementsTable.id,
      movementId: stockMovementsTable.movementId,
      productId: stockMovementsTable.productId,
      warehouseId: stockMovementsTable.warehouseId,
      movementType: stockMovementsTable.movementType,
      qty: stockMovementsTable.qty,
      referenceType: stockMovementsTable.referenceType,
      referenceId: stockMovementsTable.referenceId,
      sourceLocation: stockMovementsTable.sourceLocation,
      destinationLocation: stockMovementsTable.destinationLocation,
      createdBy: stockMovementsTable.createdBy,
      createdAt: stockMovementsTable.createdAt,
      product: {
        id: productsTable.id,
        skuCode: productsTable.skuCode,
        productName: productsTable.productName,
        category: productsTable.category,
        brand: productsTable.brand,
        unit: productsTable.unit,
        minimumStock: productsTable.minimumStock,
        reorderStock: productsTable.reorderStock,
        isActive: productsTable.isActive,
        createdAt: productsTable.createdAt,
        updatedAt: productsTable.updatedAt,
      },
      warehouse: {
        id: warehousesTable.id,
        warehouseName: warehousesTable.warehouseName,
        location: warehousesTable.location,
        warehouseType: warehousesTable.warehouseType,
        createdAt: warehousesTable.createdAt,
      },
    })
    .from(stockMovementsTable)
    .innerJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
    .innerJoin(warehousesTable, eq(stockMovementsTable.warehouseId, warehousesTable.id))
    .orderBy(sql`${stockMovementsTable.createdAt} desc`)
    .limit(limit);

  res.json(rows);
});

router.get("/dashboard/warehouse-breakdown", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      warehouseId: warehousesTable.id,
      warehouseName: warehousesTable.warehouseName,
      warehouseType: warehousesTable.warehouseType,
      totalAvailable: sql<number>`coalesce(sum(${inventoryBalanceTable.availableQty}), 0)::int`,
      totalReserved: sql<number>`coalesce(sum(${inventoryBalanceTable.reservedQty}), 0)::int`,
      totalDamaged: sql<number>`coalesce(sum(${inventoryBalanceTable.damagedQty}), 0)::int`,
      skuCount: sql<number>`count(${inventoryBalanceTable.id})::int`,
    })
    .from(warehousesTable)
    .leftJoin(inventoryBalanceTable, eq(warehousesTable.id, inventoryBalanceTable.warehouseId))
    .groupBy(warehousesTable.id, warehousesTable.warehouseName, warehousesTable.warehouseType)
    .orderBy(warehousesTable.warehouseName);

  res.json(rows);
});

export default router;
