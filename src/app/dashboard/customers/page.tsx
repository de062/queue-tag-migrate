'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import { 
  Users, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Phone,
  FileSpreadsheet,
  RefreshCw
} from 'lucide-react';
import { subscribeToCustomers, CustomerRecord } from '@/services/customerService';

export default function CustomersPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuthStore();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({});
  
  const itemsPerPage = 5;

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Subscribe to customers collection in real-time
    const unsubscribe = subscribeToCustomers(user.uid, (data) => {
      setCustomers(data);
      setIsSyncing(false);
    });

    return () => {
      unsubscribe();
    };
  }, [user, isAuthLoading, router]);

  // Filter based on search query
  const filteredCustomers = customers.filter((customer) => 
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery) ||
    customer.queueName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination calculation
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to page 1 on search
  };

  const toggleRevealPhone = (id: string) => {
    setRevealedPhones(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatPhoneDisplay = (phone: string, id: string) => {
    if (!phone) return 'No Phone';
    if (revealedPhones[id]) return phone;
    if (phone.length > 4) {
      return `${phone.slice(0, 4)} ****** ${phone.slice(-4)}`;
    }
    return '******';
  };

  // Helper to format date/time joined
  const formatJoinedAt = (joinedAtStr: string): string => {
    try {
      const date = new Date(joinedAtStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return joinedAtStr;
    }
  };

  // Export dynamically loaded CRM database records to CSV file
  const exportToCSV = () => {
    if (customers.length === 0) {
      alert('No customer records to export.');
      return;
    }
    const headers = ['Token Number', 'Patient Name', 'Phone Number', 'Queue Assigned', 'Joined At', 'Status'];
    const rows = customers.map(c => [
      c.tokenNumber,
      `"${c.name.replace(/"/g, '""')}"`,
      c.phone,
      `"${c.queueName.replace(/"/g, '""')}"`,
      c.joinedAt,
      c.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `patient_crm_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isAuthLoading || (isSyncing && customers.length === 0)) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>
        <RefreshCw className="pulse-animation" style={{ width: '24px', height: '24px', marginRight: '8px', color: '#2563eb' }} />
        Loading CRM logs...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <DashboardHeader subtext="Customer logs for" />

        {/* Content Body */}
        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Title Section with Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Customer CRM Registry</h2>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                  Real-time sync of all patient logs, assigned queues, check-in times, and statuses.
                </p>
              </div>
              
              <button 
                onClick={exportToCSV}
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <FileSpreadsheet style={{ width: '16px', height: '16px', color: '#475569' }} />
                <span>Export to CSV</span>
              </button>
            </div>

            {/* Filter and Table Card */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              overflow: 'hidden'
            }}>
              
              {/* Filter Row */}
              <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Patient CRM List</span>
                  {isSyncing && (
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RefreshCw className="pulse-animation" style={{ width: '12px', height: '12px' }} />
                      Syncing
                    </span>
                  )}
                </div>
                
                {/* Search Bar Input */}
                <div style={{ position: 'relative', width: '260px' }}>
                  <Search style={{ width: '14px', height: '14px', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input 
                    type="text" 
                    placeholder="Search patient name..." 
                    value={searchQuery}
                    onChange={handleSearchChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '13px',
                      outline: 'none',
                      fontFamily: 'var(--font-sans)',
                      color: '#0f172a'
                    }}
                  />
                </div>
              </div>

              {/* Data Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '16px 24px' }}>TOKEN NO.</th>
                      <th style={{ padding: '16px 24px' }}>PATIENT NAME</th>
                      <th style={{ padding: '16px 24px' }}>PHONE NUMBER</th>
                      <th style={{ padding: '16px 24px' }}>QUEUE ASSIGNED</th>
                      <th style={{ padding: '16px 24px' }}>DATE/TIME JOINED</th>
                      <th style={{ padding: '16px 24px' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCustomers.length > 0 ? (
                      paginatedCustomers.map((customer, idx) => {
                        const statusColors = {
                          Waiting: { bg: '#eff6ff', text: '#2563eb', border: '#dbeafe' },
                          Served: { bg: '#ecfdf5', text: '#10b981', border: '#d1fae5' },
                          Skipped: { bg: '#fef2f2', text: '#ef4444', border: '#fee2e2' },
                        };
                        const colorSet = statusColors[customer.status] || statusColors.Waiting;

                        return (
                          <tr key={customer.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '16px 24px', fontWeight: 700, color: '#2563eb' }}>
                              #{customer.tokenNumber}
                            </td>
                            <td style={{ padding: '16px 24px', fontWeight: 600, color: '#0f172a' }}>
                              {customer.name}
                            </td>
                            <td 
                              style={{ padding: '16px 24px', color: '#475569', fontFamily: 'monospace', cursor: 'pointer' }}
                              onClick={() => toggleRevealPhone(customer.id)}
                              title="Click to reveal/hide phone number"
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Phone style={{ width: '12px', height: '12px', color: '#64748b' }} />
                                {formatPhoneDisplay(customer.phone, customer.id)}
                              </span>
                            </td>
                            <td style={{ padding: '16px 24px', color: '#334155', fontWeight: 500 }}>
                              {customer.queueName}
                            </td>
                            <td style={{ padding: '16px 24px', color: '#64748b' }}>
                              {formatJoinedAt(customer.joinedAt)}
                            </td>
                            <td style={{ padding: '16px 24px' }}>
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                fontSize: '11px',
                                background: colorSet.bg,
                                color: colorSet.text,
                                border: `1px solid ${colorSet.border}`,
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em'
                              }}>
                                {customer.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                          {isSyncing ? 'Loading real-time registry...' : 'No customer entries found matching your search.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc'
              }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Showing <strong style={{ color: '#334155' }}>{filteredCustomers.length > 0 ? startIndex + 1 : 0}</strong> to{' '}
                  <strong style={{ color: '#334155' }}>{Math.min(startIndex + itemsPerPage, filteredCustomers.length)}</strong> of{' '}
                  <strong style={{ color: '#334155' }}>{filteredCustomers.length}</strong> patients
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      background: 'white',
                      color: currentPage === 1 ? '#94a3b8' : '#334155',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <ChevronLeft style={{ width: '14px', height: '14px' }} />
                    Previous
                  </button>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b' }}>
                    Page <strong style={{ color: '#334155' }}>{currentPage}</strong> of {totalPages}
                  </div>

                  <button 
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      background: 'white',
                      color: currentPage === totalPages ? '#94a3b8' : '#334155',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next
                    <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>

            </div>

            {/* Quick customer support contact banner */}
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#1e3a8a',
              fontSize: '13px'
            }}>
              <Phone style={{ width: '16px', height: '16px', color: '#2563eb' }} />
              <div>
                <strong>Clinical Privacy (HIPAA):</strong> Patient phone numbers are masked by default. Click on a patient's phone field to temporarily reveal/hide details.
              </div>
            </div>

          </div>

        </div>

      </main>

    </div>
  );
}
