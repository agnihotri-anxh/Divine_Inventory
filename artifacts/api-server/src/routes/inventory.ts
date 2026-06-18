import { Router } from "express";
import { eq, and, lte, sql } from "drizzle-orm";
import { db, inventoryBalanceTable, stockMovementsTable, inventoryLedgerTable, productsTable, warehousesTable } from "@workspace/db";
import { ListInventoryQueryParams, ListMovementsQueryParams, CreateMovementBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router();

// Outward movement types (deduct from available)
const OUTWARD_TYPES = ["SALE", "DISPATCH", "TRANSFER_OUT", "DAMAGE", "EXPIRED"];
// Inward movement types
const INWARD_TYPES = ["INWARD", "RETURN", "TRANSFER_IN", "ADJUSTMENT"];

router.get("/inventory", async (req, res): Promise<void> => {
  const query = ListInventoryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { warehouseId, productId, lowStock, page = 1, limit = 50 } = query.data;
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: inventoryBalanceTable.id,
      productId: inventoryBalanceTable.productId,
      warehouseId: inventoryBalanceTable.warehouseId,
      availableQty: inventoryBalanceTable.availableQty,
      reservedQty: inventoryBalanceTable.reservedQty,
      damagedQty: inventoryBalanceTable.damagedQty,
      expiredQty: inventoryBalanceTable.expiredQty,
      returnedQty: inventoryBalanceTable.returnedQty,
      lastUpdated: inventoryBalanceTable.lastUpdated,
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
    .from(inventoryBalanceTable)
    .innerJoin(productsTable, eq(inventoryBalanceTable.productId, productsTable.id))
    .innerJoin(warehousesTable, eq(inventoryBalanceTable.warehouseId, warehousesTable.id))
    .where(
      and(
        warehouseId ? eq(inventoryBalanceTable.warehouseId, warehouseId) : undefined,
        productId ? eq(inventoryBalanceTable.productId, productId) : undefined,
        lowStock ? lte(inventoryBalanceTable.availableQty, productsTable.minimumStock) : undefined,
      )
    )
    .orderBy(productsTable.productName)
    .limit(limit)
    .offset(offset);

  const total = rows.length; // simplified count
  res.json({ data: rows, total, page, limit });
});

router.get("/inventory/movements", async (req, res): Promise<void> => {
  const query = ListMovementsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { productId, warehouseId, movementType, page = 1, limit = 50 } = query.data;
  const offset = (page - 1) * limit;

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
    .where(
      and(
        productId ? eq(stockMovementsTable.productId, productId) : undefined,
        warehouseId ? eq(stockMovementsTable.warehouseId, warehouseId) : undefined,
        movementType ? eq(stockMovementsTable.movementType, movementType) : undefined,
      )
    )
    .orderBy(sql`${stockMovementsTable.createdAt} desc`)
    .limit(limit)
    .offset(offset);

  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(stockMovementsTable).where(
    and(
      productId ? eq(stockMovementsTable.productId, productId) : undefined,
      warehouseId ? eq(stockMovementsTable.warehouseId, warehouseId) : undefined,
      movementType ? eq(stockMovementsTable.movementType, movementType) : undefined,
    )
  );

  res.json({ data: rows, total: countResult[0].count, page, limit });
});

router.post("/inventory/movements", async (req, res): Promise<void> => {
  const parsed = CreateMovementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { movementId, productId, warehouseId, movementType, qty, referenceType, referenceId, sourceLocation, destinationLocation, createdBy } = parsed.data;

  // Idempotency check
  const existing = await db.select().from(stockMovementsTable).where(eq(stockMovementsTable.movementId, movementId));
  if (existing.length > 0) {
    res.status(409).json({ error: "Movement already processed (idempotency key exists)" });
    return;
  }

  // Get or create inventory balance
  let [balance] = await db
    .select()
    .from(inventoryBalanceTable)
    .where(and(eq(inventoryBalanceTable.productId, productId), eq(inventoryBalanceTable.warehouseId, warehouseId)));

  if (!balance) {
    const [created] = await db.insert(inventoryBalanceTable).values({ productId, warehouseId }).returning();
    balance = created;
  }

  // Check if outward and has enough stock
  const isOutward = OUTWARD_TYPES.includes(movementType);
  if (isOutward && balance.availableQty < qty) {
    res.status(422).json({ error: `Insufficient stock. Available: ${balance.availableQty}, Requested: ${qty}` });
    return;
  }

  const openingQty = balance.availableQty;
  const changeQty = isOutward ? -qty : qty;
  const closingQty = openingQty + changeQty;

  // Insert movement and update balance + ledger atomically
  const [movement] = await db.insert(stockMovementsTable).values({
    movementId,
    productId,
    warehouseId,
    movementType,
    qty,
    referenceType,
    referenceId,
    sourceLocation: sourceLocation ?? null,
    destinationLocation: destinationLocation ?? null,
    createdBy: createdBy ?? null,
  }).returning();

  // Update balance
  const balanceUpdate: Record<string, unknown> = { availableQty: closingQty };
  if (movementType === "DAMAGE") balanceUpdate.damagedQty = balance.damagedQty + qty;
  if (movementType === "EXPIRED") balanceUpdate.expiredQty = balance.expiredQty + qty;
  if (movementType === "RETURN") balanceUpdate.returnedQty = balance.returnedQty + qty;

  await db.update(inventoryBalanceTable).set(balanceUpdate).where(
    and(eq(inventoryBalanceTable.productId, productId), eq(inventoryBalanceTable.warehouseId, warehouseId))
  );

  // Append to immutable ledger
  await db.insert(inventoryLedgerTable).values({
    productId,
    warehouseId,
    movementId,
    openingQty,
    changeQty,
    closingQty,
  });

  res.status(201).json(movement);
});

export default router;
