'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { 
  Trash2, 
  RotateCcw,
  RefreshCw, 
  Search, 
  Calendar,
  DollarSign,
  Users,
  Award,
  Wallet,
  ArrowDownToLine,
  AlertTriangle,
  X,
  Eye
} from 'lucide-react';
import { adToBs } from '@/lib/utils/nepaliDate';

interface DeletedItem {
  id: string;
  display_name: string;
  deleted_at: string;
  category: string;
  metadata?: any;
}

const CATEGORIES = [
  { id: 'investments', label: 'Share Collections', icon: DollarSign, table: 'investments' },
  { id: 'shareholders', label: 'Shareholders', icon: Users, table: 'shareholders' },
  { id: 'expenses', label: 'Expenses', icon: Wallet, table: 'expenses' },
  { id: 'share_certificates', label: 'Certificates', icon: Award, table: 'share_certificates' },
  { id: 'dividends', label: 'Dividends', icon: DollarSign, table: 'dividends' },
  { id: 'company_investments', label: 'Co. Investments', icon: Wallet, table: 'company_investments' },
  { id: 'investment_returns', label: 'Returns (ROI)', icon: ArrowDownToLine, table: 'investment_returns' },
  { id: 'loans', label: 'Loans', icon: Wallet, table: 'loans' },
  { id: 'directors', label: 'Directors', icon: Users, table: 'directors' },
  { id: 'board_meetings', label: 'Meetings', icon: Calendar, table: 'board_meetings' },
  { id: 'chalanis', label: 'Chalani', icon: Calendar, table: 'chalanis' },
  { id: 'documents', label: 'Documents', icon: Calendar, table: 'documents' },
];

export default function RecycleBinPage() {
  const supabase = createClient();
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(CATEGORIES[0].id);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DeletedItem | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [permanentlyDeleting, setPermanentlyDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [previewItem, setPreviewItem] = useState<DeletedItem | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, [supabase]);

  const fetchDeletedItems = useCallback(async () => {
    setLoading(true);
    const category = CATEGORIES.find(c => c.id === activeTab);
    if (!category) return;

    try {
      let selectString = '*';
      
      // Determine columns to join based on category
      if (category.id === 'investments' || category.id === 'share_certificates') {
        selectString = '*, shareholders(first_name, last_name)';
      } else if (category.id === 'expenses') {
        selectString = '*, expense_categories(name)';
      } else if (category.id === 'loans' || category.id === 'dividends') {
        selectString = '*, shareholders(first_name, last_name)';
      } else if (category.id === 'investment_returns') {
        selectString = '*, company_investments(title)';
      }

      const { data, error } = await supabase
        .from(category.table)
        .select(selectString)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) {
        // Fallback to simple select if joins fail
        console.warn(`Join query failed for ${category.id}, falling back to basic select:`, error);
        const { data: basicData, error: basicError } = await supabase
          .from(category.table)
          .select('*')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false });

        if (basicError) throw basicError;
        processData(basicData || [], category);
      } else {
        processData(data || [], category);
      }
    } catch (err: any) {
      toast.error(`Failed to load deleted ${category.label}`);
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, supabase]);

  const processData = (data: any[], category: any) => {
    const parsedItems = data.map((item: any) => {
      let displayName = '';
      
      // Extract basic names/titles from possible joins or fields
      const shName = item.shareholders ? `${item.shareholders.first_name} ${item.shareholders.last_name}` : null;
      const catName = item.expense_categories?.name || null;
      const invTitle = item.company_investments?.title || null;
      const selfName = item.first_name ? `${item.first_name} ${item.last_name}` : (item.full_name || item.title || item.source_name || item.name || null);

      // Category-specific descriptive display names
      if (category.id === 'expenses') {
        displayName = `${catName || 'Expense'} - Rs. ${item.amount?.toLocaleString() || '0'}`;
      } else if (category.id === 'loans') {
        displayName = `${shName || 'Loan'} - Rs. ${item.principal?.toLocaleString() || (item.amount || 0).toLocaleString()}`;
      } else if (category.id === 'dividends') {
        displayName = `${shName || 'Dividend'} - Rs. ${item.amount?.toLocaleString() || '0'}`;
      } else if (category.id === 'investments') {
        displayName = `${shName || 'Collection'} - Rs. ${item.amount?.toLocaleString() || '0'}`;
      } else if (category.id === 'share_certificates') {
        displayName = `${shName || 'Certificate'} - ${item.num_shares || '0'} Kitta`;
      } else if (category.id === 'investment_returns') {
        displayName = `${invTitle || item.source_name || 'Return'} - Rs. ${item.gross_amount?.toLocaleString() || '0'}`;
      } else if (category.id === 'company_investments') {
        displayName = `${item.title || 'Investment'} - Rs. ${item.principal_amount?.toLocaleString() || '0'}`;
      } else if (category.id === 'board_meetings') {
        displayName = `${item.title || 'Meeting'} - ${item.meeting_date ? adToBs(item.meeting_date) : ''}`;
      } else if (category.id === 'chalanis') {
        displayName = `${item.reference_no ? item.reference_no + ' - ' : ''}${item.subject || 'Chalani'}`;
      } else if (category.id === 'documents') {
        displayName = `${item.title || 'Document'}`;
      } else if (category.id === 'shareholders' || category.id === 'directors') {
        displayName = selfName || item.id.slice(0, 8);
      } else {
        displayName = selfName || item.remarks || item.id.slice(0, 8);
      }

      return {
        id: item.id,
        display_name: displayName,
        deleted_at: item.deleted_at,
        category: category.id,
        metadata: item
      };
    });
    setItems(parsedItems);
  };

  useEffect(() => {
    fetchDeletedItems();
  }, [fetchDeletedItems]);

  const handleRestore = async (item: DeletedItem) => {
    const category = CATEGORIES.find(c => c.id === item.category);
    if (!category) return;

    setRestoring(item.id);
    const updates: any = { deleted_at: null };
    
    // Some tables might need extra status resets
    if (category.id === 'shareholders') updates.is_active = true;

    const { error } = await supabase
      .from(category.table)
      .update(updates)
      .eq('id', item.id);

    if (error) {
      toast.error('Failed to restore item');
    } else {
      toast.success('Item restored successfully');
      setItems(prev => prev.filter(i => i.id !== item.id));
    }
    setRestoring(null);
  };

  const handlePermanentDelete = async () => {
    if (!itemToDelete || !deleteReason.trim()) {
      toast.error('Please provide a reason for deletion');
      return;
    }
    
    const category = CATEGORIES.find(c => c.id === itemToDelete.category);
    if (!category) return;

    setPermanentlyDeleting(true);

    try {
      // 1. Log the action for audit trail
      await supabase.from('audit_logs').insert({
        table_name: category.table,
        record_id: itemToDelete.id,
        action: 'PERMANENT_DELETE',
        old_data: itemToDelete.metadata,
        new_data: { 
          permanent_deletion_comment: deleteReason,
          deleted_at: new Date().toISOString()
        },
        performed_by: user?.id
      });

      // 2. Perform hard delete
      const { error } = await supabase
        .from(category.table)
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw error;

      toast.success('Record permanently deleted');
      setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
      setDeleteModalOpen(false);
      setItemToDelete(null);
      setDeleteReason('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to permanently delete record');
    } finally {
      setPermanentlyDeleting(false);
    }
  };

  const filtered = items.filter(i => 
    i.display_name.toLowerCase().includes(search.toLowerCase()) ||
    i.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Recycle Bin</h1>
          <p className="page-subtitle">View and restore soft-deleted records</p>
        </div>
      </div>

      <div className="page-body">
        {/* Category Tabs */}
        <div className="tabs" style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: 8 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`tab ${activeTab === cat.id ? 'active' : ''}`}
              onClick={() => setActiveTab(cat.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <cat.icon size={14} />
              {cat.label}
            </button>
          ))}
        </div>

        <div className="search-bar">
          <div className="search-input-wrapper" style={{ maxWidth: 400 }}>
            <Search size={16} />
            <input
              className="input"
              placeholder="Search deleted items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 42 }}
            />
          </div>
          <button className="btn btn-secondary" onClick={() => fetchDeletedItems()}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="card">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 60, marginBottom: 12, borderRadius: 8 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <Trash2 size={48} />
            <h3>Recycle bin is empty</h3>
            <p>No deleted items found in this category.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Item / Name</th>
                  <th>Deleted At (BS)</th>
                  <th>Deleted At (AD)</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {item.display_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        ID: {item.id}
                      </div>
                    </td>
                    <td>{adToBs(item.deleted_at)}</td>
                    <td>{new Date(item.deleted_at).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setPreviewItem(item)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <Eye size={14} />
                          Preview
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRestore(item)}
                          disabled={restoring === item.id || permanentlyDeleting}
                          style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <RotateCcw size={14} />
                          {restoring === item.id ? 'Restoring...' : 'Restore'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setItemToDelete(item);
                            setDeleteModalOpen(true);
                          }}
                          disabled={restoring === item.id || (permanentlyDeleting && itemToDelete?.id === item.id)}
                          style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <Trash2 size={14} />
                          Permanent Delete
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

      {/* Permanent Delete Modal */}
      {deleteModalOpen && itemToDelete && (
        <div className="modal-overlay" onClick={() => !permanentlyDeleting && setDeleteModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ borderBottomColor: 'var(--danger-bg)' }}>
              <div className="flex items-center gap-3">
                <div className="stat-icon red" style={{ width: 40, height: 40, borderRadius: 10 }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Permanent Deletion</h2>
                  <p className="modal-subtitle">This action cannot be undone.</p>
                </div>
              </div>
              <button 
                className="btn btn-ghost btn-icon" 
                onClick={() => setDeleteModalOpen(false)}
                disabled={permanentlyDeleting}
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="card" style={{ background: 'var(--bg-secondary)', marginBottom: 20, border: '1px dashed var(--border)' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>RECORD TO DELETE</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{itemToDelete.display_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 4 }}>ID: {itemToDelete.id}</div>
              </div>

              <div className="form-group">
                <label className="label required">Reason for Permanent Deletion</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Explain why this record is being removed forever (for audit logs)..."
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  style={{ resize: 'none' }}
                  required
                />
                <p className="text-xs text-muted mt-2">
                  <AlertTriangle size={10} style={{ marginRight: 4, display: 'inline' }} />
                  Your comment will be preserved in the system audit logs.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setDeleteModalOpen(false)}
                disabled={permanentlyDeleting}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handlePermanentDelete}
                disabled={permanentlyDeleting || !deleteReason.trim()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {permanentlyDeleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="modal-overlay" onClick={() => setPreviewItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-primary" />
                <h2 className="modal-title">Record Preview</h2>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setPreviewItem(null)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>DISPLAY NAME</div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{previewItem.display_name}</div>
              </div>
              
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Raw Data Details</div>
              <pre style={{ 
                background: 'var(--bg-secondary)', 
                padding: 16, 
                borderRadius: 8, 
                border: '1px solid var(--border)',
                fontSize: 13,
                fontFamily: 'monospace',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--text-primary)'
              }}>
                {JSON.stringify(previewItem.metadata, null, 2)}
              </pre>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPreviewItem(null)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
