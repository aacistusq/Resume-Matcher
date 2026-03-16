import { pgTable, text, serial, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { resumesTable } from "./resumes";

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  resumeId: integer("resume_id").notNull().references(() => resumesTable.id, { onDelete: "cascade" }),
  jobDescription: text("job_description").notNull(),
  matchScore: real("match_score").notNull(),
  matchedSkills: jsonb("matched_skills").$type<string[]>().notNull().default([]),
  missingSkills: jsonb("missing_skills").$type<string[]>().notNull().default([]),
  suggestions: jsonb("suggestions").$type<string[]>().notNull().default([]),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({ id: true, createdAt: true });
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
