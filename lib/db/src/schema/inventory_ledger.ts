import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { warehousesTable } from "./warehouses";

export const inventoryLedgerTable = pgTable("inventory_ledger", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  warehouseId: integer("warehouse_id").notNull().references(() => warehousesTable.id),
  movementId: text("movement_id").notNull(),
  openingQty: integer("opening_qty").notNull(),
  changeQty: integer("change_qty").notNull(),
  closingQty: integer("closing_qty").notNull(),
  transactionTime: timestamp("transaction_time", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_ledger_product_time").on(t.productId, t.transactionTime),
  index("idx_ledger_warehouse_time").on(t.warehouseId, t.transactionTime),
]);

export type InventoryLedger = typeof inventoryLedgerTable.$inferSelect;
