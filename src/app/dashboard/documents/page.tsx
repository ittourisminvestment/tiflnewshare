'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { 
  Plus, Search, Edit2, Trash2, X, FileText, Download, 
  Filter, Info, Eye, Image as ImageIcon, Upload, Calendar, Save, Clock
} from 'lucide-react';
import NepaliDateInput from '../components/NepaliDateInput';
import { adToBs } from '@/lib/utils/nepaliDate';
import { processImage } from '@/lib/utils/imageProcess';

interface Document {
  id: string;
  title: string;
  category: string;
  description: string | null;
  file_path: string;
  file_url: string | null;
  upload_date: string;
  created_at: string;
}

const CATEGORIES = [
  'Audit Report',
  'Annual Report',
  'Tax Document',
  'Legal Document',
  'Meeting Minutes',
  'Company Registration',
  'Other'
];

export default function DocumentsPage() {
  const supabase = createClient();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Document | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    category: 'Other',
    description: '',
    upload_date: new Date().toISOString().split('T')[0],
  });

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .is('deleted_at', null)
      .order('upload_date', { ascending: false });

    if (error) {
      toast.error('Failed to load documents');
    } else {
      setDocuments((data || []) as Document[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Handle local file preview
  useEffect(() => {
    if (!documentFile) {
      setFilePreview(null);
      return;
    }

    if (documentFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(documentFile);
      setFilePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFilePreview(null);
    }
  }, [documentFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    let filePath = editing?.file_path || '';
    let fileUrl = editing?.file_url || null;

    if (documentFile) {
      const processedFile = await processImage(documentFile);
      const finalFile = processedFile instanceof Blob && !(processedFile instanceof File) 
        ? new File([processedFile], documentFile.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })
        : processedFile as File;

      const ext = finalFile.name.split('.').pop();
      filePath = `documents/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('expense-receipts')
        .upload(filePath, finalFile);

      if (uploadError) {
        toast.error('Failed to upload document');
        setSaving(false);
        return;
      }

      const { data: signedData } = await supabase.storage
        .from('expense-receipts')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);
      
      fileUrl = signedData?.signedUrl || null;
    }

    if (!filePath && !editing) {
      toast.error('Please select a document file');
      setSaving(false);
      return;
    }

    const payload = {
      title: form.title,
      category: form.category,
      description: form.description || null,
      upload_date: form.upload_date,
      file_path: filePath,
      file_url: fileUrl,
      created_by: user?.id,
    };

    if (editing) {
      const { error } = await supabase
        .from('documents')
        .update(payload)
        .eq('id', editing.id);
      
      if (error) toast.error('Failed to update document');
      else toast.success('Document updated successfully');
    } else {
      const { error } = await supabase
        .from('documents')
        .insert(payload);
      
      if (error) toast.error('Failed to add document');
      else toast.success('Document added successfully');
    }

    setSaving(false);
    setShowModal(false);
    fetchDocuments();
  };

  const handleDeleteClick = (doc: Document, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletingDoc(doc);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingDoc) return;
    setSaving(true);
    const { error } = await supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', deletingDoc.id);

    if (error) {
      toast.error(`Delete failed: ${error.message}`);
      console.error(error);
    } else {
      toast.success('Moved to recycle bin');
      fetchDocuments();
      setShowDeleteModal(false);
    }
    setSaving(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      category: 'Other',
      description: '',
      upload_date: new Date().toISOString().split('T')[0],
    });
    setDocumentFile(null);
    setShowModal(true);
  };

  const openEdit = (doc: Document) => {
    setEditing(doc);
    setForm({
      title: doc.title,
      category: doc.category,
      description: doc.description || '',
      upload_date: doc.upload_date,
    });
    setDocumentFile(null);
    setFilePreview(null);
    setShowModal(true);
  };

  const filtered = documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(search.toLowerCase()) || 
                          (doc.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const isImageUrl = (url: string | null) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || url.startsWith('blob:');
  };

  return (
    <>
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div className="flex items-center gap-5">
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 10px 20px -5px var(--primary-shadow)' }}>
            <FileText size={28} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: 28, fontWeight: 700 }}>Company Records</h1>
            <p className="page-subtitle" style={{ fontSize: 14 }}>Secure centralized repository for audit reports, tax filings, and legal archives</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate} style={{ padding: '0 24px', height: 48, borderRadius: 12, boxShadow: '0 10px 20px -5px var(--primary-shadow)' }}>
          <Plus size={18} /> Upload New Archive
        </button>
      </div>

      <div className="page-body">
        <div className="search-bar no-print" style={{ 
          background: 'var(--bg-card)', 
          padding: '20px 24px', 
          borderRadius: 20, 
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border)',
          marginBottom: 32,
          display: 'flex',
          gap: 16,
          alignItems: 'center'
        }}>
          <div className="search-input-wrapper" style={{ flex: 1, position: 'relative' }}>
            <Search size={18} className="absolute left-4 top-3 text-muted" />
            <input 
              className="input" 
              placeholder="Search by title, category, or description..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ paddingLeft: 48, height: 48, borderRadius: 12, background: 'var(--bg-secondary)', border: 'none' }} 
            />
          </div>
          <div className="flex items-center gap-3">
            <div style={{ height: 48, width: 1, background: 'var(--border)' }} />
            <Filter size={18} className="text-muted" />
            <select 
              className="select" 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: 220, height: 48, borderRadius: 12, background: 'var(--bg-secondary)', border: 'none' }}
            >
              <option value="All">All Document Types</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="card">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 60, marginBottom: 12, borderRadius: 12 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">
              <FileText size={48} />
            </div>
            <h3>No documents found</h3>
            <p>Upload your first document to get started.</p>
            <button className="btn btn-primary mt-4" onClick={openCreate}>
              <Plus size={16} /> Upload Document
            </button>
          </div>
        ) : (
          <div className="document-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
            gap: 24 
          }}>
            {filtered.map((doc) => (
              <div 
                key={doc.id} 
                className="card document-card group" 
                style={{ 
                  padding: 0, 
                  borderRadius: 24, 
                  overflow: 'hidden', 
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ 
                  height: 120, 
                  background: 'linear-gradient(45deg, var(--bg-secondary), var(--bg-card))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  borderBottom: '1px solid var(--border)'
                }}>
                  <div style={{ 
                    width: 64, 
                    height: 64, 
                    borderRadius: 18, 
                    background: 'white', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'var(--primary)',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.05)',
                    zIndex: 2
                  }}>
                    <FileText size={32} />
                  </div>
                  
                  {/* Category Badge Overlaid */}
                  <div style={{ 
                    position: 'absolute', 
                    top: 16, 
                    right: 16,
                    background: 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(4px)',
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {doc.category.toUpperCase()}
                  </div>
                  
                  {/* Abstract shapes for background decoration */}
                  <div style={{ position: 'absolute', top: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'var(--primary)', opacity: 0.03 }} />
                  <div style={{ position: 'absolute', bottom: -10, right: 10, width: 60, height: 60, borderRadius: '50%', background: 'var(--primary)', opacity: 0.05 }} />
                </div>

                <div style={{ padding: 24, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="flex justify-between items-start mb-3">
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{doc.title}</h3>
                  </div>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-1.5 text-muted" style={{ fontSize: 12 }}>
                      <Calendar size={13} />
                      {adToBs(doc.upload_date)} (BS)
                    </div>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border)' }} />
                    <div className="flex items-center gap-1.5 text-muted" style={{ fontSize: 12 }}>
                      <Clock size={13} />
                      {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {doc.description && (
                    <p style={{ 
                      fontSize: 13, 
                      color: 'var(--text-muted)', 
                      lineHeight: 1.6,
                      display: '-webkit-box', 
                      WebkitLineClamp: 2, 
                      WebkitBoxOrient: 'vertical', 
                      overflow: 'hidden',
                      marginBottom: 20
                    }}>
                      {doc.description}
                    </p>
                  )}

                  <div className="flex gap-3 mt-auto pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
                    <button 
                      className="btn btn-primary btn-sm flex-1" 
                      onClick={() => setLightboxUrl(doc.file_url)}
                      style={{ height: 40, borderRadius: 10, gap: 8, background: 'var(--primary-light)', borderColor: 'transparent' }}
                    >
                      <Eye size={16} /> Preview
                    </button>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-icon btn-sm" style={{ width: 40, height: 40, borderRadius: 10 }} onClick={(e) => { e.stopPropagation(); openEdit(doc); }}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm hover-danger" style={{ width: 40, height: 40, borderRadius: 10, color: 'var(--danger)' }} onClick={(e) => handleDeleteClick(doc, e)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650, width: '95%', borderRadius: 24, padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(to right, var(--bg-card), var(--bg-secondary))' }}>
              <div className="flex items-center gap-4">
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 8px 16px var(--primary-shadow)' }}>
                  <Upload size={22} />
                </div>
                <div>
                  <h2 className="modal-title" style={{ fontSize: 20, marginBottom: 2 }}>{editing ? 'Modify Document' : 'Upload New Document'}</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{editing ? 'Update existing document details' : 'Add a new record to your company archives'}</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)} style={{ borderRadius: '50%' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ padding: 32 }}>
                <div className="flex flex-col gap-6">
                  {/* Basic Info Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="input-group">
                      <label className="label-modern" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>Document Title <span className="required">*</span></label>
                      <div className="relative">
                        <FileText size={16} className="absolute left-4 top-3 text-muted" style={{ zIndex: 1 }} />
                        <input 
                          className="input" 
                          style={{ paddingLeft: 44 }}
                          value={form.title} 
                          onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} 
                          required 
                          placeholder="e.g. Audit Report 2080-81" 
                        />
                      </div>
                    </div>

                    <div className="input-group">
                      <label className="label-modern" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>Category <span className="required">*</span></label>
                      <div className="relative">
                        <Filter size={16} className="absolute left-4 top-3 text-muted" style={{ zIndex: 1 }} />
                        <select 
                          className="select" 
                          style={{ paddingLeft: 44 }}
                          value={form.category} 
                          onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))} 
                          required
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Date and Information Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="input-group">
                      <label className="label-modern" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>Document Date (BS) <span className="required">*</span></label>
                      <div className="relative">
                        <Calendar size={16} className="absolute left-4 top-3 text-muted" style={{ zIndex: 1 }} />
                        <div style={{ paddingLeft: 10 }}>
                          <NepaliDateInput 
                            value={form.upload_date} 
                            onChange={(ad) => setForm(p => ({ ...p, upload_date: ad }))} 
                            required 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="input-group">
                      <label className="label-modern" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>Security Policy</label>
                      <div className="p-3.5 rounded-xl border border-dashed border-primary/20 bg-primary/5 flex items-center gap-3">
                        <Info size={16} className="text-primary" />
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>Encrypted storage active</span>
                      </div>
                    </div>
                  </div>

                  {/* Custom File Upload Area */}
                  <div className="input-group">
                    <label className="label-modern" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>Document Asset <span className="required">*</span></label>
                    <div 
                      className="file-upload-zone"
                      style={{
                        border: '2px dashed var(--border)',
                        borderRadius: 20,
                        padding: 24,
                        textAlign: 'center',
                        background: 'var(--bg-secondary)',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                    >
                      <input 
                        type="file" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        style={{ zIndex: 10 }}
                        onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} 
                        required={!editing}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      />
                      
                      <div className="flex items-center gap-6">
                        <div style={{ 
                          width: 80, 
                          height: 80, 
                          borderRadius: 16, 
                          background: 'white', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                          border: '1px solid var(--border)',
                          flexShrink: 0
                        }}>
                          {filePreview ? (
                            <img src={filePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
                          ) : documentFile ? (
                            <div className="flex flex-col items-center">
                              <FileText size={32} className="text-primary" />
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>{documentFile.name.split('.').pop()?.toUpperCase()}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <ImageIcon size={28} className="text-muted" />
                              <Plus size={12} className="text-primary" style={{ marginTop: -8 }} />
                            </div>
                          )}
                        </div>

                        <div className="text-left flex-1">
                          <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                            {documentFile ? documentFile.name : (editing ? 'Keep current or replace' : 'Select a file to upload')}
                          </h4>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {documentFile 
                              ? `${(documentFile.size / (1024 * 1024)).toFixed(2)} MB • ${documentFile.type}`
                              : 'Click here or drag file into this area'}
                          </p>
                          <div className="mt-2 flex gap-2">
                             <span className="badge badge-neutral" style={{ fontSize: 9 }}>PDF</span>
                             <span className="badge badge-neutral" style={{ fontSize: 9 }}>JPG/PNG</span>
                             <span className="badge badge-neutral" style={{ fontSize: 9 }}>MAX 10MB</span>
                          </div>
                        </div>
                        
                        <div className="btn btn-secondary btn-sm" style={{ pointerEvents: 'none' }}>
                          Browse Files
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="input-group">
                    <label className="label-modern" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>Brief Note (Optional)</label>
                    <textarea 
                      className="textarea" 
                      value={form.description} 
                      onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} 
                      placeholder="e.g. Approved by board in meeting #42"
                      style={{ minHeight: 100, borderRadius: 16, padding: 16 }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '24px 32px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ padding: '0 24px' }}>Cancel</button>
                <div className="flex gap-3">
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '0 32px', minWidth: 140 }}>
                    {saving ? (
                      <div className="flex items-center gap-2">
                        <div className="spinner-sm" />
                        Processing...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                         <Save size={18} />
                         {editing ? 'Save Changes' : 'Upload Archive'}
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && deletingDoc && (
        <div className="modal-overlay no-print" onClick={() => !saving && setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Confirm Deletion</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => !saving && setShowDeleteModal(false)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                Are you sure you want to delete this document? It will be moved to the recycle bin.
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
                <div style={{ marginBottom: 4 }}><strong>Title:</strong> {deletingDoc.title}</div>
                <div><strong>Category:</strong> {deletingDoc.category}</div>
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

      {/* LIGHTBOX / DOCUMENT VIEWER */}
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
          
          <div className="document-viewer-container" onClick={(e) => e.stopPropagation()} style={{ width: '90vw', height: '95vh', background: 'var(--bg-primary)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div className="viewer-header flex justify-between items-center p-4 border-b" style={{ borderColor: 'var(--border)', padding: '16px 24px' }}>
              <div className="flex items-center gap-3">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <span style={{ fontWeight: 600, display: 'block' }}>Document Viewer</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Secure full-screen preview</span>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={lightboxUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ borderRadius: 10 }}>
                  <Download size={14} /> Download
                </a>
                <button onClick={() => setLightboxUrl(null)} className="btn btn-ghost btn-icon btn-sm" style={{ borderRadius: '50%' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="viewer-content" style={{ height: 'calc(100% - 73px)', background: '#525659' }}>
              {isImageUrl(lightboxUrl) ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 20 }}>
                  <img src={lightboxUrl} alt="Document" style={{ maxHeight: '100%', maxWidth: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', borderRadius: 8 }} />
                </div>
              ) : (
                <iframe src={lightboxUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Document PDF viewer" />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
