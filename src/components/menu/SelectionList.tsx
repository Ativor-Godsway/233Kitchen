import type { PricedSelection } from '../../../shared/types';
import { describeSelections } from '../../../shared/pricing';
import { ExtraIcon } from './ExtraIcon';
import { cn } from '../../lib/cn';

/** A line's chosen options with tiny icons, e.g. [🍌] 2× Extra plantain · [🥜] With nuts. */
export function SelectionList({
  selections,
  className,
}: {
  selections: Pick<PricedSelection, 'name' | 'qty' | 'icon'>[];
  className?: string;
}) {
  if (!selections.length) return null;
  return (
    <ul className={cn('flex flex-wrap gap-x-3 gap-y-1', className)}>
      {selections.map((s, i) => (
        <li key={i} className="inline-flex items-center gap-1">
          <ExtraIcon name={s.icon} size={20} />
          {describeSelections([s])}
        </li>
      ))}
    </ul>
  );
}
