import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  skuCode: text("sku_code").notNull().unique(),
  productName: text("product_name").notNull(),
  category: text("category").notNull(),
  brand: text("brand").notNull(),
  unit: text("unit").notNull().default("PIECE"),
  minimumStock: integer("minimum_stock").notNull().default(10),
  reorderStock: integer("reorder_stock").notNull().default(50),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("idx_products_sku_code").on(t.skuCode),
  index("idx_products_category").on(t.category),
]);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
