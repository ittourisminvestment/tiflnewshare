'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Landmark, Search, Eye, ArrowUpRight, ArrowDownLeft, X, Printer, Download } from 'lucide-react';
import { adToBs, getTodayBs } from '@/lib/utils/nepaliDate';
import NepaliDateInput from '../components/NepaliDateInput';

interface CompanyBank {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch: string | null;
  initial_balance: number;
  current_balance: number;
}

interface Transaction {
  id: string;
  date: string;
  type: 'Collection' | 'ROI' | 'Expense' | 'Investment Out' | 'Loan Issued' | 'Loan Repay' | 'Dividend Out';
  description: string;
  amount: number;
  flow: 'in' | 'out';
  cheque_number?: string | null;
  cheque_image_url?: string | null;
}

export default function BanksPage() {
  const supabase = createClient();
  const [banks, setBanks] = useState<CompanyBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBank, setSelectedBank] = useState<CompanyBank | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fetchingTransactions, setFetchingTransactions] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const isImageUrl = (url: string | null) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || url.startsWith('blob:');
  };

  const fetchBanks = useCallback(async () => {
    setLoading(true);
    // Fetch all banks
    const { data: bankData, error: bankError } = await supabase
      .from('company_banks')
      .select('*')
      .eq('is_active', true);

    if (bankError) {
      toast.error('Failed to load banks');
      setLoading(false);
      return;
    }

    // Fetch all movements for each bank to calculate current balance
    const updatedBanks = await Promise.all((bankData || []).map(async (bank) => {
      const [invRes, roiRes, expRes, coInvRes, loanRes, repayRes, divRes, pettyRes] = await Promise.all([
        supabase.from('investments').select('amount').eq('company_bank_id', bank.id).eq('status', 'verified').is('deleted_at', null),
        supabase.from('investment_returns').select('net_amount').eq('company_bank_id', bank.id).not('source_name', 'ilike', 'Loan Interest%').is('deleted_at', null),
        supabase.from('expenses').select('amount').eq('company_bank_id', bank.id).is('deleted_at', null),
        supabase.from('company_investments').select('principal_amount').eq('company_bank_id', bank.id).is('deleted_at', null),
        supabase.from('loans').select('principal').eq('company_bank_id', bank.id).is('deleted_at', null),
        supabase.from('loan_repayments').select('amount').eq('company_bank_id', bank.id),
        supabase.from('dividends').select('amount').eq('company_bank_id', bank.id).is('deleted_at', null),
        supabase.from('petty_cash_ledger').select('amount').eq('bank_id', bank.id).eq('type', 'inflow').eq('source', 'bank_transfer')
      ]);

      const totalIn = (invRes.data || []).reduce((s, r) => s + Number(r.amount), 0) + 
                       (roiRes.data || []).reduce((s, r) => s + Number(r.net_amount), 0) +
                       (repayRes.data || []).reduce((s, r) => s + Number(r.amount), 0);
      const totalOut = (expRes.data || []).reduce((s, r) => s + Number(r.amount), 0) + 
                        (coInvRes.data || []).reduce((s, r) => s + Number(r.principal_amount), 0) +
                        (loanRes.data || []).reduce((s, r) => s + Number(r.principal), 0) +
                        (divRes.data || []).reduce((s, r) => s + Number(r.amount), 0) +
                        (pettyRes.data || []).reduce((s, r) => s + Number(r.amount), 0);

      return {
        ...bank,
        current_balance: Number(bank.initial_balance) + totalIn - totalOut
      };
    }));

    setBanks(updatedBanks);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const fetchStatement = async (bank: CompanyBank) => {
    setSelectedBank(bank);
    setFetchingTransactions(true);
    
    const [invRes, roiRes, expRes, coInvRes, loanRes, repayRes, divRes, pettyRes] = await Promise.all([
      supabase.from('investments').select('id, investment_date, amount, cheque_number, cheque_image_url, shareholders(first_name, last_name)').eq('company_bank_id', bank.id).eq('status', 'verified').is('deleted_at', null),
      supabase.from('investment_returns').select('id, return_date, net_amount, source_name, cheque_number, cheque_image_url').eq('company_bank_id', bank.id).not('source_name', 'ilike', 'Loan Interest%').is('deleted_at', null),
      supabase.from('expenses').select('id, expense_date, amount, description, cheque_number, cheque_image_url').eq('company_bank_id', bank.id).is('deleted_at', null),
      supabase.from('company_investments').select('id, investment_date, principal_amount, title, cheque_number, cheque_image_url').eq('company_bank_id', bank.id).is('deleted_at', null),
      supabase.from('loans').select('id, issue_date, principal, cheque_number, cheque_image_url, shareholders:shareholders!loans_shareholder_id_fkey(first_name, last_name)').eq('company_bank_id', bank.id).is('deleted_at', null),
      supabase.from('loan_repayments').select('id, payment_date, amount, interest_amount, principal_amount, remarks, cheque_number, cheque_image_url, loans(shareholders:shareholders!loans_shareholder_id_fkey(first_name, last_name))').eq('company_bank_id', bank.id).then(async (res) => {
         if (res.error && (res.error.message?.includes('interest_amount') || res.error.message?.includes('column'))) {
            return supabase.from('loan_repayments').select('id, payment_date, amount, remarks, cheque_number, cheque_image_url, loans(shareholders:shareholders!loans_shareholder_id_fkey(first_name, last_name))').eq('company_bank_id', bank.id);
         }
         return res;
      }),
      supabase.from('dividends').select('id, payment_date, amount, cheque_number, cheque_image_url, shareholders(first_name, last_name)').eq('company_bank_id', bank.id).is('deleted_at', null),
      supabase.from('petty_cash_ledger').select('id, date, amount, description').eq('bank_id', bank.id).eq('type', 'inflow').eq('source', 'bank_transfer')
    ]);

    if (invRes.error) console.error("invRes error:", invRes.error);
    if (roiRes.error) console.error("roiRes error:", roiRes.error);
    if (expRes.error) console.error("expRes error:", expRes.error);
    if (coInvRes.error) console.error("coInvRes error:", coInvRes.error);
    if (loanRes.error) console.error("loanRes error:", loanRes.error);
    if (repayRes.error) console.error("repayRes error:", repayRes.error);
    if (divRes.error) console.error("divRes error:", divRes.error);
    if (pettyRes.error) console.error("pettyRes error:", pettyRes.error);

    const combined: Transaction[] = [
      ...(invRes.data || []).map(r => ({
        id: r.id,
        date: r.investment_date,
        type: 'Collection' as const,
        description: `Share Collection: ${Array.isArray(r.shareholders) ? r.shareholders[0]?.first_name : (r.shareholders as any)?.first_name} ${Array.isArray(r.shareholders) ? r.shareholders[0]?.last_name : (r.shareholders as any)?.last_name}`,
        amount: Number(r.amount),
        flow: 'in' as const,
        cheque_number: r.cheque_number,
        cheque_image_url: r.cheque_image_url
      })),
      ...(roiRes.data || []).map(r => ({
        id: r.id,
        date: r.return_date,
        type: 'ROI' as const,
        description: `ROI Return: ${r.source_name}`,
        amount: Number(r.net_amount),
        flow: 'in' as const,
        cheque_number: r.cheque_number,
        cheque_image_url: r.cheque_image_url
      })),
      ...(expRes.data || []).map(r => ({
        id: r.id,
        date: r.expense_date,
        type: 'Expense' as const,
        description: `Expense: ${r.description || 'General Expense'}`,
        amount: Number(r.amount),
        flow: 'out' as const,
        cheque_number: r.cheque_number,
        cheque_image_url: r.cheque_image_url
      })),
      ...(coInvRes.data || []).map(r => ({
        id: r.id,
        date: r.investment_date,
        type: 'Investment Out' as const,
        description: `Investment Out: ${r.title}`,
        amount: Number(r.principal_amount),
        flow: 'out' as const,
        cheque_number: r.cheque_number,
        cheque_image_url: r.cheque_image_url
      })),
      ...(loanRes.data || []).map(r => ({
        id: r.id,
        date: r.issue_date,
        type: 'Loan Issued' as const,
        description: `Loan to: ${Array.isArray(r.shareholders) ? r.shareholders[0]?.first_name : (r.shareholders as any)?.first_name} ${Array.isArray(r.shareholders) ? r.shareholders[0]?.last_name : (r.shareholders as any)?.last_name}`,
        amount: Number(r.principal),
        flow: 'out' as const,
        cheque_number: r.cheque_number,
        cheque_image_url: r.cheque_image_url
      })),
      ...(repayRes.data || []).map(r => {
        const sh = (r.loans as any)?.shareholders;
        const shName = Array.isArray(sh) ? `${sh[0]?.first_name} ${sh[0]?.last_name}` : sh ? `${sh.first_name} ${sh.last_name}` : 'Unknown';
        
        let prin = (r as any).principal_amount;
        let intr = (r as any).interest_amount;

        // Fallback: Parse from remarks if columns didn't exist when created
        if ((!prin || Number(prin) === 0) && r.remarks && r.remarks.includes('[Breakdown]')) {
          const match = r.remarks.match(/Principal:\s*Rs\.\s*([\d.]+).*Interest:\s*Rs\.\s*([\d.]+)/);
          if (match) {
            prin = parseFloat(match[1]);
            intr = parseFloat(match[2]);
          }
        }

        const printedPrin = Number(prin || Number(r.amount)).toFixed(2);
        const printedIntr = Number(intr || 0).toFixed(2);

        // Extract custom remarks content if it exists to replace title
        let customTitle = 'Loan Repayment';
        if (r.remarks) {
          const parts = r.remarks.split(' | [Breakdown]');
          if (parts[0] && parts[0].trim().length > 0) {
            customTitle = parts[0].trim();
          }
        }

        return {
          id: r.id,
          date: r.payment_date,
          type: 'Loan Repay' as const,
          description: `${customTitle}: ${shName} (Prin: Rs. ${printedPrin}, Int: Rs. ${printedIntr})`,
          amount: Number(r.amount),
          flow: 'in' as const,
          cheque_number: r.cheque_number,
          cheque_image_url: r.cheque_image_url
        };
      }),
      ...(divRes.data || []).map(r => ({
        id: r.id,
        date: r.payment_date || new Date().toISOString(),
        type: 'Dividend Out' as const,
        description: `Dividend: ${Array.isArray(r.shareholders) ? r.shareholders[0]?.first_name : (r.shareholders as any)?.first_name} ${Array.isArray(r.shareholders) ? r.shareholders[0]?.last_name : (r.shareholders as any)?.last_name}`,
        amount: Number(r.amount),
        flow: 'out' as const,
        cheque_number: r.cheque_number,
        cheque_image_url: r.cheque_image_url
      })),
      ...(pettyRes.data || []).map(r => ({
        id: r.id,
        date: r.date,
        type: 'Petty Cash Transfer' as any,
        description: r.description || 'Transfer to Petty Cash',
        amount: Number(r.amount),
        flow: 'out' as const
      }))
    ];

    const sorted = combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(sorted);
    
    // Set default dates if not already set
    if (sorted.length > 0 && !startDate && !endDate) {
      setStartDate(sorted[0].date); // Most recent transaction date
      setEndDate(new Date().toISOString().split('T')[0]); // Today
    }
    
    setFetchingTransactions(false);
  };

  const handleExport = () => {
    if (!selectedBank || filteredTransactions.length === 0) return;
    
    const totalIn = filteredTransactions.filter(t => t.flow === 'in').reduce((s,t) => s + t.amount, 0);
    const totalOut = filteredTransactions.filter(t => t.flow === 'out').reduce((s,t) => s + t.amount, 0);
    const closing = selectedBank.initial_balance + totalIn - totalOut;

    const summary = [
      [`Bank Statement: ${selectedBank.bank_name}`],
      [`Account: ${selectedBank.account_number}`],
      [`Period: ${startDate || 'All Time'} to ${endDate || 'Present'}`],
      [],
      ['Summary Data'],
      ['Opening Balance', selectedBank.initial_balance.toFixed(2)],
      ['Total Inflow', totalIn.toFixed(2)],
      ['Total Outflow', totalOut.toFixed(2)],
      ['Closing Balance', closing.toFixed(2)],
      [],
      ['Date (AD)', 'Date (BS)', 'Type', 'Description', 'Cheque No', 'Inflow', 'Outflow', 'Balance']
    ];

    let runningBal = selectedBank.initial_balance;
    const sortedAsc = [...filteredTransactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const rows = sortedAsc.map(t => {
      if (t.flow === 'in') runningBal += t.amount;
      else runningBal -= t.amount;
      
      return [
        t.date,
        adToBs(t.date),
        t.type,
        `"${t.description.replace(/"/g, '""')}"`,
        t.cheque_number || '-',
        t.flow === 'in' ? t.amount.toFixed(2) : '0.00',
        t.flow === 'out' ? t.amount.toFixed(2) : '0.00',
        runningBal.toFixed(2)
      ];
    });

    const csvContent = [
      ...summary.map(r => r.join(',')),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedBank.bank_name}_statement_${getTodayBs()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const filteredTransactions = transactions.filter(t => {
    const d = t.date;
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Banking Overview</h1>
          <p className="page-subtitle">Manage multiple bank accounts and statements</p>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="grid-3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />)}
          </div>
        ) : banks.length === 0 ? (
          <div className="card empty-state">
            <Landmark size={48} style={{ color: 'var(--text-muted)' }} />
            <h3>No banks configured</h3>
            <p>Add bank accounts in Settings &rarr; Banks to see them here.</p>
          </div>
        ) : (
          <div className="grid-3">
            {banks.map(bank => (
              <div key={bank.id} className="card bank-card" style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.05 }}>
                  <Landmark size={120} />
                </div>
                <div className="flex flex-col h-full">
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{bank.bank_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{bank.account_number}</div>
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div className="stat-label">Current Balance</div>
                    <div className="stat-value" style={{ fontSize: 24, color: 'var(--primary-light)' }}>{formatCurrency(bank.current_balance)}</div>
                  </div>

                  <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    <button className="btn btn-ghost btn-sm w-full flex items-center justify-center gap-2" onClick={() => fetchStatement(bank)}>
                      <Eye size={16} /> View Statement
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LIGHTBOX */}
      {lightboxUrl && (
        <div 
          className="modal-overlay" 
          onClick={() => setLightboxUrl(null)} 
          style={{ zIndex: 9999, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <button 
            onClick={() => setLightboxUrl(null)}
            className="btn btn-ghost btn-icon"
            style={{ position: 'absolute', top: 20, right: 20, color: 'white', background: 'rgba(0,0,0,0.5)', width: 40, height: 40, borderRadius: '50%' }}
          >
            <X size={20} />
          </button>
          
          {isImageUrl(lightboxUrl) ? (
            <img 
              src={lightboxUrl} 
              alt="Cheque document" 
              style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} 
              onClick={(e) => e.stopPropagation()} 
            />
          ) : (
            <div onClick={(e) => e.stopPropagation()} style={{ width: '90vw', height: '90vh' }}>
              <iframe src={lightboxUrl} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }} title="Document viewer" />
            </div>
          )}
        </div>
      )}

      {/* Statement Modal */}
      {selectedBank && (
        <div className="modal-overlay" onClick={() => setSelectedBank(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: '95vw' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Bank Statement</h2>
                <p className="modal-subtitle">{selectedBank.bank_name} &bull; {selectedBank.account_number}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost btn-icon no-print" onClick={handleExport} title="Export CSV"><Download size={18} /></button>
                <button className="btn btn-ghost btn-icon no-print" onClick={() => window.print()} title="Print Statement"><Printer size={18} /></button>
                <button className="btn btn-ghost btn-icon no-print" onClick={() => { setSelectedBank(null); setStartDate(''); setEndDate(''); }}><X size={18} /></button>
              </div>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center gap-4 bg-secondary/20 p-4 border-b no-print">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-muted whitespace-nowrap">From Date (BS):</label>
                    <NepaliDateInput value={startDate} onChange={(ad) => setStartDate(ad)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-muted whitespace-nowrap">To Date (BS):</label>
                    <NepaliDateInput value={endDate} onChange={(ad) => setEndDate(ad)} />
                  </div>
                  {(startDate || endDate) && (
                    <button className="btn btn-ghost btn-xs text-danger" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear</button>
                  )}
                </div>

                <div className="print-header-info print-only text-center border-b pb-4 mb-4">
                  <h2 className="text-xl font-bold">{selectedBank.bank_name}</h2>
                  <p className="text-sm">{selectedBank.account_name} | {selectedBank.account_number}</p>
                  <p className="mt-2 font-bold">
                    Bank Statement: from <strong>{startDate ? adToBs(startDate) : '..................'}</strong> to <strong>{endDate ? adToBs(endDate) : '..................'}</strong>
                  </p>
                </div>

                <div className="p-6 flex items-center justify-between bg-secondary/30" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <div className="flex gap-4">
                    <div className="stat-mini">
                      <div className="stat-label">Initial Balance</div>
                      <div className="stat-value" style={{ fontSize: 16 }}>{formatCurrency(selectedBank.initial_balance)}</div>
                    </div>
                    <div className="stat-mini">
                      <div className="stat-label">Total Inflow</div>
                      <div className="stat-value" style={{ fontSize: 16, color: 'var(--success)' }}>
                        {formatCurrency(filteredTransactions.filter(t => t.flow === 'in').reduce((s,t) => s + t.amount, 0))}
                      </div>
                    </div>
                    <div className="stat-mini">
                      <div className="stat-label">Total Outflow</div>
                      <div className="stat-value" style={{ fontSize: 16, color: 'var(--danger)' }}>
                        {formatCurrency(filteredTransactions.filter(t => t.flow === 'out').reduce((s,t) => s + t.amount, 0))}
                      </div>
                    </div>
                  </div>
                  <div className="stat-mini">
                    <div className="stat-label">Closing Balance</div>
                    <div className="stat-value" style={{ fontSize: 18, color: 'var(--primary-light)' }}>
                      {(() => {
                          let bal = selectedBank.initial_balance;
                          filteredTransactions.forEach(t => {
                            if (t.flow === 'in') bal += t.amount;
                            else bal -= t.amount;
                          });
                          return formatCurrency(bal);
                      })()}
                    </div>
                  </div>
                </div>

                {fetchingTransactions ? (
                  <div className="p-8 text-center"><div className="skeleton h-32 w-full" /></div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="p-12 text-center text-muted">No transactions found for the selected period.</div>
                ) : (
                  <div className="table-container" style={{ margin: 0, border: 'none' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date (BS)</th>
                          <th>Type</th>
                          <th>Description</th>
                          <th style={{ textAlign: 'right' }}>Inflow</th>
                          <th style={{ textAlign: 'right' }}>Outflow</th>
                          <th style={{ textAlign: 'right' }}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={5} style={{ fontWeight: 500 }}>Opening Balance for Period</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(selectedBank.initial_balance)}</td>
                        </tr>
                        {(() => {
                          let runningBalance = selectedBank.initial_balance;
                          const sortedAsc = [...filteredTransactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                          
                          return sortedAsc.map((t) => {
                            if (t.flow === 'in') runningBalance += t.amount;
                            else runningBalance -= t.amount;
                            
                            return (
                              <tr key={t.id}>
                                <td style={{ fontSize: 13 }}>{adToBs(t.date)}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.date}</div></td>
                                <td><span className={`badge ${t.flow === 'in' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 11 }}>{t.type}</span></td>
                                <td style={{ fontSize: 13 }}>
                                  {t.description}
                                  {t.cheque_number && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Chq: {t.cheque_number}</div>}
                                </td>
                                <td style={{ textAlign: 'right', fontSize: 13 }}>
                                  <div className="flex flex-col items-end">
                                    <span style={{ color: 'var(--success)' }}>{t.flow === 'in' ? formatCurrency(t.amount) : '—'}</span>
                                    {t.cheque_image_url && t.flow === 'in' && (
                                      <button className="btn btn-ghost btn-sm text-xs no-print" style={{ color: 'var(--warning, #f59e0b)', padding: 0, height: 'auto' }} onClick={() => setLightboxUrl(t.cheque_image_url!)}>
                                        View Cheque
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right', fontSize: 13 }}>
                                  <div className="flex flex-col items-end">
                                    <span style={{ color: 'var(--danger)' }}>{t.flow === 'out' ? formatCurrency(t.amount) : '—'}</span>
                                    {t.cheque_image_url && t.flow === 'out' && (
                                      <button className="btn btn-ghost btn-sm text-xs no-print" style={{ color: 'var(--warning, #f59e0b)', padding: 0, height: 'auto' }} onClick={() => setLightboxUrl(t.cheque_image_url!)}>
                                        View Cheque
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 500, fontSize: 13 }}>{formatCurrency(runningBalance)}</td>
                              </tr>
                            );
                          }).reverse();
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer no-print">
              <button className="btn btn-secondary" onClick={() => { setSelectedBank(null); setStartDate(''); setEndDate(''); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .bank-card {
          padding: 24px;
          transition: all 0.3s ease;
          border: 1px solid var(--border);
        }
        .bank-card:hover {
          border-color: var(--primary);
          transform: translateY(-4px);
          box-shadow: 0 12px 24px -8px rgba(0,0,0,0.2);
        }
        .stat-mini {
          display: flex;
          flex-direction: column;
        }
        @page { margin: 0; }
        @media print {
          .no-print, .sidebar, .sidebar-toggle, #mobile-sidebar-toggle, .sidebar-overlay, .theme-toggle-btn { display: none !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .modal-overlay { 
            position: absolute !important; 
            background: white !important; 
            padding: 0 !important;
            inset: 0 !important;
            z-index: 9999 !important;
            display: block !important;
          }
          .modal { 
            border: none !important; 
            box-shadow: none !important; 
            width: 100% !important; 
            max-width: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important;
            color: black !important;
            display: block !important;
          }
          .modal-body { overflow: visible !important; padding: 0 !important; }
          .modal-header, .modal-footer { display: none !important; }
          .table { width: 100% !important; border-collapse: collapse !important; font-size: 11px !important; }
          .table th, .table td { border: 1px solid #eee !important; padding: 8px !important; color: black !important; }
          .badge { background: transparent !important; border: 1px solid #ccc !important; color: black !important; }
          .stat-mini .stat-label { color: #666 !important; }
          .stat-mini .stat-value { color: black !important; }
          
          .main-content { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .page-header, .page-body, .bank-card-container { display: none !important; }
          .print-header-info { display: block !important; }
        }
        .print-header-info { display: none; }
      `}</style>
    </>
  );
}
