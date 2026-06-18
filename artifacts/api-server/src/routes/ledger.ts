import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, inventoryLedgerTable, productsTable, warehousesTable } from "@workspace/db";
import { ListLedgerQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/ledger", async (req, res): Promise<void> => {
  const query = ListLedgerQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { productId, warehouseId, page = 1, limit = 50 } = query.data;
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: inventoryLedgerTable.id,
      productId: inventoryLedgerTable.productId,
      warehouseId: inventoryLedgerTable.warehouseId,
      movementId: inventoryLedgerTable.movementId,
      openingQty: inventoryLedgerTable.openingQty,
      changeQty: inventoryLedgerTable.changeQty,
      closingQty: inventoryLedgerTable.closingQty,
      transactionTime: inventoryLedgerTable.transactionTime,
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
    .from(inventoryLedgerTable)
    .innerJoin(productsTable, eq(inventoryLedgerTable.productId, productsTable.id))
    .innerJoin(warehousesTable, eq(inventoryLedgerTable.warehouseId, warehousesTable.id))
    .where(
      and(
        productId ? eq(inventoryLedgerTable.productId, productId) : undefined,
        warehouseId ? eq(inventoryLedgerTable.warehouseId, warehouseId) : undefined,
      )
    )
    .orderBy(sql`${inventoryLedgerTable.transactionTime} desc`)
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inventoryLedgerTable)
    .where(
      and(
        productId ? eq(inventoryLedgerTable.productId, productId) : undefined,
        warehouseId ? eq(inventoryLedgerTable.warehouseId, warehouseId) : undefined,
      )
    );

  res.json({ data: rows, total: countResult[0].count, page, limit });
});

export default router;
