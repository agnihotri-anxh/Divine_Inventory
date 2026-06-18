import { pgTable, serial, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { warehousesTable } from "./warehouses";

export const stockMovementsTable = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  movementId: text("movement_id").notNull().unique(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  warehouseId: integer("warehouse_id").notNull().references(() => warehousesTable.id),
  movementType: text("movement_type").notNull(),
  qty: integer("qty").notNull(),
  referenceType: text("reference_type").notNull(),
  referenceId: text("reference_id").notNull(),
  sourceLocation: text("source_location"),
  destinationLocation: text("destination_location"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("idx_movements_movement_id").on(t.movementId),
  index("idx_movements_product_id").on(t.productId),
  index("idx_movements_warehouse_id").on(t.warehouseId),
  index("idx_movements_created_at").on(t.createdAt),
]);

export type StockMovement = typeof stockMovementsTable.$inferSelect;
