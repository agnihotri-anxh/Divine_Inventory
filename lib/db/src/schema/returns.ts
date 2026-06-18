import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { warehousesTable } from "./warehouses";
import { salesOrdersTable } from "./orders";

export const returnsTable = pgTable("returns", {
  id: serial("id").primaryKey(),
  returnNumber: text("return_number").notNull().unique(),
  orderId: integer("order_id").references(() => salesOrdersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  warehouseId: integer("warehouse_id").notNull().references(() => warehousesTable.id),
  qty: integer("qty").notNull(),
  returnReason: text("return_reason").notNull(),
  qcStatus: text("qc_status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Return = typeof returnsTable.$inferSelect;
