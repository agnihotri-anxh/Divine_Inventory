import { pgTable, serial, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { warehousesTable } from "./warehouses";

export const inventoryBalanceTable = pgTable("inventory_balance", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  warehouseId: integer("warehouse_id").notNull().references(() => warehousesTable.id),
  availableQty: integer("available_qty").notNull().default(0),
  reservedQty: integer("reserved_qty").notNull().default(0),
  damagedQty: integer("damaged_qty").notNull().default(0),
  expiredQty: integer("expired_qty").notNull().default(0),
  returnedQty: integer("returned_qty").notNull().default(0),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("idx_inventory_product_warehouse").on(t.productId, t.warehouseId),
]);

export type InventoryBalance = typeof inventoryBalanceTable.$inferSelect;
