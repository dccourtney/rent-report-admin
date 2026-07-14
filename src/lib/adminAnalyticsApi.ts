import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ── Types ─────────────────────────────────────────────────────────────────────

export type DateRange = 'today' | '7d' | '30d' | 'all';

export interface AnalyticsOverview {
  visitors:             number;
  anon_visitors:        number;
  logged_in_users:      number;
  sessions:             number;
  avg_events_per_session: number;
  signups:              number;
  checkout_starts:      number;
  purchases:            number;
  searches:             number;
  pricing_views:        number;
}

export interface RetentionData {
  free_active_7d:  number;
  free_active_30d: number;
  paid_active_7d:  number;
  paid_active_30d: number;
  inactive_14d:    number;
  inactive_30d:    number;
}

export interface FunnelStep {
  event_name:       string;
  total:            number;
  unique_visitors:  number;
}

export interface FeatureRow {
  event_name:  string;
  event_count: number;
  unique_users: number;
  anon_users:  number;
  last_used:   string | null;
}

export interface JourneyRow {
  anonymous_id:       string;
  user_id:            string | null;
  email:              string | null;
  anon_short:         string;
  first_seen:         string;
  last_seen:          string;
  total_sessions:     number;
  total_searches:     number;
  reports_viewed:     number;
  reports_downloaded: number;
  current_plan:       string | null;
  total_events:       number;
  pricing_views:      number;
  checkout_starts:    number;
  last_event:         string | null;
}

export interface JourneyEvent {
  created_at: string;
  event_name: string;
  path:       string | null;
  plan:       string | null;
  properties: Record<string, unknown>;
}

export interface ErrorRow {
  event_name:        string;
  event_count:       number;
  affected_users:    number;
  last_occurrence:   string;
  sample_properties: Record<string, unknown> | null;
}

export interface DropoffData {
  pricing_no_checkout:  number;
  checkout_no_purchase: number;
  signup_never_returned: number;
  signup_no_report:     number;
}

export interface PowerUserRow {
  anonymous_id: string;
  user_id:      string | null;
  email:        string | null;
  anon_short:   string;
  current_plan: string | null;
  last_seen:    string;
  intent_score: number;
  signals:      string[];
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

type AnalyticsResult<T> =
  | { status: 'ok';        data: T }
  | { status: 'forbidden' }
  | { status: 'error';     message: string };

async function fetchAnalytics<T>(
  action: string,
  range: DateRange,
  extra?: Record<string, unknown>,
): Promise<AnalyticsResult<T>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { status: 'forbidden' };

    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-analytics`, {
      method: 'POST',
      headers: {
        apikey:         ANON_KEY,
        Authorization:  `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, range, ...extra }),
    });

    if (res.status === 401 || res.status === 403) return { status: 'forbidden' };
    const body = await res.json();
    if (!res.ok) return { status: 'error', message: body.error ?? 'Unknown error' };
    return { status: 'ok', data: body as T };
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
}

// ── Lifecycle emails ────────────────────────────────────────────────────────

export interface LifecycleRates {
  sent: number; delivered: number; opened: number; clicked: number;
  bounced: number; unsubscribed: number; conversions: number;
  openRate: number; ctr: number; ctor: number; convRate: number;
}
export interface LifecycleEmailStat extends LifecycleRates { email_key: string; campaign: string; goal: string; }
export interface LifecycleCampaignStat extends LifecycleRates { campaign: string; }
export interface LifecycleDayStat { day: string; sent: number; opened: number; clicked: number; }
export interface LifecycleSummary extends LifecycleRates { revenueAttributed: number; }
export interface LifecycleData {
  range: DateRange;
  summary: LifecycleSummary;
  byEmail: LifecycleEmailStat[];
  byCampaign: LifecycleCampaignStat[];
  byDay: LifecycleDayStat[];
}
export interface LifecycleHistoryRow {
  email_key: string; campaign: string; goal: string; status: string;
  sent_at: string | null; delivered_at: string | null; opened_at: string | null;
  clicked_at: string | null; bounced_at: string | null; unsubscribed_at: string | null;
  goal_completed_at: string | null;
}

// Same shape as fetchAnalytics but hits the admin-lifecycle function.
async function fetchLifecycleFn<T>(
  action: string, range: DateRange, extra?: Record<string, unknown>,
): Promise<AnalyticsResult<T>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { status: 'forbidden' };
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-lifecycle`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, range, ...extra }),
    });
    if (res.status === 401 || res.status === 403) return { status: 'forbidden' };
    const body = await res.json();
    if (!res.ok) return { status: 'error', message: body.error ?? 'Unknown error' };
    return { status: 'ok', data: body as T };
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
}

export const fetchLifecycleOverview = (range: DateRange) =>
  fetchLifecycleFn<LifecycleData>('overview', range);
export const fetchLifecycleUserHistory = (userId: string) =>
  fetchLifecycleFn<{ history: LifecycleHistoryRow[] }>('user_history', 'all', { user_id: userId });

// ── Public API ────────────────────────────────────────────────────────────────

export const fetchAnalyticsOverview = (range: DateRange) =>
  fetchAnalytics<AnalyticsOverview>('overview', range);

export const fetchAnalyticsRetention = (range: DateRange) =>
  fetchAnalytics<RetentionData>('retention', range);

export const fetchAnalyticsFunnel = (range: DateRange) =>
  fetchAnalytics<FunnelStep[]>('funnel', range);

export const fetchAnalyticsFeatures = (range: DateRange) =>
  fetchAnalytics<FeatureRow[]>('features', range);

export const fetchAnalyticsJourneys = (range: DateRange) =>
  fetchAnalytics<JourneyRow[]>('journeys', range);

export const fetchJourneyDetail = (anonymousId: string, range: DateRange) =>
  fetchAnalytics<JourneyEvent[]>('journey_detail', range, { anonymous_id: anonymousId });

export const fetchAnalyticsErrors = (range: DateRange) =>
  fetchAnalytics<{ errors: ErrorRow[]; dropoffs: DropoffData }>('errors', range);

export const fetchAnalyticsPowerUsers = (range: DateRange) =>
  fetchAnalytics<PowerUserRow[]>('power_users', range);

// ── Top users (Users tab) ───────────────────────────────────────────────────

export interface TopUserRow {
  user_id:        string;
  email:          string | null;
  plan:           string | null;
  plan_status:    string | null;
  signup_at:      string | null;
  first_seen:     string | null;
  last_seen:      string;
  last_login:     string | null;
  last_search_at: string | null;
  total_searches: number;
  total_sessions: number;
  reports_viewed: number;
  saved_reports:  number;
  watchlist_adds: number;
  portfolio_adds: number;
  rent_reviews:   number;
  utm_source:     string | null;
  utm_medium:     string | null;
  utm_campaign:   string | null;
  search_spark:   number[];   // 30 daily search counts, oldest → newest
}

export const fetchTopUsers = () =>
  fetchAnalytics<TopUserRow[]>('top_users', 'all');

// ── RentCast usage time series ──────────────────────────────────────────────

export type RentcastBucket = 'day' | 'week' | 'month';
export interface RentcastSeriesPoint {
  bucket: string;   // ISO timestamp of the bucket start
  calls:  number;
}

// range is unused by this action (the bucket drives the lookback window server-side).
export const fetchRentcastSeries = (bucket: RentcastBucket) =>
  fetchAnalytics<RentcastSeriesPoint[]>('rentcast_series', 'all', { bucket });

// ── Feature name map ──────────────────────────────────────────────────────────
// Groups raw event names into human-readable feature rows for the UI.

export const FEATURE_GROUPS: Array<{
  name:   string;
  events: string[];
}> = [
  { name: 'Search',         events: ['property_search_started', 'property_search_completed'] },
  { name: 'Buy Analysis',   events: ['buy_analysis_viewed'] },
  { name: 'Own Analysis',   events: ['own_analysis_viewed'] },
  { name: 'Report View',    events: ['report_viewed'] },
  { name: 'PDF Download',   events: ['report_downloaded'] },
  { name: 'Portfolio',      events: ['portfolio_viewed', 'portfolio_property_added'] },
  { name: 'Watchlist',      events: ['watchlist_viewed', 'watchlist_added'] },
  { name: 'Rent Review',    events: ['rent_review_created', 'rent_review_downloaded'] },
  { name: 'Pricing Page',   events: ['pricing_viewed'] },
  { name: 'Checkout',       events: ['checkout_started', 'purchase_completed'] },
  { name: 'Page Views',     events: ['page_view'] },
];

export interface GroupedFeature {
  name:         string;
  event_count:  number;
  unique_users: number;
  anon_users:   number;
  last_used:    string | null;
}

export function groupFeatures(rows: FeatureRow[]): GroupedFeature[] {
  const byEvent = new Map(rows.map(r => [r.event_name, r]));
  return FEATURE_GROUPS.map(g => {
    const matched = g.events.map(e => byEvent.get(e)).filter(Boolean) as FeatureRow[];
    return {
      name:         g.name,
      event_count:  matched.reduce((s, r) => s + r.event_count, 0),
      unique_users: Math.max(...matched.map(r => r.unique_users), 0),
      anon_users:   Math.max(...matched.map(r => r.anon_users), 0),
      last_used:    matched.reduce((latest, r) => {
        if (!latest) return r.last_used;
        if (!r.last_used) return latest;
        return r.last_used > latest ? r.last_used : latest;
      }, null as string | null),
    };
  }).filter(g => g.event_count > 0);
}

export interface ModalFunnelData {
  shown:     number;
  dismissed: number;
  clicked:   number;
}

export const fetchModalFunnel = (range: DateRange) =>
  fetchAnalytics<ModalFunnelData>('signup_modal_funnel', range);

// ── Funnel helpers ────────────────────────────────────────────────────────────

export const FUNNEL_STEP_LABELS: Record<string, string> = {
  page_view:                  'Page View',
  property_search_completed:  'Search Completed',
  report_viewed:              'Report Viewed',
  pricing_viewed:             'Pricing Viewed',
  signup_started:             'Signup Started',
  signup_completed:           'Signup Completed',
  checkout_started:           'Checkout Started',
  purchase_completed:         'Purchase Completed',
};
