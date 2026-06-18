import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, salesOrdersTable, salesOrderItemsTable, productsTable, inventoryBalanceTable, stockMovementsTable, inventoryLedgerTable } from "@workspace/db";
import { ListOrdersQueryParams, CreateOrderBody, GetOrderParams } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router();

router.get("/orders", async (req, res): Promise<void> => {
  const query = ListOrdersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { status, channel, page = 1, limit = 50 } = query.data;
  const offset = (page - 1) * limit;

  const orders = await db
    .select()
    .from(salesOrdersTable)
    .where(
      and(
        status ? eq(salesOrdersTable.status, status) : undefined,
        channel ? eq(salesOrdersTable.channel, channel) : undefined,
      )
    )
    .orderBy(sql`${salesOrdersTable.createdAt} desc`)
    .limit(limit)
    .offset(offset);

  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(salesOrdersTable).where(
    and(
      status ? eq(salesOrdersTable.status, status) : undefined,
      channel ? eq(salesOrdersTable.channel, channel) : undefined,
    )
  );

  // Get items for each order
  const orderIds = orders.map(o => o.id);
  const items = orderIds.length > 0
    ? await db.select({
        id: salesOrderItemsTable.id,
        orderId: salesOrderItemsTable.orderId,
        productId: salesOrderItemsTable.productId,
        warehouseId: salesOrderItemsTable.warehouseId,
        qty: salesOrderItemsTable.qty,
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
      })
      .from(salesOrderItemsTable)
      .innerJoin(productsTable, eq(salesOrderItemsTable.productId, productsTable.id))
      .where(sql`${salesOrderItemsTable.orderId} = ANY(${sql.raw(`ARRAY[${orderIds.join(",")}]`)})`)
    : [];

  const data = orders.map(order => ({
    ...order,
    items: items.filter(i => i.orderId === order.id),
  }));

  res.json({ data, total: countResult[0].count, page, limit });
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { channel, items } = parsed.data;

  // Verify stock for all items
  for (const item of items) {
    const [balance] = await db
      .select()
      .from(inventoryBalanceTable)
      .where(and(eq(inventoryBalanceTable.productId, item.productId), eq(inventoryBalanceTable.warehouseId, item.warehouseId)));

    if (!balance || balance.availableQty < item.qty) {
      const available = balance?.availableQty ?? 0;
      res.status(422).json({ error: `Insufficient stock for product ${item.productId}. Available: ${available}, Requested: ${item.qty}` });
      return;
    }
  }

  const orderNo = `ORD-${Date.now()}`;
  const [order] = await db.insert(salesOrdersTable).values({ orderNo, channel, status: "CONFIRMED" }).returning();

  for (const item of items) {
    await db.insert(salesOrderItemsTable).values({ orderId: order.id, productId: item.productId, warehouseId: item.warehouseId, qty: item.qty });

    // Create SALE movement
    const movementId = randomUUID();
    const [balance] = await db.select().from(inventoryBalanceTable).where(
      and(eq(inventoryBalanceTable.productId, item.productId), eq(inventoryBalanceTable.warehouseId, item.warehouseId))
    );
    const openingQty = balance.availableQty;
    const closingQty = openingQty - item.qty;

    await db.insert(stockMovementsTable).values({
      movementId,
      productId: item.productId,
      warehouseId: item.warehouseId,
      movementType: "SALE",
      qty: item.qty,
      referenceType: "order",
      referenceId: order.orderNo,
    });

    await db.update(inventoryBalanceTable).set({ availableQty: closingQty }).where(
      and(eq(inventoryBalanceTable.productId, item.productId), eq(inventoryBalanceTable.warehouseId, item.warehouseId))
    );

    await db.insert(inventoryLedgerTable).values({
      productId: item.productId,
      warehouseId: item.warehouseId,
      movementId,
      openingQty,
      changeQty: -item.qty,
      closingQty,
    });
  }

  const orderItems = await db.select({
    id: salesOrderItemsTable.id,
    orderId: salesOrderItemsTable.orderId,
    productId: salesOrderItemsTable.productId,
    warehouseId: salesOrderItemsTable.warehouseId,
    qty: salesOrderItemsTable.qty,
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
  })
  .from(salesOrderItemsTable)
  .innerJoin(productsTable, eq(salesOrderItemsTable.productId, productsTable.id))
  .where(eq(salesOrderItemsTable.orderId, order.id));

  res.status(201).json({ ...order, items: orderItems });
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db.select().from(salesOrdersTable).where(eq(salesOrdersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const items = await db.select({
    id: salesOrderItemsTable.id,
    orderId: salesOrderItemsTable.orderId,
    productId: salesOrderItemsTable.productId,
    warehouseId: salesOrderItemsTable.warehouseId,
    qty: salesOrderItemsTable.qty,
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
  })
  .from(salesOrderItemsTable)
  .innerJoin(productsTable, eq(salesOrderItemsTable.productId, productsTable.id))
  .where(eq(salesOrderItemsTable.orderId, order.id));

  res.json({ ...order, items });
});

export default router;
