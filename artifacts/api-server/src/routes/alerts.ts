import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, alertsTable, productsTable } from "@workspace/db";
import { ListAlertsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/alerts", async (req, res): Promise<void> => {
  const query = ListAlertsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { status, page = 1, limit = 50 } = query.data;
  const offset = (page - 1) * limit;
  const whereClause = status ? eq(alertsTable.status, status) : undefined;

  const [data, countResult] = await Promise.all([
    db.select({
      id: alertsTable.id,
      productId: alertsTable.productId,
      alertType: alertsTable.alertType,
      currentStock: alertsTable.currentStock,
      threshold: alertsTable.threshold,
      status: alertsTable.status,
      createdAt: alertsTable.createdAt,
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
    .from(alertsTable)
    .innerJoin(productsTable, eq(alertsTable.productId, productsTable.id))
    .where(whereClause)
    .orderBy(sql`${alertsTable.createdAt} desc`)
    .limit(limit)
    .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(alertsTable).where(whereClause),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

export default router;
