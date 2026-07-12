import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, TrendingUp, Users, DollarSign, ShieldAlert, Search,
  AlertTriangle, BarChart2, GitBranch, Map, AlertCircle, Zap,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useProfileStore } from '../stores/profileStore';
import { fetchAdminMetrics, updateRentcastLimit, updateRentcastSetting, AdminMetrics } from '../lib/adminApi';
import {
  fetchAnalyticsOverview, fetchAnalyticsRetention, fetchAnalyticsFunnel,
  fetchAnalyticsFeatures, fetchAnalyticsJourneys, fetchJourneyDetail,
  fetchAnalyticsErrors, fetchAnalyticsPowerUsers, fetchModalFunnel,
  groupFeatures,
  FUNNEL_STEP_LABELS,
  DateRange,
  AnalyticsOverview, RetentionData, FunnelStep, GroupedFeature,
  JourneyRow, JourneyEvent, ErrorRow, DropoffData, PowerUserRow, ModalFunnelData,
} from '../lib/adminAnalyticsApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtRelative(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return fmtDate(iso);
}

function pct(n: number, d: number) {
  if (!d) return '—';
  return `${Math.round((n / d) * 100)}%`;
}

function planBadge(plan: string | null) {
  const p = plan ?? 'free';
  const styles: Record<string, string> = {
    free:       'bg-slate-100 text-slate-600',
    starter:    'bg-blue-100 text-blue-700',
    plus:       'bg-purple-100 text-purple-700',
    pro:        'bg-orange-100 text-orange-700',
    small_team: 'bg-teal-100 text-teal-700',
    agency:     'bg-indigo-100 text-indigo-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${styles[p] ?? styles.free}`}>
      {p.replace('_', ' ')}
    </span>
  );
}

function eventLabel(name: string) {
  return FUNNEL_STEP_LABELS[name] ?? name.replace(/_/g, ' ');
}

// ── Shared layout components ──────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, icon }: {
  label: string; value: string | number; sub?: string; accent?: boolean; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
          {icon}
        </div>
      </div>
      <div>
        <p className={`text-2xl font-bold ${accent ? 'text-orange-500' : 'text-slate-900'}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">{children}</th>;
}

function Td({ children, mono, muted }: { children: React.ReactNode; mono?: boolean; muted?: boolean }) {
  return (
    <td className={`px-4 py-2.5 text-sm border-t border-slate-100 ${mono ? 'font-mono text-xs' : ''} ${muted ? 'text-slate-400' : 'text-slate-700'}`}>
      {children}
    </td>
  );
}

function EmptyRow({ cols, message = 'No data yet' }: { cols: number; message?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-6 text-center text-sm text-slate-400">{message}</td>
    </tr>
  );
}

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-2xl" />)}
      </div>
      {[1, 2, 3].map(i => <div key={i} className="h-48 bg-slate-200 rounded-2xl" />)}
    </div>
  );
}

// ── Forbidden ─────────────────────────────────────────────────────────────────

function Forbidden() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
      <ShieldAlert className="w-12 h-12 text-slate-300" />
      <h1 className="text-2xl font-bold text-slate-800">403 — Access Denied</h1>
      <p className="text-slate-500 max-w-sm">You don't have permission to view this page.</p>
      <button onClick={() => navigate('/')} className="text-orange-500 text-sm underline">Go home</button>
    </div>
  );
}

// ── Date range selector ───────────────────────────────────────────────────────

const DATE_RANGES: Array<{ value: DateRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d',    label: '7 days' },
  { value: '30d',   label: '30 days' },
  { value: 'all',   label: 'All time' },
];

function DateRangeSelector({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
      {DATE_RANGES.map(r => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
            value === r.value
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type AdminTab = 'overview' | 'analytics' | 'funnels' | 'journeys' | 'errors' | 'users';

const TABS: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
  { id: 'overview',  label: 'Overview',   icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: 'analytics', label: 'Analytics',  icon: <BarChart2  className="w-3.5 h-3.5" /> },
  { id: 'funnels',   label: 'Funnels',    icon: <GitBranch  className="w-3.5 h-3.5" /> },
  { id: 'journeys',  label: 'Journeys',   icon: <Map        className="w-3.5 h-3.5" /> },
  { id: 'errors',    label: 'Errors',     icon: <AlertCircle className="w-3.5 h-3.5" /> },
  { id: 'users',     label: 'Users',      icon: <Zap        className="w-3.5 h-3.5" /> },
];

// ── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab({
  overview, retention, features, loading,
}: {
  overview: AnalyticsOverview | null;
  retention: RetentionData | null;
  features: GroupedFeature[] | null;
  loading: boolean;
}) {
  if (loading) return <TabSpinner />;

  const searchToSignup   = overview && overview.searches > 0
    ? `${Math.round((overview.signups / overview.searches) * 100)}%` : '—';
  const signupToPurchase = overview && overview.signups > 0
    ? `${Math.round((overview.purchases / overview.signups) * 100)}%` : '—';

  return (
    <div className="space-y-6">

      {/* Overview cards */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Visitors"           value={overview.visitors}          icon={<Users className="w-4 h-4" />} />
          <StatCard label="Anonymous"          value={overview.anon_visitors}     icon={<Users className="w-4 h-4" />} />
          <StatCard label="Logged-in users"    value={overview.logged_in_users}   icon={<Users className="w-4 h-4" />} />
          <StatCard label="Sessions"           value={overview.sessions}          icon={<BarChart2 className="w-4 h-4" />} />
          <StatCard label="Avg events/session" value={overview.avg_events_per_session} icon={<BarChart2 className="w-4 h-4" />} />
          <StatCard label="Searches"           value={overview.searches}          icon={<Search className="w-4 h-4" />} />
          <StatCard label="Pricing views"      value={overview.pricing_views}     icon={<TrendingUp className="w-4 h-4" />} />
          <StatCard label="Signups"            value={overview.signups}           icon={<Users className="w-4 h-4" />} accent={overview.signups > 0} />
          <StatCard label="Checkout starts"    value={overview.checkout_starts}   icon={<DollarSign className="w-4 h-4" />} />
          <StatCard label="Purchases"          value={overview.purchases}         icon={<DollarSign className="w-4 h-4" />} accent={overview.purchases > 0} />
        </div>
      )}

      {/* Conversion rates */}
      {overview && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Search → Signup</p>
            <p className="text-3xl font-bold text-slate-900">{searchToSignup}</p>
            <p className="text-xs text-slate-400 mt-1">{overview.searches} searches → {overview.signups} signups</p>
          </div>
          <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Signup → Purchase</p>
            <p className="text-3xl font-bold text-slate-900">{signupToPurchase}</p>
            <p className="text-xs text-slate-400 mt-1">{overview.signups} signups → {overview.purchases} purchases</p>
          </div>
        </div>
      )}

      {/* Retention */}
      {retention && (
        <Section title="Retention — all time windows">
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Free active 7d',  value: retention.free_active_7d },
              { label: 'Free active 30d', value: retention.free_active_30d },
              { label: 'Paid active 7d',  value: retention.paid_active_7d,  accent: true },
              { label: 'Paid active 30d', value: retention.paid_active_30d, accent: true },
              { label: 'Inactive 14d+',   value: retention.inactive_14d },
              { label: 'Inactive 30d+',   value: retention.inactive_30d },
            ].map(({ label, value, accent }) => (
              <div key={label} className={`rounded-xl p-4 text-center ${accent ? 'bg-orange-50' : 'bg-slate-50'}`}>
                <p className={`text-2xl font-bold ${accent ? 'text-orange-600' : 'text-slate-900'}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Feature usage */}
      {features && features.length > 0 && (
        <Section title="Feature usage">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Feature</Th>
                  <Th>Events</Th>
                  <Th>Unique users</Th>
                  <Th>Anonymous</Th>
                  <Th>Last used</Th>
                </tr>
              </thead>
              <tbody>
                {features.map(f => (
                  <tr key={f.name} className="hover:bg-slate-50">
                    <Td><span className="font-medium">{f.name}</span></Td>
                    <Td><span className="font-semibold text-orange-500">{f.event_count.toLocaleString()}</span></Td>
                    <Td>{f.unique_users.toLocaleString()}</Td>
                    <Td muted>{f.anon_users.toLocaleString()}</Td>
                    <Td muted>{fmtRelative(f.last_used)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {!overview && !loading && (
        <div className="text-center py-16 text-slate-400 text-sm">No analytics data yet. Events will appear after the first tracked session.</div>
      )}
    </div>
  );
}

// ── Funnels tab ───────────────────────────────────────────────────────────────

function FunnelsTab({ steps, modal, loading }: { steps: FunnelStep[] | null; modal: ModalFunnelData | null; loading: boolean }) {
  if (loading) return <TabSpinner />;
  if (!steps)  return null;

  const topStep = steps[0]?.unique_visitors ?? 0;

  return (
    <div className="space-y-6">
      <Section title="Acquisition funnel — anonymous → signup → purchase">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Step</Th>
                <Th>Total events</Th>
                <Th>Unique visitors</Th>
                <Th>Drop-off from prev</Th>
                <Th>Conv. from start</Th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => {
                const prev      = steps[i - 1]?.unique_visitors ?? null;
                const dropoff   = prev ? `−${Math.round((1 - s.unique_visitors / prev) * 100)}%` : '—';
                const fromStart = topStep > 0 ? pct(s.unique_visitors, topStep) : '—';
                const barW      = topStep > 0 ? Math.round((s.unique_visitors / topStep) * 100) : 0;
                return (
                  <tr key={s.event_name} className="hover:bg-slate-50">
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-semibold flex-shrink-0">{i + 1}</span>
                        <span className="font-medium">{eventLabel(s.event_name)}</span>
                      </div>
                    </Td>
                    <Td>{s.total.toLocaleString()}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{s.unique_visitors.toLocaleString()}</span>
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-1.5 bg-teal-400 rounded-full" style={{ width: `${barW}%` }} />
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {dropoff !== '—'
                        ? <span className="text-red-500 font-semibold">{dropoff}</span>
                        : <span className="text-slate-400">—</span>}
                    </Td>
                    <Td>
                      <span className={fromStart === '100%' ? 'text-slate-500' : 'font-semibold text-slate-700'}>{fromStart}</span>
                    </Td>
                  </tr>
                );
              })}
              {steps.length === 0 && <EmptyRow cols={5} message="No funnel events yet" />}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Signup modal funnel */}
      {modal && (
        <Section title="Signup modal — shown → dismissed / clicked">
          <div className="grid grid-cols-4 gap-6 p-5 text-center">
            <div>
              <div className="text-2xl font-bold text-slate-800">{modal.shown.toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-1">Shown</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">{modal.dismissed.toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-1">Dismissed</div>
              <div className="text-xs text-slate-400">{pct(modal.dismissed, modal.shown)} of shown</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-teal-600">{modal.clicked.toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-1">Auth clicked</div>
              <div className="text-xs text-slate-400">{pct(modal.clicked, modal.shown)} of shown</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-500">{pct(modal.clicked, modal.shown)}</div>
              <div className="text-xs text-slate-500 mt-1">Conversion</div>
            </div>
          </div>
        </Section>
      )}

      {/* Monetization mini-funnel */}
      <Section title="Monetization funnel — report → purchase">
        <div className="p-5">
          {(['report_viewed', 'pricing_viewed', 'checkout_started', 'purchase_completed'] as const).map((name, i) => {
            const s = steps.find(r => r.event_name === name);
            if (!s) return null;
            const topV = steps.find(r => r.event_name === 'report_viewed')?.unique_visitors ?? 1;
            return (
              <div key={name} className="flex items-center gap-4 py-2">
                <span className="w-20 text-xs text-slate-500 text-right">{eventLabel(name)}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-4 bg-orange-400 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(4, Math.round((s.unique_visitors / topV) * 100))}%` }}
                  >
                    <span className="text-xs text-white font-semibold">{s.unique_visitors}</span>
                  </div>
                </div>
                {i > 0 && (
                  <span className="w-12 text-xs text-red-500 font-semibold">
                    {pct(s.unique_visitors, steps.find(r => r.event_name === ['report_viewed', 'pricing_viewed', 'checkout_started', 'purchase_completed'][i - 1])?.unique_visitors ?? 0)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ── Journey timeline ──────────────────────────────────────────────────────────

function JourneyTimeline({ events }: { events: JourneyEvent[] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (events.length === 0) {
    return <div className="px-4 py-6 text-sm text-slate-400 text-center">No events recorded</div>;
  }

  return (
    <div className="px-4 py-3 space-y-0.5 max-h-96 overflow-y-auto">
      {events.map((e, i) => {
        const hasProps = Object.keys(e.properties ?? {}).length > 0;
        return (
          <div key={i} className="flex gap-3 text-xs py-1.5 border-b border-slate-50 last:border-0">
            <span className="text-slate-400 w-36 flex-shrink-0 font-mono">{fmtTime(e.created_at)}</span>
            <span className="font-medium text-slate-700 w-44 flex-shrink-0">{e.event_name}</span>
            <span className="text-slate-400 flex-1 truncate">{e.path ?? '—'}</span>
            {e.plan && <span className="text-slate-400">{e.plan}</span>}
            {hasProps && (
              <button
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                className="text-orange-400 hover:text-orange-600 font-medium flex-shrink-0"
              >
                {expandedIdx === i ? '▲' : '▼'}
              </button>
            )}
          </div>
        );
      }).concat(
        expandedIdx !== null && events[expandedIdx] ? [
          <pre key="exp" className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 font-mono overflow-x-auto mt-1">
            {JSON.stringify(events[expandedIdx].properties, null, 2)}
          </pre>
        ] : []
      )}
    </div>
  );
}

// ── Journeys tab ──────────────────────────────────────────────────────────────

function JourneysTab({
  rows, loading, onLoadDetail,
}: {
  rows: JourneyRow[] | null;
  loading: boolean;
  onLoadDetail: (anonId: string) => Promise<JourneyEvent[]>;
}) {
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [detail, setDetail]         = useState<Record<string, JourneyEvent[]>>({});
  const [detailLoading, setLoading] = useState<Record<string, boolean>>({});

  if (loading) return <TabSpinner />;

  const toggleRow = async (anonId: string) => {
    if (expanded === anonId) { setExpanded(null); return; }
    setExpanded(anonId);
    if (!detail[anonId] && !detailLoading[anonId]) {
      setLoading(prev => ({ ...prev, [anonId]: true }));
      const events = await onLoadDetail(anonId);
      setDetail(prev => ({ ...prev, [anonId]: events }));
      setLoading(prev => ({ ...prev, [anonId]: false }));
    }
  };

  return (
    <Section title={`Recent user journeys (${rows?.length ?? 0})`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <Th></Th>
              <Th>Visitor / User</Th>
              <Th>Plan</Th>
              <Th>First seen</Th>
              <Th>Last seen</Th>
              <Th>Sessions</Th>
              <Th>Searches</Th>
              <Th>Reports</Th>
              <Th>Pricing</Th>
              <Th>Checkout</Th>
              <Th>Last event</Th>
            </tr>
          </thead>
          <tbody>
            {!rows || rows.length === 0
              ? <EmptyRow cols={11} message="No journey data yet" />
              : rows.map(r => {
                  const isExpanded = expanded === r.anonymous_id;
                  const isLoading  = detailLoading[r.anonymous_id];
                  return [
                    <tr
                      key={r.anonymous_id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => toggleRow(r.anonymous_id)}
                    >
                      <Td>
                        {isLoading
                          ? <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                          : isExpanded
                          ? <ChevronDown className="w-3 h-3 text-slate-400" />
                          : <ChevronRight className="w-3 h-3 text-slate-400" />}
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-0.5">
                          {r.email
                            ? <span className="font-medium">{r.email}</span>
                            : <span className="font-mono text-slate-500">{r.anon_short}</span>}
                          {r.email && <span className="font-mono text-xs text-slate-400">{r.anon_short}</span>}
                        </div>
                      </Td>
                      <Td>{planBadge(r.current_plan)}</Td>
                      <Td muted>{fmtDate(r.first_seen)}</Td>
                      <Td muted>{fmtRelative(r.last_seen)}</Td>
                      <Td>{r.total_sessions}</Td>
                      <Td>{r.total_searches}</Td>
                      <Td>{r.reports_viewed}</Td>
                      <Td>{r.pricing_views}</Td>
                      <Td>
                        {Number(r.checkout_starts) > 0
                          ? <span className="font-semibold text-orange-500">{r.checkout_starts}</span>
                          : <span className="text-slate-300">0</span>}
                      </Td>
                      <Td muted>{r.last_event ? eventLabel(r.last_event) : '—'}</Td>
                    </tr>,
                    isExpanded && (
                      <tr key={`${r.anonymous_id}_detail`}>
                        <td colSpan={11} className="bg-slate-50 border-t border-slate-100">
                          {isLoading
                            ? <div className="px-4 py-4 text-xs text-slate-400">Loading timeline…</div>
                            : detail[r.anonymous_id]
                            ? <JourneyTimeline events={detail[r.anonymous_id]} />
                            : null}
                        </td>
                      </tr>
                    ),
                  ];
                })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ── Errors tab ────────────────────────────────────────────────────────────────

function ErrorsTab({
  errors, dropoffs, loading,
}: {
  errors: ErrorRow[] | null;
  dropoffs: DropoffData | null;
  loading: boolean;
}) {
  if (loading) return <TabSpinner />;

  return (
    <div className="space-y-6">

      {/* Drop-off signals */}
      {dropoffs && (
        <Section title="Drop-off signals">
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Pricing → no checkout',  value: dropoffs.pricing_no_checkout,   desc: 'Saw pricing, skipped checkout' },
              { label: 'Checkout → no purchase', value: dropoffs.checkout_no_purchase,  desc: 'Started checkout, never bought' },
              { label: 'Signup, never returned', value: dropoffs.signup_never_returned, desc: 'Only 1 session after signup' },
              { label: 'Signup, no report',      value: dropoffs.signup_no_report,      desc: 'Never viewed a report post-signup' },
            ].map(({ label, value, desc }) => (
              <div key={label} className={`rounded-xl p-4 ${value > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                <p className={`text-2xl font-bold ${value > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p>
                <p className="text-xs font-semibold text-slate-700 mt-1">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Error events */}
      <Section title="Error events">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Event</Th>
                <Th>Count</Th>
                <Th>Affected users</Th>
                <Th>Last seen</Th>
                <Th>Sample payload</Th>
              </tr>
            </thead>
            <tbody>
              {!errors || errors.length === 0
                ? <EmptyRow cols={5} message="No error events recorded — good sign!" />
                : errors.map(e => (
                    <tr key={e.event_name} className="hover:bg-slate-50">
                      <Td><span className="font-mono text-xs text-red-600">{e.event_name}</span></Td>
                      <Td><span className="font-semibold text-red-600">{e.event_count}</span></Td>
                      <Td>{e.affected_users}</Td>
                      <Td muted>{fmtRelative(e.last_occurrence)}</Td>
                      <Td>
                        {e.sample_properties
                          ? <span className="font-mono text-xs text-slate-500 truncate max-w-xs block">
                              {JSON.stringify(e.sample_properties).slice(0, 80)}…
                            </span>
                          : <span className="text-slate-300">—</span>}
                      </Td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ── Power users tab ───────────────────────────────────────────────────────────

const SIGNAL_LABELS: Record<string, string> = {
  property_search_completed: 'search',
  report_viewed:             'report',
  pricing_viewed:            'pricing',
  checkout_started:          'checkout',
  free_limit_reached:        'limit hit',
  report_downloaded:         'download',
  rent_review_created:       'rent review',
  portfolio_property_added:  'portfolio',
  watchlist_added:           'watchlist',
  purchase_completed:        'purchased',
};

function PowerUsersTab({ rows, loading }: { rows: PowerUserRow[] | null; loading: boolean }) {
  if (loading) return <TabSpinner />;

  return (
    <Section title="High buying-intent users">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <Th>Visitor / User</Th>
              <Th>Plan</Th>
              <Th>Intent score</Th>
              <Th>Signals</Th>
              <Th>Last seen</Th>
            </tr>
          </thead>
          <tbody>
            {!rows || rows.length === 0
              ? <EmptyRow cols={5} message="No high-intent users yet" />
              : rows.map(r => (
                  <tr key={r.anonymous_id} className="hover:bg-slate-50">
                    <Td>
                      <div className="flex flex-col gap-0.5">
                        {r.email
                          ? <span className="font-medium">{r.email}</span>
                          : <span className="font-mono text-slate-500">{r.anon_short}</span>}
                        {r.email && <span className="font-mono text-xs text-slate-400">{r.anon_short}</span>}
                      </div>
                    </Td>
                    <Td>{planBadge(r.current_plan)}</Td>
                    <Td>
                      <span className={`text-lg font-bold ${r.intent_score >= 10 ? 'text-orange-500' : 'text-slate-700'}`}>
                        {r.intent_score}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {(r.signals ?? []).map(s => (
                          <span key={s} className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            s === 'purchase_completed' ? 'bg-teal-100 text-teal-700' :
                            s === 'checkout_started'  ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {SIGNAL_LABELS[s] ?? s}
                          </span>
                        ))}
                      </div>
                    </Td>
                    <Td muted>{fmtRelative(r.last_seen)}</Td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate            = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { profile }         = useProfileStore();

  // ── Existing metrics state ─────────────────────────────────────────────────
  const [metrics,     setMetrics]     = useState<AdminMetrics | null>(null);
  const [phase,       setPhase]       = useState<'loading' | 'forbidden' | 'error' | 'ok'>('loading');
  const [errorMsg,    setErrorMsg]    = useState('');
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [limitInput,  setLimitInput]  = useState('');
  const [limitSaving, setLimitSaving] = useState(false);
  const [limitSaved,  setLimitSaved]  = useState(false);
  const [limitError,  setLimitError]  = useState<string | null>(null);
  const [anchorInput,  setAnchorInput]  = useState('');
  const [anchorSaving, setAnchorSaving] = useState(false);
  const [anchorSaved,  setAnchorSaved]  = useState(false);
  const [anchorError,  setAnchorError]  = useState<string | null>(null);

  // ── Analytics tab state ───────────────────────────────────────────────────
  const [activeTab,   setActiveTab]   = useState<AdminTab>('overview');
  const [dateRange,   setDateRange]   = useState<DateRange>('7d');
  const [tabLoading,  setTabLoading]  = useState(false);

  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  const [analyticsRetention, setRetention]        = useState<RetentionData | null>(null);
  const [analyticsFeatures,  setFeatures]         = useState<GroupedFeature[] | null>(null);
  const [funnelSteps,        setFunnelSteps]      = useState<FunnelStep[] | null>(null);
  const [modalFunnel,        setModalFunnel]      = useState<ModalFunnelData | null>(null);
  const [journeyRows,        setJourneyRows]      = useState<JourneyRow[] | null>(null);
  const [errorRows,          setErrorRows]        = useState<ErrorRow[] | null>(null);
  const [dropoffs,           setDropoffs]         = useState<DropoffData | null>(null);
  const [powerUsers,         setPowerUsers]       = useState<PowerUserRow[] | null>(null);

  // Track which (tab, range) combos have been loaded to avoid redundant fetches
  const loadedRef = useRef<Set<string>>(new Set());

  // ── Existing metrics load ─────────────────────────────────────────────────
  const loadMetrics = async () => {
    setPhase('loading');
    const result = await fetchAdminMetrics();
    if (result.status === 'ok') {
      setMetrics(result.data);
      setLimitInput(String(result.data.rentcastUsage?.monthlyLimit ?? 1000));
      setAnchorInput(String(result.data.rentcastUsage?.billingAnchorDay ?? 7));
      setRefreshedAt(new Date());
      setPhase('ok');
    } else if (result.status === 'forbidden') {
      setPhase('forbidden');
    } else {
      setErrorMsg(result.message);
      setPhase('error');
    }
  };

  const saveLimit = async () => {
    const n = parseInt(limitInput);
    if (isNaN(n) || n < 1) { setLimitError('Must be a positive number'); return; }
    setLimitSaving(true);
    setLimitError(null);
    const result = await updateRentcastLimit(n);
    setLimitSaving(false);
    if (result.ok) {
      setLimitSaved(true);
      setTimeout(() => setLimitSaved(false), 2000);
      await loadMetrics();
    } else {
      setLimitError(result.error ?? 'Failed to save');
    }
  };

  const saveAnchor = async () => {
    const n = parseInt(anchorInput);
    if (isNaN(n) || n < 1 || n > 28) { setAnchorError('Must be 1–28'); return; }
    setAnchorSaving(true);
    setAnchorError(null);
    const result = await updateRentcastSetting('rentcast_billing_anchor_day', n);
    setAnchorSaving(false);
    if (result.ok) {
      setAnchorSaved(true);
      setTimeout(() => setAnchorSaved(false), 2000);
      await loadMetrics();
    } else {
      setAnchorError(result.error ?? 'Failed to save');
    }
  };

  // ── Analytics tab loader ──────────────────────────────────────────────────
  const loadAnalyticsTab = async (tab: AdminTab, range: DateRange) => {
    if (tab === 'overview') return;
    const key = `${tab}:${range}`;
    if (loadedRef.current.has(key)) return;
    loadedRef.current.add(key);
    setTabLoading(true);

    try {
      if (tab === 'analytics') {
        const [ov, ret, feat] = await Promise.all([
          fetchAnalyticsOverview(range),
          fetchAnalyticsRetention(range),
          fetchAnalyticsFeatures(range),
        ]);
        if (ov.status === 'ok')   setAnalyticsOverview(ov.data);
        if (ret.status === 'ok')  setRetention(ret.data);
        if (feat.status === 'ok') setFeatures(groupFeatures(feat.data));
      } else if (tab === 'funnels') {
        const [res, modalRes] = await Promise.all([
          fetchAnalyticsFunnel(range),
          fetchModalFunnel(range),
        ]);
        if (res.status === 'ok')      setFunnelSteps(res.data);
        if (modalRes.status === 'ok') setModalFunnel(modalRes.data);
      } else if (tab === 'journeys') {
        const res = await fetchAnalyticsJourneys(range);
        if (res.status === 'ok') setJourneyRows(res.data);
      } else if (tab === 'errors') {
        const res = await fetchAnalyticsErrors(range);
        if (res.status === 'ok') {
          setErrorRows(res.data.errors);
          setDropoffs(res.data.dropoffs);
        }
      } else if (tab === 'users') {
        const res = await fetchAnalyticsPowerUsers(range);
        if (res.status === 'ok') setPowerUsers(res.data);
      }
    } finally {
      setTabLoading(false);
    }
  };

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    loadAnalyticsTab(tab, dateRange);
  };

  const handleRangeChange = (range: DateRange) => {
    // Clear loaded cache so switching range forces a refetch
    loadedRef.current.clear();
    setAnalyticsOverview(null);
    setRetention(null);
    setFeatures(null);
    setFunnelSteps(null);
    setModalFunnel(null);
    setJourneyRows(null);
    setErrorRows(null);
    setDropoffs(null);
    setPowerUsers(null);
    setDateRange(range);
    loadAnalyticsTab(activeTab, range);
  };

  const handleRefresh = () => {
    loadedRef.current.clear();
    setAnalyticsOverview(null);
    setRetention(null);
    setFeatures(null);
    setFunnelSteps(null);
    setModalFunnel(null);
    setJourneyRows(null);
    setErrorRows(null);
    setDropoffs(null);
    setPowerUsers(null);
    loadMetrics();
    if (activeTab !== 'overview') {
      loadAnalyticsTab(activeTab, dateRange);
    }
  };

  const loadJourneyDetail = async (anonId: string): Promise<JourneyEvent[]> => {
    const res = await fetchJourneyDetail(anonId, dateRange);
    return res.status === 'ok' ? res.data : [];
  };

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (profile && !profile.is_admin) { setPhase('forbidden'); return; }
    loadMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, profile]);

  if (phase === 'forbidden') return <Forbidden />;
  if (phase === 'error') return (
    <div className="min-h-[60vh] flex items-center justify-center text-slate-500 text-sm">
      Failed to load: {errorMsg}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {refreshedAt ? `Refreshed ${refreshedAt.toLocaleTimeString()}` : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab !== 'overview' && (
              <DateRangeSelector value={dateRange} onChange={handleRangeChange} />
            )}
            <button
              onClick={handleRefresh}
              disabled={phase === 'loading'}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white rounded-xl ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${phase === 'loading' || tabLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {phase === 'loading' && activeTab === 'overview' && <Skeleton />}

        {/* ── Overview tab ───────────────────────────────────────────────── */}
        {activeTab === 'overview' && phase === 'ok' && metrics && (
          <>
            {/* Overview cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard label="Signups today"  value={metrics.signupsToday}   icon={<Users className="w-4 h-4" />} accent={metrics.signupsToday > 0} />
              <StatCard label="Signups 7d"     value={metrics.signups7Days}   sub={`${metrics.totalUsers} total`} icon={<TrendingUp className="w-4 h-4" />} />
              <StatCard label="Paid users"     value={metrics.activePaidUsers} sub={`${metrics.conversionRate}% conversion`} icon={<Users className="w-4 h-4" />} accent />
              <StatCard label="MRR estimate"   value={fmt$(metrics.mrrEstimate)} icon={<DollarSign className="w-4 h-4" />} accent />
              <StatCard label="Revenue MTD"    value={fmt$(metrics.revenueMtd)}  icon={<DollarSign className="w-4 h-4" />} />
              <StatCard label="Anon searches"  value={metrics.anonSearchesThisPeriod} sub={`${metrics.anonIpsThisPeriod} unique IPs`} icon={<Search className="w-4 h-4" />} />
            </div>

            {/* Plan breakdown */}
            <Section title="Plan breakdown">
              <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(metrics.planBreakdown).map(([plan, count]) => (
                  <div key={plan} className="bg-slate-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900">{count}</p>
                    <p className="text-xs text-slate-500 capitalize mt-1">{plan}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* RentCast usage */}
            {(() => {
              const u = metrics.rentcastUsage;
              const pl = metrics.rentcastPlan;
              const pct = u?.usagePct ?? 0;
              const isOver = pct >= 100;
              const barColor   = isOver ? 'bg-red-500' : pct >= 90 ? 'bg-red-400' : pct >= 80 ? 'bg-amber-400' : 'bg-teal-500';
              const labelColor = isOver ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-slate-700';
              return (
                <Section title="RentCast API — this month">
                  <div className="p-5 space-y-4">

                    {/* Plan badge + cost summary */}
                    <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">API {pl?.name ?? 'Foundation'} plan</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-700">Active</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {fmt$(pl?.baseFee ?? 74)}/mo · {(pl?.includedCalls ?? 1000).toLocaleString()} requests included · ${pl?.overageRate ?? 0.06}/request overage
                        </p>
                        {/* Reset countdown */}
                        {u?.nextResetDate && (() => {
                          const d = u.daysUntilReset;
                          const label = d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
                          const resetFmt = new Date(u.nextResetDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          return (
                            <p className={`text-xs font-medium mt-1 ${d <= 1 ? 'text-orange-600' : 'text-slate-500'}`}>
                              Billing resets {label} · {resetFmt}
                            </p>
                          );
                        })()}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 mb-0.5">Est. total this month</p>
                        <p className={`text-2xl font-bold ${isOver ? 'text-red-600' : 'text-slate-900'}`}>
                          {fmt$(u?.totalCostThisMonth ?? pl?.baseFee ?? 74)}
                        </p>
                        {isOver && (
                          <p className="text-xs text-red-500 mt-0.5">
                            {fmt$(pl?.baseFee ?? 74)} base + {fmt$(u?.overageCostThisMonth ?? 0)} overage ({u?.overageCallsThisMonth ?? 0} calls × ${pl?.overageRate ?? 0.06})
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Usage bar */}
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className={`text-3xl font-bold ${labelColor}`}>
                          {(u?.callsThisMonth ?? 0).toLocaleString()}
                          <span className="text-base font-normal text-slate-400 ml-1">
                            / {(u?.includedCalls ?? 1000).toLocaleString()} included
                          </span>
                        </span>
                        <span className={`text-sm font-semibold ${labelColor}`}>{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div className={`h-3 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>
                          {isOver
                            ? <span className="text-red-500 font-semibold">{(u?.overageCallsThisMonth ?? 0)} overage calls this month</span>
                            : `${(u?.remainingCalls ?? 0).toLocaleString()} calls remaining this month`}
                        </span>
                        <span>alert threshold: 80% · 90% · 100%</span>
                      </div>
                      {isOver && (
                        <div className="flex items-center gap-2 mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <p className="text-sm font-semibold text-red-700">
                            Over included limit — overage calls billed at ${pl?.overageRate ?? 0.06}/request. Consider upgrading to the Growth plan (5,000 calls, $199/mo) to reduce overage costs.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Settings row: alert threshold + billing anchor day */}
                    <div className="flex flex-wrap items-end gap-6 pt-2 border-t border-slate-100">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">
                          Alert threshold <span className="text-slate-400">(warn at this many calls/mo)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min={1} step={100} value={limitInput}
                            onChange={e => { setLimitInput(e.target.value); setLimitError(null); }}
                            className="w-32 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <button
                            onClick={saveLimit}
                            disabled={limitSaving || limitInput === String(u?.monthlyLimit)}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-900 hover:bg-slate-700 text-white transition-colors disabled:opacity-40"
                          >
                            {limitSaved ? 'Saved!' : limitSaving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                        {limitError && <p className="text-xs text-red-500 mt-1">{limitError}</p>}
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">
                          Billing resets on day <span className="text-slate-400">(day of month, 1–28)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min={1} max={28} step={1} value={anchorInput}
                            onChange={e => { setAnchorInput(e.target.value); setAnchorError(null); }}
                            className="w-20 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <button
                            onClick={saveAnchor}
                            disabled={anchorSaving || anchorInput === String(u?.billingAnchorDay)}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-900 hover:bg-slate-700 text-white transition-colors disabled:opacity-40"
                          >
                            {anchorSaved ? 'Saved!' : anchorSaving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                        {anchorError && <p className="text-xs text-red-500 mt-1">{anchorError}</p>}
                      </div>
                    </div>

                    {/* All-time cache stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs text-slate-500 mb-1">Property cache (all-time)</p>
                        <p className="text-lg font-bold text-slate-900">{metrics.apiCostEstimate.propertyCacheRows.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">unique addresses cached</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs text-slate-500 mb-1">Market cache (all-time)</p>
                        <p className="text-lg font-bold text-slate-900">{metrics.apiCostEstimate.marketCacheRows.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">ZIP lookups cached</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs text-slate-500 mb-1">ZIP page misses</p>
                        <p className="text-lg font-bold text-slate-900">{metrics.apiCostEstimate.zipPageTotalMisses.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">today: {metrics.zipMissesToday}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs text-slate-500 mb-1">Total API calls (all-time)</p>
                        <p className="text-lg font-bold text-slate-900">{metrics.apiCostEstimate.totalApiCalls.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">cache hits saved the rest</p>
                      </div>
                    </div>

                  </div>
                </Section>
              );
            })()}

            {/* Recent signups */}
            <Section title="Recent signups">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr><Th>Date</Th><Th>Email</Th><Th>Plan</Th><Th>User ID</Th></tr></thead>
                  <tbody>
                    {metrics.recentSignups.length === 0
                      ? <EmptyRow cols={4} message="No signups yet" />
                      : metrics.recentSignups.map(u => (
                          <tr key={u.userId} className="hover:bg-slate-50">
                            <Td>{fmtDate(u.createdAt)}</Td>
                            <Td>{u.email ?? '—'}</Td>
                            <Td>{planBadge(u.plan)}</Td>
                            <Td mono>{u.userId.slice(-8)}</Td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Recent paid conversions */}
            <Section title="Recent paid conversions">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr><Th>Date</Th><Th>Email</Th><Th>Plan</Th><Th>Price</Th><Th>Billing</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {metrics.recentPaidConversions.length === 0
                      ? <EmptyRow cols={6} message="No paid users yet" />
                      : metrics.recentPaidConversions.map(u => (
                          <tr key={u.userId} className="hover:bg-slate-50">
                            <Td>{fmtDate(u.periodStart)}</Td>
                            <Td>{u.email ?? '—'}</Td>
                            <Td>{planBadge(u.plan)}</Td>
                            <Td>{u.price ? fmt$(u.price) : '—'}</Td>
                            <Td>{u.billingCycle ?? '—'}</Td>
                            <Td><span className={`text-xs font-semibold ${u.status === 'active' ? 'text-teal-600' : 'text-slate-500'}`}>{u.status}</span></Td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Top ZIPs + recent searches */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Top zip codes by hits">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><Th>ZIP</Th><Th>Property type</Th><Th>Hits</Th></tr></thead>
                    <tbody>
                      {metrics.topZipsByHits.length === 0
                        ? <EmptyRow cols={3} message="No market searches yet" />
                        : metrics.topZipsByHits.map((z, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <Td mono>{z.zip_code}</Td>
                              <Td>{z.property_type}</Td>
                              <Td><span className="font-semibold text-orange-500">{z.hit_count}</span></Td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </Section>
              <Section title="Recent property searches">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><Th>Address</Th><Th>Last searched</Th><Th>Hits</Th></tr></thead>
                    <tbody>
                      {metrics.recentPropertySearches.length === 0
                        ? <EmptyRow cols={3} message="No searches yet" />
                        : metrics.recentPropertySearches.map((s, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <Td>{s.original_address}</Td>
                              <Td>{fmtTime(s.last_accessed_at)}</Td>
                              <Td>{s.hit_count}</Td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          </>
        )}

        {/* ── Analytics tab ──────────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            overview={analyticsOverview}
            retention={analyticsRetention}
            features={analyticsFeatures}
            loading={tabLoading}
          />
        )}

        {/* ── Funnels tab ────────────────────────────────────────────────── */}
        {activeTab === 'funnels' && (
          <FunnelsTab steps={funnelSteps} modal={modalFunnel} loading={tabLoading} />
        )}

        {/* ── Journeys tab ───────────────────────────────────────────────── */}
        {activeTab === 'journeys' && (
          <JourneysTab
            rows={journeyRows}
            loading={tabLoading}
            onLoadDetail={loadJourneyDetail}
          />
        )}

        {/* ── Errors tab ─────────────────────────────────────────────────── */}
        {activeTab === 'errors' && (
          <ErrorsTab errors={errorRows} dropoffs={dropoffs} loading={tabLoading} />
        )}

        {/* ── Users (power users) tab ────────────────────────────────────── */}
        {activeTab === 'users' && (
          <PowerUsersTab rows={powerUsers} loading={tabLoading} />
        )}

      </div>
    </div>
  );
}
