'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, X, FileText, Landmark, Briefcase, Calendar, Clock, CheckCircle, Info } from 'lucide-react';
import NepaliDateInput from '../components/NepaliDateInput';
import { adToBs } from '@/lib/utils/nepaliDate';
import { getAvailableCheques } from '@/lib/utils/chequeUtils';
import { getBankBalance, getPettyCashBalance } from '@/lib/utils/bankBalance';
import { processImage } from '@/lib/utils/imageProcess';

interface CompanyInvestment {
  id: string;
  title: string;
  investment_type: 'Fixed Deposit' | 'Stocks' | 'Land' | 'Other';
  principal_amount: number;
  investment_date: string;
  maturity_date: string | null;
  status: 'active' | 'closed';
  company_bank_id: string | null;
  remarks: string | null;
  created_at: string;
  cheque_number: string | null;
  cheque_image_url: string | null;
  payment_method: string;
  company_banks?: { bank_name: string; account_number: string };
}

interface CompanyBank {
  id: string;
  bank_name: string;
  account_number: string;
}

export default function CompanyInvestmentsPage() {
  const supabase = createClient();
  const [investments, setInvestments] = useState<CompanyInvestment[]>([]);
  const [banks, setBanks] = useState<CompanyBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CompanyInvestment | null>(null);
  const [saving, setSaving] = useState(false);
  const [chequeFile, setChequeFile] = useState<File | null>(null);
  const [chequePreview, setChequePreview] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [availableCheques, setAvailableCheques] = useState<string[]>([]);
  const [loadingCheques, setLoadingCheques] = useState(false);
  const [currentSelectedBalance, setCurrentSelectedBalance] = useState<number | null>(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingInvestment, setDeletingInvestment] = useState<CompanyInvestment | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isImageUrl = (url: string | null) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || url.startsWith('blob:');
  };

  const [form, setForm] = useState({
    title: '',
    investment_type: 'Fixed Deposit' as any,
    principal_amount: '',
    investment_date: new Date().toISOString().split('T')[0],
    maturity_date: '',
    company_bank_id: '',
    remarks: '',
    status: 'active' as any,
    payment_method: 'bank',
    cheque_number: '',
  });

  const fetchInvestments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('company_investments')
      .select('*, company_banks(bank_name, account_number)')
      .is('deleted_at', null)
      .order('investment_date', { ascending: false });

    if (error) toast.error('Failed to load investments');
    else setInvestments((data || []) as CompanyInvestment[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (investments.length > 0 && !startDate && !endDate) {
      setStartDate(investments[0].investment_date); // Most recent transaction date
      setEndDate(new Date().toISOString().split('T')[0]); // Today
    }
  }, [investments, startDate, endDate]);

  const fetchBanks = useCallback(async () => {
    const { data } = await supabase.from('company_banks').select('id, bank_name, account_number').eq('is_active', true);
    setBanks((data || []) as CompanyBank[]);
  }, [supabase]);

  useEffect(() => {
    fetchInvestments();
    fetchBanks();
  }, [fetchInvestments, fetchBanks]);

  useEffect(() => {
    const loadCheques = async () => {
      if (form.company_bank_id) {
        setLoadingCheques(true);
        const cheques = await getAvailableCheques(supabase, form.company_bank_id);
        // Include current cheque if editing
        if (editing && editing.cheque_number && editing.company_bank_id === form.company_bank_id) {
          if (!cheques.includes(editing.cheque_number)) {
            cheques.push(editing.cheque_number);
            cheques.sort((a,b) => parseInt(a) - parseInt(b));
          }
        }
        setAvailableCheques(cheques);
        setLoadingCheques(false);
      } else {
        setAvailableCheques([]);
      }
    };
    loadCheques();
  }, [form.company_bank_id, supabase, editing]);

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

    const amount = parseFloat(form.principal_amount);
    if (currentSelectedBalance !== null && amount > currentSelectedBalance) {
      toast.error(`Insufficient balance in selected bank account. Current balance: Rs. ${currentSelectedBalance.toLocaleString()}`);
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    let chequeUrl = editing?.cheque_image_url || null;
    if (chequeFile) {
      const processedFile = await processImage(chequeFile);
      const finalFile = processedFile instanceof Blob && !(processedFile instanceof File) 
        ? new File([processedFile], chequeFile.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })
        : processedFile as File;

      const ext = finalFile.name.split('.').pop();
      const filePath = `cheque-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('expense-receipts').upload(filePath, finalFile);
      if (error) { toast.error('Failed to upload cheque receipt'); setSaving(false); return; }
      const { data: signedData } = await supabase.storage.from('expense-receipts').createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);
      chequeUrl = signedData?.signedUrl || null;
    }

    const payload: any = {
      title: form.title,
      investment_type: form.investment_type,
      principal_amount: parseFloat(form.principal_amount),
      investment_date: form.investment_date,
      maturity_date: form.maturity_date || null,
      company_bank_id: (form.payment_method === 'bank' || form.payment_method === 'check') ? (form.company_bank_id || null) : null,
      cheque_number: (form.payment_method === 'bank' || form.payment_method === 'check') ? (form.cheque_number || null) : null,
      cheque_image_url: (form.payment_method === 'bank' || form.payment_method === 'check') ? chequeUrl : null,
      remarks: form.remarks || null,
      status: form.status,
      created_by: user?.id,
    };

    if (editing) {
      const { error } = await supabase.from('company_investments').update(payload).eq('id', editing.id);
      if (error) toast.error('Failed to update'); else {
        toast.success('Investment updated');
        // Sync with petty cash if applicable
        if (form.payment_method === 'petty_cash') {
          await supabase.from('petty_cash_ledger').upsert({
            reference_id: editing.id,
            date: payload.investment_date,
            type: 'outflow',
            source: 'company_investment',
            amount: payload.principal_amount,
            description: payload.title,
            created_by: user?.id
          }, { onConflict: 'reference_id' });
        } else {
          await supabase.from('petty_cash_ledger').delete().eq('reference_id', editing.id);
        }
      }
    } else {
      const { data, error } = await supabase.from('company_investments').insert(payload).select().single();
      if (error) toast.error('Failed to create'); else {
        toast.success('Investment recorded');
        if (form.payment_method === 'petty_cash' && data) {
          await supabase.from('petty_cash_ledger').insert({
            reference_id: data.id,
            date: payload.investment_date,
            type: 'outflow',
            source: 'company_investment',
            amount: payload.principal_amount,
            description: payload.title,
            created_by: user?.id
          });
        }
      }
    }

    setSaving(false);
    setShowModal(false);
    fetchInvestments();
  };

  const handleDelete = (inv: CompanyInvestment) => {
    setDeletingInvestment(inv);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingInvestment) return;
    setSaving(true);
    const { error } = await supabase.from('company_investments').update({ deleted_at: new Date().toISOString() }).eq('id', deletingInvestment.id);
    if (error) {
       toast.error('Failed to delete investment');
    } else {
       toast.success('Investment moved to recycle bin');
       // Sync with petty cash ledger
       await supabase.from('petty_cash_ledger').delete().eq('reference_id', deletingInvestment.id);
       fetchInvestments();
       setShowDeleteModal(false);
    }
    setSaving(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      investment_type: 'Fixed Deposit',
      principal_amount: '',
      investment_date: new Date().toISOString().split('T')[0],
      maturity_date: '',
      company_bank_id: '',
      remarks: '',
      status: 'active',
      payment_method: 'bank',
      cheque_number: '',
    });
    setChequeFile(null);
    setChequePreview(null);
    setShowModal(true);
  };

  const openEdit = (inv: CompanyInvestment) => {
    setEditing(inv);
    setForm({
      title: inv.title,
      investment_type: inv.investment_type,
      principal_amount: String(inv.principal_amount),
      investment_date: inv.investment_date,
      maturity_date: inv.maturity_date || '',
      company_bank_id: inv.company_bank_id || '',
      remarks: inv.remarks || '',
      status: inv.status,
      payment_method: inv.payment_method || 'bank',
      cheque_number: inv.cheque_number || '',
    });
    setChequeFile(null);
    setChequePreview(null);
    setShowModal(true);
  };

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const filtered = investments.filter(i => {
    const d = i.investment_date;
    const matchesSearch = (i.title || '').toLowerCase().includes(search.toLowerCase()) || 
                         (i.remarks || '').toLowerCase().includes(search.toLowerCase()) ||
                         (i.company_banks?.bank_name || '').toLowerCase().includes(search.toLowerCase());
    
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return matchesSearch;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Company Investments</h1>
          <p className="page-subtitle">Track outward deployment of capital (FDs, Stocks, etc.)</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Record Investment
        </button>
      </div>

      <div className="page-body">
        <div className="search-bar no-print flex justify-between items-center" style={{ marginBottom: 20 }}>
          <div className="flex gap-4">
            <div className="search-input-wrapper" style={{ minWidth: 250 }}>
              <Search size={16} />
              <input className="input" placeholder="Search company investments..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
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

        {loading ? (
          <div className="card">{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 8 }} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <Briefcase size={48} style={{ color: 'var(--text-muted)' }} />
            <h3>No investments recorded</h3>
            <p>Start tracking company's outward investments here.</p>
            <button className="btn btn-primary mt-4" onClick={openCreate}><Plus size={16} /> Record Investment</button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Investment</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Date (BS)</th>
                  <th>Source Bank</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inv.title}</div>
                      {inv.remarks && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{inv.remarks}</div>}
                    </td>
                    <td><span className="badge badge-neutral">{inv.investment_type}</span></td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(inv.principal_amount)}</td>
                    <td>{adToBs(inv.investment_date)}</td>
                    <td>
                      {inv.company_banks ? (
                        <div style={{ fontSize: 13 }}>
                          <div style={{ fontWeight: 500 }}>{inv.company_banks.bank_name}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{inv.company_banks.account_number}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className={`badge ${inv.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                          {inv.status === 'active' ? 'Active' : 'Closed'}
                        </span>
                        {inv.cheque_image_url && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setLightboxUrl(inv.cheque_image_url)} style={{ color: 'var(--warning, #f59e0b)', fontSize: 10, padding: '2px 4px' }}>
                            View Cheque
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(inv)}><Edit2 size={16} /></button>
                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(inv)} style={{ color: 'var(--danger)' }}><Trash2 size={16} /></button>
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Investment' : 'Record Investment'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Investment Title / Source <span className="required">*</span></label>
                    <input className="input" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} required placeholder="e.g. FD in Global Bank, Secondary Market Shares" />
                  </div>
                  
                  <div className="input-group">
                    <label>Investment Type <span className="required">*</span></label>
                    <select className="select" value={form.investment_type} onChange={(e) => setForm(p => ({ ...p, investment_type: e.target.value as any }))} required>
                      <option value="Fixed Deposit">Fixed Deposit</option>
                      <option value="Stocks">Stocks</option>
                      <option value="Land">Land</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  <div className="input-group">
                    <label className="flex justify-between items-center">
                      <span>Principal Amount (Rs.) <span className="required">*</span></span>
                      {currentSelectedBalance !== null && !fetchingBalance && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: (parseFloat(form.principal_amount) || 0) > currentSelectedBalance ? 'var(--danger)' : 'var(--primary-light)' }}>
                          Bal: Rs. {currentSelectedBalance.toLocaleString()}
                        </span>
                      )}
                      {fetchingBalance && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Checking balance...</span>}
                    </label>
                    <input type="number" step="0.01" min="0.01" className="input" value={form.principal_amount} onChange={(e) => setForm(p => ({ ...p, principal_amount: e.target.value }))} required placeholder="0.00" />
                  </div>

                  <div className="input-group">
                    <label>Investment Date (BS) <span className="required">*</span></label>
                    <NepaliDateInput value={form.investment_date} onChange={(ad) => setForm(p => ({ ...p, investment_date: ad }))} required />
                  </div>

                  <div className="input-group">
                    <label>Payment Method</label>
                    <select className="select" value={form.payment_method} onChange={(e) => setForm(p => ({ ...p, payment_method: e.target.value, company_bank_id: '' }))}>
                      <option value="bank">Bank</option>
                      <option value="petty_cash">Petty Cash</option>
                    </select>
                  </div>

                  {form.payment_method === 'bank' && (
                    <div className="input-group" style={{ gridColumn: 'span 2' }}>
                      <label>Source Bank Account (Funds Deducted From)</label>
                      <select className="select" value={form.company_bank_id} onChange={(e) => setForm(p => ({ ...p, company_bank_id: e.target.value }))}>
                        <option value="">Select bank account...</option>
                        {banks.map(b => (
                          <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {form.company_bank_id && (
                    <>
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
                      </div>
                      <div className="input-group">
                        <label>Cheque Receipt Image</label>
                        <input type="file" accept="image/*,.pdf" onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setChequeFile(file);
                          if (file && file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setChequePreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }} style={{ fontSize: 12 }} />
                        {chequePreview && (
                          <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }} onClick={() => setLightboxUrl(chequePreview)}>
                            {isImageUrl(chequePreview) ? (
                              <img src={chequePreview} alt="Cheque preview" style={{ width: '100%', maxHeight: 80, objectFit: 'cover' }} />
                            ) : (
                              <div style={{ padding: 8, fontSize: 11 }}>Cheque PDF Selected</div>
                            )}
                          </div>
                        )}
                        {!chequePreview && editing?.cheque_image_url && (
                          <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }} onClick={() => setLightboxUrl(editing.cheque_image_url!)}>
                            {isImageUrl(editing.cheque_image_url) ? (
                              <img src={editing.cheque_image_url} alt="Current cheque" style={{ width: '100%', maxHeight: 80, objectFit: 'cover' }} />
                            ) : (
                              <div style={{ padding: 8, fontSize: 11 }}>View Current Cheque PDF</div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="input-group">
                    <label>Status</label>
                    <select className="select" value={form.status} onChange={(e) => setForm(p => ({ ...p, status: e.target.value as any }))}>
                      <option value="active">Active</option>
                      <option value="closed">Closed / Liquidated</option>
                    </select>
                  </div>

                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Remarks</label>
                    <textarea className="textarea" value={form.remarks} onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Additional details..." style={{ minHeight: 60 }} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Record'}</button>
              </div>
            </form>
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

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && deletingInvestment && (
        <div className="modal-overlay" onClick={() => !saving && setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Confirm Deletion</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => !saving && setShowDeleteModal(false)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                Are you sure you want to delete this investment record? It will be moved to the recycle bin.
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
                <div style={{ marginBottom: 4 }}><strong>Title:</strong> {deletingInvestment.title}</div>
                <div style={{ marginBottom: 4 }}><strong>Type:</strong> {deletingInvestment.investment_type}</div>
                <div><strong>Amount:</strong> Rs. {deletingInvestment.principal_amount.toLocaleString()}</div>
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
    </>
  );
}
