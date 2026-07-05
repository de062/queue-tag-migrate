'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import { 
  Archive, 
  Search, 
  Calendar as CalendarIcon, 
  FileSpreadsheet, 
  FileText, 
  Download,
  Clock,
  Users,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { subscribeToCustomers, CustomerRecord } from '@/services/customerService';

export default function DailyArchivePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuthStore();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(true);
  
  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedQueue, setSelectedQueue] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    const unsubscribe = subscribeToCustomers(user.id, (data) => {
      setCustomers(data);
      setIsSyncing(false);
    });

    return () => unsubscribe();
  }, [user, isAuthLoading, router]);

  // Get unique queue names for filter dropdown
  const queueNames = Array.from(new Set(customers.map(c => c.queueName).filter(Boolean)));

  // Filtered customers for the archive
  const filteredCustomers = customers.filter(c => {
    // Date filter (check c.date or slice joinedAt/completedAt)
    const cDate = c.date || c.joinedAt?.split('T')[0] || '';
    if (selectedDate && cDate !== selectedDate) {
      return false;
    }
    // Queue filter
    if (selectedQueue !== 'all' && c.queueName !== selectedQueue) {
      return false;
    }
    // Status filter
    if (selectedStatus !== 'all' && c.status.toLowerCase() !== selectedStatus.toLowerCase()) {
      return false;
    }
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchPhone = c.phone?.includes(q);
      const matchToken = c.tokenNumber?.toString().includes(q);
      if (!matchName && !matchPhone && !matchToken) return false;
    }
    return true;
  });

  // Calculate analytics for the filtered data
  const totalServed = filteredCustomers.filter(c => c.status === 'Served' || c.status === 'Completed').length;
  const totalNoShow = filteredCustomers.filter(c => c.status === 'No-Show' || c.status === 'Skipped').length;
  const noShowPct = filteredCustomers.length > 0 ? Math.round((totalNoShow / filteredCustomers.length) * 100) : 0;
  
  // Average wait time
  const servedWithWait = filteredCustomers.filter(c => (c.status === 'Served' || c.status === 'Completed') && typeof c.waitTimeMin === 'number');
  const avgWaitTime = servedWithWait.length > 0 
    ? Math.round(servedWithWait.reduce((acc, curr) => acc + (curr.waitTimeMin || 0), 0) / servedWithWait.length)
    : 15; // default fallback

  // Peak hours calculation
  const hourCounts: Record<number, number> = {};
  filteredCustomers.forEach(c => {
    if (c.joinedAt) {
      const hour = new Date(c.joinedAt).getHours();
      if (!isNaN(hour)) {
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    }
  });
  let peakHour = 10;
  let maxCount = -1;
  Object.entries(hourCounts).forEach(([hr, count]) => {
    if (count > maxCount) {
      maxCount = count;
      peakHour = parseInt(hr, 10);
    }
  });
  const formatHour = (hr: number) => {
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const h = hr % 12 === 0 ? 12 : hr % 12;
    return `${h}:00 ${ampm}`;
  };
  const peakHourStr = `${formatHour(peakHour)} - ${formatHour(peakHour + 1)}`;

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + itemsPerPage);

  // Exports
  const exportCSV = () => {
    if (filteredCustomers.length === 0) {
      alert('No records to export.');
      return;
    }
    const headers = ['Token Number', 'Patient Name', 'Phone Number', 'Queue Assigned', 'Check-in Time', 'Completed Time', 'Wait Time (Min)', 'Status'];
    const rows = filteredCustomers.map(c => [
      c.tokenNumber,
      `"${c.name?.replace(/"/g, '""') || ''}"`,
      c.phone || '',
      `"${c.queueName?.replace(/"/g, '""') || ''}"`,
      c.joinedAt || '',
      c.completedAt || '',
      c.waitTimeMin || '',
      c.status || ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `queue_archive_${selectedDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportExcel = () => {
    // Export formatted as TSV for Excel compatibility
    if (filteredCustomers.length === 0) {
      alert('No records to export.');
      return;
    }
    const headers = ['Token Number', 'Patient Name', 'Phone Number', 'Queue Assigned', 'Check-in Time', 'Completed Time', 'Wait Time (Min)', 'Status'];
    const rows = filteredCustomers.map(c => [
      c.tokenNumber,
      c.name || '',
      c.phone || '',
      c.queueName || '',
      c.joinedAt || '',
      c.completedAt || '',
      c.waitTimeMin || '',
      c.status || ''
    ]);
    const tsvContent = "data:application/vnd.ms-excel;charset=utf-8," + [headers.join('\t'), ...rows.map(e => e.join('\t'))].join('\n');
    const encodedUri = encodeURI(tsvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `queue_archive_${selectedDate || 'all'}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <DashboardHeader subtext="Daily queue archives for" />

        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Title & Export buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                    <Archive style={{ width: '20px', height: '20px' }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Daily Queue Archive</h2>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                      Read-only audit trail of past queue sessions with export & analytics
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={exportCSV}
                  style={{ background: 'white', border: '1px solid #cbd5e1', color: '#334155', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  <FileSpreadsheet style={{ width: '16px', height: '16px', color: '#10b981' }} />
                  <span>CSV</span>
                </button>
                <button
                  onClick={exportExcel}
                  style={{ background: 'white', border: '1px solid #cbd5e1', color: '#334155', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  <FileSpreadsheet style={{ width: '16px', height: '16px', color: '#2563eb' }} />
                  <span>Excel</span>
                </button>
                <button
                  onClick={exportPDF}
                  style={{ background: 'white', border: '1px solid #cbd5e1', color: '#334155', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  <FileText style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                  <span>PDF Print</span>
                </button>
              </div>
            </div>

            {/* Analytics Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                  <span>Total Served</span>
                  <Users style={{ width: '16px', height: '16px', color: '#2563eb' }} />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>{totalServed}</div>
                <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>Completed patients</div>
              </div>

              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                  <span>Average Wait Time</span>
                  <Clock style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>~{avgWaitTime} min</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>Per patient average</div>
              </div>

              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                  <span>No-Show Rate</span>
                  <AlertCircle style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>{noShowPct}%</div>
                <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', fontWeight: 600 }}>{totalNoShow} missed turns</div>
              </div>

              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                  <span>Peak Check-in Hours</span>
                  <TrendingUp style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>{peakHourStr}</div>
                <div style={{ fontSize: '11px', color: '#8b5cf6', marginTop: '4px', fontWeight: 600 }}>Busiest period</div>
              </div>
            </div>

            {/* Filters Bar */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarIcon style={{ width: '16px', height: '16px', color: '#64748b' }} />
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }}
                  style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter style={{ width: '16px', height: '16px', color: '#64748b' }} />
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Queue:</label>
                <select
                  value={selectedQueue}
                  onChange={(e) => { setSelectedQueue(e.target.value); setCurrentPage(1); }}
                  style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                >
                  <option value="all">All Queues</option>
                  {queueNames.map((qn, idx) => (
                    <option key={idx} value={qn}>{qn}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Status:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                  style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="served">Served / Completed</option>
                  <option value="no-show">No-Show / Skipped</option>
                  <option value="waiting">Waiting</option>
                </select>
              </div>

              <div style={{ marginLeft: 'auto', position: 'relative', width: '240px' }}>
                <Search style={{ width: '14px', height: '14px', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search token, name, phone..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  style={{ width: '100%', padding: '6px 10px 6px 30px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Table */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '14px 20px' }}>TOKEN</th>
                      <th style={{ padding: '14px 20px' }}>PATIENT NAME</th>
                      <th style={{ padding: '14px 20px' }}>PHONE</th>
                      <th style={{ padding: '14px 20px' }}>QUEUE</th>
                      <th style={{ padding: '14px 20px' }}>CHECK-IN</th>
                      <th style={{ padding: '14px 20px' }}>WAIT TIME</th>
                      <th style={{ padding: '14px 20px' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCustomers.length > 0 ? (
                      paginatedCustomers.map((c, idx) => {
                        const isSuccess = c.status === 'Served' || c.status === 'Completed';
                        const isFail = c.status === 'Skipped' || c.status === 'No-Show';
                        return (
                          <tr key={c.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '14px 20px', fontWeight: 700, color: '#2563eb' }}>#{c.tokenNumber}</td>
                            <td style={{ padding: '14px 20px', fontWeight: 600, color: '#0f172a' }}>{c.name}</td>
                            <td style={{ padding: '14px 20px', color: '#64748b', fontFamily: 'monospace' }}>{c.phone || 'N/A'}</td>
                            <td style={{ padding: '14px 20px', color: '#334155' }}>{c.queueName}</td>
                            <td style={{ padding: '14px 20px', color: '#64748b' }}>
                              {c.joinedAt ? new Date(c.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                            </td>
                            <td style={{ padding: '14px 20px', color: '#334155', fontWeight: 600 }}>
                              {c.waitTimeMin ? `${c.waitTimeMin} min` : '~15 min'}
                            </td>
                            <td style={{ padding: '14px 20px' }}>
                              <span style={{
                                padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                                background: isSuccess ? '#dcfce7' : isFail ? '#fee2e2' : '#eff6ff',
                                color: isSuccess ? '#166534' : isFail ? '#991b1b' : '#1e40af'
                              }}>
                                {c.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                          {isSyncing ? 'Loading archive records...' : 'No archived records found matching your filters.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Showing <strong style={{ color: '#334155' }}>{filteredCustomers.length > 0 ? startIndex + 1 : 0}</strong> to <strong style={{ color: '#334155' }}>{Math.min(startIndex + itemsPerPage, filteredCustomers.length)}</strong> of <strong style={{ color: '#334155' }}>{filteredCustomers.length}</strong> records
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', color: currentPage === 1 ? '#94a3b8' : '#334155', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronLeft style={{ width: '14px', height: '14px' }} /> Prev
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
                    Page <strong style={{ color: '#334155', margin: '0 4px' }}>{currentPage}</strong> of {totalPages}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', color: currentPage === totalPages ? '#94a3b8' : '#334155', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    Next <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
