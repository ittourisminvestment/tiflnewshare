'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, Check } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export default function NotificationsPage() {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    setNotifications((data || []) as Notification[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    fetchNotifications();
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    fetchNotifications();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary" onClick={markAllRead}><Check size={16} /> Mark All Read</button>
        )}
      </div>
      <div className="page-body">
        {loading ? (
          <div className="card">{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}</div>
        ) : notifications.length === 0 ? (
          <div className="card empty-state"><Bell size={48} /><h3>No notifications</h3><p>You&apos;re all caught up!</p></div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((n) => (
              <div key={n.id} className="card" style={{ padding: '16px 20px', opacity: n.is_read ? 0.6 : 1, cursor: 'pointer' }} onClick={() => !n.is_read && markAsRead(n.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</span>
                      <span className="badge badge-neutral" style={{ fontSize: 10 }}>{n.type}</span>
                      {!n.is_read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{n.message}</p>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
