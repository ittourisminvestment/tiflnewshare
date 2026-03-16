'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, X, FileText, ArrowDownToLine, Printer, Landmark } from 'lucide-react';
import NepaliDateInput from '../components/NepaliDateInput';
import { adToBs } from '@/lib/utils/nepaliDate';
import { getBankBalance, getPettyCashBalance } from '@/lib/utils/bankBalance';
import { processImage } from '@/lib/utils/imageProcess';

interface InvestmentReturn {
  id: string;
  source_name: string;
  gross_amount: number;
  tax_amount: number;
  net_amount: number;
  return_date: string;
  payment_method: string | null;
  receipt_url: string | null;
  remarks: string | null;
  created_at: string;
  company_investment_id: string | null;
  company_bank_id: string | null;
  cheque_number: string | null;
  cheque_image_url: string | null;
  company_investments?: { title: string };
  company_banks?: { bank_name: string };
}

interface CompanyInvestment {
  id: string;
  title: string;
}

interface CompanyBank {
  id: string;
  bank_name: string;
  account_number: string;
}

export default function ReturnsPage() {
  const supabase = createClient();
  const [returns, setReturns] = useState<InvestmentReturn[]>([]);
  const [investments, setInvestments] = useState<CompanyInvestment[]>([]);
  const [banks, setBanks] = useState<CompanyBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InvestmentReturn | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [chequeFile, setChequeFile] = useState<File | null>(null);
  const [chequePreview, setChequePreview] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [currentSelectedBalance, setCurrentSelectedBalance] = useState<number | null>(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingReturn, setDeletingReturn] = useState<InvestmentReturn | null>(null);

  const isImageUrl = (url: string | null) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || url.startsWith('blob:');
  };

  const [form, setForm] = useState({
    source_name: '',
    gross_amount: '',
    tax_amount: '0',
    return_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank',
    company_investment_id: '',
    company_bank_id: '',
    remarks: '',
    cheque_number: '',
  });

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('investment_returns')
      .select('*, company_investments(title), company_banks(bank_name)')
      .is('deleted_at', null)
      .order('return_date', { ascending: false });

    if (error) {
      toast.error('Failed to load returns of investment');
    } else {
      setReturns((data || []) as InvestmentReturn[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!startDate && !endDate) {
      // Default to starting of current Nepali Month or just 30 days prior
      const defaultStart = new Date();
      defaultStart.setDate(defaultStart.getDate() - 30);
      setStartDate(defaultStart.toISOString().split('T')[0]);
      setEndDate(new Date().toISOString().split('T')[0]); // Today
    }
  }, [startDate, endDate]);

  const fetchData = useCallback(async () => {
    const [invRes, bankRes] = await Promise.all([
      supabase.from('company_investments').select('id, title').is('deleted_at', null).eq('status', 'active'),
      supabase.from('company_banks').select('id, bank_name, account_number').eq('is_active', true)
    ]);
    setInvestments((invRes.data || []) as CompanyInvestment[]);
    setBanks((bankRes.data || []) as CompanyBank[]);
  }, [supabase]);

  useEffect(() => {
    fetchReturns();
    fetchData();
  }, [fetchReturns, fetchData]);

  // Handle local file preview url creation
  useEffect(() => {
    if (!chequeFile) {
      setChequePreview(null);
      return;
    }
    if (chequeFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(chequeFile);
      setChequePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setChequePreview(null);
    }
  }, [chequeFile]);

  useEffect(() => {
    if (!receiptFile) {
      setReceiptPreview(null);
      return;
    }
    if (receiptFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(receiptFile);
      setReceiptPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setReceiptPreview(null);
    }
  }, [receiptFile]);
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
    setSaving(true);

    let receiptUrl = editing?.receipt_url || null;
    if (receiptFile) {
      const processedFile = await processImage(receiptFile);
      const finalFile = processedFile instanceof Blob && !(processedFile instanceof File) 
        ? new File([processedFile], receiptFile.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })
        : processedFile as File;

      const ext = finalFile.name.split('.').pop();
      const filePath = `returns/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('expense-receipts').upload(filePath, finalFile);
      if (error) { toast.error('Failed to upload receipt'); setSaving(false); return; }
      const { data: signedData } = await supabase.storage.from('expense-receipts').createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);
      receiptUrl = signedData?.signedUrl || null;
    }

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

    const { data: { user } } = await supabase.auth.getUser();

    const payload: any = {
      source_name: form.source_name,
      gross_amount: parseFloat(form.gross_amount),
      tax_amount: parseFloat(form.tax_amount || '0'),
      net_amount: parseFloat(form.gross_amount) - parseFloat(form.tax_amount || '0'),
      return_date: form.return_date,
      payment_method: form.payment_method,
      company_investment_id: form.company_investment_id || null,
      company_bank_id: (form.payment_method === 'bank' || form.payment_method === 'check') ? (form.company_bank_id || null) : null,
      cheque_number: (form.payment_method === 'bank' || form.payment_method === 'check') ? (form.cheque_number || null) : null,
      cheque_image_url: (form.payment_method === 'bank' || form.payment_method === 'check') ? chequeUrl : null,
      remarks: form.remarks || null,
      receipt_url: receiptUrl,
      created_by: user?.id,
    };

    if (editing) {
      const { error } = await supabase.from('investment_returns').update(payload).eq('id', editing.id);
      if (error) toast.error('Failed to update'); else {
        toast.success('ROI updated');
        if (form.payment_method === 'petty_cash') {
          await supabase.from('petty_cash_ledger').upsert({
            reference_id: editing.id,
            date: payload.return_date,
            type: 'inflow',
            source: 'roi',
            amount: payload.net_amount,
            description: payload.source_name,
            created_by: user?.id
          }, { onConflict: 'reference_id' });
        } else {
          await supabase.from('petty_cash_ledger').delete().eq('reference_id', editing.id);
        }
      }
    } else {
      const { data, error } = await supabase.from('investment_returns').insert(payload).select().single();
      if (error) toast.error('Failed to record ROI'); else {
        toast.success('ROI recorded');
        if (form.payment_method === 'petty_cash' && data) {
          await supabase.from('petty_cash_ledger').insert({
            reference_id: data.id,
            date: payload.return_date,
            type: 'inflow',
            source: 'roi',
            amount: payload.net_amount,
            description: payload.source_name,
            created_by: user?.id
          });
        }
      }
    }

    setSaving(false);
    setShowModal(false);
    fetchReturns();
  };

  const handleDelete = (ret: InvestmentReturn) => {
    setDeletingReturn(ret);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingReturn) return;
    setSaving(true);
    const { error } = await supabase.from('investment_returns').update({ deleted_at: new Date().toISOString() }).eq('id', deletingReturn.id);
    if (error) {
      toast.error('Failed to delete ROI record');
    } else {
      toast.success('ROI moved to recycle bin');
      // Sync with petty cash ledger
      await supabase.from('petty_cash_ledger').delete().eq('reference_id', deletingReturn.id);
      fetchReturns();
      setShowDeleteModal(false);
    }
    setSaving(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ source_name: '', gross_amount: '', tax_amount: '0', return_date: new Date().toISOString().split('T')[0], payment_method: 'bank', company_investment_id: '', company_bank_id: '', remarks: '', cheque_number: '' });
    setReceiptFile(null);
    setChequeFile(null);
    setShowModal(true);
  };

  const openEdit = (ret: InvestmentReturn) => {
    setEditing(ret);
    setForm({
      source_name: ret.source_name,
      gross_amount: String(ret.gross_amount),
      tax_amount: String(ret.tax_amount),
      return_date: ret.return_date,
      payment_method: ret.payment_method || 'bank',
      company_investment_id: ret.company_investment_id || '',
      company_bank_id: ret.company_bank_id || '',
      remarks: ret.remarks || '',
      cheque_number: ret.cheque_number || '',
    });
    setReceiptFile(null);
    setChequeFile(null);
    setShowModal(true);
  };

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const filtered = returns.filter(r => {
    const d = r.return_date;
    const matchesSearch = (r.source_name || '').toLowerCase().includes(search.toLowerCase()) || 
                         (r.remarks || '').toLowerCase().includes(search.toLowerCase()) ||
                         (r.company_investments?.title || '').toLowerCase().includes(search.toLowerCase());
    
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return matchesSearch;
  });

  const totalGross = filtered.reduce((s, e) => s + Number(e.gross_amount), 0);
  const totalTax = filtered.reduce((s, e) => s + Number(e.tax_amount), 0);
  const totalNet = filtered.reduce((s, e) => s + Number(e.net_amount), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Returns (ROI)</h1>
          <p className="page-subtitle">{filtered.length} returns found &bull; Total Net: {formatCurrency(totalNet)}</p>
          <div className="print-period">
            Period: from <strong>{startDate ? adToBs(startDate) : '..................'}</strong> to <strong>{endDate ? adToBs(endDate) : '..................'}</strong>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary no-print" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          <button className="btn btn-primary no-print" onClick={openCreate} id="add-return-btn">
            <Plus size={16} /> Record Return
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid-3 no-print" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ padding: '16px 20px' }}>
          <div className="stat-label">Total Gross Return</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{formatCurrency(totalGross)}</div>
        </div>
        <div className="stat-card" style={{ padding: '16px 20px' }}>
          <div className="stat-label">Total Tax Deducted</div>
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--danger)' }}>{formatCurrency(totalTax)}</div>
        </div>
        <div className="stat-card" style={{ padding: '16px 20px' }}>
          <div className="stat-label">Total Net Return</div>
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--success)' }}>{formatCurrency(totalNet)}</div>
        </div>
      </div>

      <div className="page-body">
        <div className="search-bar no-print flex justify-between items-center" style={{ marginBottom: 20 }}>
          <div className="flex gap-4">
            <div className="search-input-wrapper" style={{ minWidth: 250 }}>
              <Search size={16} />
              <input className="input" placeholder="Search returns..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
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
            <ArrowDownToLine size={48} style={{ color: 'var(--text-muted)' }} />
            <h3>No returns recorded</h3>
            <p>Start tracking your incomes and investment returns.</p>
            <button className="btn btn-primary mt-4" onClick={openCreate}><Plus size={16} /> Record ROI</button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Date (BS)</th><th>Source</th><th>Method</th><th>Gross</th><th>Tax</th><th>Net Return</th><th>Receipt</th><th style={{ textAlign: 'right' }} className="no-print">Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((ret) => (
                  <tr key={ret.id}>
                    <td>{adToBs(ret.return_date)}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ret.return_date}</div></td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className="badge badge-info">{ret.source_name}</span>
                        {ret.company_investments && <div style={{ fontSize: 11, color: 'var(--primary-light)' }}>Linked: {ret.company_investments.title}</div>}
                      </div>
                      {ret.remarks && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{ret.remarks}</div>}
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span style={{ textTransform: 'capitalize' }}>{ret.payment_method || '—'}</span>
                        {ret.company_banks && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ret.company_banks.bank_name}</span>}
                      </div>
                    </td>
                    <td>{formatCurrency(ret.gross_amount)}</td>
                    <td style={{ color: 'var(--danger)' }}>{formatCurrency(ret.tax_amount)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(ret.net_amount)}</td>
                    <td>
                      <div className="flex gap-2">
                        {ret.receipt_url && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setLightboxUrl(ret.receipt_url)} style={{ color: 'var(--primary-light)' }}>
                            Receipt
                          </button>
                        )}
                        {ret.cheque_image_url && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setLightboxUrl(ret.cheque_image_url)} style={{ color: 'var(--warning, #f59e0b)' }}>
                            Cheque
                          </button>
                        )}
                        {!ret.receipt_url && !ret.cheque_image_url && '—'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }} className="no-print">
                      <div className="flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(ret)}><Edit2 size={16} /></button>
                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(ret)} style={{ color: 'var(--danger)' }}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ROI MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit ROI Entry' : 'Record ROI Entry'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Source Name <span className="required">*</span></label>
                    <input className="input" value={form.source_name} onChange={(e) => setForm(p => ({ ...p, source_name: e.target.value }))} required placeholder="e.g. FD Interest, Dividend" />
                  </div>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Link to Investment (Optional)</label>
                    <select className="select" value={form.company_investment_id} onChange={(e) => {
                      const invId = e.target.value;
                      const inv = investments.find(i => i.id === invId);
                      setForm(p => ({ ...p, company_investment_id: invId, source_name: inv ? `${inv.title} Return` : p.source_name }));
                    }}>
                      <option value="">-- No specific investment --</option>
                      {investments.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="flex justify-between items-center">
                      <span>Gross Amount (Rs.) <span className="required">*</span></span>
                      {currentSelectedBalance !== null && !fetchingBalance && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary-light)' }}>
                          Bank Bal: Rs. {currentSelectedBalance.toLocaleString()}
                        </span>
                      )}
                      {fetchingBalance && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Checking balance...</span>}
                    </label>
                    <input type="number" step="0.01" min="0.01" className="input" value={form.gross_amount} onChange={(e) => setForm(p => ({ ...p, gross_amount: e.target.value }))} required placeholder="0.00" />
                  </div>
                  <div className="input-group">
                    <label>Tax Deducted (Rs.)</label>
                    <input type="number" step="0.01" min="0" className="input" value={form.tax_amount} onChange={(e) => setForm(p => ({ ...p, tax_amount: e.target.value }))} placeholder="0.00" />
                  </div>
                  
                  {form.gross_amount && (
                     <div style={{ gridColumn: 'span 2', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Net Amount:</span>
                        <strong style={{ color: 'var(--success)' }}>{formatCurrency((parseFloat(form.gross_amount) || 0) - (parseFloat(form.tax_amount) || 0))}</strong>
                     </div>
                  )}

                  <div className="input-group">
                    <label>Date (BS)</label>
                    <NepaliDateInput 
                      value={form.return_date} 
                      onChange={(ad) => setForm(p => ({ ...p, return_date: ad }))} 
                      align="left"
                    />
                  </div>
                  <div className="input-group">
                    <label>Payment Method</label>
                    <select className="select" value={form.payment_method} onChange={(e) => setForm(p => ({ ...p, payment_method: e.target.value, company_bank_id: '' }))}>
                      <option value="bank">Bank</option>
                      <option value="petty_cash">Petty Cash</option>
                    </select>
                  </div>
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
                      <div className="input-group" style={{ gridColumn: 'span 2' }}>
                        <label>Cheque Number</label>
                        <input className="input" value={form.cheque_number} onChange={(e) => setForm(p => ({ ...p, cheque_number: e.target.value }))} placeholder="Enter cheque number (if any)" />
                      </div>
                      <div className="input-group" style={{ gridColumn: 'span 2' }}>
                        <label>Cheque Receipt Image</label>
                        <input type="file" accept="image/*,.pdf" onChange={(e) => setChequeFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
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
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Remarks</label>
                    <textarea className="textarea" value={form.remarks} onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Additional details..." style={{ minHeight: 60 }} />
                  </div>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Document / Receipt</label>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
                    
                    {receiptPreview && (
                      <div style={{ marginTop: 8, position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setLightboxUrl(receiptPreview)}>
                        {isImageUrl(receiptPreview) ? (
                          <img src={receiptPreview} alt="Preview" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div className="flex items-center gap-2" style={{ padding: '12px 16px', background: 'var(--bg-secondary)' }}>
                            <FileText size={18} style={{ color: 'var(--primary-light)' }} />
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Preview PDF</span>
                          </div>
                        )}
                      </div>
                    )}
                    {!receiptPreview && editing?.receipt_url && (
                      <div style={{ marginTop: 8, position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setLightboxUrl(editing.receipt_url!)}>
                        {isImageUrl(editing.receipt_url) ? (
                          <img src={editing.receipt_url} alt="Current" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div className="flex items-center gap-2" style={{ padding: '12px 16px', background: 'var(--bg-secondary)' }}>
                            <FileText size={18} style={{ color: 'var(--primary-light)' }} />
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Current receipt</span>
                          </div>
                        )}
                      </div>
                    )}
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
              alt="Receipt" 
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
      {showDeleteModal && deletingReturn && (
        <div className="modal-overlay" onClick={() => !saving && setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Confirm Deletion</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => !saving && setShowDeleteModal(false)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                Are you sure you want to delete this ROI record? It will be moved to the recycle bin.
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
                <div style={{ marginBottom: 4 }}><strong>Source:</strong> {deletingReturn.source_name}</div>
                <div style={{ marginBottom: 4 }}><strong>Net Amount:</strong> Rs. {deletingReturn.net_amount.toLocaleString()}</div>
                <div><strong>Date:</strong> {deletingReturn.return_date}</div>
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

      <style jsx global>{`
        @page { margin: 0; }
        @media print {
          .no-print, .sidebar, .sidebar-toggle, .sidebar-overlay, #mobile-sidebar-toggle, .theme-toggle-btn { display: none !important; }
          body { background: white !important; padding: 0.5in !important; margin: 0 !important; color: black !important; }
          .main-content { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .page-header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .table-container { border: none !important; }
          .table th { background: #f5f5f5 !important; border: 1px solid #ccc !important; }
          .table td { border: 1px solid #eee !important; color: black !important; padding: 8px !important; }
          .print-period { display: block !important; margin-top: 10px; font-size: 11pt; }
        }
        .print-period { display: none; }
      `}</style>
    </>
  );
}
