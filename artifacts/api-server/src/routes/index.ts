import { Router, type IRouter } from "express";
import healthRouter from "./health";
import feedRouter from "./feed";
import debatesRouter from "./debates";
import articlesRouter from "./articles";
import usersRouter from "./users";
import topicsRouter from "./topics";
import statsRouter from "./stats";
import communitiesRouter from "./communities";
import reputationRouter from "./reputation";
import analyticsRouter from "./analytics";
import adminRouter from "./admin";
import notificationsRouter from "./notifications";
import searchRouter from "./search";
import moderationRouter from "./moderation";
import mathRouter from "./math";
import pushRouter from "./push";
import { suspendedCheck } from "../middlewares/suspendedCheck";

const router: IRouter = Router();

// Block suspended users from all authenticated endpoints
router.use(suspendedCheck);

router.use(healthRouter);
router.use(feedRouter);
router.use(debatesRouter);
router.use(articlesRouter);
router.use(usersRouter);
router.use(topicsRouter);
router.use(statsRouter);
router.use(communitiesRouter);
router.use(reputationRouter);
router.use(analyticsRouter);
router.use(adminRouter);
router.use(notificationsRouter);
router.use(searchRouter);
router.use(moderationRouter);
router.use(mathRouter);
router.use(pushRouter);

export default router;
