import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { warehousesTable } from "./warehouses";

export const stockReconciliationTable = pgTable("stock_reconciliation", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  warehouseId: integer("warehouse_id").notNull().references(() => warehousesTable.id),
  systemQty: integer("system_qty").notNull(),
  physicalQty: integer("physical_qty").notNull(),
  variance: integer("variance").notNull(),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StockReconciliation = typeof stockReconciliationTable.$inferSelect;
