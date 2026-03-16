import { pgTable, text, serial, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { resumesTable } from "./resumes";

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  resumeId: integer("resume_id").notNull().references(() => resumesTable.id, { onDelete: "cascade" }),
  jobDescription: text("job_description").notNull(),

  matchScore: real("match_score").notNull(),

  fitScore: real("fit_score"),
  resumeQualityScore: real("resume_quality_score"),
  scoreBand: text("score_band"),
  scoreBreakdown: jsonb("score_breakdown").$type<Record<string, unknown>>(),
  scoreRationale: text("score_rationale"),

  matchedSkills: jsonb("matched_skills").$type<string[]>().notNull().default([]),
  partialSkills: jsonb("partial_skills").$type<string[]>().default([]),
  missingSkills: jsonb("missing_skills").$type<string[]>().notNull().default([]),
  topGaps: jsonb("top_gaps").$type<string[]>().default([]),
  whyNotHigher: jsonb("why_not_higher").$type<string[]>().default([]),

  suggestions: jsonb("suggestions").$type<string[]>().notNull().default([]),
  summary: text("summary").notNull(),
  confidenceLevel: text("confidence_level"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({ id: true, createdAt: true });
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
