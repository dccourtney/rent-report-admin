import { useEffect, useRef, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, TrendingUp, Users, DollarSign, ShieldAlert, Search,
  AlertTriangle, BarChart2, GitBranch, Map, AlertCircle, Zap,
  ChevronDown, ChevronRight, Mail, Send, Wrench, Inbox, X,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useProfileStore } from '../stores/profileStore';
import { fetchAdminMetrics, updateRentcastLimit, updateRentcastSetting, AdminMetrics } from '../lib/adminApi';
import {
  fetchAnalyticsOverview, fetchAnalyticsRetention, fetchAnalyticsFunnel,
  fetchAnalyticsFeatures, fetchAnalyticsJourneys, fetchJourneyDetail,
  fetchAnalyticsErrors, fetchTopUsers, fetchModalFunnel,
  fetchRentcastSeries,
  groupFeatures,
  FUNNEL_STEP_LABELS,
  DateRange,
  AnalyticsOverview, RetentionData, FunnelStep, GroupedFeature,
  JourneyRow, JourneyEvent, ErrorRow, DropoffData, TopUserRow, ModalFunnelData,
  RentcastBucket, RentcastSeriesPoint,
  fetchLifecycleOverview, fetchLifecycleUserHistory,
  LifecycleData, LifecycleHistoryRow,
  fetchToolsOverview, fetchToolsByTool, fetchToolsTrend,
  fetchToolsAcquisition, fetchToolsFunnel, fetchToolsLinkSources,
  ToolsOverview, ToolByToolRow, ToolsTrendPoint, ToolsAcquisition,
  ToolsFunnelStep, ToolsLinkSource, TOOL_NAME, TOOL_FUNNEL_LABELS,
  fetchSentEmails, fetchEmailDetail, SentEmailRow, SentEmailDetail,
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

function Td({ children, mono, muted, right }: { children: React.ReactNode; mono?: boolean; muted?: boolean; right?: boolean }) {
  return (
    <td className={`px-4 py-2.5 text-sm border-t border-slate-100 ${mono ? 'font-mono text-xs' : ''} ${muted ? 'text-slate-400' : 'text-slate-700'} ${right ? 'text-right' : ''}`}>
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

type AdminTab = 'overview' | 'analytics' | 'funnels' | 'journeys' | 'errors' | 'users' | 'lifecycle' | 'tools' | 'emails';

const TABS: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
  { id: 'overview',  label: 'Overview',   icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: 'analytics', label: 'Analytics',  icon: <BarChart2  className="w-3.5 h-3.5" /> },
  { id: 'lifecycle', label: 'Lifecycle',  icon: <Mail       className="w-3.5 h-3.5" /> },
  { id: 'funnels',   label: 'Funnels',    icon: <GitBranch  className="w-3.5 h-3.5" /> },
  { id: 'journeys',  label: 'Journeys',   icon: <Map        className="w-3.5 h-3.5" /> },
  { id: 'errors',    label: 'Errors',     icon: <AlertCircle className="w-3.5 h-3.5" /> },
  { id: 'users',     label: 'Users',      icon: <Zap        className="w-3.5 h-3.5" /> },
  { id: 'tools',     label: 'Tools & SEO', icon: <Wrench     className="w-3.5 h-3.5" /> },
  { id: 'emails',    label: 'Emails',     icon: <Inbox      className="w-3.5 h-3.5" /> },
];

// ── Lifecycle tab ─────────────────────────────────────────────────────────────

const pctStr = (n: number) => `${n}%`;

function FunnelBar({ label, value, of, color }: { label: string; value: number; of: number; color: string }) {
  const w = of > 0 ? Math.round((value / of) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-xs font-medium text-slate-500 text-right">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-lg h-7 overflow-hidden">
        <div className={`h-full ${color} rounded-lg`} style={{ width: `${value > 0 ? Math.max(w, 4) : 0}%` }} />
      </div>
      <div className="w-28 text-xs text-slate-600 tabular-nums">
        {value.toLocaleString()} <span className="text-slate-400">({w}%)</span>
      </div>
    </div>
  );
}

function LifecycleTab({ data, loading }: { data: LifecycleData | null; loading: boolean }) {
  const [uid, setUid] = useState('');
  const [history, setHistory] = useState<LifecycleHistoryRow[] | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  const lookup = async () => {
    if (!uid.trim()) return;
    setHistLoading(true);
    const res = await fetchLifecycleUserHistory(uid.trim());
    setHistLoading(false);
    setHistory(res.status === 'ok' ? res.data.history : []);
  };

  if (loading) return <TabSpinner />;
  if (!data) return <div className="text-center py-16 text-slate-400">No data</div>;

  const s = data.summary;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Sent"              value={s.sent.toLocaleString()}      icon={<Send className="w-4 h-4" />} />
        <StatCard label="Delivered"         value={s.delivered.toLocaleString()} icon={<Mail className="w-4 h-4" />} />
        <StatCard label="Open rate"         value={pctStr(s.openRate)}           icon={<TrendingUp className="w-4 h-4" />} />
        <StatCard label="Click rate"        value={pctStr(s.ctr)}                icon={<BarChart2 className="w-4 h-4" />} />
        <StatCard label="Conversions"       value={s.conversions.toLocaleString()} sub={`${s.convRate}% of sent`} accent icon={<Zap className="w-4 h-4" />} />
        <StatCard label="Revenue attributed" value={fmt$(s.revenueAttributed)}   icon={<DollarSign className="w-4 h-4" />} />
      </div>

      <Section title="Funnel">
        <div className="p-5 space-y-2">
          <FunnelBar label="Sent"      value={s.sent}        of={s.sent} color="bg-slate-400" />
          <FunnelBar label="Delivered" value={s.delivered}   of={s.sent} color="bg-teal-400" />
          <FunnelBar label="Opened"    value={s.opened}      of={s.sent} color="bg-sky-400" />
          <FunnelBar label="Clicked"   value={s.clicked}     of={s.sent} color="bg-indigo-400" />
          <FunnelBar label="Converted" value={s.conversions} of={s.sent} color="bg-orange-500" />
        </div>
      </Section>

      <Section title="Email performance">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              <Th>Email</Th><Th>Campaign</Th><Th>Sent</Th><Th>Open %</Th><Th>CTR</Th><Th>CTOR</Th><Th>Conv %</Th>
            </tr></thead>
            <tbody>
              {data.byEmail.length === 0 ? <EmptyRow cols={7} /> : data.byEmail.map((e) => (
                <tr key={e.email_key}>
                  <Td mono>{e.email_key}</Td>
                  <Td muted>{e.campaign}</Td>
                  <Td right>{e.sent.toLocaleString()}</Td>
                  <Td right>{pctStr(e.openRate)}</Td>
                  <Td right>{pctStr(e.ctr)}</Td>
                  <Td right>{pctStr(e.ctor)}</Td>
                  <Td right>{pctStr(e.convRate)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="By campaign">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><Th>Campaign</Th><Th>Sent</Th><Th>Open %</Th><Th>Conv %</Th></tr></thead>
              <tbody>
                {data.byCampaign.length === 0 ? <EmptyRow cols={4} /> : data.byCampaign.map((c) => (
                  <tr key={c.campaign}>
                    <Td>{c.campaign}</Td>
                    <Td right>{c.sent.toLocaleString()}</Td>
                    <Td right>{pctStr(c.openRate)}</Td>
                    <Td right>{pctStr(c.convRate)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Sends by day">
          <div className="p-5">
            {data.byDay.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No data yet</p>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {data.byDay.map((d) => {
                  const max = Math.max(...data.byDay.map((x) => x.sent), 1);
                  return (
                    <div key={d.day} className="flex-1 flex flex-col justify-end min-w-0"
                      title={`${d.day}: ${d.sent} sent · ${d.opened} opened · ${d.clicked} clicked`}>
                      <div className="w-full bg-teal-400 hover:bg-teal-500 rounded-t transition-colors"
                        style={{ height: `${Math.max(2, Math.round((d.sent / max) * 100))}%` }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Section>
      </div>

      <Section title="Per-user history">
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <input
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
              placeholder="user_id (UUID)"
              className="flex-1 px-3 py-2 text-sm rounded-lg ring-1 ring-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-orange-400"
            />
            <button onClick={lookup} className="px-4 py-2 text-sm font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600">
              Look up
            </button>
          </div>
          {histLoading ? <TabSpinner /> : history && (
            history.length === 0 ? (
              <p className="text-sm text-slate-400">No lifecycle emails for this user.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr><Th>Email</Th><Th>Sent</Th><Th>Opened</Th><Th>Clicked</Th><Th>Converted</Th></tr></thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i}>
                        <Td mono>{h.email_key}</Td>
                        <Td muted>{fmtDate(h.sent_at)}</Td>
                        <Td>{h.opened_at ? '✓' : '—'}</Td>
                        <Td>{h.clicked_at ? '✓' : '—'}</Td>
                        <Td>{h.goal_completed_at ? '✓' : '—'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </Section>
    </div>
  );
}

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
              <div key={label} className={`rounded-xl p-4 text-center ${accent ? 'bg-orange-50 dark:bg-orange-500/15' : 'bg-slate-50'}`}>
                <p className={`text-2xl font-bold ${accent ? 'text-orange-600 dark:text-orange-300' : 'text-slate-900'}`}>{value}</p>
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

// Two separate funnels so the pricing-before-or-after-signup branching doesn't
// distort either one.
const ACQUISITION_STEPS = ['page_view', 'property_search_completed', 'signup_started', 'signup_completed'];
const MONETIZATION_STEPS = ['pricing_viewed', 'checkout_started', 'purchase_completed'];

function FunnelsTab({ steps, modal, loading }: { steps: FunnelStep[] | null; modal: ModalFunnelData | null; loading: boolean }) {
  if (loading) return <TabSpinner />;
  if (!steps)  return null;

  const pick = (names: string[]): FunnelStep[] =>
    names.map(n => steps.find(s => s.event_name === n) ?? { event_name: n, total: 0, unique_visitors: 0 });

  const acq = pick(ACQUISITION_STEPS);
  const mon = pick(MONETIZATION_STEPS);
  const acqTop = acq[0]?.unique_visitors ?? 0;
  const monTop = mon[0]?.unique_visitors ?? 0;

  return (
    <div className="space-y-6">
      <Section title="Acquisition funnel — anonymous → free account">
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
              {acq.map((s, i) => {
                const prev      = acq[i - 1]?.unique_visitors ?? null;
                const dropoff   = prev ? `−${Math.round((1 - s.unique_visitors / prev) * 100)}%` : '—';
                const fromStart = acqTop > 0 ? pct(s.unique_visitors, acqTop) : '—';
                const barW      = acqTop > 0 ? Math.round((s.unique_visitors / acqTop) * 100) : 0;
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
      <Section title="Monetization funnel — pricing → purchase">
        <div className="p-5">
          {mon.map((s, i) => (
            <div key={s.event_name} className="flex items-center gap-4 py-2">
              <span className="w-24 text-xs text-slate-500 text-right">{eventLabel(s.event_name)}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                <div
                  className="h-4 bg-orange-400 rounded-full flex items-center justify-end pr-2"
                  style={{ width: `${Math.max(4, monTop > 0 ? Math.round((s.unique_visitors / monTop) * 100) : 0)}%` }}
                >
                  <span className="text-xs text-white font-semibold">{s.unique_visitors}</span>
                </div>
              </div>
              {i > 0 && (
                <span className="w-12 text-xs text-red-500 font-semibold">
                  {pct(s.unique_visitors, mon[i - 1]?.unique_visitors ?? 0)}
                </span>
              )}
            </div>
          ))}
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
              <div key={label} className={`rounded-xl p-4 ${value > 0 ? 'bg-amber-50 dark:bg-amber-500/15' : 'bg-slate-50'}`}>
                <p className={`text-2xl font-bold ${value > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900'}`}>{value}</p>
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

// ── Top users tab ─────────────────────────────────────────────────────────────

// Inline 30-day search-activity sparkline (one bar per day, oldest → newest).
function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0 || data.every(v => v === 0)) {
    return <span className="text-slate-300">—</span>;
  }
  const max = Math.max(...data, 1);
  const w = 84, h = 22, bw = w / data.length;
  return (
    <svg width={w} height={h} className="block" aria-hidden="true">
      {data.map((v, i) => {
        const bh = Math.max(1, Math.round((v / max) * (h - 2)));
        return (
          <rect
            key={i}
            x={i * bw}
            y={h - bh}
            width={Math.max(1, bw - 0.6)}
            height={bh}
            className={v > 0 ? 'fill-teal-400' : 'fill-slate-200'}
          />
        );
      })}
    </svg>
  );
}

type UserSortKey = 'last_seen' | 'last_search_at' | 'total_searches' | 'saved_reports' | 'watchlist_adds' | 'portfolio_adds' | 'rent_reviews';

const daysAgo = (iso: string | null) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

function acquisitionLabel(r: TopUserRow) {
  const parts = [r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Direct / none';
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-700 mt-0.5">{value}</div>
    </div>
  );
}

function TopUsersTab({ rows, loading }: { rows: TopUserRow[] | null; loading: boolean }) {
  const [sortKey, setSortKey]   = useState<UserSortKey>('last_seen');
  const [dir, setDir]           = useState<'asc' | 'desc'>('desc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (loading) return <TabSpinner />;

  const dateKeys: UserSortKey[] = ['last_seen', 'last_search_at'];
  const sorted = [...(rows ?? [])].sort((a, b) => {
    const cmp = dateKeys.includes(sortKey)
      ? new Date((a[sortKey] as string) ?? 0).getTime() - new Date((b[sortKey] as string) ?? 0).getTime()
      : (a[sortKey] as number) - (b[sortKey] as number);
    return dir === 'asc' ? cmp : -cmp;
  });

  const toggle = (k: UserSortKey) => {
    if (sortKey === k) setDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setDir('desc'); }
  };

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const SortTh = ({ k, label, left }: { k: UserSortKey; label: string; left?: boolean }) => (
    <th
      onClick={() => toggle(k)}
      className={`px-4 py-2.5 ${left ? 'text-left' : 'text-right'} text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 cursor-pointer select-none hover:text-slate-800`}
    >
      <span className="inline-flex items-center gap-1">
        {label}{sortKey === k && <span className="text-slate-400">{dir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  );

  return (
    <Section title={`Top users by activity (${sorted.length})`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="bg-slate-50 w-8" />
              <Th>User</Th>
              <Th>Plan</Th>
              <SortTh k="last_seen"      label="Last seen"   left />
              <SortTh k="last_search_at" label="Last search" left />
              <SortTh k="total_searches" label="Searches" />
              <Th>30-day searches</Th>
              <SortTh k="saved_reports"  label="Reports" />
              <SortTh k="watchlist_adds" label="Watchlist" />
              <SortTh k="portfolio_adds" label="Portfolio" />
              <SortTh k="rent_reviews"   label="Rent reviews" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0
              ? <EmptyRow cols={11} message="No users yet" />
              : sorted.map(r => {
                  const open = expanded.has(r.user_id);
                  const inactive = daysAgo(r.last_seen);
                  const age = daysAgo(r.signup_at);
                  return (
                    <Fragment key={r.user_id}>
                      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleExpand(r.user_id)}>
                        <Td>
                          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}
                        </Td>
                        <Td>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{r.email ?? '—'}</span>
                            <span className="font-mono text-xs text-slate-400">…{r.user_id.slice(-8)}</span>
                          </div>
                        </Td>
                        <Td>
                          <div className="flex flex-col gap-0.5 items-start">
                            {planBadge(r.plan)}
                            {r.plan_status && r.plan_status !== 'active' && (
                              <span className={`text-[10px] font-medium ${r.plan_status === 'past_due' ? 'text-red-500' : 'text-slate-400'}`}>
                                {r.plan_status.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </Td>
                        <Td muted>{fmtRelative(r.last_seen)}</Td>
                        <Td muted>{r.last_search_at ? fmtRelative(r.last_search_at) : '—'}</Td>
                        <Td right><span className="font-semibold text-slate-800">{r.total_searches.toLocaleString()}</span></Td>
                        <Td><Sparkline data={r.search_spark} /></Td>
                        <Td right>{r.saved_reports.toLocaleString()}</Td>
                        <Td right>{r.watchlist_adds.toLocaleString()}</Td>
                        <Td right>{r.portfolio_adds.toLocaleString()}</Td>
                        <Td right>{r.rent_reviews.toLocaleString()}</Td>
                      </tr>
                      {open && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={11} className="px-6 py-4 border-t border-slate-100">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-xs">
                              <Detail label="Signed up" value={r.signup_at ? `${fmtDate(r.signup_at)}${age != null ? ` · ${age}d ago` : ''}` : '—'} />
                              <Detail label="Last login" value={fmtRelative(r.last_login)} />
                              <Detail label="First seen" value={r.first_seen ? fmtDate(r.first_seen) : '—'} />
                              <Detail label="Days inactive" value={inactive != null ? `${inactive}d` : '—'} />
                              <Detail label="Total sessions" value={r.total_sessions.toLocaleString()} />
                              <Detail label="Reports viewed" value={r.reports_viewed.toLocaleString()} />
                              <Detail label="Plan status" value={r.plan_status ?? '—'} />
                              <Detail label="Acquisition" value={acquisitionLabel(r)} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 px-4 py-3 border-t border-slate-100">
        Top 100 signed-up users by recent activity — click a row for signup, acquisition, and session detail.
        Watchlist/Portfolio show "add" events over time (portfolio is stored client-side, so this is activity, not a live item count).
      </p>
    </Section>
  );
}

// ── RentCast usage chart ────────────────────────────────────────────────────

function RentcastChart({ series, bucket }: { series: RentcastSeriesPoint[] | null; bucket: RentcastBucket }) {
  if (series === null) {
    return <div className="h-32 flex items-center justify-center text-sm text-slate-400">Loading…</div>;
  }
  if (series.length === 0) {
    return <div className="h-32 flex items-center justify-center text-sm text-slate-400">No RentCast requests recorded yet.</div>;
  }

  const max   = Math.max(...series.map(p => p.calls), 1);
  const total = series.reduce((s, p) => s + p.calls, 0);
  // Day view = hourly buckets → time labels; week/month = daily buckets → dates.
  const label = (iso: string) => {
    const d = new Date(iso);
    return bucket === 'day'
      ? d.toLocaleTimeString('en-US', { hour: 'numeric' })
      : d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  };
  const windowLabel = bucket === 'day' ? 'last 24 hours' : bucket === 'week' ? 'last 7 days' : 'last 30 days';
  const unit = bucket === 'day' ? 'hour' : 'day';
  const mid  = Math.round(max / 2);
  const step = Math.max(1, Math.ceil(series.length / 12));

  return (
    <div>
      <div className="flex gap-2">
        {/* Y axis (requests) */}
        <div className="flex flex-col justify-between h-32 w-7 shrink-0 text-[9px] text-slate-400 text-right leading-none">
          <span>{max.toLocaleString()}</span>
          <span>{mid.toLocaleString()}</span>
          <span>0</span>
        </div>
        {/* Plot */}
        <div className="flex-1 min-w-0">
          <div className="relative h-32">
            {/* Gridlines at 0 / mid / max */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              <div className="border-t border-slate-100" />
              <div className="border-t border-slate-100" />
              <div className="border-t border-slate-100" />
            </div>
            {/* Bars */}
            <div className="relative flex items-end gap-1 h-full">
              {series.map((p, i) => (
                <div
                  key={i}
                  className="flex-1 h-full flex flex-col justify-end min-w-0"
                  title={`${label(p.bucket)}: ${p.calls.toLocaleString()} requests`}
                >
                  <div
                    className="w-full bg-teal-400 hover:bg-teal-500 rounded-t transition-colors"
                    style={{ height: `${p.calls > 0 ? Math.max(2, Math.round((p.calls / max) * 100)) : 0}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
          {/* X axis labels */}
          <div className="flex gap-1 mt-1">
            {series.map((p, i) => (
              <div key={i} className="flex-1 text-center text-[9px] text-slate-400 truncate min-w-0">
                {i % step === 0 ? label(p.bucket) : ''}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Requests per {unit} · {total.toLocaleString()} total over the {windowLabel}
      </p>
    </div>
  );
}

// ── Tools & SEO tab ───────────────────────────────────────────────────────────

const TREND_METRICS: Array<{ key: keyof ToolsTrendPoint; label: string; color: string }> = [
  { key: 'tool_visitors', label: 'Tool visitors', color: 'bg-orange-400' },
  { key: 'calculations',  label: 'Calculations',  color: 'bg-teal-400' },
  { key: 'cta_clicks',    label: 'CTA clicks',     color: 'bg-amber-400' },
  { key: 'searches',      label: 'Property searches', color: 'bg-sky-400' },
  { key: 'signups',       label: 'Signups',        color: 'bg-violet-400' },
  { key: 'purchases',     label: 'Purchases',      color: 'bg-rose-400' },
];

function ToolsTrendChart({ series, metricKey, color }: { series: ToolsTrendPoint[]; metricKey: keyof ToolsTrendPoint; color: string }) {
  if (series.length === 0) {
    return <div className="h-32 flex items-center justify-center text-sm text-slate-400">No activity in this range yet.</div>;
  }
  const vals = series.map((p) => Number(p[metricKey]) || 0);
  const max = Math.max(...vals, 1);
  const total = vals.reduce((s, n) => s + n, 0);
  const step = Math.max(1, Math.ceil(series.length / 12));
  const label = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  return (
    <div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between h-32 w-7 shrink-0 text-[9px] text-slate-400 text-right leading-none">
          <span>{max.toLocaleString()}</span><span>{Math.round(max / 2).toLocaleString()}</span><span>0</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative h-32">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              <div className="border-t border-slate-100" /><div className="border-t border-slate-100" /><div className="border-t border-slate-100" />
            </div>
            <div className="relative flex items-end gap-1 h-full">
              {series.map((p, i) => (
                <div key={i} className="flex-1 h-full flex flex-col justify-end min-w-0" title={`${label(p.bucket)}: ${vals[i].toLocaleString()}`}>
                  <div className={`w-full ${color} rounded-t transition-colors`} style={{ height: `${vals[i] > 0 ? Math.max(2, Math.round((vals[i] / max) * 100)) : 0}%` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-1 mt-1">
            {series.map((p, i) => (
              <div key={i} className="flex-1 text-center text-[9px] text-slate-400 truncate min-w-0">{i % step === 0 ? label(p.bucket) : ''}</div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-2">{total.toLocaleString()} total over the selected range</p>
    </div>
  );
}

type ToolSortKey = keyof ToolByToolRow;

function ToolsTab({
  overview, byTool, trend, acquisition, funnel, linkSources, loading,
}: {
  overview: ToolsOverview | null;
  byTool: ToolByToolRow[] | null;
  trend: ToolsTrendPoint[] | null;
  acquisition: ToolsAcquisition | null;
  funnel: ToolsFunnelStep[] | null;
  linkSources: ToolsLinkSource[] | null;
  loading: boolean;
}) {
  const [metric, setMetric] = useState<keyof ToolsTrendPoint>('tool_visitors');
  const [sortKey, setSortKey] = useState<ToolSortKey>('page_views');

  if (loading && !overview) return <TabSpinner />;

  const rate = (x: number | null | undefined) => (x == null ? '—' : `${x}%`);
  const num = (x: number | null | undefined) => (x == null ? '0' : Number(x).toLocaleString());

  const kpis: Array<{ label: string; value: string; accent?: boolean; icon: React.ReactNode }> = overview
    ? [
        { label: 'Directory visitors', value: num(overview.directory_visitors), icon: <Map className="w-4 h-4" /> },
        { label: 'Tool visitors', value: num(overview.tool_visitors), icon: <Users className="w-4 h-4" /> },
        { label: 'Tool starts', value: num(overview.tool_starts), icon: <Wrench className="w-4 h-4" /> },
        { label: 'Calculations', value: num(overview.calculations), icon: <BarChart2 className="w-4 h-4" /> },
        { label: 'Completion rate', value: rate(overview.completion_rate), icon: <TrendingUp className="w-4 h-4" /> },
        { label: 'CTA clicks', value: num(overview.cta_clicks), icon: <Search className="w-4 h-4" /> },
        { label: 'Tool → search rate', value: rate(overview.tool_to_search_rate), icon: <GitBranch className="w-4 h-4" /> },
        { label: 'Tool-assisted signups', value: num(overview.tool_assisted_signups), icon: <Users className="w-4 h-4" /> },
        { label: 'Tool-assisted purchases', value: num(overview.tool_assisted_purchases), accent: true, icon: <DollarSign className="w-4 h-4" /> },
        { label: 'Tool-assisted revenue', value: fmt$(Number(overview.tool_assisted_revenue) || 0), accent: true, icon: <DollarSign className="w-4 h-4" /> },
        { label: 'Returning tool users', value: num(overview.returning_tool_users), icon: <RefreshCw className="w-4 h-4" /> },
      ]
    : [];

  const sortedTools = byTool
    ? [...byTool].sort((a, b) => {
        if (sortKey === 'tool_id') return a.tool_id.localeCompare(b.tool_id);
        return (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0);
      })
    : [];

  const funnelTop = funnel && funnel.length > 0 ? funnel[0].total : 0;
  const activeMetric = TREND_METRICS.find((m) => m.key === metric)!;

  const SortableTh = ({ k, children }: { k: ToolSortKey; children: React.ReactNode }) => (
    <th
      onClick={() => setSortKey(k)}
      className={`px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide bg-slate-50 cursor-pointer select-none ${sortKey === k ? 'text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
    >
      {children}
    </th>
  );

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.length === 0
          ? <div className="col-span-full text-center text-sm text-slate-400 py-8">No tool activity in this range yet.</div>
          : kpis.map((k) => <StatCard key={k.label} label={k.label} value={k.value} accent={k.accent} icon={k.icon} />)}
      </div>

      {/* Trend */}
      <Section
        title="Trend"
        action={
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as keyof ToolsTrendPoint)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600"
          >
            {TREND_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        }
      >
        <div className="p-5">
          {trend === null ? <div className="h-32 flex items-center justify-center text-sm text-slate-400">Loading…</div>
            : <ToolsTrendChart series={trend} metricKey={metric} color={activeMetric.color} />}
        </div>
      </Section>

      {/* Per-tool performance */}
      <Section title="Performance by tool">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <SortableTh k="tool_id">Tool</SortableTh>
                <SortableTh k="page_views">Views</SortableTh>
                <SortableTh k="unique_visitors">Visitors</SortableTh>
                <SortableTh k="starts">Starts</SortableTh>
                <SortableTh k="calculations">Calcs</SortableTh>
                <SortableTh k="completion_rate">Compl.</SortableTh>
                <SortableTh k="cta_views">CTA views</SortableTh>
                <SortableTh k="cta_clicks">CTA clicks</SortableTh>
                <SortableTh k="cta_ctr">CTA CTR</SortableTh>
                <SortableTh k="searches_started">Searches</SortableTh>
                <SortableTh k="search_conv_rate">Search conv.</SortableTh>
                <SortableTh k="signups">Signups</SortableTh>
                <SortableTh k="purchases">Purchases</SortableTh>
                <SortableTh k="revenue">Revenue</SortableTh>
              </tr>
            </thead>
            <tbody>
              {sortedTools.length === 0
                ? <EmptyRow cols={14} message="No tool activity yet" />
                : sortedTools.map((t) => (
                    <tr key={t.tool_id}>
                      <Td>{TOOL_NAME[t.tool_id] ?? t.tool_id}</Td>
                      <Td right>{num(t.page_views)}</Td>
                      <Td right>{num(t.unique_visitors)}</Td>
                      <Td right>{num(t.starts)}</Td>
                      <Td right>{num(t.calculations)}</Td>
                      <Td right>{rate(t.completion_rate)}</Td>
                      <Td right>{num(t.cta_views)}</Td>
                      <Td right>{num(t.cta_clicks)}</Td>
                      <Td right>{rate(t.cta_ctr)}</Td>
                      <Td right>{num(t.searches_started)}</Td>
                      <Td right>{rate(t.search_conv_rate)}</Td>
                      <Td right>{num(t.signups)}</Td>
                      <Td right>{num(t.purchases)}</Td>
                      <Td right>{fmt$(Number(t.revenue) || 0)}</Td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Funnel */}
      <Section title="Tool funnel">
        <div className="p-5 space-y-2">
          {funnel === null || funnel.length === 0
            ? <p className="text-sm text-slate-400 text-center py-4">No funnel data yet</p>
            : funnel.map((s) => (
                <FunnelBar key={s.step} label={TOOL_FUNNEL_LABELS[s.step] ?? s.step} value={s.unique_visitors} of={funnelTop || 1} color="bg-orange-400" />
              ))}
        </div>
      </Section>

      {/* Acquisition + link sources */}
      <div className="grid md:grid-cols-2 gap-6">
        <Section title="Acquisition (tool visitors)">
          <div className="p-5 space-y-2">
            {!acquisition || acquisition.channels.length === 0
              ? <p className="text-sm text-slate-400 text-center py-4">No acquisition data yet</p>
              : (
                <>
                  {acquisition.channels.map((c) => (
                    <FunnelBar key={c.channel} label={c.channel} value={c.visitors}
                      of={acquisition.channels.reduce((s, x) => s + x.visitors, 0) || 1} color="bg-sky-400" />
                  ))}
                  {acquisition.campaigns.length > 0 && (
                    <div className="pt-3 mt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Top campaigns</p>
                      {acquisition.campaigns.slice(0, 5).map((c) => (
                        <div key={c.campaign} className="flex justify-between text-xs text-slate-600 py-0.5">
                          <span className="truncate mr-2">{c.campaign}</span><span className="tabular-nums">{c.visitors.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
          </div>
        </Section>

        <Section title="Discovery by link source">
          <div className="p-5 space-y-2">
            {!linkSources || linkSources.length === 0
              ? <p className="text-sm text-slate-400 text-center py-4">No link clicks yet</p>
              : linkSources.map((s) => (
                  <FunnelBar key={s.source_location} label={s.source_location.replace(/_/g, ' ')} value={s.clicks}
                    of={linkSources.reduce((a, x) => a + x.clicks, 0) || 1} color="bg-teal-400" />
                ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── Emails inbox tab ──────────────────────────────────────────────────────────

const EMAILS_PAGE = 50;

// Readable fallback label for rows sent before subjects were stored.
const humanizeKey = (key: string) =>
  key ? key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '(no subject)';

function emailStatusPills(e: SentEmailRow) {
  const pills: Array<{ label: string; cls: string }> = [];
  if (e.bounced_at) pills.push({ label: 'Bounced', cls: 'bg-red-100 text-red-700' });
  if (e.unsubscribed_at) pills.push({ label: 'Unsub', cls: 'bg-slate-200 text-slate-600' });
  if (e.clicked_at) pills.push({ label: 'Clicked', cls: 'bg-orange-100 text-orange-700' });
  if (e.opened_at) pills.push({ label: 'Opened', cls: 'bg-teal-100 text-teal-700' });
  if (!e.opened_at && !e.clicked_at && e.delivered_at) pills.push({ label: 'Delivered', cls: 'bg-emerald-100 text-emerald-700' });
  if (pills.length === 0) pills.push({ label: e.status, cls: 'bg-slate-100 text-slate-500' });
  return pills;
}

function EmailDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<SentEmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEmailDetail(id).then((r) => {
      if (cancelled) return;
      if (r.status === 'ok') setDetail(r.data.email);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{detail?.subject || (detail ? humanizeKey(detail.email_key) : '…')}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              To {detail?.to_email ?? '—'} · {detail?.email_key} · {fmtTime(detail?.sent_at ?? null)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-hidden p-4 bg-slate-50">
          {loading ? (
            <div className="h-full flex items-center justify-center"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : detail?.html ? (
            <iframe title="email" sandbox="" srcDoc={detail.html} className="w-full h-[65vh] bg-white rounded-lg border border-slate-200" />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center px-6">
              No stored content for this email. Only emails sent after the inbox was enabled include their full content.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailsTab() {
  const [rows, setRows] = useState<SentEmailRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSentEmails(EMAILS_PAGE, offset).then((r) => {
      if (cancelled) return;
      if (r.status === 'ok') { setRows(r.data.emails); setTotal(r.data.total); }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [offset]);

  if (loading && rows === null) return <TabSpinner />;

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + EMAILS_PAGE, total);

  return (
    <div className="space-y-4">
      <Section title={`Sent emails${total ? ` — ${total.toLocaleString()}` : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr><Th>To</Th><Th>Subject</Th><Th>Type</Th><Th>Sent</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {!rows || rows.length === 0
                ? <EmptyRow cols={5} message="No sent emails yet" />
                : rows.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setOpenId(e.id)}>
                      <Td mono>{e.to_email ?? '—'}</Td>
                      <Td>{e.subject || <span className="text-slate-500">{humanizeKey(e.email_key)}</span>}</Td>
                      <Td muted>{e.campaign ?? e.email_key}</Td>
                      <Td muted>{fmtRelative(e.sent_at)}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {emailStatusPills(e).map((p) => (
                            <span key={p.label} className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${p.cls}`}>{p.label}</span>
                          ))}
                        </div>
                      </Td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{total > 0 ? `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}` : ''}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - EMAILS_PAGE))}
            disabled={offset === 0 || loading}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:border-slate-300"
          >Prev</button>
          <button
            onClick={() => setOffset(offset + EMAILS_PAGE)}
            disabled={to >= total || loading}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:border-slate-300"
          >Next</button>
        </div>
      </div>

      {openId && <EmailDetailModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
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

  // RentCast usage time series
  const [rentcastBucket, setRentcastBucket] = useState<RentcastBucket>('day');
  const [rentcastSeries, setRentcastSeries] = useState<RentcastSeriesPoint[] | null>(null);

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
  const [topUsers,          setTopUsers]        = useState<TopUserRow[] | null>(null);
  const [lifecycleData,     setLifecycleData]   = useState<LifecycleData | null>(null);

  // Tools & SEO tab state
  const [toolsOverview, setToolsOverview] = useState<ToolsOverview | null>(null);
  const [toolsByTool,   setToolsByTool]   = useState<ToolByToolRow[] | null>(null);
  const [toolsTrend,    setToolsTrend]    = useState<ToolsTrendPoint[] | null>(null);
  const [toolsAcq,      setToolsAcq]      = useState<ToolsAcquisition | null>(null);
  const [toolsFunnel,   setToolsFunnel]   = useState<ToolsFunnelStep[] | null>(null);
  const [toolsLinks,    setToolsLinks]    = useState<ToolsLinkSource[] | null>(null);

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
    if (tab === 'overview' || tab === 'emails') return; // emails self-manages its own paging
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
        const res = await fetchTopUsers();
        if (res.status === 'ok') setTopUsers(res.data);
      } else if (tab === 'lifecycle') {
        const res = await fetchLifecycleOverview(range);
        if (res.status === 'ok') setLifecycleData(res.data);
      } else if (tab === 'tools') {
        const [ov, bt, tr, ac, fn, ls] = await Promise.all([
          fetchToolsOverview(range),
          fetchToolsByTool(range),
          fetchToolsTrend(range, 'day'),
          fetchToolsAcquisition(range),
          fetchToolsFunnel(range),
          fetchToolsLinkSources(range),
        ]);
        if (ov.status === 'ok') setToolsOverview(ov.data);
        if (bt.status === 'ok') setToolsByTool(bt.data);
        if (tr.status === 'ok') setToolsTrend(tr.data);
        if (ac.status === 'ok') setToolsAcq(ac.data);
        if (fn.status === 'ok') setToolsFunnel(fn.data);
        if (ls.status === 'ok') setToolsLinks(ls.data);
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
    setTopUsers(null);
    setLifecycleData(null);
    setToolsOverview(null); setToolsByTool(null); setToolsTrend(null);
    setToolsAcq(null); setToolsFunnel(null); setToolsLinks(null);
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
    setTopUsers(null);
    setLifecycleData(null);
    setToolsOverview(null); setToolsByTool(null); setToolsTrend(null);
    setToolsAcq(null); setToolsFunnel(null); setToolsLinks(null);
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

  // Load the RentCast usage series once metrics are available, and on bucket change.
  useEffect(() => {
    if (phase !== 'ok') return;
    let cancelled = false;
    setRentcastSeries(null);
    fetchRentcastSeries(rentcastBucket).then(res => {
      if (!cancelled && res.status === 'ok') setRentcastSeries(res.data);
    });
    return () => { cancelled = true; };
  }, [phase, rentcastBucket]);

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
              const pct = u?.usagePct ?? 0;
              const isOver = pct >= 100;
              const barColor   = isOver ? 'bg-red-500' : pct >= 90 ? 'bg-red-400' : pct >= 80 ? 'bg-amber-400' : 'bg-teal-500';
              const labelColor = isOver ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-slate-700';
              const dayFmt = (iso?: string) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
              const resetsIn = u?.daysUntilReset === 0 ? 'today' : u?.daysUntilReset === 1 ? 'tomorrow' : `in ${u?.daysUntilReset} days`;
              return (
                <Section title="RentCast API usage">
                  <div className="p-5 space-y-5">

                    {/* Requests this period */}
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className={`text-3xl font-bold ${labelColor}`}>
                          {(u?.callsThisMonth ?? 0).toLocaleString()}
                          <span className="text-base font-normal text-slate-400 ml-1">
                            / {(u?.monthlyLimit ?? 0).toLocaleString()} limit
                          </span>
                          <span className="text-sm font-normal text-slate-400 ml-2">requests this period</span>
                        </span>
                        <span className={`text-sm font-semibold ${labelColor}`}>{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div className={`h-3 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-4 text-xs text-slate-400 mt-1.5">
                        <span>Period started {dayFmt(u?.periodStart)} · resets {dayFmt(u?.nextResetDate)} ({resetsIn})</span>
                        <span>
                          {isOver
                            ? <span className="text-red-500 font-semibold">{Math.max(0, (u?.callsThisMonth ?? 0) - (u?.monthlyLimit ?? 0)).toLocaleString()} over limit</span>
                            : `${(u?.remainingCalls ?? 0).toLocaleString()} remaining · alerts at 80 / 90 / 100%`}
                        </span>
                      </div>
                      {isOver && (
                        <div className="flex items-center gap-2 mt-3 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-2.5">
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                            Over the alert threshold of {(u?.monthlyLimit ?? 0).toLocaleString()} requests for this period.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Requests over time */}
                    <div className="pt-1 border-t border-slate-100">
                      <div className="flex items-center justify-between pt-4 mb-3">
                        <span className="text-sm font-semibold text-slate-700">Requests over time</span>
                        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                          {(['day', 'week', 'month'] as const).map(b => (
                            <button
                              key={b}
                              onClick={() => setRentcastBucket(b)}
                              className={`px-3 py-1 capitalize transition-colors ${rentcastBucket === b ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      </div>
                      <RentcastChart series={rentcastSeries} bucket={rentcastBucket} />
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
          <TopUsersTab rows={topUsers} loading={tabLoading} />
        )}

        {activeTab === 'lifecycle' && (
          <LifecycleTab data={lifecycleData} loading={tabLoading} />
        )}

        {activeTab === 'tools' && (
          <ToolsTab
            overview={toolsOverview}
            byTool={toolsByTool}
            trend={toolsTrend}
            acquisition={toolsAcq}
            funnel={toolsFunnel}
            linkSources={toolsLinks}
            loading={tabLoading}
          />
        )}

        {activeTab === 'emails' && <EmailsTab />}

      </div>
    </div>
  );
}
