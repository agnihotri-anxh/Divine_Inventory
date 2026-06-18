import { db, productsTable, warehousesTable, inventoryBalanceTable, stockMovementsTable, inventoryLedgerTable, alertsTable } from "@workspace/db";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Warehouses
  const [wh1, wh2, wh3] = await db.insert(warehousesTable).values([
    { warehouseName: "Main Delhi Warehouse", location: "Delhi, IN", warehouseType: "MAIN" },
    { warehouseName: "Mumbai Distribution Centre", location: "Mumbai, MH", warehouseType: "MAIN" },
    { warehouseName: "Returns Processing Hub", location: "Bangalore, KA", warehouseType: "RETURNS" },
  ]).returning().onConflictDoNothing();
  console.log("✓ Warehouses seeded");

  // Products
  const products = await db.insert(productsTable).values([
    { skuCode: "SKU-AGARBATTI-001", productName: "Sandalwood Agarbatti Pack", category: "Incense", brand: "Divine Scents", unit: "BOX", minimumStock: 50, reorderStock: 100 },
    { skuCode: "SKU-DIYA-001", productName: "Brass Diya Set (6 pcs)", category: "Diyas & Candles", brand: "Puja Essentials", unit: "SET", minimumStock: 30, reorderStock: 60 },
    { skuCode: "SKU-IDOL-GANESH-001", productName: "Marble Ganesh Idol 6 inch", category: "Idols", brand: "Divine Crafts", unit: "PCS", minimumStock: 10, reorderStock: 25 },
    { skuCode: "SKU-GHEE-001", productName: "Pure Cow Ghee 500ml", category: "Puja Samagri", brand: "AyurVed", unit: "PCS", minimumStock: 40, reorderStock: 80 },
    { skuCode: "SKU-KUMKUM-001", productName: "Kumkum Powder 100g", category: "Colors & Powders", brand: "Sindoor Plus", unit: "PCS", minimumStock: 100, reorderStock: 200 },
    { skuCode: "SKU-FLOWER-001", productName: "Marigold Garland (Artificial)", category: "Decorations", brand: "FloriDecor", unit: "PCS", minimumStock: 60, reorderStock: 120 },
    { skuCode: "SKU-CAMPHOR-001", productName: "Camphor Tablets 50g", category: "Puja Samagri", brand: "Pure Camphor", unit: "BOX", minimumStock: 80, reorderStock: 150 },
    { skuCode: "SKU-KALASH-001", productName: "Copper Kalash 1L", category: "Utensils", brand: "Copper Craft", unit: "PCS", minimumStock: 15, reorderStock: 30 },
  ]).returning().onConflictDoNothing();
  console.log(`✓ ${products.length} products seeded`);

  if (!wh1 || !wh2 || products.length === 0) {
    console.log("Data already exists, skipping inventory seed");
    return;
  }

  // Seed inventory in Delhi warehouse
  for (const product of products) {
    const qty = Math.floor(Math.random() * 200) + 50;
    const movementId = randomUUID();

    await db.insert(inventoryBalanceTable).values({
      productId: product.id,
      warehouseId: wh1.id,
      availableQty: qty,
    }).onConflictDoNothing();

    await db.insert(stockMovementsTable).values({
      movementId,
      productId: product.id,
      warehouseId: wh1.id,
      movementType: "INWARD",
      qty,
      referenceType: "GRN",
      referenceId: `GRN-SEED-${product.skuCode}`,
      createdBy: "system",
    }).onConflictDoNothing();

    await db.insert(inventoryLedgerTable).values({
      productId: product.id,
      warehouseId: wh1.id,
      movementId,
      openingQty: 0,
      changeQty: qty,
      closingQty: qty,
    });
  }
  console.log("✓ Delhi warehouse inventory seeded");

  // Seed some stock in Mumbai too
  for (const product of products.slice(0, 5)) {
    const qty = Math.floor(Math.random() * 100) + 20;
    const movementId = randomUUID();

    await db.insert(inventoryBalanceTable).values({
      productId: product.id,
      warehouseId: wh2.id,
      availableQty: qty,
    }).onConflictDoNothing();

    await db.insert(stockMovementsTable).values({
      movementId,
      productId: product.id,
      warehouseId: wh2.id,
      movementType: "INWARD",
      qty,
      referenceType: "GRN",
      referenceId: `GRN-MUM-${product.skuCode}`,
      createdBy: "system",
    }).onConflictDoNothing();

    await db.insert(inventoryLedgerTable).values({
      productId: product.id,
      warehouseId: wh2.id,
      movementId,
      openingQty: 0,
      changeQty: qty,
      closingQty: qty,
    });
  }
  console.log("✓ Mumbai warehouse inventory seeded");

  // Create some low-stock situations for 2 products
  const lowStockProducts = products.slice(0, 2);
  for (const product of lowStockProducts) {
    await db.update(inventoryBalanceTable)
      .set({ availableQty: Math.floor(product.minimumStock / 3) })
      .where(
        and(
          eq(inventoryBalanceTable.productId, product.id),
          eq(inventoryBalanceTable.warehouseId, wh1.id),
        )
      );

    await db.insert(alertsTable).values({
      productId: product.id,
      alertType: "LOW_STOCK",
      currentStock: Math.floor(product.minimumStock / 3),
      threshold: product.minimumStock,
      status: "ACTIVE",
    }).onConflictDoNothing();
  }
  console.log("✓ Low stock alerts seeded");

  console.log("\nSeed complete!");
}

seed().catch(console.error).finally(() => process.exit(0));
