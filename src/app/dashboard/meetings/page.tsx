'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Plus, X, Calendar, Edit2, Trash2, MapPin, ClipboardList, CheckCircle2, UserCheck, MoreVertical, FileText } from 'lucide-react';

interface ActionItem {
  id: string;
  description: string;
  assigned_to: string;
  due_date: string | null;
  status: string;
}

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  location: string | null;
  agenda: string | null;
  attendees: Array<{ name: string; role: string }>;
  decisions: string | null;
  minutes_url: string | null;
  fiscal_year_id: string | null;
  fiscal_years?: { name: string };
  meeting_action_items?: ActionItem[];
  created_at: string;
}

interface FiscalYear { id: string; name: string; is_current: boolean; }

export default function MeetingsPage() {
  const supabase = createClient();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingMeeting, setDeletingMeeting] = useState<Meeting | null>(null);
  const [saving, setSaving] = useState(false);
  const [minutesFile, setMinutesFile] = useState<File | null>(null);
  const [form, setForm] = useState({ 
    title: '', 
    meeting_date: new Date().toISOString().split('T')[0], 
    location: 'Pokhara, Newroad', 
    agenda: '', 
    decisions: '', 
    attendees: '',
    fiscal_year_id: '' 
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [meetRes, fyRes] = await Promise.all([
      supabase.from('board_meetings')
        .select('*, fiscal_years(name), meeting_action_items(*)')
        .is('deleted_at', null)
        .order('meeting_date', { ascending: false }),
      supabase.from('fiscal_years').select('*').order('start_date', { ascending: false })
    ]);
    
    setMeetings((meetRes.data || []) as Meeting[]);
    setFiscalYears((fyRes.data || []) as FiscalYear[]);
    
    // Set default fiscal year in form if currently active
    const currentFy = (fyRes.data || []).find(fy => fy.is_current);
    if (currentFy && !form.fiscal_year_id) {
      setForm(p => ({ ...p, fiscal_year_id: currentFy.id }));
    }
    
    setLoading(false);
  }, [supabase, form.fiscal_year_id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let minutesUrl = editing?.minutes_url || null;
    if (minutesFile) {
      const ext = minutesFile.name.split('.').pop();
      const filePath = `minutes/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('documents').upload(filePath, minutesFile);
      if (!error) {
        const { data: signedData } = await supabase.storage.from('documents').createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);
        minutesUrl = signedData?.signedUrl || null;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    const attendeesList = form.attendees.split(',').map(a => a.trim()).filter(Boolean).map(a => ({ name: a, role: '' }));

    const payload = {
      title: form.title,
      meeting_date: form.meeting_date,
      location: form.location || null,
      agenda: form.agenda || null,
      decisions: form.decisions || null,
      attendees: attendeesList,
      minutes_url: minutesUrl,
      fiscal_year_id: form.fiscal_year_id || null,
      created_by: user?.id,
    };

    const { error } = editing 
      ? await supabase.from('board_meetings').update(payload).eq('id', editing.id)
      : await supabase.from('board_meetings').insert(payload);
    
    if (error) toast.error(error.message); 
    else { 
      toast.success(editing ? 'Meeting updated' : 'Meeting recorded'); 
      setShowModal(false); 
      setEditing(null);
      fetchAll(); 
    }
    setSaving(false);
  };

  const openEdit = (meeting: Meeting) => {
    setEditing(meeting);
    setForm({
      title: meeting.title,
      meeting_date: meeting.meeting_date,
      location: meeting.location || '',
      agenda: meeting.agenda || '',
      decisions: meeting.decisions || '',
      attendees: meeting.attendees.map(a => a.name).join(', '),
      fiscal_year_id: meeting.fiscal_year_id || ''
    });
    setMinutesFile(null);
    setShowModal(true);
  };

  const handleDelete = (meeting: Meeting) => {
    setDeletingMeeting(meeting);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingMeeting) return;
    setSaving(true);
    const { error } = await supabase.from('board_meetings').update({ deleted_at: new Date().toISOString() }).eq('id', deletingMeeting.id);
    if (error) {
       toast.error('Failed to delete meeting');
    } else {
       toast.success('Meeting moved to recycle bin');
       fetchAll();
       setShowDeleteModal(false);
    }
    setSaving(false);
  };

  const addActionItem = async (meetingId: string) => {
    const desc = prompt('Enter action item description:');
    if (!desc) return;
    const assigned = prompt('Assigned to (optional):') || '';
    const due = prompt('Due date (YYYY-MM-DD, optional):') || null;

    const { error } = await supabase.from('meeting_action_items').insert({
      meeting_id: meetingId,
      description: desc,
      assigned_to: assigned,
      due_date: due
    });

    if (error) toast.error(error.message);
    else {
      toast.success('Action item added');
      fetchAll();
    }
  };

  const toggleActionItem = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'open' : 'completed';
    const { error } = await supabase.from('meeting_action_items').update({ status: newStatus }).eq('id', id);
    if (error) toast.error('Update failed');
    else fetchAll();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Board Meetings</h1>
          <p className="page-subtitle">{meetings.length} meetings recorded</p>
        </div>
        <button className="btn btn-primary shadow-lg shadow-primary/20" onClick={() => { 
          const currentFy = fiscalYears.find(fy => fy.is_current);
          setEditing(null);
          setForm({ 
            title: '', 
            meeting_date: new Date().toISOString().split('T')[0], 
            location: 'Pokhara, Newroad', 
            agenda: '', 
            decisions: '', 
            attendees: '',
            fiscal_year_id: currentFy?.id || ''
          }); 
          setMinutesFile(null); 
          setShowModal(true); 
        }}>
          <Plus size={16} /> Record Meeting
        </button>
      </div>
      <div className="page-body">
        {loading ? <div className="card">{[1,2].map(i => <div key={i} className="skeleton" style={{ height: 100, marginBottom: 12, borderRadius: 12 }} />)}</div> : meetings.length === 0 ? (
          <div className="card empty-state"><Calendar size={48} /><h3>No meetings recorded</h3><p>Record board meetings and their decisions here.</p></div>
        ) : (
          <div className="flex flex-col gap-6">
            {meetings.map((m) => (
              <div key={m.id} className="card" style={{ cursor: 'default', borderLeft: '4px solid var(--primary)' }}>
                <div className="flex items-center justify-between mb-4 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{m.title}</h3>
                      {m.fiscal_years && <span className="badge badge-neutral">{m.fiscal_years.name}</span>}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{m.meeting_date} &bull; {m.location || 'No location'}</p>
                  </div>
                   <div className="flex gap-2">
                    {m.minutes_url && (
                      <a href={m.minutes_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><FileText size={14} /> Minutes</a>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={() => addActionItem(m.id)}><Plus size={14} /> Task</button>
                    <div style={{ width: 1, background: 'var(--border)', height: 24, margin: '0 8px' }} />
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(m)}><Edit2 size={14} /></button>
                    <button className="btn btn-ghost btn-sm btn-icon text-danger" onClick={() => handleDelete(m)}><Trash2 size={14} /></button>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    {m.agenda && <div style={{ marginBottom: 16 }}><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Agenda</span><p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{m.agenda}</p></div>}
                    {m.decisions && <div style={{ marginBottom: 16 }}><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Decisions Made</span><p style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 6, lineHeight: 1.5, padding: '8px 12px', background: 'rgba(16,185,129,0.05)', borderRadius: 8, borderLeft: '3px solid var(--success)' }}>{m.decisions}</p></div>}
                  </div>
                  
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Action Items & Tasks</span>
                    <div className="flex flex-col gap-2">
                      {m.meeting_action_items && m.meeting_action_items.length > 0 ? (
                        m.meeting_action_items.map(item => (
                          <div key={item.id} className="flex items-center gap-3" style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13 }}>
                            <input 
                              type="checkbox" 
                              checked={item.status === 'completed'} 
                              onChange={() => toggleActionItem(item.id, item.status)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1, textDecoration: item.status === 'completed' ? 'line-through' : 'none', opacity: item.status === 'completed' ? 0.6 : 1 }}>
                              <div style={{ fontWeight: 500 }}>{item.description}</div>
                              {(item.assigned_to || item.due_date) && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {item.assigned_to && `Assigned: ${item.assigned_to}`} {item.due_date && ` • Due: ${item.due_date}`}
                                </div>
                              )}
                            </div>
                            <span className={`badge ${item.status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>{item.status}</span>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No action items recorded.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Attendees</span>
                  {m.attendees.length > 0 ? (
                    <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                      {m.attendees.map((a, i) => <span key={i} className="badge badge-neutral" style={{ fontSize: 12, padding: '4px 10px' }}>{a.name}</span>)}
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No attendees listed.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Meeting Record' : 'Record Board Meeting'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Meeting Title <span className="required">*</span></label>
                    <input className="input" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} required placeholder="e.g., Q3 Board Review / Financial Planning" />
                  </div>
                  <div className="input-group">
                    <label>Date <span className="required">*</span></label>
                    <input type="date" className="input" value={form.meeting_date} onChange={(e) => setForm(p => ({ ...p, meeting_date: e.target.value }))} required />
                  </div>
                  <div className="input-group">
                    <label>Fiscal Year</label>
                    <select className="select" value={form.fiscal_year_id} onChange={(e) => setForm(p => ({ ...p, fiscal_year_id: e.target.value }))}>
                      <option value="">Select Fiscal Year...</option>
                      {fiscalYears.map(fy => <option key={fy.id} value={fy.id}>{fy.name}{fy.is_current ? ' (Current)' : ''}</option>)}
                    </select>
                  </div>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Location</label>
                    <input className="input" value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Meeting location..." />
                  </div>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Attendees (comma-separated names)</label>
                    <input className="input" value={form.attendees} onChange={(e) => setForm(p => ({ ...p, attendees: e.target.value }))} placeholder="Ram Bihani, Shyam Bihani, Hari Kumar" />
                  </div>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Agenda</label>
                    <textarea className="textarea" value={form.agenda} onChange={(e) => setForm(p => ({ ...p, agenda: e.target.value }))} placeholder="What was the meeting about?" style={{ minHeight: 80 }} />
                  </div>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Decisions Made</label>
                    <textarea className="textarea" value={form.decisions} onChange={(e) => setForm(p => ({ ...p, decisions: e.target.value }))} placeholder="What was decided?" style={{ minHeight: 80 }} />
                  </div>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Minutes Document (PDF/Doc)</label>
                    <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => setMinutesFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Meeting' : 'Record Meeting'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && deletingMeeting && (
        <div className="modal-overlay" onClick={() => !saving && setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Confirm Deletion</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => !saving && setShowDeleteModal(false)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                Are you sure you want to delete this meeting? It will be moved to the recycle bin.
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
                <div style={{ marginBottom: 4 }}><strong>Title:</strong> {deletingMeeting.title}</div>
                <div><strong>Date:</strong> {deletingMeeting.meeting_date}</div>
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
