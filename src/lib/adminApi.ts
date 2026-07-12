import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export interface AdminMetrics {
  signupsToday:    number;
  signups7Days:    number;
  totalUsers:      number;
  activePaidUsers: number;
  mrrEstimate:     number;
  revenueMtd:      number;
  conversionRate:  number;
  planBreakdown:   { free: number; starter: number; plus: number; pro: number };
  anonSearchesThisPeriod: number;
  anonIpsThisPeriod:      number;
  zipMissesToday:  number;
  recentSignups: Array<{
    userId:    string;
    email:     string | null;
    plan:      string;
    createdAt: string;
  }>;
  recentPaidConversions: Array<{
    userId:      string;
    email:       string | null;
    plan:        string;
    price:       number | null;
    currency:    string | null;
    billingCycle: string | null;
    periodStart: string | null;
    status:      string;
  }>;
  topZipsByHits: Array<{
    zip_code:      string;
    hit_count:     number;
    property_type: string;
  }>;
  recentPropertySearches: Array<{
    original_address: string;
    last_accessed_at: string;
    hit_count:        number;
  }>;
  apiCostEstimate: {
    propertyCacheRows:  number;
    marketCacheRows:    number;
    zipPageTotalMisses: number;
    totalApiCalls:      number;
    estimatedTotalCost: number;
  };
  rentcastPlan: {
    name:          string;
    baseFee:       number;
    includedCalls: number;
    overageRate:   number;
  };
  rentcastUsage: {
    callsThisMonth:        number;
    includedCalls:         number;
    overageCallsThisMonth: number;
    overageCostThisMonth:  number;
    totalCostThisMonth:    number;
    monthlyLimit:          number;
    usagePct:              number;
    remainingCalls:        number;
    periodStart:           string;
    nextResetDate:         string;
    daysUntilReset:        number;
    billingAnchorDay:      number;
  };
}

export type AdminMetricsResult =
  | { status: 'ok';        data: AdminMetrics }
  | { status: 'forbidden' }
  | { status: 'error';     message: string };

export async function updateRentcastSetting(key: string, value: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: 'Not authenticated' };

    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/admin-settings`,
      {
        method: 'POST',
        headers: {
          apikey:          import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          Authorization:   `Bearer ${session.access_token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ key, value }),
      },
    );
    const body = await res.json();
    if (!res.ok) return { ok: false, error: body.error ?? 'Unknown error' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function updateRentcastLimit(newLimit: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: 'Not authenticated' };

    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/admin-settings`,
      {
        method: 'POST',
        headers: {
          apikey:          import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          Authorization:   `Bearer ${session.access_token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ key: 'rentcast_monthly_limit', value: newLimit }),
      },
    );
    const body = await res.json();
    if (!res.ok) return { ok: false, error: body.error ?? 'Unknown error' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function fetchAdminMetrics(): Promise<AdminMetricsResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { status: 'forbidden' };

    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/admin-metrics`,
      {
        headers: {
          apikey:        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (res.status === 401 || res.status === 403) return { status: 'forbidden' };
    const body = await res.json();
    if (!res.ok) return { status: 'error', message: body.error ?? 'Unknown error' };

    return { status: 'ok', data: body as AdminMetrics };
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
}
