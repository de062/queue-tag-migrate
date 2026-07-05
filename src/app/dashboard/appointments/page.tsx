'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import { supabase } from '@/lib/supabase';
import { Calendar, Filter, X, RefreshCw, CheckCircle, XCircle, Clock, CalendarOff } from 'lucide-react';
import Link from 'next/link';

export default function AdminAppointmentsPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuthStore();

  // Firestore Sync states
  const [appointments, setAppointments] = useState<any[]>([]);
  const [businessServices, setBusinessServices] = useState<any[]>([]);
  const [appointmentsEnabled, setAppointmentsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Sync appointments and business services
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) { router.push('/login'); return; }

    const businessId = user.id;

    const fetchAppointments = async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('workspace_id', businessId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });
      if (!error) {
        setAppointments(
          (data ?? []).map((row) => ({
            id: row.id,
            workspaceId: row.workspace_id,
            customerName: row.customer_name,
            customerPhone: row.customer_phone,
            date: row.date,
            startTime: typeof row.start_time === 'string' ? row.start_time.slice(0, 5) : row.start_time,
            endTime: typeof row.end_time === 'string' ? row.end_time.slice(0, 5) : row.end_time,
            status: row.status,
            cancellationReason: row.cancellation_reason,
          }))
        );
      }
      setIsLoading(false);
    };

    const fetchBiz = async () => {
      const { data } = await supabase
        .from('businesses')
        .select('services, appointments_enabled')
        .eq('id', businessId)
        .single();
      if (data) {
        setBusinessServices(data.services || []);
        setAppointmentsEnabled(data.appointments_enabled ?? false);
      }
    };

    fetchAppointments();
    fetchBiz();

    const apptChannel = supabase
      .channel(`admin-appointments:${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments',
          filter: `workspace_id=eq.${businessId}` }, fetchAppointments)
      .subscribe();

    const bizChannel = supabase
      .channel(`admin-biz:${businessId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'businesses',
          filter: `id=eq.${businessId}` }, fetchBiz)
      .subscribe();

    return () => {
      supabase.removeChannel(apptChannel);
      supabase.removeChannel(bizChannel);
    };
  }, [user, isAuthLoading, router]);

  // Helpers
  const getServiceName = (serviceId: string) => {
    const service = businessServices.find(s => s.id === serviceId);
    return service ? service.name : 'Unknown Service';
  };

  const formatTimeTo12Hour = (timeStr: string) => {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = m.toString().padStart(2, '0');
    return `${displayH}:${displayM} ${ampm}`;
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: '#ecfdf5', color: '#065f46', label: 'Completed' };
      case 'cancelled':
        return { bg: '#fef2f2', color: '#991b1b', label: 'Cancelled' };
      case 'scheduled':
        return { bg: '#eff6ff', color: '#1d4ed8', label: 'Scheduled' };
      default:
        return { bg: '#f1f5f9', color: '#475569', label: status };
    }
  };

  // Metrics calculation
  const totalCount = appointments.length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;
  const cancelledCount = appointments.filter(a => a.status === 'cancelled').length;
  const scheduledCount = appointments.filter(a => a.status === 'scheduled').length;
  
  // Check-in success rate: completed / (completed + cancelled no-shows)
  const totalArrivedOrExpired = completedCount + cancelledCount;
  const successRate = totalArrivedOrExpired > 0 
    ? Math.round((completedCount / totalArrivedOrExpired) * 100)
    : 100;

  // Filtered appointments list
  const filteredAppointments = appointments.filter((appt) => {
    if (statusFilter !== 'all' && appt.status !== statusFilter) {
      return false;
    }
    if (dateFilter && appt.date !== dateFilter) {
      return false;
    }
    return true;
  });

  if (isAuthLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        <RefreshCw className="animate-spin" style={{ width: '24px', height: '24px', marginRight: '8px' }} />
        <span>Loading appointments dashboard...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar />
      
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <DashboardHeader subtext="Monitor booking slot history and check-in success metrics" />

        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          
          {/* Header section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Master Appointments Ledger</h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>Review and filter historical booking data for your location</p>
            </div>
          </div>

          {appointmentsEnabled ? (
            <>
              {/* Metrics summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '28px' }}>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Total Bookings</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>{totalCount}</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock style={{ width: '12px', height: '12px', color: '#3b82f6' }} />
                <span>Scheduled</span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb', marginTop: '8px' }}>{scheduledCount}</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle style={{ width: '12px', height: '12px', color: '#10b981' }} />
                <span>Completed</span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '8px' }}>{completedCount}</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <XCircle style={{ width: '12px', height: '12px', color: '#ef4444' }} />
                <span>Cancelled / No-Show</span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444', marginTop: '8px' }}>{cancelledCount}</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Check-In Success Rate</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: successRate >= 75 ? '#10b981' : '#f59e0b', marginTop: '8px' }}>{successRate}%</div>
            </div>
          </div>

          {/* Filtering toolbar */}
          <div style={{ display: 'flex', gap: '16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#475569', marginRight: '8px' }}>
              <Filter style={{ width: '15px', height: '15px', color: '#64748b' }} />
              <span>Filters</span>
            </div>

            {/* Status dropdown filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                  background: 'white'
                }}
              >
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Date filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                  background: 'white',
                  fontFamily: 'inherit'
                }}
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                  title="Clear Date"
                >
                  <X style={{ width: '14px', height: '14px' }} />
                </button>
              )}
            </div>

            <div style={{ marginLeft: 'auto', fontSize: '12.5px', color: '#64748b', fontWeight: 500 }}>
              Showing <strong>{filteredAppointments.length}</strong> of {totalCount} records
            </div>
          </div>

          {/* Ledger table */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
            {isLoading ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
                <RefreshCw className="animate-spin" style={{ width: '28px', height: '28px', margin: '0 auto 12px auto', color: '#2563eb' }} />
                <div style={{ fontSize: '13px' }}>Syncing appointment ledger...</div>
              </div>
            ) : filteredAppointments.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                    <th style={{ padding: '14px 20px' }}>Date</th>
                    <th style={{ padding: '14px 20px' }}>Time</th>
                    <th style={{ padding: '14px 20px' }}>Customer Name</th>
                    <th style={{ padding: '14px 20px' }}>Phone Number</th>
                    <th style={{ padding: '14px 20px' }}>Assigned Queue / Specialty</th>
                    <th style={{ padding: '14px 20px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((appt) => {
                    const statusConfig = getStatusStyle(appt.status);
                    return (
                      <tr key={appt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 20px', fontWeight: 600, color: '#1e293b' }}>{appt.date}</td>
                        <td style={{ padding: '14px 20px', color: '#475569' }}>{formatTimeTo12Hour(appt.startTime)}</td>
                        <td style={{ padding: '14px 20px', fontWeight: 700, color: '#0f172a' }}>{appt.customerName}</td>
                        <td style={{ padding: '14px 20px', color: '#64748b' }}>{appt.customerPhone || '--'}</td>
                        <td style={{ padding: '14px 20px', fontWeight: 500, color: '#334155' }}>
                          {appt.queueName || getServiceName(appt.serviceId)}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{
                              display: 'inline-flex',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'capitalize',
                              background: statusConfig.bg,
                              color: statusConfig.color,
                              width: 'fit-content'
                            }}>
                              {statusConfig.label}
                            </span>
                            {appt.status === 'cancelled' && appt.cancellationReason && (
                              <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 500, fontStyle: 'italic', maxWidth: '180px', marginTop: '2px' }}>
                                Reason: "{appt.cancellationReason}"
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📅</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>No Appointments Found</div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
                  Try adjusting your date or status filters to find matching bookings.
                </div>
              </div>
            )}
          </div>
          </>
          ) : (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '64px 24px', 
              background: 'white', 
              border: '1px solid #e2e8f0', 
              borderRadius: '16px', 
              boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
              textAlign: 'center',
              maxWidth: '560px',
              margin: '60px auto 0 auto'
            }}>
              <div style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%', 
                background: '#f1f5f9', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#64748b',
                marginBottom: '20px'
              }}>
                <CalendarOff style={{ width: '28px', height: '28px' }} />
              </div>
              
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                Appointments Feature Disabled
              </h3>
              
              <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.6, margin: '0 0 24px 0', maxWidth: '380px' }}>
                You currently have online booking and VIP Fast-Pass turned off. Customers cannot book appointments.
              </p>
              
              <Link 
                href="/dashboard/settings" 
                style={{
                  display: 'inline-block',
                  background: '#2563eb',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  textDecoration: 'none',
                  transition: 'background-color 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              >
                Go to Settings to Enable
              </Link>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
