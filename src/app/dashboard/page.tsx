'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQueueStore } from '@/store/queueStore';
import { 
  LayoutDashboard, 
  Users, 
  Activity, 
  CheckCircle, 
  Clock, 
  Plus, 
  QrCode, 
  FileText, 
  BarChart3, 
  Settings, 
  UserPlus, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownRight,
  Bell,
  Mail,
  Lock,
  ChevronDown,
  Info,
  LogOut,
  User
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import AddQueueModal from '@/components/AddQueueModal';
import QRCodeModal from '@/components/QRCodeModal';
import { createNewQueue } from '@/services/queueService';
import { useAuthStore } from '@/store/authStore';

function AdminDashboardContent() {
  const router = useRouter();
  const { user, businessId, businessName, isLoading: isAuthLoading } = useAuthStore();
  const queues = useQueueStore((state) => state.queues);
  const staff = useQueueStore((state) => state.staff);
  const provisionStaff = useQueueStore((state) => state.provisionStaff);
  const currentBusiness = useQueueStore((state) => state.currentBusiness);
  const locations = useQueueStore((state) => state.locations);
  const initLiveSync = useQueueStore((state) => state.initLiveSync);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    console.log(`STEP 1: Dashboard Mounted, requesting sync for ${user.id}`);
    const unsubscribe = initLiveSync(user.id);
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [initLiveSync, user, isAuthLoading, router]);

  const searchParams = useSearchParams();
  const tab = searchParams ? searchParams.get('tab') : null;

  // Tab State: 'dashboard' or 'staff'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'staff'>('dashboard');

  useEffect(() => {
    if (tab === 'staff') {
      setActiveTab('staff');
    } else {
      setActiveTab('dashboard');
    }
  }, [tab]);

  // Staff Provisioning Form State
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffQueueId, setStaffQueueId] = useState('dr-john');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals and Toast State
  const [showQrModal, setShowQrModal] = useState(false);
  const [showAddQueueModal, setShowAddQueueModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const location = currentBusiness || locations['abc-clinic'] || {
    id: 'abc-clinic',
    name: 'ABC Clinic',
    type: 'Clinic',
    address: '123, MG Road, Bangalore, Karnataka 560001',
    timezone: '(GMT+05:30) Asia/Kolkata',
  };

  const activeQueuesList = Object.values(queues).filter(q => q.locationId === location.id);

  // Fallback to all queues if the onboarded business has no queues created yet (to avoid empty dashboard)
  const displayQueuesList = activeQueuesList.length > 0 ? activeQueuesList : Object.values(queues);

  // Adjust staff select dropdown default value based on filtered queues
  useEffect(() => {
    if (displayQueuesList.length > 0) {
      setStaffQueueId(displayQueuesList[0].id);
    }
  }, [displayQueuesList]);

  // Calculate dynamic stats
  const totalWaiting = displayQueuesList.reduce(
    (sum, q) => sum + q.entries.filter(e => e.status === 'waiting' || e.status === 'next').length, 
    0
  );
  
  const totalServed = displayQueuesList.reduce(
    (sum, q) => sum + q.totalServedToday, 
    0
  );

  const handleProvisionStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffEmail || !staffQueueId) return;

    provisionStaff(staffName, staffEmail, staffQueueId);
    setSuccessMessage(`Successfully provisioned profile for ${staffName} linked to queue: ${staffQueueId}`);
    
    // Reset form
    setStaffName('');
    setStaffEmail('');
    setStaffPassword('');
    
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  if (isAuthLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>
        Verifying session...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      
      {/* 1. SIDEBAR */}
      <Sidebar />

      {/* 2. MAIN CONTENT AREA */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Top Header */}
        <DashboardHeader subtext="Good morning," />

        {/* Inner Content */}
        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              
              {/* Stats Card Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                
                {/* Stat 1 */}
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Waiting Now</span>
                    <Users style={{ width: '18px', height: '18px', color: '#2563eb' }} />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '12px 0 6px 0' }}>{totalWaiting}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <span>Active customers in line</span>
                  </div>
                </div>

                {/* Stat 2 */}
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Active Queues</span>
                    <Activity style={{ width: '18px', height: '18px', color: '#10b981' }} />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '12px 0 6px 0' }}>{displayQueuesList.length}</div>
                  <div style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <CheckCircle style={{ width: '14px', height: '14px' }} />
                    <span>All queues are active</span>
                  </div>
                </div>

                {/* Stat 3 */}
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Served Today</span>
                    <CheckCircle style={{ width: '18px', height: '18px', color: '#10b981' }} />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '12px 0 6px 0' }}>{totalServed}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <span>Completed sessions today</span>
                  </div>
                </div>

                {/* Stat 4 */}
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Average Wait Time</span>
                    <Clock style={{ width: '18px', height: '18px', color: '#f59e0b' }} />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '12px 0 6px 0' }}>--</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <span>No calculations yet</span>
                  </div>
                </div>

              </div>

              {/* READ-ONLY MONITORING GRID */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Your Queues (Real-Time Monitoring)</h3>
                  <button 
                    onClick={() => setShowAddQueueModal(true)}
                    style={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#2563eb',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
                      transition: 'all 0.2s',
                    }}
                    className="btn-add-queue"
                  >
                    <Plus style={{ width: '14px', height: '14px' }} />
                    <span>New Queue</span>
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {displayQueuesList.map((queue) => {
                    const isPaused = queue.status === 'paused';
                    const activeServing = queue.entries.find(e => e.tokenNumber === queue.currentToken) || queue.entries.find(e => e.status === 'serving');
                    const waitListCount = queue.waitingCount;
                    
                    return (
                      <div key={queue.id} className="queue-card" style={{ padding: '24px', background: 'white', border: '1px solid #e2e8f0' }}>
                        <div className="queue-card-header" style={{ marginBottom: '20px' }}>
                          <div className="avatar-icon-wrapper">
                            <Users style={{ width: '22px', height: '22px' }} />
                          </div>
                          <div className="queue-title-info">
                            <div className="queue-name">{queue.name}</div>
                            {queue.role && <div className="queue-specialty">{queue.role}</div>}
                          </div>
                          <span className={`status-badge ${isPaused ? 'paused' : 'live'}`}>
                            {isPaused ? 'Paused' : 'Live'}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Current Token</div>
                            <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
                              {queue.currentToken === 0 || !queue.currentToken ? '--' : `#${queue.currentToken}`}
                            </div>
                            <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {activeServing ? activeServing.customerName : 'No one active'}
                            </div>
                          </div>
                          
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Waiting Queue</div>
                            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                              {queue.waitingCount}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                              customers in line
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
                          <span>Estimated wait: <strong>{isPaused ? '--' : `${queue.averageWaitTimeMin * waitListCount} min`}</strong></span>
                          <span>Served today: <strong>{queue.totalServedToday} served</strong></span>
                        </div>

                        {/* Read-Only Banner */}
                        <div style={{
                          padding: '12px',
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: 500
                        }}>
                          <Info style={{ width: '16px', height: '16px', color: '#2563eb', flexShrink: 0 }} />
                          <span>Monitoring Mode Only. Callings managed by staff console.</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Quick Actions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  
                  {/* Generate QR Code */}
                  <div 
                    onClick={() => setShowQrModal(true)}
                    style={{ 
                      background: 'white', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '10px', 
                      padding: '18px', 
                      cursor: 'pointer', 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all 0.2s',
                    }}
                    className="quick-action-card"
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                      <QrCode style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Generate QR Code</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>Get QR code for all your queues</div>
                    </div>
                  </div>

                  {/* Download Poster */}
                  <div 
                    onClick={() => setShowQrModal(true)}
                    style={{ 
                      background: 'white', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '10px', 
                      padding: '18px', 
                      cursor: 'pointer', 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all 0.2s',
                    }}
                    className="quick-action-card"
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                      <FileText style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Download Poster</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>Download and print queue poster</div>
                    </div>
                  </div>

                  {/* View Analytics */}
                  <Link 
                    href="/dashboard/analytics"
                    style={{ 
                      background: 'white', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '10px', 
                      padding: '18px', 
                      cursor: 'pointer', 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                    }}
                    className="quick-action-card"
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                      <BarChart3 style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>View Analytics</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>Detailed insights and queue performance</div>
                    </div>
                  </Link>

                  {/* Manage Settings */}
                  <Link 
                    href="/dashboard/settings"
                    style={{ 
                      background: 'white', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '10px', 
                      padding: '18px', 
                      cursor: 'pointer', 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                    }}
                    className="quick-action-card"
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                      <Settings style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Manage Settings</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>Edit queue details, hours and settings</div>
                    </div>
                  </Link>

                </div>
              </div>

            </div>
          )}

          {activeTab === 'staff' && (
            <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start' }}>
              
              {/* STAFF PROVISIONING CONTROL */}
              <div style={{ flex: 1.2, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                  <UserPlus style={{ width: '22px', height: '22px', color: '#2563eb' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Provision Individual Staff Profile</h3>
                </div>

                {successMessage && (
                  <div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', color: '#065f46', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <ShieldCheck style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                    <span>{successMessage}</span>
                  </div>
                )}

                <form onSubmit={handleProvisionStaff} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '12px' }}>Staff Member Name *</label>
                      <div className="form-input-wrapper">
                        <User className="form-input-icon" style={{ width: '16px', height: '16px' }} />
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. Dr. John Watson" 
                          style={{ paddingLeft: '36px', borderRadius: '8px' }}
                          value={staffName}
                          onChange={(e) => setStaffName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '12px' }}>Link to Specific Queue ID *</label>
                      <select 
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontFamily: 'var(--font-sans)',
                          color: '#0f172a',
                          outline: 'none',
                          background: 'white'
                        }}
                        value={staffQueueId}
                        onChange={(e) => setStaffQueueId(e.target.value)}
                        required
                      >
                        {displayQueuesList.map(q => (
                          <option key={q.id} value={q.id}>{q.name} ({q.role || q.specialty})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '12px' }}>Email Address *</label>
                      <div className="form-input-wrapper">
                        <Mail className="form-input-icon" style={{ width: '16px', height: '16px' }} />
                        <input 
                          type="email" 
                          className="form-input" 
                          placeholder="e.g. watson@queuetag.com" 
                          style={{ paddingLeft: '36px', borderRadius: '8px' }}
                          value={staffEmail}
                          onChange={(e) => setStaffEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '12px' }}>Password *</label>
                      <div className="form-input-wrapper">
                        <Lock className="form-input-icon" style={{ width: '16px', height: '16px' }} />
                        <input 
                          type="password" 
                          className="form-input" 
                          placeholder="••••••••" 
                          style={{ paddingLeft: '36px', borderRadius: '8px' }}
                          value={staffPassword}
                          onChange={(e) => setStaffPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748b', background: '#eff6ff', padding: '12px', borderRadius: '8px', display: 'flex', gap: '6px', lineHeight: 1.4 }}>
                    <Info style={{ width: '16px', height: '16px', color: '#2563eb', flexShrink: 0 }} />
                    <span>Assigning a specific Queue ID ensures strict isolation. This staff member will only be able to view and call clients for that particular queue, blocking cross-access completely.</span>
                  </div>

                  <button type="submit" className="btn-primary" style={{ padding: '12px', borderRadius: '8px', width: 'fit-content', minWidth: '180px' }}>
                    <Plus style={{ width: '16px', height: '16px' }} />
                    Provision Credentials
                  </button>
                </form>
              </div>

              {/* REGISTERED STAFF TABLE */}
              <div style={{ flex: 1, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Active Staff Credentials ({Object.keys(staff).length})</h3>
                
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>
                        <th style={{ padding: '10px 12px' }}>STAFF NAME</th>
                        <th style={{ padding: '10px 12px' }}>EMAIL/LOGIN</th>
                        <th style={{ padding: '10px 12px' }}>ASSIGNED QUEUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(staff).map((st) => (
                        <tr key={st.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px', fontWeight: 600, color: '#334155' }}>{st.name}</td>
                          <td style={{ padding: '12px', color: '#2563eb', fontFamily: 'monospace' }}>{st.email}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              fontSize: '10px',
                              background: '#f1f5f9',
                              color: '#475569'
                            }}>
                              {queues[st.queueId]?.name || st.queueId}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

      </main>

      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: '#0f172a',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'slideIn 0.2s ease'
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
          {toastMsg}
        </div>
      )}

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        businessId={user?.id || ''}
        businessName={businessName || location.name}
      />



      {/* Add Queue Modal */}
      <AddQueueModal 
        isOpen={showAddQueueModal}
        onClose={() => setShowAddQueueModal(false)}
        onSubmit={async (name, role) => {
          await createNewQueue(user?.id || '', name, role);
          setToastMsg('New queue created successfully!');
          setTimeout(() => setToastMsg(null), 3000);
        }}
      />

      {/* Global CSS for Animations and Printing Isolation */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media print {
          /* Hide all page content except the printable poster container */
          body * {
            visibility: hidden !important;
          }
          #printable-poster-root, #printable-poster-root * {
            visibility: visible !important;
          }
          #printable-poster-root {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 100% !important;
            max-width: 600px !important;
            height: 840px !important;
            border: 4px solid #000 !important;
            padding: 60px 40px !important;
            box-shadow: none !important;
            background: white !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: space-between !important;
          }
        }
      `}} />

    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>
        Loading Dashboard...
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}
