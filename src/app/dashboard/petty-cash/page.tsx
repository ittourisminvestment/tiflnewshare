'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Wallet, Search, ArrowUpRight, ArrowDownLeft, X, Printer, Download, Landmark, Plus } from 'lucide-react';
import { adToBs, getTodayBs } from '@/lib/utils/nepaliDate';
import NepaliDateInput from '../components/NepaliDateInput';
import { getBankBalance } from '@/lib/utils/bankBalance';

interface PettyCashEntry {
  id: string;
  date: string;
  type: 'inflow' | 'outflow';
  source: string;
  amount: number;
  bank_id: string | null;
  reference_id: string | null;
  description: string | null;
  created_at: string;
  company_banks?: { bank_name: string };
}

interface CompanyBank {
  id: string;
  bank_name: string;
  account_number: string;
}

export default function PettyCashPage() {
  const supabase = createClient();
  const [ledger, setLedger] = useState<PettyCashEntry[]>([]);
  const [banks, setBanks] = useState<CompanyBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [selectedBankBalance, setSelectedBankBalance] = useState<number | null>(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);

  const [transferForm, setTransferForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    bank_id: '',
    description: 'Transfer from Bank to Petty Cash'
  });

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('petty_cash_ledger')
      .select('*, company_banks(bank_name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load petty cash ledger');
    } else {
      setLedger((data || []) as PettyCashEntry[]);
    }
    setLoading(false);
  }, [supabase]);

  const fetchBanks = useCallback(async () => {
    const { data } = await supabase.from('company_banks').select('id, bank_name, account_number').eq('is_active', true);
    setBanks((data || []) as CompanyBank[]);
  }, [supabase]);

  useEffect(() => {
    fetchLedger();
    fetchBanks();
  }, [fetchLedger, fetchBanks]);

  useEffect(() => {
    if (ledger.length > 0 && !startDate && !endDate) {
      setStartDate(ledger[0].date); // Most recent transaction date
      setEndDate(new Date().toISOString().split('T')[0]); // Today
    }
  }, [ledger, startDate, endDate]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (transferForm.bank_id) {
        setFetchingBalance(true);
        const bal = await getBankBalance(supabase, transferForm.bank_id);
        setSelectedBankBalance(bal);
        setFetchingBalance(false);
      } else {
        setSelectedBankBalance(null);
      }
    };
    fetchBalance();
  }, [transferForm.bank_id, supabase]);

  const handleBankTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedBankBalance !== null && parseFloat(transferForm.amount) > selectedBankBalance) {
      toast.error(`Insufficient balance in selected bank. Current balance: Rs. ${selectedBankBalance.toLocaleString()}`);
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('petty_cash_ledger').insert({
      date: transferForm.date,
      type: 'inflow',
      source: 'bank_transfer',
      amount: parseFloat(transferForm.amount),
      bank_id: transferForm.bank_id,
      description: transferForm.description,
      created_by: user?.id
    });

    if (error) {
      toast.error('Failed to record transfer');
    } else {
      toast.success('Cash transferred successfully');
      setShowTransferModal(false);
      setTransferForm({ ...transferForm, amount: '', bank_id: '' });
      fetchLedger();
    }
    setSaving(false);
  };

  const calculateBalance = () => {
    return ledger.reduce((acc, entry) => {
      return entry.type === 'inflow' ? acc + Number(entry.amount) : acc - Number(entry.amount);
    }, 0);
  };

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const filteredLedger = ledger.filter(t => {
    const d = t.date;
    const matchesSearch = (t.description || '').toLowerCase().includes(search.toLowerCase()) || 
                         (t.source || '').toLowerCase().includes(search.toLowerCase());
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return matchesSearch;
  });

  const handleExport = () => {
    if (filteredLedger.length === 0) return;
    
    const totalInflow = ledger.filter(t => t.type === 'inflow').reduce((s,t) => s + Number(t.amount), 0);
    const totalOutflow = ledger.filter(t => t.type === 'outflow').reduce((s,t) => s + Number(t.amount), 0);
    
    let running = currentBalance;
    const rows = filteredLedger.map(t => {
      const rowBalance = running;
      if (t.type === 'inflow') running -= t.amount;
      else running += t.amount;
      
      return [
        t.date,
        adToBs(t.date),
        t.type,
        t.source.replace('_', ' '),
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.type === 'inflow' ? t.amount : 0,
        t.type === 'outflow' ? t.amount : 0,
        rowBalance
      ];
    });

    const csvContent = [
      ['Petty Cash Statement', '', '', '', '', '', '', ''],
      [`Current Balance: Rs. ${currentBalance.toFixed(2)}`, '', '', '', '', '', '', ''],
      [`Total Inflow: Rs. ${totalInflow.toFixed(2)}`, '', '', '', '', '', '', ''],
      [`Total Outflow: Rs. ${totalOutflow.toFixed(2)}`, '', '', '', '', '', '', ''],
      [`Period: ${startDate ? adToBs(startDate) : 'Beginning'} to ${endDate ? adToBs(endDate) : 'Today'}`, '', '', '', '', '', '', ''],
      [],
      ['Date (AD)', 'Date (BS)', 'Type', 'Source', 'Description', 'Inflow', 'Outflow', 'Running Balance'],
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `petty_cash_statement_${adToBs(new Date().toISOString().split('T')[0])}.csv`);
    link.click();
  };

  const currentBalance = calculateBalance();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Petty Cash Management</h1>
          <p className="page-subtitle">Track office cash and bank-to-cash transfers</p>
          <p className="print-period">
            Statement Period: from <strong>{startDate ? adToBs(startDate) : '..................'}</strong> to <strong>{endDate ? adToBs(endDate) : '..................'}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary no-print" onClick={() => window.print()}>
            <Printer size={16} /> Print Statement
          </button>
          <button className="btn btn-primary no-print" onClick={() => setShowTransferModal(true)}>
            <Landmark size={16} /> Transfer from Bank
          </button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary-light)' }}>
          <div className="stat-label">Current Cash Balance</div>
          <div className="stat-value" style={{ color: 'var(--primary-light)' }}>{formatCurrency(currentBalance)}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-label">Total Cash Inflow</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{formatCurrency(ledger.filter(t => t.type === 'inflow').reduce((s,t) => s + Number(t.amount), 0))}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-label">Total Cash Outflow</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{formatCurrency(ledger.filter(t => t.type === 'outflow').reduce((s,t) => s + Number(t.amount), 0))}</div>
        </div>
      </div>

      <div className="page-body">
        <div className="search-bar no-print flex justify-between items-center">
          <div className="flex gap-4">
            <div className="search-input-wrapper" style={{ minWidth: 250 }}>
              <Search size={16} />
              <input className="input" placeholder="Search ledger..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
            </div>
            <div className="flex items-center gap-2">
               <label className="text-sm text-muted">From:</label>
               <NepaliDateInput value={startDate} onChange={(ad) => setStartDate(ad)} />
            </div>
            <div className="flex items-center gap-2">
               <label className="text-sm text-muted">To:</label>
               <NepaliDateInput value={endDate} onChange={(ad) => setEndDate(ad)} />
            </div>
            {(startDate || endDate || search) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setStartDate(''); setEndDate(''); setSearch(''); }}>Clear</button>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleExport}>
            <Download size={16} /> Export CSV
          </button>
        </div>

        {loading ? (
          <div className="card">{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 8 }} />)}</div>
        ) : filteredLedger.length === 0 ? (
          <div className="card empty-state">
            <Wallet size={48} style={{ color: 'var(--text-muted)' }} />
            <h3>No cash transactions</h3>
            <p>Start by transferring cash from bank or recording expenses.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date (BS)</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let running = currentBalance;
                  // The ledger is sorted by date DESC, created_at DESC
                  // To show running balance correctly, we need to iterate carefully or just show current entries
                  return filteredLedger.map((t, idx) => {
                    const rowBalance = running;
                    if (t.type === 'inflow') running -= t.amount;
                    else running += t.amount;

                    return (
                      <tr key={t.id}>
                        <td>{adToBs(t.date)}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.date}</div></td>
                        <td>
                          <span className={`badge ${t.type === 'inflow' ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize' }}>
                            {t.type}
                          </span>
                        </td>
                        <td style={{ textTransform: 'capitalize', fontSize: 13 }}>
                          {t.source.replace('_', ' ')}
                          {t.company_banks && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>From: {t.company_banks.bank_name}</div>}
                        </td>
                        <td style={{ fontSize: 13 }}>{t.description || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: t.type === 'inflow' ? 'var(--success)' : 'var(--danger)' }}>
                           {t.type === 'inflow' ? '+' : '-'}{formatCurrency(t.amount)}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                          {formatCurrency(rowBalance)}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title">Transfer Bank to Petty Cash</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowTransferModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleBankTransfer}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="input-group">
                    <label>Transfer Date (BS)</label>
                    <NepaliDateInput value={transferForm.date} onChange={(ad) => setTransferForm(p => ({ ...p, date: ad }))} />
                  </div>
                  <div className="input-group">
                    <label>Source Bank <span className="required">*</span></label>
                    <select 
                      className="select" 
                      value={transferForm.bank_id} 
                      onChange={(e) => setTransferForm(p => ({ ...p, bank_id: e.target.value }))} 
                      required
                    >
                      <option value="">Select bank account...</option>
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>
                      ))}
                    </select>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>This bank balance will decrease while Petty Cash increases.</p>
                  </div>
                  <div className="input-group">
                    <label className="flex justify-between items-center">
                      <span>Amount (Rs.) <span className="required">*</span></span>
                      {selectedBankBalance !== null && !fetchingBalance && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: (parseFloat(transferForm.amount) || 0) > selectedBankBalance ? 'var(--danger)' : 'var(--primary-light)' }}>
                          Bal: Rs. {selectedBankBalance.toLocaleString()}
                        </span>
                      )}
                      {fetchingBalance && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Checking...</span>}
                    </label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0.01" 
                      className="input" 
                      value={transferForm.amount} 
                      onChange={(e) => setTransferForm(p => ({ ...p, amount: e.target.value }))} 
                      required 
                      placeholder="0.00" 
                    />
                  </div>
                  <div className="input-group">
                    <label>Remarks / Description</label>
                    <textarea 
                      className="textarea" 
                      value={transferForm.description} 
                      onChange={(e) => setTransferForm(p => ({ ...p, description: e.target.value }))} 
                      placeholder="Reason for transfer..."
                      rows={2}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Processing...' : 'Complete Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .stat-mini { display: flex; flex-direction: column; }
        @page { margin: 0; }
        @media print {
          .no-print, .sidebar, .sidebar-toggle, .sidebar-overlay, #mobile-sidebar-toggle, .theme-toggle-btn { display: none !important; }
          body { background: white !important; padding: 0.5in !important; margin: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: black !important; }
          .main-content { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .page-header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .grid-3 { display: flex !important; gap: 15px !important; margin-bottom: 25px !important; }
          .stat-card { 
            flex: 1; 
            border: 1px solid #ddd !important; 
            padding: 12px !important; 
            border-radius: 8px !important;
            background: #fff !important;
          }
          .stat-label { font-size: 10pt !important; color: #555 !important; margin-bottom: 4px; }
          .stat-value { font-size: 14pt !important; font-weight: bold !important; color: #000 !important; }
          .table-container { border: none !important; margin-top: 20px; }
          .table { border-collapse: collapse; width: 100%; }
          .table th { background: #f5f5f5 !important; border: 1px solid #ccc !important; font-weight: bold !important; }
          .table td { border: 1px solid #eee !important; color: #000 !important; padding: 8px !important; font-size: 9pt !important; }
          .print-period { display: block !important; color: #000 !important; margin-top: 8px !important; font-size: 11pt; }
        }
        .print-period { display: none; }
      `}</style>
    </>
  );
}
