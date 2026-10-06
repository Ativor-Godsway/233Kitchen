import type { MenuItem } from '../../shared/types';

/** True when the item can be added without choosing anything. */
export const canQuickAdd = (item: MenuItem) => !item.optionGroups.some((g) => g.required);
