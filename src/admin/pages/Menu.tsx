import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ImageOff, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { formatMoney } from '../../../shared/pricing';
import { CATEGORY_LABELS } from '../../../shared/menu.seed';
import { EXTRA_ICONS, iconLabel } from '../../../shared/icons';
import { ExtraIcon } from '../../components/menu/ExtraIcon';
import type { MenuItem, OptionGroup } from '../../../shared/types';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  Toggle,
} from '../ui';
import { Dialog } from '../../components/ui/Dialog';
import { cn } from '../../lib/cn';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
const toDollars = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, '');
const toCents = (d: string) => Math.round(Number(d || 0) * 100);

type Draft = Omit<MenuItem, 'id'> & { id?: string };

const BLANK: Draft = {
  name: '',
  slug: '',
  description: '',
  category: 'mains',
  basePrice: 0,
  image: '',
  boxImages: [],
  isAvailable: true,
  sortOrder: 10,
  optionGroups: [],
};

function PriceInput({
  cents,
  onChange,
  label,
  id,
}: {
  cents: number;
  onChange: (c: number) => void;
  label: string;
  id?: string;
}) {
  const [text, setText] = useState(toDollars(cents));
  useEffect(() => setText(toDollars(cents)), [cents]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">
        $
      </span>
      <Input
        id={id}
        aria-label={label}
        inputMode="decimal"
        className="pl-6 tabular-nums"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ''))}
        onBlur={() => onChange(toCents(text))}
      />
    </div>
  );
}

function GroupEditor({
  group,
  onChange,
  onRemove,
}: {
  group: OptionGroup;
  onChange: (g: OptionGroup) => void;
  onRemove: () => void;
}) {
  const setOpt = (i: number, patch: Partial<OptionGroup['options'][number]>) =>
    onChange({
      ...group,
      options: group.options.map((o, j) => (j === i ? { ...o, ...patch } : o)),
    });
  return (
    <div className="rounded-xl border border-neutral-200 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
        <Field label="Group name">
          <Input
            aria-label="Group name"
            value={group.name}
            onChange={(e) => onChange({ ...group, name: e.target.value })}
          />
        </Field>
        <Field label="Type">
          <Select
            aria-label="Group type"
            value={group.type}
            onChange={(e) => {
              const type = e.target.value as OptionGroup['type'];
              onChange({
                ...group,
                type,
                ...(type === 'single'
                  ? { min: group.required ? 1 : 0, max: 1 }
                  : type === 'quantity'
                    ? { min: 0, max: 5 }
                    : {}),
              });
            }}
          >
            <option value="quantity">Extras (0–N each)</option>
            <option value="single">Choose one</option>
            <option value="multi">Toggles / choose several</option>
          </Select>
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-ghana-green"
            checked={group.required}
            onChange={(e) =>
              onChange({
                ...group,
                required: e.target.checked,
                min: e.target.checked ? Math.max(1, group.min) : 0,
              })
            }
          />
          Required
        </label>
        {group.type !== 'single' && (
          <label className="flex items-center gap-2">
            {group.type === 'quantity' ? 'Max per extra' : 'Max choices'}
            <Input
              aria-label="Maximum"
              type="number"
              min={1}
              max={20}
              className="h-8 w-16"
              value={group.max}
              onChange={(e) =>
                onChange({ ...group, max: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </label>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-xs font-medium text-ghana-red hover:underline"
        >
          Remove group
        </button>
      </div>
      <ul className="mt-4 space-y-2">
        {group.options.map((o, i) => (
          <li
            key={i}
            className="grid grid-cols-[40px_minmax(0,1fr)_96px_auto_auto] items-center gap-x-2 gap-y-1.5"
          >
            <span className="row-span-2 grid h-10 w-10 place-items-center self-start rounded-lg bg-neutral-100">
              {o.icon ? (
                <ExtraIcon name={o.icon} size={32} surface="light" />
              ) : (
                <ImageOff size={14} className="text-neutral-300" aria-hidden />
              )}
            </span>
            <Input
              aria-label="Option name"
              value={o.name}
              onChange={(e) =>
                setOpt(i, {
                  name: e.target.value,
                  ...(o.key ? {} : { key: slugify(e.target.value) }),
                })
              }
              placeholder="Option name"
            />
            <PriceInput
              label={`${o.name || 'Option'} price`}
              cents={o.price}
              onChange={(price) => setOpt(i, { price })}
            />
            <Toggle
              label={`${o.name} available`}
              checked={o.isAvailable}
              onChange={(v) => setOpt(i, { isAvailable: v })}
            />
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-ghana-red"
              aria-label={`Remove ${o.name}`}
              onClick={() =>
                onChange({ ...group, options: group.options.filter((_, j) => j !== i) })
              }
            >
              <X size={16} aria-hidden />
            </button>
            <Select
              aria-label={`${o.name || 'Option'} icon`}
              className="col-span-2 h-9 py-1 text-sm"
              value={o.icon ?? ''}
              onChange={(e) => setOpt(i, { icon: e.target.value || undefined })}
            >
              <option value="">No icon</option>
              {EXTRA_ICONS.map((n) => (
                <option key={n} value={n}>
                  {iconLabel(n)}
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="ghost"
        className="mt-2"
        onClick={() =>
          onChange({
            ...group,
            options: [...group.options, { key: '', name: '', price: 0, isAvailable: true }],
          })
        }
      >
        <Plus size={14} aria-hidden /> Add option
      </Button>
    </div>
  );
}

function Editor({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState('');
  const isNew = !initial.id;

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...d,
        id: undefined,
        slug: d.slug || slugify(d.name),
        image: d.image || null,
        boxImages: (d.boxImages ?? []).map((u) => u.trim()).filter(Boolean),
        optionGroups: d.optionGroups.map((g, gi) => ({
          ...g,
          key: g.key || slugify(g.name) || `group-${gi + 1}`,
          options: g.options
            .filter((o) => o.name.trim())
            .map((o, oi) => ({ ...o, key: o.key || slugify(o.name) || `option-${oi + 1}` })),
        })),
      };
      return isNew
        ? api('/admin/menu', { method: 'POST', json: body })
        : api(`/admin/menu/${initial.id}`, { method: 'PUT', json: body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'menu'] });
      qc.invalidateQueries({ queryKey: ['menu'] });
      toast.success(isNew ? 'Item added' : 'Item saved');
      onClose();
    },
    onError: (e) => {
      const fields =
        e instanceof ApiError && e.fieldErrors
          ? Object.entries(e.fieldErrors)
              .map(([k, v]) => `${k}: ${v?.[0]}`)
              .join(' · ')
          : '';
      setError(
        [e instanceof ApiError ? e.message : 'Could not save', fields].filter(Boolean).join(' '),
      );
    },
  });

  return (
    <>
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
        <p className="text-lg font-semibold">{isNew ? 'New menu item' : `Edit ${initial.name}`}</p>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
          aria-label="Close"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          save.mutate();
        }}
      >
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <Field label="Name" htmlFor="m-name">
            <Input
              id="m-name"
              required
              value={d.name}
              onChange={(e) =>
                setD({
                  ...d,
                  name: e.target.value,
                  ...(isNew ? { slug: slugify(e.target.value) } : {}),
                })
              }
            />
          </Field>
          <Field label="Description" htmlFor="m-desc">
            <Textarea
              id="m-desc"
              rows={3}
              value={d.description}
              onChange={(e) => setD({ ...d, description: e.target.value })}
              maxLength={600}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Base price" htmlFor="m-price">
              <PriceInput
                id="m-price"
                label="Base price"
                cents={d.basePrice}
                onChange={(basePrice) => setD({ ...d, basePrice })}
              />
            </Field>
            <Field label="Category" htmlFor="m-cat">
              <Select
                id="m-cat"
                value={d.category}
                onChange={(e) => setD({ ...d, category: e.target.value as MenuItem['category'] })}
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sort order" htmlFor="m-sort" hint="Lower shows first">
              <Input
                id="m-sort"
                type="number"
                min={0}
                max={1000}
                value={d.sortOrder}
                onChange={(e) => setD({ ...d, sortOrder: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>
          <Field
            label="Image URL"
            htmlFor="m-img"
            hint="Paste an https:// image link, or a /images/… path. (Uploads can be added later via Cloudinary.)"
          >
            <div className="flex gap-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-neutral-100">
                {d.image ? (
                  <img src={d.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageOff size={18} className="text-neutral-400" aria-hidden />
                )}
              </div>
              <Input
                id="m-img"
                value={d.image ?? ''}
                onChange={(e) => setD({ ...d, image: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </Field>
          <Field
            label="Box photos (“What you’ll receive”)"
            htmlFor="m-box"
            hint="One per line, e.g. /images/box/waakye-fish-480.webp. Leave empty to hide the row."
          >
            <div className="flex gap-3">
              <div className="flex shrink-0 gap-1">
                {(d.boxImages ?? []).filter(Boolean).length ? (
                  (d.boxImages ?? [])
                    .filter(Boolean)
                    .slice(0, 3)
                    .map((u) => (
                      <img
                        key={u}
                        src={u}
                        alt=""
                        className="h-16 w-16 rounded-lg bg-neutral-100 object-cover"
                      />
                    ))
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-lg bg-neutral-100">
                    <ImageOff size={18} className="text-neutral-400" aria-hidden />
                  </div>
                )}
              </div>
              <Textarea
                id="m-box"
                rows={2}
                value={(d.boxImages ?? []).join('\n')}
                onChange={(e) => setD({ ...d, boxImages: e.target.value.split('\n') })}
                placeholder="/images/box/…-480.webp"
              />
            </div>
          </Field>
          <Field
            label="URL slug"
            htmlFor="m-slug"
            hint="Used internally and in saved bags. Changing it removes this item from customers’ saved bags."
          >
            <Input
              id="m-slug"
              value={d.slug}
              onChange={(e) => setD({ ...d, slug: slugify(e.target.value) })}
            />
          </Field>
          <label className="flex items-center justify-between rounded-xl border border-neutral-200 p-4 text-sm">
            <span>
              <span className="block font-medium">Available</span>
              <span className="text-xs text-neutral-500">Off shows “Sold out” on the site</span>
            </span>
            <Toggle
              label="Available"
              checked={d.isAvailable}
              onChange={(v) => setD({ ...d, isAvailable: v })}
            />
          </label>

          <div>
            <p className="mb-2 text-sm font-semibold">Options & extras</p>
            <div className="space-y-3">
              {d.optionGroups.map((g, i) => (
                <GroupEditor
                  key={i}
                  group={g}
                  onChange={(ng) =>
                    setD({ ...d, optionGroups: d.optionGroups.map((x, j) => (j === i ? ng : x)) })
                  }
                  onRemove={() =>
                    setD({ ...d, optionGroups: d.optionGroups.filter((_, j) => j !== i) })
                  }
                />
              ))}
            </div>
            <Button
              size="sm"
              className="mt-3"
              onClick={() =>
                setD({
                  ...d,
                  optionGroups: [
                    ...d.optionGroups,
                    {
                      key: '',
                      name: 'Extras',
                      type: 'quantity',
                      required: false,
                      min: 0,
                      max: 5,
                      options: [{ key: '', name: '', price: 0, isAvailable: true }],
                    },
                  ],
                })
              }
            >
              <Plus size={14} aria-hidden /> Add option group
            </Button>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            {isNew ? 'Add item' : 'Save changes'}
          </Button>
        </div>
      </form>
    </>
  );
}

export default function MenuPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'menu'],
    queryFn: () => api<{ items: MenuItem[] }>('/admin/menu'),
  });
  const [editing, setEditing] = useState<Draft | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    document.title = 'Menu · +233 Kitchen Admin';
  }, []);

  const avail = useMutation({
    mutationFn: (v: { id: string; isAvailable: boolean; groupKey?: string; optionKey?: string }) =>
      api(`/admin/menu/${v.id}/availability`, {
        method: 'PATCH',
        json: { isAvailable: v.isAvailable, groupKey: v.groupKey, optionKey: v.optionKey },
      }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['admin', 'menu'] });
      qc.invalidateQueries({ queryKey: ['menu'] });
      toast.success(v.isAvailable ? 'Marked available' : 'Marked sold out');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update'),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/admin/menu/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'menu'] });
      qc.invalidateQueries({ queryKey: ['menu'] });
      toast.success('Item deleted');
    },
  });

  return (
    <>
      <PageHeader
        title="Menu"
        sub="Changes go live on the site immediately. Prices are always recalculated on the server."
        actions={
          <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={16} aria-hidden /> Add item
          </Button>
        }
      />
      {isLoading && (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      )}
      {isError && <ErrorState message="Could not load the menu." onRetry={refetch} />}
      <div className="space-y-3">
        {data?.items.map((item) => (
          <Card key={item.id} className={cn(!item.isAvailable && 'bg-neutral-50')}>
            <div className="flex items-center gap-4 p-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-ghana-gold-100">
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    className={cn('h-full w-full object-cover', !item.isAvailable && 'grayscale')}
                  />
                ) : (
                  <ImageOff size={18} className="text-ghana-gold-700" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-sm text-neutral-500">
                  {formatMoney(item.basePrice)} · {CATEGORY_LABELS[item.category]}
                  {!item.isAvailable && (
                    <span className="ml-2 rounded bg-neutral-900 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-white">
                      Sold out
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 sm:gap-3">
                <label className="hidden items-center gap-2 text-xs text-neutral-500 sm:flex">
                  Available
                </label>
                <Toggle
                  label={`${item.name} available`}
                  checked={item.isAvailable}
                  disabled={avail.isPending}
                  onChange={(v) => avail.mutate({ id: item.id, isAvailable: v })}
                />
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                  aria-label={`Edit ${item.name}`}
                  onClick={() => setEditing({ ...item })}
                >
                  <Pencil size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-ghana-red"
                  aria-label={`Delete ${item.name}`}
                  onClick={() =>
                    window.confirm(
                      `Delete “${item.name}” from the menu? Past orders are not affected.`,
                    ) && del.mutate(item.id)
                  }
                >
                  <Trash2 size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                  aria-expanded={!!open[item.id]}
                  aria-label={`${open[item.id] ? 'Hide' : 'Show'} options for ${item.name}`}
                  onClick={() => setOpen((o) => ({ ...o, [item.id]: !o[item.id] }))}
                >
                  <ChevronDown
                    size={16}
                    className={cn('transition', open[item.id] && 'rotate-180')}
                    aria-hidden
                  />
                </button>
              </div>
            </div>
            {open[item.id] && (
              <div className="space-y-4 border-t border-neutral-100 px-4 py-4">
                {item.optionGroups.length === 0 && (
                  <p className="text-sm text-neutral-500">No options.</p>
                )}
                {item.optionGroups.map((g) => (
                  <div key={g.key}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      {g.name}
                      {g.required ? ' · required' : ''}
                    </p>
                    <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                      {g.options.map((o) => (
                        <li
                          key={o.key}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                        >
                          <span
                            className={cn(
                              'inline-flex items-center gap-2',
                              !o.isAvailable && 'text-neutral-400 line-through',
                            )}
                          >
                            <ExtraIcon name={o.icon} size={24} surface="light" />
                            {o.name}
                          </span>
                          <span className="ml-auto tabular-nums text-neutral-500">
                            {o.price ? `+${formatMoney(o.price)}` : 'Free'}
                          </span>
                          <Toggle
                            label={`${o.name} available`}
                            checked={o.isAvailable}
                            disabled={avail.isPending}
                            onChange={(v) =>
                              avail.mutate({
                                id: item.id,
                                isAvailable: v,
                                groupKey: g.key,
                                optionKey: o.key,
                              })
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit menu item"
        hideTitle
        variant="drawer-right"
        className="sm:!max-w-xl"
      >
        {editing && (
          <Editor key={editing.id ?? 'new'} initial={editing} onClose={() => setEditing(null)} />
        )}
      </Dialog>
    </>
  );
}
