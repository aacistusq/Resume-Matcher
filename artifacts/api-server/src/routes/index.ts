import { Router, type IRouter } from "express";
import healthRouter from "./health";
import resumesRouter from "./resumes";
import analysisRouter from "./analysis";

const router: IRouter = Router();

router.use(healthRouter);
router.use(resumesRouter);
router.use(analysisRouter);

export default router;
