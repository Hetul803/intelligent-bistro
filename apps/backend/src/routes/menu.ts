import { Router } from 'express';
import { menu } from '../data/menu.js';

export const menuRouter = Router();

menuRouter.get('/', (_req, res) => {
  res.json({ menu });
});
