'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, X, User, MapPin, Phone, Mail, Briefcase, Printer } from 'lucide-react';
import { processImage } from '@/lib/utils/imageProcess';

interface Director {
  id: string;
  full_name: string;
  address: string | null;
  designation: string | null;
  phone_number: string | null;
  email: string | null;
  experience: string | null;
  is_active: boolean;
  profile_picture_url: string | null;
  created_at: string;
}

export default function DirectorsPage() {
  const supabase = createClient();
  const [directors, setDirectors] = useState<Director[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Director | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingDirector, setDeletingDirector] = useState<Director | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    address: '',
    designation: '',
    phone_number: '',
    email: '',
    experience: '',
    is_active: true,
    profile_picture_url: ''
  });
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);

  const fetchDirectors = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('directors')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load directors');
    } else {
      setDirectors((data || []) as Director[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchDirectors();
  }, [fetchDirectors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let profileUrl = editing?.profile_picture_url || null;
    if (profileFile) {
      const processedFile = await processImage(profileFile);
      const finalFile = processedFile instanceof Blob && !(processedFile instanceof File) 
        ? new File([processedFile], profileFile.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })
        : processedFile as File;

      const ext = finalFile.name.split('.').pop();
      const filePath = `profile-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, finalFile);
      if (uploadError) { 
        toast.error('Failed to upload profile picture'); 
        setSaving(false); 
        return; 
      }
      const { data: signedData } = await supabase.storage.from('documents').createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);
      profileUrl = signedData?.signedUrl || null;
    }

    const payload = {
      ...form,
      profile_picture_url: profileUrl,
      is_active: form.is_active
    };

    if (editing) {
      const { error } = await supabase
        .from('directors')
        .update(payload)
        .eq('id', editing.id);

      if (error) toast.error('Failed to update director');
      else {
        toast.success('Director updated');
        setShowModal(false);
        fetchDirectors();
      }
    } else {
      const { error } = await supabase
        .from('directors')
        .insert(payload);

      if (error) toast.error('Failed to add director');
      else {
        toast.success('Director added');
        setShowModal(false);
        fetchDirectors();
      }
    }
    setSaving(false);
  };

  const handleDelete = (director: Director) => {
    setDeletingDirector(director);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingDirector) return;
    setSaving(true);
    const { error } = await supabase.from('directors').update({ deleted_at: new Date().toISOString() }).eq('id', deletingDirector.id);
    if (error) {
       toast.error('Failed to delete director');
    } else {
       toast.success('Director moved to recycle bin');
       fetchDirectors();
       setShowDeleteModal(false);
    }
    setSaving(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      full_name: '',
      address: '',
      designation: '',
      phone_number: '',
      email: '',
      experience: '',
      is_active: true,
      profile_picture_url: ''
    });
    setProfileFile(null);
    setProfilePreview(null);
    setShowModal(true);
  };

  const openEdit = (director: Director) => {
    setEditing(director);
    setForm({
      full_name: director.full_name || '',
      address: director.address || '',
      designation: director.designation || '',
      phone_number: director.phone_number || '',
      email: director.email || '',
      experience: director.experience || '',
      is_active: director.is_active,
      profile_picture_url: director.profile_picture_url || ''
    });
    setProfileFile(null);
    setProfilePreview(director.profile_picture_url || null);
    setShowModal(true);
  };

  const filtered = directors.filter((d) => 
    d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (d.designation || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Directors</h1>
          <p className="page-subtitle">Board of Directors management</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary no-print" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          <button className="btn btn-primary no-print" onClick={openCreate} id="add-director-btn">
            <Plus size={16} /> Add Director
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="search-bar">
          <div className="search-input-wrapper" style={{ maxWidth: 400 }}>
            <Search size={16} />
            <input 
              className="input" 
              placeholder="Search by name or designation..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ paddingLeft: 42 }} 
            />
          </div>
        </div>

        {loading ? (
          <div className="card">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 60, marginBottom: 12, borderRadius: 8 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <User size={48} style={{ color: 'var(--text-muted)' }} />
            <h3>No directors found</h3>
            <p>Start by adding board members to the system.</p>
          </div>
        ) : (
          <div className="grid-2">
            {filtered.map((d) => (
              <div key={d.id} className="card director-card">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className="director-avatar">
                      {d.profile_picture_url ? (
                        <img src={d.profile_picture_url} alt={d.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                      ) : (
                        <User size={24} />
                      )}
                    </div>
                    <div>
                      <h3 className="director-name">{d.full_name}</h3>
                      <div className="director-designation">
                        <Briefcase size={14} className="mr-1" /> {d.designation || 'Board Member'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(d)}><Edit2 size={16} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleDelete(d)}><Trash2 size={16} /></button>
                  </div>
                </div>
                
                <div className="director-details mt-4">
                  <div className="detail-item">
                    <MapPin size={14} /> <span>{d.address || 'Address not listed'}</span>
                  </div>
                  <div className="detail-group flex gap-4 mt-2">
                    <div className="detail-item">
                      <Phone size={14} /> <span>{d.phone_number || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <Mail size={14} /> <span>{d.email || 'N/A'}</span>
                    </div>
                  </div>
                  {d.experience && (
                    <div className="detail-item mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Professional Experience:</div>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{d.experience}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Director' : 'Add New Director'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="flex flex-col items-center mb-6">
                  <div 
                    className="profile-upload-preview" 
                    onClick={() => document.getElementById('profile_upload')?.click()}
                  >
                    {profilePreview ? (
                      <img src={profilePreview} alt="Profile Preview" />
                    ) : (
                      <div className="flex flex-col items-center text-muted">
                        <User size={32} />
                        <span style={{ fontSize: 10, marginTop: 4 }}>Add Photo</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      id="profile_upload" 
                      hidden 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setProfileFile(file);
                          const reader = new FileReader();
                          reader.onload = (ev) => setProfilePreview(ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </div>
                </div>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Full Name <span className="required">*</span></label>
                    <input 
                      className="input" 
                      value={form.full_name} 
                      onChange={(e) => setForm(p => ({ ...p, full_name: e.target.value }))} 
                      required 
                      placeholder="Enter director's full name" 
                    />
                  </div>
                  
                  <div className="input-group">
                    <label>Designation <span className="required">*</span></label>
                    <input 
                      className="input" 
                      value={form.designation} 
                      onChange={(e) => setForm(p => ({ ...p, designation: e.target.value }))} 
                      required 
                      placeholder="e.g. Chairperson, MD" 
                    />
                  </div>

                  <div className="input-group">
                    <label>Phone Number</label>
                    <input 
                      className="input" 
                      value={form.phone_number} 
                      onChange={(e) => setForm(p => ({ ...p, phone_number: e.target.value }))} 
                      placeholder="Primary contact number" 
                    />
                  </div>

                  <div className="input-group">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      className="input" 
                      value={form.email} 
                      onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} 
                      placeholder="Email for communications" 
                    />
                  </div>

                  <div className="input-group">
                    <label>Address</label>
                    <input 
                      className="input" 
                      value={form.address} 
                      onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} 
                      placeholder="Current residential address" 
                    />
                  </div>

                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Working Experience</label>
                    <textarea 
                      className="textarea" 
                      value={form.experience} 
                      onChange={(e) => setForm(p => ({ ...p, experience: e.target.value }))} 
                      placeholder="Brief overview of professional background and experience..." 
                      rows={4}
                    />
                  </div>

                  <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <input 
                      type="checkbox" 
                      id="is_active" 
                      checked={form.is_active} 
                      onChange={(e) => setForm(p => ({ ...p, is_active: e.target.checked }))} 
                    />
                    <label htmlFor="is_active" style={{ cursor: 'pointer' }}>Active Board Member</label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Update Director' : 'Add Director'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && deletingDirector && (
        <div className="modal-overlay" onClick={() => !saving && setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Confirm Deletion</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => !saving && setShowDeleteModal(false)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                Are you sure you want to delete this director record? It will be moved to the recycle bin.
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
                <div style={{ marginBottom: 4 }}><strong>Name:</strong> {deletingDirector.full_name}</div>
                <div><strong>Designation:</strong> {deletingDirector.designation}</div>
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

      <style jsx>{`
        .director-card {
          padding: 24px;
          border: 1px solid var(--border);
          transition: all 0.3s ease;
        }
        .director-card:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2);
        }
        .director-avatar {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: var(--bg-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary-light);
        }
        .director-name {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .director-designation {
          font-size: 13px;
          color: var(--primary-light);
          display: flex;
          align-items: center;
          margin-top: 2px;
        }
        .detail-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .detail-item :global(svg) {
          color: var(--text-muted);
        }
        .profile-upload-preview {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: var(--bg-secondary);
          border: 2px dashed var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          overflow: hidden;
          position: relative;
          transition: border-color 0.2s;
        }
        .profile-upload-preview:hover {
          border-color: var(--primary);
        }
        .profile-upload-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}</style>

      <style jsx global>{`
        @page { margin: 0; }
        @media print {
          .no-print, .sidebar, .sidebar-toggle, .sidebar-overlay, #mobile-sidebar-toggle, .theme-toggle-btn { display: none !important; }
          body { background: white !important; padding: 0.5in !important; margin: 0 !important; color: black !important; }
          .main-content { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .page-header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .director-card { break-inside: avoid; border: 1px solid #eee !important; box-shadow: none !important; margin-bottom: 15px !important; }
        }
      `}</style>
    </>
  );
}
