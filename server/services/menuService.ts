import { MenuItemModel, toMenuItem } from '../models/MenuItem.js';
import type { MenuItem } from '../../shared/types.js';

export async function getMenu(): Promise<MenuItem[]> {
  const rows = await MenuItemModel.find().sort({ sortOrder: 1, name: 1 }).lean();
  return rows.map((r) => toMenuItem(r));
}
