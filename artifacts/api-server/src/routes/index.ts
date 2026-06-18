import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import warehousesRouter from "./warehouses";
import inventoryRouter from "./inventory";
import ledgerRouter from "./ledger";
import ordersRouter from "./orders";
import returnsRouter from "./returns";
import reconciliationRouter from "./reconciliation";
import alertsRouter from "./alerts";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(warehousesRouter);
router.use(inventoryRouter);
router.use(ledgerRouter);
router.use(ordersRouter);
router.use(returnsRouter);
router.use(reconciliationRouter);
router.use(alertsRouter);
router.use(dashboardRouter);

export default router;
