'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Users,
  MapPin,
  AlertCircle,
  TrendingUp,
  Wallet,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';

import NepaliDateInput from '../components/NepaliDateInput';

interface Shareholder {
  id: string;
  first_name: string;
  last_name: string;
  perm_address: {
    province?: string;
    district?: string;
    municipality?: string;
  };
  nid_no?: string;
  pan_no?: string;
  email?: string;
  created_at: string;
  member_since: string;
}

interface Investment {
  shareholder_id: string;
  amount: number;
  status: string;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#22c55e', '#f59e0b', '#ef4444'];

export default function AnalyticsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  // RAW Data Cache State
  const [rawShareholders, setRawShareholders] = useState<Shareholder[]>([]);
  const [rawInvestments, setRawInvestments] = useState<Investment[]>([]);

  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterProvince, setFilterProvince] = useState('all');
  const [uniqueProvinces, setUniqueProvinces] = useState<string[]>([]);

  // Computed Dashboard States
  const [totalShareholders, setTotalShareholders] = useState(0);
  const [missingEmails, setMissingEmails] = useState(0);
  const [missingPan, setMissingPan] = useState(0);
  const [missingNid, setMissingNid] = useState(0);

  const [provinceData, setProvinceData] = useState<Array<{ name: string; value: number }>>([]);
  const [districtData, setDistrictData] = useState<Array<{ name: string; counts: number }>>([]);
  const [growthTrend, setGrowthTrend] = useState<Array<{ month: string; counts: number }>>([]);
  const [investmentBrackets, setInvestmentBrackets] = useState<Array<{ range: string; counts: number }>>([]);

  useEffect(() => {
    fetchRawData();
  }, []);

  const fetchRawData = async () => {
    setLoading(true);
    try {
      const { data: shareholders } = await supabase
        .from('shareholders')
        .select('id, first_name, last_name, perm_address, nid_no, pan_no, email, member_since, created_at')
        .is('deleted_at', null);

      const { data: investments } = await supabase
        .from('investments')
        .select('shareholder_id, amount')
        .eq('status', 'verified');

      const shs = (shareholders || []) as unknown as Shareholder[];
      
      setRawShareholders(shs);
      setRawInvestments((investments || []) as unknown as Investment[]);

      // Extract unique provinces for filter dropdown
      const provs = [...new Set(shs.map(s => s.perm_address?.province).filter(Boolean))] as string[];
      setUniqueProvinces(provs);

    } catch (error) {
      console.error('Error fetching raw data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Re-compute Analytics when any filter changes
  useEffect(() => {
    if (rawShareholders.length === 0) {
      setTotalShareholders(0);
      return;
    }

    // A. Apply Filters
    const filteredShs = rawShareholders.filter(sh => {
      if (startDate && sh.member_since < startDate) return false;
      if (endDate && sh.member_since > endDate) return false;
      if (filterProvince !== 'all' && sh.perm_address?.province !== filterProvince) return false;
      return true;
    });

    setTotalShareholders(filteredShs.length);

    // B. Missing Info
    let mEmail = 0, mPan = 0, mNid = 0;
    filteredShs.forEach(sh => {
      if (!sh.email || sh.email.trim() === '') mEmail++;
      if (!sh.pan_no || sh.pan_no.trim() === '') mPan++;
      if (!sh.nid_no || sh.nid_no.trim() === '') mNid++;
    });
    setMissingEmails(mEmail);
    setMissingPan(mPan);
    setMissingNid(mNid);

    // C. Province Breakdown
    const provinceCounts: Record<string, number> = {};
    filteredShs.forEach(sh => {
      const prov = sh.perm_address?.province || 'Unspecified';
      provinceCounts[prov] = (provinceCounts[prov] || 0) + 1;
    });
    setProvinceData(Object.entries(provinceCounts).map(([name, value]) => ({ name, value })));

    // D. District Breakdown
    const districtCounts: Record<string, number> = {};
    filteredShs.forEach(sh => {
      const dist = sh.perm_address?.district || 'Unspecified';
      districtCounts[dist] = (districtCounts[dist] || 0) + 1;
    });
    setDistrictData(
      Object.entries(districtCounts)
        .map(([name, counts]) => ({ name, counts }))
        .sort((a, b) => b.counts - a.counts)
        .slice(0, 8)
    );

    // E. Growth Trend Over time
    const monthlyGrowth: Record<string, number> = {};
    filteredShs.forEach(sh => {
      const date = new Date(sh.member_since);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyGrowth[key] = (monthlyGrowth[key] || 0) + 1;
    });
    
    const sortedMonths = Object.entries(monthlyGrowth).sort((a, b) => a[0].localeCompare(b[0]));
    let cumulative = 0;
    const cumulativeGrowth = sortedMonths.map(([month, counts]) => {
      cumulative += counts;
      return { month, counts: cumulative };
    });
    setGrowthTrend(cumulativeGrowth);

    // F. Investment Brackets
    const userInvestments: Record<string, number> = {};
    rawInvestments.forEach(i => {
      userInvestments[i.shareholder_id] = (userInvestments[i.shareholder_id] || 0) + Number(i.amount);
    });

    let b1 = 0, b2 = 0, b3 = 0, b4 = 0;
    filteredShs.forEach(sh => {
      const amount = userInvestments[sh.id] || 0;
      if (amount === 0) return;
      if (amount < 10000) b1++;
      else if (amount < 50000) b2++;
      else if (amount < 100000) b3++;
      else b4++;
    });

    setInvestmentBrackets([
      { range: 'Under 10K', counts: b1 },
      { range: '10K - 50K', counts: b2 },
      { range: '50K - 1L', counts: b3 },
      { range: '1L +', counts: b4 },
    ]);

  }, [rawShareholders, rawInvestments, startDate, endDate, filterProvince]);

  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString('en-IN')}`;
  };

  if (loading) {
    return <div className="loading">Loading Analytics...</div>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Management Analytics</h1>
          <p className="page-subtitle">Deep dive into shareholder demographics and analytics for BOD &amp; Management</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="search-bar no-print" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
        <div className="flex items-center gap-2">
           <label className="text-sm text-muted">From (Join):</label>
           <NepaliDateInput value={startDate} onChange={(ad) => setStartDate(ad)} />
        </div>
        <div className="flex items-center gap-2">
           <label className="text-sm text-muted">To:</label>
           <NepaliDateInput value={endDate} onChange={(ad) => setEndDate(ad)} />
        </div>
        <div style={{ minWidth: 150 }}>
          <select className="select" value={filterProvince} onChange={(e) => setFilterProvince(e.target.value)} style={{ fontSize: 13, height: 38 }}>
            <option value="all">All Provinces</option>
            {uniqueProvinces.sort().map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {(startDate || endDate || filterProvince !== 'all') && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setStartDate(''); setEndDate(''); setFilterProvince('all'); }} style={{ color: 'var(--danger)', fontSize: 13, alignSelf: 'center' }}>
            Clear
          </button>
        )}
      </div>

      <div className="page-body">
        {/* KPI Row */}
        <div className="stats-grid">
          <Link href="/dashboard/shareholders" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-icon purple"><Users size={22} /></div>
            <div className="stat-content">
              <div className="stat-label">Total Shareholders</div>
              <div className="stat-value">{totalShareholders}</div>
            </div>
          </Link>
          <Link href="/dashboard/shareholders?missing=email" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-icon red"><AlertCircle size={22} /></div>
            <div className="stat-content">
              <div className="stat-label">Missing Email</div>
              <div className="stat-value">{missingEmails}</div>
              <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>{((missingEmails/totalShareholders)*100).toFixed(0)}% list coverage gap</div>
            </div>
          </Link>
          <Link href="/dashboard/shareholders?missing=pan" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-icon red"><AlertCircle size={22} /></div>
            <div className="stat-content">
              <div className="stat-label">Missing PAN</div>
              <div className="stat-value">{missingPan}</div>
            </div>
          </Link>
          <Link href="/dashboard/shareholders?missing=nid" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-icon red"><AlertCircle size={22} /></div>
            <div className="stat-content">
              <div className="stat-label">Missing NID</div>
              <div className="stat-value">{missingNid}</div>
            </div>
          </Link>
        </div>

        {/* Charts Grid */}
        <div className="grid-2" style={{ marginBottom: 28 }}>
          {/* Province Breakdown */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Shareholders by Province</div>
                <div className="card-subtitle">Permanent Address breakdown</div>
              </div>
            </div>
            {provinceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={provinceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {provinceData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#16161f',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: '#f1f1f4',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#a0a0b2' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="empty-state">No Province Data</div>}
          </div>

          {/* District Breakdown */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Top Districts</div>
                <div className="card-subtitle">Count of shareholders per district</div>
              </div>
            </div>
            {districtData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={districtData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#6b6b80" fontSize={12} />
                  <YAxis stroke="#6b6b80" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: '#16161f',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: '#f1f1f4',
                    }}
                  />
                  <Bar dataKey="counts" fill="#818cf8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state">No District Data</div>}
          </div>
        </div>

        <div className="grid-2">
          {/* Growth Trend */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Shareholder Growth Curve</div>
                <div className="card-subtitle">Cumulative shareholder joining trend</div>
              </div>
            </div>
            {growthTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={growthTrend}>
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="#6b6b80" fontSize={12} />
                  <YAxis stroke="#6b6b80" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: '#16161f',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: '#f1f1f4',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="counts"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#growthGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="empty-state">No Growth Data</div>}
          </div>

          {/* Investment Brackets */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Shareholders Investment Breakdown</div>
                <div className="card-subtitle">Count grouped by aggregate investment bands</div>
              </div>
            </div>
            {investmentBrackets.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={investmentBrackets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="range" stroke="#6b6b80" fontSize={12} />
                  <YAxis stroke="#6b6b80" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: '#16161f',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: '#f1f1f4',
                    }}
                  />
                  <Bar dataKey="counts" fill="#22c55e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state">No Investment Data</div>}
          </div>
        </div>
      </div>
    </>
  );
}
