import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { authRouter } from './auth.js';
import { ordersRouter } from './orders.js';
import { settingsRouter } from './settings.js';
import { emailsRouter } from './emails.js';

export const adminRouter = Router();

adminRouter.use(authRouter);
adminRouter.use(requireAdmin);
adminRouter.use('/orders', ordersRouter);
adminRouter.use('/settings', settingsRouter);
adminRouter.use('/emails', emailsRouter);
