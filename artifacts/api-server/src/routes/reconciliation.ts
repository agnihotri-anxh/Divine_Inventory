import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, stockReconciliationTable, productsTable, warehousesTable, inventoryBalanceTable, stockMovementsTable, inventoryLedgerTable } from "@workspace/db";
import { ListReconciliationQueryParams, CreateReconciliationBody, ApproveReconciliationParams } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router();

const withJoins = (whereClause: any, page: number, limit: number) =>
  db.select({
    id: stockReconciliationTable.id,
    productId: stockReconciliationTable.productId,
    warehouseId: stockReconciliationTable.warehouseId,
    systemQty: stockReconciliationTable.systemQty,
    physicalQty: stockReconciliationTable.physicalQty,
    variance: stockReconciliationTable.variance,
    status: stockReconciliationTable.status,
    createdAt: stockReconciliationTable.createdAt,
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
  .from(stockReconciliationTable)
  .innerJoin(productsTable, eq(stockReconciliationTable.productId, productsTable.id))
  .innerJoin(warehousesTable, eq(stockReconciliationTable.warehouseId, warehousesTable.id))
  .where(whereClause)
  .orderBy(sql`${stockReconciliationTable.createdAt} desc`)
  .limit(limit)
  .offset((page - 1) * limit);

router.get("/reconciliation", async (req, res): Promise<void> => {
  const query = ListReconciliationQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { status, warehouseId, page = 1, limit = 50 } = query.data;
  const whereClause = and(
    status ? eq(stockReconciliationTable.status, status) : undefined,
    warehouseId ? eq(stockReconciliationTable.warehouseId, warehouseId) : undefined,
  );

  const [data, countResult] = await Promise.all([
    withJoins(whereClause, page, limit),
    db.select({ count: sql<number>`count(*)::int` }).from(stockReconciliationTable).where(whereClause),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

router.post("/reconciliation", async (req, res): Promise<void> => {
  const parsed = CreateReconciliationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { productId, warehouseId, physicalQty } = parsed.data;

  let [balance] = await db.select().from(inventoryBalanceTable).where(
    and(eq(inventoryBalanceTable.productId, productId), eq(inventoryBalanceTable.warehouseId, warehouseId))
  );
  if (!balance) {
    const [created] = await db.insert(inventoryBalanceTable).values({ productId, warehouseId }).returning();
    balance = created;
  }

  const systemQty = balance.availableQty;
  const variance = physicalQty - systemQty;

  const [rec] = await db.insert(stockReconciliationTable).values({
    productId,
    warehouseId,
    systemQty,
    physicalQty,
    variance,
    status: "PENDING",
  }).returning();

  const [result] = await withJoins(eq(stockReconciliationTable.id, rec.id), 1, 1);
  res.status(201).json(result);
});

router.patch("/reconciliation/:id/approve", async (req, res): Promise<void> => {
  const params = ApproveReconciliationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [rec] = await db.select().from(stockReconciliationTable).where(eq(stockReconciliationTable.id, params.data.id));
  if (!rec) {
    res.status(404).json({ error: "Reconciliation not found" });
    return;
  }
  if (rec.status === "APPROVED") {
    res.status(400).json({ error: "Already approved" });
    return;
  }

  // Apply ADJUSTMENT movement
  if (rec.variance !== 0) {
    const movementId = randomUUID();
    let [balance] = await db.select().from(inventoryBalanceTable).where(
      and(eq(inventoryBalanceTable.productId, rec.productId), eq(inventoryBalanceTable.warehouseId, rec.warehouseId))
    );
    if (!balance) {
      const [created] = await db.insert(inventoryBalanceTable).values({ productId: rec.productId, warehouseId: rec.warehouseId }).returning();
      balance = created;
    }

    const openingQty = balance.availableQty;
    const closingQty = openingQty + rec.variance;

    await db.insert(stockMovementsTable).values({
      movementId,
      productId: rec.productId,
      warehouseId: rec.warehouseId,
      movementType: "ADJUSTMENT",
      qty: Math.abs(rec.variance),
      referenceType: "reconciliation",
      referenceId: String(rec.id),
    });

    await db.update(inventoryBalanceTable).set({ availableQty: closingQty }).where(
      and(eq(inventoryBalanceTable.productId, rec.productId), eq(inventoryBalanceTable.warehouseId, rec.warehouseId))
    );

    await db.insert(inventoryLedgerTable).values({
      productId: rec.productId,
      warehouseId: rec.warehouseId,
      movementId,
      openingQty,
      changeQty: rec.variance,
      closingQty,
    });
  }

  await db.update(stockReconciliationTable).set({ status: "APPROVED" }).where(eq(stockReconciliationTable.id, rec.id));

  const [result] = await withJoins(eq(stockReconciliationTable.id, rec.id), 1, 1);
  res.json(result);
});

export default router;
