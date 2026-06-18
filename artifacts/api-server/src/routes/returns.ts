import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, returnsTable, productsTable, warehousesTable, inventoryBalanceTable, stockMovementsTable, inventoryLedgerTable } from "@workspace/db";
import { ListReturnsQueryParams, CreateReturnBody, UpdateReturnQcParams, UpdateReturnQcBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router();

const withJoins = async (whereClause: Parameters<typeof db.select>[0] extends never ? never : any, page: number, limit: number) => {
  return db.select({
    id: returnsTable.id,
    returnNumber: returnsTable.returnNumber,
    orderId: returnsTable.orderId,
    productId: returnsTable.productId,
    warehouseId: returnsTable.warehouseId,
    qty: returnsTable.qty,
    returnReason: returnsTable.returnReason,
    qcStatus: returnsTable.qcStatus,
    createdAt: returnsTable.createdAt,
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
  .from(returnsTable)
  .innerJoin(productsTable, eq(returnsTable.productId, productsTable.id))
  .innerJoin(warehousesTable, eq(returnsTable.warehouseId, warehousesTable.id))
  .where(whereClause)
  .orderBy(sql`${returnsTable.createdAt} desc`)
  .limit(limit)
  .offset((page - 1) * limit);
};

router.get("/returns", async (req, res): Promise<void> => {
  const query = ListReturnsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { qcStatus, page = 1, limit = 50 } = query.data;
  const whereClause = qcStatus ? eq(returnsTable.qcStatus, qcStatus) : undefined;

  const [data, countResult] = await Promise.all([
    withJoins(whereClause, page, limit),
    db.select({ count: sql<number>`count(*)::int` }).from(returnsTable).where(whereClause),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

router.post("/returns", async (req, res): Promise<void> => {
  const parsed = CreateReturnBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { productId, warehouseId, qty, returnReason, orderId } = parsed.data;
  const returnNumber = `RET-${Date.now()}`;

  const [ret] = await db.insert(returnsTable).values({
    returnNumber,
    orderId: orderId ?? null,
    productId,
    warehouseId,
    qty,
    returnReason,
    qcStatus: "PENDING",
  }).returning();

  // Move items to RETURN category in inventory
  const movementId = randomUUID();
  let [balance] = await db.select().from(inventoryBalanceTable).where(
    and(eq(inventoryBalanceTable.productId, productId), eq(inventoryBalanceTable.warehouseId, warehouseId))
  );
  if (!balance) {
    const [created] = await db.insert(inventoryBalanceTable).values({ productId, warehouseId }).returning();
    balance = created;
  }
  const openingQty = balance.availableQty;
  const closingQty = openingQty; // returns go to returnedQty, not availableQty

  await db.insert(stockMovementsTable).values({
    movementId,
    productId,
    warehouseId,
    movementType: "RETURN",
    qty,
    referenceType: "return",
    referenceId: returnNumber,
  });

  await db.update(inventoryBalanceTable).set({ returnedQty: balance.returnedQty + qty }).where(
    and(eq(inventoryBalanceTable.productId, productId), eq(inventoryBalanceTable.warehouseId, warehouseId))
  );

  await db.insert(inventoryLedgerTable).values({
    productId,
    warehouseId,
    movementId,
    openingQty,
    changeQty: 0,
    closingQty,
  });

  const [result] = await withJoins(eq(returnsTable.id, ret.id), 1, 1);
  res.status(201).json(result);
});

router.patch("/returns/:id/qc", async (req, res): Promise<void> => {
  const params = UpdateReturnQcParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateReturnQcBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [ret] = await db.select().from(returnsTable).where(eq(returnsTable.id, params.data.id));
  if (!ret) {
    res.status(404).json({ error: "Return not found" });
    return;
  }

  const { qcStatus } = parsed.data;
  const [updated] = await db.update(returnsTable).set({ qcStatus }).where(eq(returnsTable.id, ret.id)).returning();

  // Create appropriate movement based on QC outcome
  const movementId = randomUUID();
  const movementType = qcStatus === "GOOD" ? "INWARD" : qcStatus === "DAMAGED" ? "DAMAGE" : "EXPIRED";

  let [balance] = await db.select().from(inventoryBalanceTable).where(
    and(eq(inventoryBalanceTable.productId, ret.productId), eq(inventoryBalanceTable.warehouseId, ret.warehouseId))
  );
  if (!balance) {
    const [created] = await db.insert(inventoryBalanceTable).values({ productId: ret.productId, warehouseId: ret.warehouseId }).returning();
    balance = created;
  }

  const openingQty = balance.availableQty;
  const changeQty = qcStatus === "GOOD" ? ret.qty : 0;
  const closingQty = openingQty + changeQty;

  await db.insert(stockMovementsTable).values({
    movementId,
    productId: ret.productId,
    warehouseId: ret.warehouseId,
    movementType,
    qty: ret.qty,
    referenceType: "return",
    referenceId: ret.returnNumber,
  });

  const balanceUpdate: Record<string, number> = {};
  if (qcStatus === "GOOD") balanceUpdate.availableQty = closingQty;
  if (qcStatus === "DAMAGED") balanceUpdate.damagedQty = balance.damagedQty + ret.qty;
  if (qcStatus === "EXPIRED") balanceUpdate.expiredQty = balance.expiredQty + ret.qty;
  balanceUpdate.returnedQty = Math.max(0, balance.returnedQty - ret.qty);

  await db.update(inventoryBalanceTable).set(balanceUpdate).where(
    and(eq(inventoryBalanceTable.productId, ret.productId), eq(inventoryBalanceTable.warehouseId, ret.warehouseId))
  );

  await db.insert(inventoryLedgerTable).values({
    productId: ret.productId,
    warehouseId: ret.warehouseId,
    movementId,
    openingQty,
    changeQty,
    closingQty,
  });

  const [result] = await withJoins(eq(returnsTable.id, ret.id), 1, 1);
  res.json(result);
});

export default router;
