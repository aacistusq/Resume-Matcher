import { Router, type IRouter } from "express";
import { db, resumesTable } from "@workspace/db";
import { CreateResumeBody, GetResumeParams, DeleteResumeParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/resumes", async (_req, res) => {
  try {
    const resumes = await db.select().from(resumesTable).orderBy(resumesTable.createdAt);
    res.json(resumes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch resumes" });
  }
});

router.post("/resumes", async (req, res) => {
  try {
    const body = CreateResumeBody.parse(req.body);
    const [resume] = await db.insert(resumesTable).values(body).returning();
    res.status(201).json(resume);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/resumes/:id", async (req, res) => {
  try {
    const { id } = GetResumeParams.parse({ id: Number(req.params.id) });
    const [resume] = await db.select().from(resumesTable).where(eq(resumesTable.id, id));
    if (!resume) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }
    res.json(resume);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/resumes/:id", async (req, res) => {
  try {
    const { id } = DeleteResumeParams.parse({ id: Number(req.params.id) });
    await db.delete(resumesTable).where(eq(resumesTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
