'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Plus, X, PiggyBank, Calendar, Eye, Trash2, Search } from 'lucide-react';
import { getAvailableCheques } from '@/lib/utils/chequeUtils';
import { adToBs } from '@/lib/utils/nepaliDate';
import NepaliDateInput from '../components/NepaliDateInput';
import { getBankBalance, getPettyCashBalance } from '@/lib/utils/bankBalance';
import { processImage } from '@/lib/utils/imageProcess';

interface Dividend {
  id: string;
  shareholder_id: string;
  fiscal_year_id: string;
  total_investment: number;
  dividend_rate: number;
  amount: number;
  payment_status: string;
  payment_date: string | null;
  payment_method: string | null;
  remarks: string | null;
  cheque_number: string | null;
  cheque_image_url: string | null;
  company_bank_id: string | null;
  shareholders: { first_name: string; last_name: string; phone_number: string | null };
  fiscal_years: { name: string };
}

interface CompanyBank {
  id: string;
  bank_name: string;
  account_number: string;
}

interface ShareholderOption { id: string; first_name: string; last_name: string; }
interface FiscalYear { id: string; name: string; is_current: boolean; }

export default function DividendsPage() {
  const supabase = createClient();
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [shareholders, setShareholders] = useState<ShareholderOption[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [banks, setBanks] = useState<CompanyBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingDividend, setDeletingDividend] = useState<Dividend | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ 
    shareholder_id: '', 
    fiscal_year_id: '', 
    amount: '', 
    dividend_rate: '', 
    payment_method: 'bank', 
    remarks: '',
    company_bank_id: '',
    cheque_number: '',
  });
  const [chequeFile, setChequeFile] = useState<File | null>(null);
  const [chequePreview, setChequePreview] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [availableCheques, setAvailableCheques] = useState<string[]>([]);
  const [loadingCheques, setLoadingCheques] = useState(false);
  const [currentSelectedBalance, setCurrentSelectedBalance] = useState<number | null>(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  const isImageUrl = (url: string | null) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || url.startsWith('blob:');
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [divRes, shRes, fyRes, bankRes] = await Promise.all([
      supabase.from('dividends').select('*, shareholders!inner(first_name, last_name, phone_number), fiscal_years!inner(name)').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('shareholders').select('id, first_name, last_name, phone_number').is('deleted_at', null).eq('is_active', true),
      supabase.from('fiscal_years').select('*').order('start_date', { ascending: false }),
      supabase.from('company_banks').select('id, bank_name, account_number').eq('is_active', true)
    ]);
    setDividends((divRes.data || []) as Dividend[]);
    setShareholders((shRes.data || []) as ShareholderOption[]);
    setFiscalYears((fyRes.data || []) as FiscalYear[]);
    setBanks((bankRes.data || []) as CompanyBank[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (dividends.length > 0 && !startDate && !endDate) {
      // Find the most recent payment date
      const sortedD = [...dividends].filter(d => d.payment_date).sort((a,b) => new Date(b.payment_date!).getTime() - new Date(a.payment_date!).getTime());
      if (sortedD.length > 0) {
        setStartDate(sortedD[0].payment_date!); 
        setEndDate(new Date().toISOString().split('T')[0]); // Today
      }
    }
  }, [dividends, startDate, endDate]);

  useEffect(() => {
    const loadCheques = async () => {
      if (form.company_bank_id) {
        setLoadingCheques(true);
        const cheques = await getAvailableCheques(supabase, form.company_bank_id);
        setAvailableCheques(cheques);
        setLoadingCheques(false);
      } else {
        setAvailableCheques([]);
      }
    };
    loadCheques();
  }, [form.company_bank_id, supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (form.payment_method === 'petty_cash') {
        setFetchingBalance(true);
        const bal = await getPettyCashBalance(supabase);
        setCurrentSelectedBalance(bal);
        setFetchingBalance(false);
      } else if (form.company_bank_id) {
        setFetchingBalance(true);
        const bal = await getBankBalance(supabase, form.company_bank_id);
        setCurrentSelectedBalance(bal);
        setFetchingBalance(false);
      } else {
        setCurrentSelectedBalance(null);
      }
    };
    fetchBalance();
  }, [form.company_bank_id, form.payment_method, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(form.amount);
    if (currentSelectedBalance !== null && amount > currentSelectedBalance) {
      toast.error(`Insufficient balance in selected bank account. Current balance: Rs. ${currentSelectedBalance.toLocaleString()}`);
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    let chequeUrl = null;
    if (chequeFile) {
      const processedFile = await processImage(chequeFile);
      const finalFile = processedFile instanceof Blob && !(processedFile instanceof File) 
        ? new File([processedFile], chequeFile.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })
        : processedFile as File;

      const ext = finalFile.name.split('.').pop();
      const filePath = `dividends/${Date.now()}.${ext}`;
      const { error: upError } = await supabase.storage.from('documents').upload(filePath, finalFile);
      if (upError) { toast.error('Failed to upload cheque'); setSaving(false); return; }
      const { data: signedData } = await supabase.storage.from('documents').createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);
      chequeUrl = signedData?.signedUrl || null;
    }

    const { data: divData, error } = await supabase.from('dividends').insert({
      shareholder_id: form.shareholder_id,
      fiscal_year_id: form.fiscal_year_id,
      amount: parseFloat(form.amount),
      dividend_rate: form.dividend_rate ? parseFloat(form.dividend_rate) / 100 : null,
      payment_method: form.payment_method,
      company_bank_id: (form.payment_method === 'bank' || form.payment_method === 'check') ? (form.company_bank_id || null) : null,
      cheque_number: (form.payment_method === 'bank' || form.payment_method === 'check') ? (form.cheque_number || null) : null,
      cheque_image_url: (form.payment_method === 'bank' || form.payment_method === 'check') ? chequeUrl : null,
      remarks: form.remarks || null,
      created_by: user?.id,
      payment_status: 'paid', // Dividends recorded here are usually paid immediately
      payment_date: new Date().toISOString().split('T')[0]
    }).select().single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Dividend recorded');
      if (form.payment_method === 'petty_cash' && divData) {
        await supabase.from('petty_cash_ledger').insert({
          reference_id: divData.id,
          date: new Date().toISOString().split('T')[0],
          type: 'outflow',
          source: 'dividend',
          amount: parseFloat(form.amount),
          description: `Dividend payment to shareholder ID: ${form.shareholder_id}`,
          created_by: user?.id
        });
      }
      setShowModal(false);
      fetchAll();
    }
    setSaving(false);
  };

  const handleMarkPaid = async (div: Dividend) => {
    const { error } = await supabase.from('dividends').update({ payment_status: 'paid', payment_date: new Date().toISOString().split('T')[0] }).eq('id', div.id);
    if (error) toast.error('Failed'); else { 
      toast.success('Marked as paid'); 
      // Synchronize with petty cash ledger if payment method is petty cash
      if (div.payment_method === 'petty_cash') {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('petty_cash_ledger').upsert({
          reference_id: div.id,
          date: new Date().toISOString().split('T')[0],
          type: 'outflow',
          source: 'dividend',
          amount: div.amount,
          description: `Dividend paid to shareholder ID: ${div.shareholder_id}`,
          created_by: user?.id
        }, { onConflict: 'reference_id' });
      }
      fetchAll(); 
    }
  };

  const handleDeleteClick = (div: Dividend) => {
    setDeletingDividend(div);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingDividend) return;
    setSaving(true);
    const { error } = await supabase.from('dividends').update({ deleted_at: new Date().toISOString() }).eq('id', deletingDividend.id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Dividend record removed');
      // Sync with petty cash ledger
      await supabase.from('petty_cash_ledger').delete().eq('reference_id', deletingDividend.id);
      fetchAll();
      setShowDeleteModal(false);
    }
    setSaving(false);
  };

  const formatCurrency = (n: number) => `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const filtered = dividends.filter(d => {
    const dDate = d.payment_date;
    const name = `${d.shareholders?.first_name || ''} ${d.shareholders?.last_name || ''}`.toLowerCase();
    const fiscal = (d.fiscal_years?.name || '').toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase()) || fiscal.includes(search.toLowerCase());
    
    if (startDate && dDate && dDate < startDate) return false;
    if (endDate && dDate && dDate > endDate) return false;
    return matchesSearch;
  });

  const totalPaid = filtered.reduce((s, d) => s + d.amount, 0);
  const totalPending = filtered.filter(d => d.payment_status === 'pending').reduce((s, d) => s + d.amount, 0);
  const statusBadge = (s: string) => s === 'paid' ? 'badge-success' : s === 'cancelled' ? 'badge-danger' : 'badge-warning';

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dividends</h1>
          <p className="page-subtitle">Paid: {formatCurrency(totalPaid)} &bull; Pending: {formatCurrency(totalPending)}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { 
          setForm({ 
            shareholder_id: '', 
            fiscal_year_id: '', 
            amount: '', 
            dividend_rate: '', 
            payment_method: 'bank', 
            remarks: '',
            company_bank_id: '',
            cheque_number: '',
          }); 
          setChequeFile(null);
          setChequePreview(null);
          setShowModal(true); 
        }}>
          <Plus size={16} /> Record Dividend
        </button>
      </div>
      <div className="page-body">
        <div className="search-bar no-print flex justify-between items-center" style={{ marginBottom: 20 }}>
          <div className="flex gap-4">
            <div className="search-input-wrapper" style={{ minWidth: 250 }}>
              <Search size={16} />
              <input className="input" placeholder="Search dividends..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
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
        </div>

        {loading ? <div className="card">{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 8 }} />)}</div> : filtered.length === 0 ? (
          <div className="card empty-state"><PiggyBank size={48} /><h3>No dividends found</h3><p>Manage and track shareholder dividends here.</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Shareholder</th><th>Fiscal Year</th><th>Investment</th><th>Rate</th><th>Amount</th><th>Date (BS)</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.shareholders.first_name} {d.shareholders.last_name}</td>
                    <td><span className="badge badge-neutral">{d.fiscal_years.name}</span></td>
                    <td>{d.dividend_rate ? `${(d.dividend_rate * 100).toFixed(2)}%` : '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(d.amount)}</td>
                    <td>
                      <div className="flex flex-col">
                        <span style={{ textTransform: 'capitalize' }}>{d.payment_method || '—'}</span>
                        {d.payment_date && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{adToBs(d.payment_date)}</span>}
                        {d.cheque_image_url && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setLightboxUrl(d.cheque_image_url!)} style={{ color: 'var(--warning, #f59e0b)', padding: 0, height: 'auto', justifyContent: 'flex-start', marginTop: 2 }}>
                            <Eye size={12} className="mr-1" /> Cheque
                          </button>
                        )}
                      </div>
                    </td>
                    <td><span className={`badge ${statusBadge(d.payment_status)}`}>{d.payment_status}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex gap-2 justify-end">
                        {d.payment_status === 'pending' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleMarkPaid(d)} style={{ color: 'var(--success)' }}>Mark Paid</button>
                        )}
                        <button className="btn btn-ghost btn-icon" onClick={() => handleDeleteClick(d)} style={{ color: 'var(--danger)' }} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Record Dividend</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Shareholder <span className="required">*</span></label>
                    <select className="select" value={form.shareholder_id} onChange={(e) => setForm(p => ({ ...p, shareholder_id: e.target.value }))} required><option value="">Select...</option>{shareholders.map(sh => <option key={sh.id} value={sh.id}>{sh.first_name} {sh.last_name}</option>)}</select>
                  </div>
                  <div className="input-group"><label>Fiscal Year <span className="required">*</span></label>
                    <select className="select" value={form.fiscal_year_id} onChange={(e) => setForm(p => ({ ...p, fiscal_year_id: e.target.value }))} required><option value="">Select...</option>{fiscalYears.map(fy => <option key={fy.id} value={fy.id}>{fy.name}{fy.is_current ? ' (Current)' : ''}</option>)}</select>
                  </div>
                  <div className="input-group">
                    <label className="flex justify-between items-center">
                      <span>Amount (Rs.) <span className="required">*</span></span>
                      {currentSelectedBalance !== null && !fetchingBalance && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: (parseFloat(form.amount) || 0) > currentSelectedBalance ? 'var(--danger)' : 'var(--primary-light)' }}>
                          Bal: Rs. {currentSelectedBalance.toLocaleString()}
                        </span>
                      )}
                      {fetchingBalance && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Checking balance...</span>}
                    </label>
                    <input type="number" step="0.01" min="0.01" className="input" value={form.amount} onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))} required placeholder="0.00" />
                  </div>
                  <div className="input-group"><label>Dividend Rate (%)</label><input type="number" step="0.01" className="input" value={form.dividend_rate} onChange={(e) => setForm(p => ({ ...p, dividend_rate: e.target.value }))} placeholder="e.g., 12" /></div>
                  <div className="input-group"><label>Payment Method</label>
                    <select className="select" value={form.payment_method} onChange={(e) => setForm(p => ({ ...p, payment_method: e.target.value, company_bank_id: '' }))}>
                      <option value="bank">Bank</option>
                      <option value="petty_cash">Petty Cash</option>
                    </select>
                  </div>
                  <div className="input-group"><label>Remarks</label><input className="input" value={form.remarks} onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Notes..." /></div>
                  
                  {form.payment_method === 'bank' && (
                    <>
                      <div className="input-group" style={{ gridColumn: 'span 2' }}>
                        <label>Select Company Bank <span className="required">*</span></label>
                        <select className="select" value={form.company_bank_id} onChange={(e) => setForm(p => ({ ...p, company_bank_id: e.target.value }))} required>
                          <option value="">Select bank account...</option>
                          {banks.map(b => (
                            <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>
                          ))}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Cheque Number {loadingCheques && <span style={{ fontSize: 10, color: 'var(--primary)' }}>(Loading...)</span>}</label>
                        <select 
                          className="select" 
                          value={form.cheque_number || ''} 
                          onChange={(e) => setForm(p => ({ ...p, cheque_number: e.target.value }))}
                          disabled={loadingCheques}
                        >
                          <option value="">Select cheque...</option>
                          {availableCheques.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        {availableCheques.length === 0 && !loadingCheques && form.company_bank_id && (
                          <span style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>No active cheque ranges found for this bank. Add them in Settings.</span>
                        )}
                      </div>
                      <div className="input-group">
                        <label>Cheque Receipt Image</label>
                        <input type="file" className="input" onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setChequeFile(file);
                          if (file && file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setChequePreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }} accept="image/*,.pdf" />
                      </div>
                      {chequePreview && (
                        <div style={{ gridColumn: 'span 2', marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                          <img src={chequePreview} alt="Cheque Preview" style={{ width: '100%', maxHeight: 120, objectFit: 'contain', background: '#000' }} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && deletingDividend && (
        <div className="modal-overlay no-print" onClick={() => !saving && setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Confirm Deletion</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => !saving && setShowDeleteModal(false)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                Are you sure you want to delete this Dividend record? It will be moved to the recycle bin.
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
                <div style={{ marginBottom: 4 }}><strong>Shareholder:</strong> {deletingDividend.shareholders?.first_name} {deletingDividend.shareholders?.last_name}</div>
                <div><strong>Amount:</strong> {formatCurrency(deletingDividend.amount)}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={confirmDelete} disabled={saving}>
                {saving ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </>
  );
}
