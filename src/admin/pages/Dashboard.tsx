import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, ClipboardList, Table2, BarChart3 } from 'lucide-react';
import { api } from '../../lib/api';
import { formatMoney } from '../../../shared/pricing';
import type { AnalyticsResult, RangeKey } from '../../../shared/types';
import { Button, Card, CardHeader, ErrorState, Input, PageHeader, Spinner } from '../ui';
import { cn } from '../../lib/cn';

/** Single-series charts use one brand hue (validated vs the white surface). */
const MARK = '#1E6131';
const GRID = '#EEEEEE';
const TICK = { fill: '#737373', fontSize: 12 };

/** "Loaded Fried Rice with Chicken" → "Fried Rice" for compact chart labels. */
const shortItem = (name: string) => name.replace(/^Loaded\s+/i, '').replace(/\s+with\s+.*$/i, '');

const RANGES: Array<{ id: RangeKey; label: string }> = [
  { id: 'week', label: 'This week' },
  { id: '4w', label: '4 weeks' },
  { id: '3m', label: '3 months' },
  { id: 'custom', label: 'Custom' },
];

function Kpi({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-neutral-900">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </>
  );
  return href ? (
    <Link
      to={href}
      className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card transition hover:border-neutral-300"
    >
      {body}
    </Link>
  ) : (
    <Card className="p-4">{body}</Card>
  );
}

interface Row {
  label: string;
  value: number;
}

function ChartTooltip({
  active,
  payload,
  label,
  money,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  money?: boolean;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-neutral-900">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-neutral-600">
        <span className="h-2 w-2 rounded-sm" style={{ background: MARK }} aria-hidden />
        {money ? formatMoney(v) : v} {unit}
      </p>
    </div>
  );
}

/** Card with a bar chart and an accessible table view toggle. */
function ChartCard({
  title,
  sub,
  rows,
  money,
  unit,
  horizontal,
  empty,
}: {
  title: string;
  sub?: string;
  rows: Row[];
  money?: boolean;
  unit: string;
  horizontal?: boolean;
  empty: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const hasData = rows.some((r) => r.value > 0);
  const height = horizontal ? Math.max(160, rows.length * 34 + 24) : 240;
  const fmt = (v: number) => (money ? formatMoney(v) : String(v));
  return (
    <Card>
      <CardHeader
        title={title}
        sub={sub}
        action={
          hasData && (
            <button
              type="button"
              onClick={() => setAsTable(!asTable)}
              className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
              aria-label={asTable ? `Show ${title} as chart` : `Show ${title} as table`}
              title={asTable ? 'Chart view' : 'Table view'}
            >
              {asTable ? <BarChart3 size={16} aria-hidden /> : <Table2 size={16} aria-hidden />}
            </button>
          )
        }
      />
      <div className="px-3 py-4">
        {!hasData ? (
          <p className="px-2 py-12 text-center text-sm text-neutral-500">{empty}</p>
        ) : asTable ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr>
                <th className="px-2 py-1 font-medium">{horizontal ? 'Item' : 'Pickup day'}</th>
                <th className="px-2 py-1 text-right font-medium">{unit}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="px-2 py-1.5">{r.label}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div
            style={{ height }}
            role="img"
            aria-label={`${title}: ${rows.map((r) => `${r.label} ${fmt(r.value)}`).join(', ')}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              {horizontal ? (
                <BarChart
                  data={rows}
                  layout="vertical"
                  margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
                  barCategoryGap={8}
                >
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis
                    type="number"
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    tickFormatter={fmt}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    width={190}
                  />
                  <Tooltip
                    cursor={{ fill: '#F5F5F5' }}
                    content={<ChartTooltip money={money} unit={unit} />}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="value"
                    fill={MARK}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={22}
                    label={{ position: 'right', fill: '#404040', fontSize: 12, formatter: fmt }}
                  />
                </BarChart>
              ) : (
                <BarChart
                  data={rows}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis
                    dataKey="label"
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    width={money ? 52 : 32}
                    allowDecimals={false}
                    tickFormatter={fmt}
                  />
                  <Tooltip
                    cursor={{ fill: '#F5F5F5' }}
                    content={<ChartTooltip money={money} unit={unit} />}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="value"
                    fill={MARK}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState<RangeKey>('week');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    document.title = 'Dashboard · +233 Kitchen Admin';
  }, []);

  const qs = new URLSearchParams({ range });
  if (range === 'custom' && from && to) {
    qs.set('from', from);
    qs.set('to', to);
  }
  const ready = range !== 'custom' || (!!from && !!to);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'analytics', qs.toString()],
    queryFn: () => api<AnalyticsResult>(`/admin/analytics?${qs}`),
    enabled: ready,
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub={
          data
            ? `${data.range.label} · by pickup date · revenue is estimated (orders are paid later)`
            : 'Overview of your orders'
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-lg border border-neutral-200 bg-white p-1"
          role="tablist"
          aria-label="Date range"
        >
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={range === r.id}
              onClick={() => setRange(r.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium',
                range === r.id
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="From date"
              className="w-40"
            />
            <span className="text-neutral-400">–</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="To date"
              className="w-40"
            />
          </div>
        )}
      </div>

      {isError && <ErrorState message="Could not load analytics." onRetry={refetch} />}
      {(isLoading || !ready) && !data && (
        <div className="grid place-items-center py-24">
          {ready ? (
            <Spinner />
          ) : (
            <p className="text-sm text-neutral-500">Choose a start and end date.</p>
          )}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {data.upcoming && (
            <div className="flex flex-col gap-4 overflow-hidden rounded-xl border border-neutral-900 bg-neutral-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-ghana-gold">
                  Upcoming pickup
                </p>
                <p className="mt-1 text-xl font-semibold">{data.upcoming.label}</p>
                <p className="text-sm text-neutral-300">
                  {data.upcoming.orders} order{data.upcoming.orders === 1 ? '' : 's'} ·{' '}
                  {formatMoney(data.upcoming.revenue)} estimated
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/admin/orders?date=${data.upcoming.date}&status=all`}>
                  <Button variant="secondary">View orders</Button>
                </Link>
                <Link to={`/admin/prep?date=${data.upcoming.date}`}>
                  <Button variant="brand">
                    <ClipboardList size={16} aria-hidden /> Prep sheet{' '}
                    <ArrowRight size={14} aria-hidden />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Orders" value={data.kpis.orders} sub={data.range.label} />
            <Kpi
              label="Revenue (est.)"
              value={formatMoney(data.kpis.revenue)}
              sub={`${formatMoney(data.kpis.unpaidRevenue)} still unpaid`}
            />
            <Kpi label="Avg order value" value={formatMoney(data.kpis.avgOrderValue)} />
            <Kpi
              label="Customers"
              value={`${data.kpis.newCustomers} new`}
              sub={`${data.kpis.returningCustomers} returning`}
            />
            <Kpi
              label="Pending (new)"
              value={data.kpis.pendingOrders}
              sub="Need confirming →"
              href="/admin/orders?status=new"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Revenue per pickup day"
              sub="Last 12 pickup days"
              rows={data.weekly.map((w) => ({ label: w.label, value: w.revenue }))}
              money
              unit="revenue"
              empty="No orders in the last 12 weeks yet."
            />
            <ChartCard
              title="Orders per pickup day"
              sub="Last 12 pickup days"
              rows={data.weekly.map((w) => ({ label: w.label, value: w.orders }))}
              unit="orders"
              empty="No orders in the last 12 weeks yet."
            />
            <ChartCard
              title="Best sellers"
              sub="Boxes sold in range"
              rows={data.bestSellers.map((b) => ({ label: b.name, value: b.quantity }))}
              unit="sold"
              horizontal
              empty="No sales in this range."
            />
            <ChartCard
              title="Most popular extras & options"
              sub="Units in range"
              rows={data.extras.map((e) => ({
                label: `${e.name} · ${shortItem(e.item)}`,
                value: e.count,
              }))}
              unit="units"
              horizontal
              empty="No extras ordered in this range."
            />
            <ChartCard
              title="Orders by pickup window"
              sub="In range"
              rows={data.byWindow.map((w) => ({ label: w.label, value: w.orders }))}
              unit="orders"
              empty="No orders in this range."
            />
          </div>
        </div>
      )}
    </>
  );
}
