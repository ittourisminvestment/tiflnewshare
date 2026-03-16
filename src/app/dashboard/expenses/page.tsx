'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, X, Tag, FileText, Printer, Landmark } from 'lucide-react';
import { getAvailableCheques } from '@/lib/utils/chequeUtils';
import { adToBs } from '@/lib/utils/nepaliDate';
import NepaliDateInput from '../components/NepaliDateInput';
import { getBankBalance, getPettyCashBalance } from '@/lib/utils/bankBalance';
import { processImage } from '@/lib/utils/imageProcess';

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface Expense {
  id: string;
  category_id: string;
  amount: number;
  description: string | null;
  expense_date: string;
  payment_method: string | null;
  receipt_url: string | null;
  created_at: string;
  expense_categories: { name: string };
  company_bank_id: string | null;
  cheque_number: string | null;
  cheque_image_url: string | null;
}

interface CompanyBank {
  id: string;
  bank_name: string;
  account_number: string;
  is_active: boolean;
}

export default function ExpensesPage() {
  const supabase = createClient();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [banks, setBanks] = useState<CompanyBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [chequeFile, setChequeFile] = useState<File | null>(null);
  const [chequePreview, setChequePreview] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [availableCheques, setAvailableCheques] = useState<string[]>([]);
  const [loadingCheques, setLoadingCheques] = useState(false);
  const [currentSelectedBalance, setCurrentSelectedBalance] = useState<number | null>(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const isImageUrl = (url: string | null) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || url.startsWith('blob:');
  };

  const [form, setForm] = useState({
    category_id: '',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank',
    company_bank_id: '',
    cheque_number: '',
  });

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*, expense_categories!inner(name)')
      .is('deleted_at', null)
      .order('expense_date', { ascending: false });

    if (error) toast.error('Failed to load expenses');
    else setExpenses((data || []) as Expense[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (expenses.length > 0 && !startDate && !endDate) {
      setStartDate(expenses[0].expense_date); // Most recent transaction date
      setEndDate(new Date().toISOString().split('T')[0]); // Today
    }
  }, [expenses, startDate, endDate]);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    setCategories((data || []) as ExpenseCategory[]);
  }, [supabase]);

  const fetchBanks = useCallback(async () => {
    const { data } = await supabase.from('company_banks').select('*').eq('is_active', true);
    setBanks((data || []) as CompanyBank[]);
  }, [supabase]);

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
    fetchBanks();
  }, [fetchExpenses, fetchCategories, fetchBanks]);

  // Handle local file previews
  useEffect(() => {
    if (!chequeFile) {
      setChequePreview(null);
      return;
    }
    if (chequeFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(chequeFile);
      setChequePreview(url);
      return () => URL.revokeObjectURL(url);
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
    }
  }, [receiptFile]);

  useEffect(() => {
    const loadCheques = async () => {
      if (form.company_bank_id) {
        setLoadingCheques(true);
        const cheques = await getAvailableCheques(supabase, form.company_bank_id);
        // Include current cheque if editing
        if (editing && editing.cheque_number && editing.company_bank_id === form.company_bank_id) {
          if (!cheques.includes(editing.cheque_number)) {
            cheques.push(editing.cheque_number);
            cheques.sort((a, b) => parseInt(a) - parseInt(b));
          }
        }
        setAvailableCheques(cheques);
        setLoadingCheques(false);
      }
    };
    loadCheques();
  }, [form.company_bank_id, supabase, editing]);

  useEffect(() => {
    const fetchSelectedBalance = async () => {
      if (form.payment_method === 'petty_cash') {
        setFetchingBalance(true);
        const bal = await getPettyCashBalance(supabase);
        setCurrentSelectedBalance(bal);
        setFetchingBalance(false);
      } else if ((form.payment_method === 'bank' || form.payment_method === 'check') && form.company_bank_id) {
        setFetchingBalance(true);
        const bal = await getBankBalance(supabase, form.company_bank_id);
        setCurrentSelectedBalance(bal);
        setFetchingBalance(false);
      } else {
        setCurrentSelectedBalance(null);
      }
    };
    fetchSelectedBalance();
  }, [form.payment_method, form.company_bank_id, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(form.amount);
    if (currentSelectedBalance !== null && amount > currentSelectedBalance) {
      toast.error(`Insufficient balance. Current balance is Rs. ${currentSelectedBalance.toLocaleString()}`);
      return;
    }

    setSaving(true);

    let receiptUrl = editing?.receipt_url || null;
    if (receiptFile) {
      const processedFile = await processImage(receiptFile);
      const finalFile = processedFile instanceof Blob && !(processedFile instanceof File) 
        ? new File([processedFile], receiptFile.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })
        : processedFile as File;
        
      const ext = finalFile.name.split('.').pop();
      const filePath = `${Date.now()}.${ext}`;
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

    const payload = {
      category_id: form.category_id,
      amount: parseFloat(form.amount),
      description: form.description || null,
      expense_date: form.expense_date,
      payment_method: form.payment_method,
      company_bank_id: (form.payment_method === 'bank' || form.payment_method === 'check') ? (form.company_bank_id || null) : null,
      cheque_number: (form.payment_method === 'bank' || form.payment_method === 'check') ? (form.cheque_number || null) : null,
      cheque_image_url: (form.payment_method === 'bank' || form.payment_method === 'check') ? chequeUrl : null,
      receipt_url: receiptUrl,
      created_by: user?.id,
    };

    if (editing) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', editing.id);
      if (error) toast.error(error.message || 'Failed to update'); else {
        toast.success('Expense updated');
        // Sync with petty cash ledger
        if (form.payment_method === 'petty_cash') {
          await supabase.from('petty_cash_ledger').upsert({
            reference_id: editing.id,
            date: payload.expense_date,
            type: 'outflow',
            source: 'expense',
            amount: payload.amount,
            description: payload.description,
            created_by: user?.id
          }, { onConflict: 'reference_id' });
        } else {
          // If changed from petty_cash, remove from ledger
          await supabase.from('petty_cash_ledger').delete().eq('reference_id', editing.id);
        }
      }
    } else {
      const { data, error } = await supabase.from('expenses').insert(payload).select().single();
      if (error) toast.error(error.message || 'Failed to create'); else {
        toast.success('Expense recorded');
        if (form.payment_method === 'petty_cash' && data) {
           await supabase.from('petty_cash_ledger').insert({
            reference_id: data.id,
            date: payload.expense_date,
            type: 'outflow',
            source: 'expense',
            amount: payload.amount,
            description: payload.description,
            created_by: user?.id
           });
        }
      }
    }

    setSaving(false);
    setShowModal(false);
    fetchExpenses();
  };

  const handleDelete = (exp: Expense) => {
    setDeletingExpense(exp);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingExpense) return;
    setSaving(true);
    const { error } = await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', deletingExpense.id);
    if (error) {
      toast.error('Failed to delete expense');
    } else { 
      toast.success('Expense moved to recycle bin'); 
      // Also remove from petty cash ledger if exists
      await supabase.from('petty_cash_ledger').delete().eq('reference_id', deletingExpense.id);
      fetchExpenses(); 
      setShowDeleteModal(false);
    }
    setSaving(false);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('expense_categories').insert({
      name: catForm.name,
      description: catForm.description || null,
      sort_order: categories.length + 1,
    });
    if (error) toast.error('Failed to add category');
    else { toast.success('Category added'); setCatForm({ name: '', description: '' }); fetchCategories(); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ category_id: '', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0], payment_method: 'bank', company_bank_id: '', cheque_number: '' });
    setReceiptFile(null);
    setChequeFile(null);
    setShowModal(true);
  };

  const openEdit = (exp: Expense) => {
    setEditing(exp);
    setForm({
      category_id: exp.category_id,
      amount: String(exp.amount),
      description: exp.description || '',
      expense_date: exp.expense_date,
      payment_method: exp.payment_method || 'bank',
      company_bank_id: exp.company_bank_id || '',
      cheque_number: exp.cheque_number || '',
    });
    setReceiptFile(null);
    setChequeFile(null);
    setShowModal(true);
  };

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const filtered = expenses.filter(e => {
    const d = e.expense_date;
    const matchesSearch = (e.expense_categories.name || '').toLowerCase().includes(search.toLowerCase()) || 
                         (e.description || '').toLowerCase().includes(search.toLowerCase());
    
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return matchesSearch;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">{filtered.length} expenses recorded &bull; Total: {formatCurrency(totalExpenses)}</p>
          <div className="print-period">
            Period: from <strong>{startDate ? adToBs(startDate) : '..................'}</strong> to <strong>{endDate ? adToBs(endDate) : '..................'}</strong>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary no-print" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          <button className="btn btn-secondary no-print" onClick={() => setShowCatModal(true)}>
            <Tag size={16} /> Categories
          </button>
          <button className="btn btn-primary no-print" onClick={openCreate}>
            <Plus size={16} /> Record Expense
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="search-bar no-print flex justify-between items-center" style={{ marginBottom: 20 }}>
          <div className="flex gap-4">
            <div className="search-input-wrapper" style={{ minWidth: 250 }}>
              <Search size={16} />
              <input className="input" placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
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
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            <h3>No expenses recorded</h3>
            <p>Start tracking your daily operational costs.</p>
            <button className="btn btn-primary mt-4" onClick={openCreate}><Plus size={16} /> Add Expense</button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Category</th><th>Description</th><th>Method</th><th>Amount</th><th>Receipt</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((exp) => (
                  <tr key={exp.id}>
                    <td>{exp.expense_date}</td>
                    <td><span className="badge badge-info">{exp.expense_categories.name}</span></td>
                    <td>{exp.description || '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{exp.payment_method || '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(exp.amount)}</td>
                    <td>
                      <div className="flex gap-2">
                        {exp.receipt_url && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setLightboxUrl(exp.receipt_url)} style={{ color: 'var(--primary-light)' }}>
                            Receipt
                          </button>
                        )}
                        {exp.cheque_image_url && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setLightboxUrl(exp.cheque_image_url)} style={{ color: 'var(--warning, #f59e0b)' }}>
                            Cheque
                          </button>
                        )}
                        {!exp.receipt_url && !exp.cheque_image_url && '—'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(exp)}><Edit2 size={16} /></button>
                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(exp)} style={{ color: 'var(--danger)' }}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EXPENSE MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Expense' : 'Record Expense'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="input-group">
                    <label>Category <span className="required">*</span></label>
                    <div className="flex gap-2">
                       <select className="select" style={{ flex: 1 }} value={form.category_id} onChange={(e) => setForm(p => ({ ...p, category_id: e.target.value }))} required>
                         <option value="">Select category...</option>
                         {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                       <button type="button" className="btn btn-secondary btn-icon" onClick={() => setShowCatModal(true)} title="Manage Categories">
                         <Tag size={16} />
                       </button>
                    </div>
                    {categories.length === 0 && (
                      <span style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                        No categories exist. Please create one first!
                      </span>
                    )}
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
                  <div className="input-group">
                    <label>Date <span className="required">*</span></label>
                    <input type="date" className="input" value={form.expense_date} onChange={(e) => setForm(p => ({ ...p, expense_date: e.target.value }))} required />
                  </div>
                  <div className="input-group">
                    <label>Payment Method</label>
                    <select className="select" value={form.payment_method} onChange={(e) => setForm(p => ({ ...p, payment_method: e.target.value }))}>
                      <option value="bank">Bank</option>
                      <option value="petty_cash">Petty Cash</option>
                    </select>
                  </div>

                  {(form.payment_method === 'bank' || form.payment_method === 'check') && (
                    <>
                      <div className="input-group" style={{ gridColumn: 'span 2' }}>
                        <label>Select Company Bank <span className="required">*</span></label>
                        <select 
                          className="select" 
                          value={form.company_bank_id} 
                          onChange={(e) => setForm(p => ({ ...p, company_bank_id: e.target.value }))}
                          required
                        >
                          <option value="">Select bank account...</option>
                          {banks.map(b => (
                            <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>
                          ))}
                        </select>
                      </div>
                      <div className="input-group" style={{ gridColumn: 'span 2' }}>
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
                      <div className="input-group" style={{ gridColumn: 'span 2' }}>
                        <label>Cheque Receipt Image</label>
                        <input type="file" accept="image/*,.pdf" onChange={(e) => setChequeFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
                        {chequePreview && (
                          <div style={{ marginTop: 8, position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setLightboxUrl(chequePreview)}>
                            {isImageUrl(chequePreview) ? (
                              <img src={chequePreview} alt="Cheque preview" style={{ width: '100%', maxHeight: 100, objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <div className="flex items-center gap-2" style={{ padding: '8px 12px', background: 'var(--bg-secondary)' }}>
                                <FileText size={16} /> <span style={{ fontSize: 12 }}>Cheque PDF</span>
                              </div>
                            )}
                          </div>
                        )}
                        {!chequePreview && editing?.cheque_image_url && (
                          <div style={{ marginTop: 8, position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setLightboxUrl(editing.cheque_image_url!)}>
                            {isImageUrl(editing.cheque_image_url) ? (
                              <img src={editing.cheque_image_url} alt="Current cheque" style={{ width: '100%', maxHeight: 100, objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <div className="flex items-center gap-2" style={{ padding: '8px 12px', background: 'var(--bg-secondary)' }}>
                                <FileText size={16} /> <span style={{ fontSize: 12 }}>Current Cheque PDF</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Description</label>
                    <textarea className="textarea" value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What was this expense for?" style={{ minHeight: 60 }} />
                  </div>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Receipt</label>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
                    
                    {/* File preview */}
                    {receiptPreview && (
                      <div style={{ marginTop: 8, position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setLightboxUrl(receiptPreview)}>
                        {isImageUrl(receiptPreview) ? (
                          <img src={receiptPreview} alt="Receipt preview" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div className="flex items-center gap-2" style={{ padding: '12px 16px', background: 'var(--bg-secondary)' }}>
                            <FileText size={18} style={{ color: 'var(--primary-light)' }} />
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Preview PDF (click to view)</span>
                          </div>
                        )}
                        <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: '#fff' }}>Preview</div>
                      </div>
                    )}
                    {/* Existing snippet thumbnail */}
                    {!receiptPreview && editing?.receipt_url && (
                      <div style={{ marginTop: 8, position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setLightboxUrl(editing.receipt_url!)}>
                        {isImageUrl(editing.receipt_url) ? (
                          <img src={editing.receipt_url} alt="Current receipt" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div className="flex items-center gap-2" style={{ padding: '12px 16px', background: 'var(--bg-secondary)' }}>
                            <FileText size={18} style={{ color: 'var(--primary-light)' }} />
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Current receipt (click to view)</span>
                          </div>
                        )}
                        <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: '#fff' }}>Current</div>
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

      {/* CATEGORY MODAL */}
      {showCatModal && (
        <div className="modal-overlay" onClick={() => setShowCatModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Expense Categories</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCatModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                <input className="input" placeholder="New category name..." value={catForm.name} onChange={(e) => setCatForm(p => ({ ...p, name: e.target.value }))} required style={{ flex: 1 }} />
                <button type="submit" className="btn btn-primary btn-sm"><Plus size={14} /> Add</button>
              </form>
              <div className="flex flex-col gap-2">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between" style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                    <div>
                      <span style={{ fontWeight: 500 }}>{c.name}</span>
                      {c.description && <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>{c.description}</span>}
                    </div>
                    <span className="badge badge-success">Active</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX DOCUMENT VIEWER */}
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
              alt="Receipt document document" 
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
      {showDeleteModal && deletingExpense && (
        <div className="modal-overlay" onClick={() => !saving && setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Confirm Deletion</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => !saving && setShowDeleteModal(false)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                Are you sure you want to delete this expense? It will be moved to the recycle bin.
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
                <div style={{ marginBottom: 4 }}><strong>Category:</strong> {deletingExpense.expense_categories.name}</div>
                <div style={{ marginBottom: 4 }}><strong>Amount:</strong> Rs. {deletingExpense.amount.toLocaleString()}</div>
                <div><strong>Date:</strong> {deletingExpense.expense_date}</div>
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
