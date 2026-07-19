// PostgreSQL (Neon) schema — for new features/modules only.
// Existing data model stays on MongoDB (see lib/db/models/*) — do not
// migrate existing collections here.

import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Business category taxonomy for tenant onboarding (top-level category ->
// subcategory tree via parentId). Read-only reference data, seeded via
// scripts/seed-master-data.ts.
export const businessCategories = pgTable("business_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  nameTh: varchar("name_th", { length: 255 }).notNull(),
  parentId: uuid("parent_id").references(
    (): AnyPgColumn => businessCategories.id,
    { onDelete: "cascade" }
  ),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Signup purpose dropdown options for tenant onboarding.
export const signupPurposes = pgTable("signup_purposes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  nameTh: varchar("name_th", { length: 255 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});
