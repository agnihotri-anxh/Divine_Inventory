import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, warehousesTable } from "@workspace/db";
import { CreateWarehouseBody, GetWarehouseParams } from "@workspace/api-zod";

const router = Router();

router.get("/warehouses", async (_req, res): Promise<void> => {
  const data = await db.select().from(warehousesTable).orderBy(warehousesTable.warehouseName);
  res.json(data);
});

router.post("/warehouses", async (req, res): Promise<void> => {
  const parsed = CreateWarehouseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [warehouse] = await db.insert(warehousesTable).values(parsed.data).returning();
  res.status(201).json(warehouse);
});

router.get("/warehouses/:id", async (req, res): Promise<void> => {
  const params = GetWarehouseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [warehouse] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, params.data.id));
  if (!warehouse) {
    res.status(404).json({ error: "Warehouse not found" });
    return;
  }
  res.json(warehouse);
});

export default router;
