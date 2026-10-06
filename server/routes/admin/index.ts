import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { authRouter } from './auth.js';
import { ordersRouter } from './orders.js';
import { settingsRouter } from './settings.js';
import { emailsRouter } from './emails.js';
import { analyticsRouter } from './analytics.js';
import { customersRouter } from './customers.js';
import { campaignsRouter } from './campaigns.js';
import { menuRouter } from './menu.js';

export const adminRouter = Router();

adminRouter.use(authRouter);
adminRouter.use(requireAdmin);
adminRouter.use('/orders', ordersRouter);
adminRouter.use('/settings', settingsRouter);
adminRouter.use('/emails', emailsRouter);
adminRouter.use('/analytics', analyticsRouter);
adminRouter.use('/customers', customersRouter);
adminRouter.use('/campaigns', campaignsRouter);
adminRouter.use('/menu', menuRouter);
