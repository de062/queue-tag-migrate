'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useQueueStore } from '@/store/queueStore';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import { 
  UserPlus, 
  Mail, 
  Copy, 
  Check, 
  Loader2, 
  Trash2, 
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Info,
  UserCheck,
  Send
} from 'lucide-react';
import { createStaffInvite, deleteStaffInvite, subscribeToStaffInvites, subscribeToStaffProfiles, StaffInvite } from '@/services/staffService';
import { StaffProfile } from '@/types';

export default function ManageStaffPage() {
  const router = useRouter();
  const { user, businessName: authBusinessName, isLoading: isAuthLoading } = useAuthStore();
  const queues = useQueueStore((state) => state.queues);
  const currentBusiness = useQueueStore((state) => state.currentBusiness);
  const locations = useQueueStore((state) => state.locations);
  const initLiveSync = useQueueStore((state) => state.initLiveSync);

  // States
  const [staffEmail, setStaffEmail] = useState('');
  const [staffQueueId, setStaffQueueId] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<StaffInvite[]>([]);
  const [activeStaff, setActiveStaff] = useState<StaffProfile[]>([]);
  const [inviteCopiedId, setInviteCopiedId] = useState<string | null>(null);

  // Sync queues and auth check
  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    console.log(`STEP 1: Manage Staff Page Mounted, requesting sync for ${user.id}`);
    const unsubscribeLiveSync = initLiveSync(user.id);

    // Subscribe to staff invites
    const unsubscribeInvites = subscribeToStaffInvites(user.id, (invites) => {
      setPendingInvites(invites);
    });

    // Subscribe to active staff profiles
    const unsubscribeProfiles = subscribeToStaffProfiles(user.id, (profiles) => {
      setActiveStaff(profiles);
    });

    return () => {
      if (unsubscribeLiveSync) unsubscribeLiveSync();
      unsubscribeInvites();
      unsubscribeProfiles();
    };
  }, [isAuthLoading, user, initLiveSync, router]);

  const location = currentBusiness || locations['abc-clinic'] || {
    id: 'abc-clinic',
    name: 'ABC Clinic',
    type: 'Clinic',
    address: '123, MG Road, Bangalore, Karnataka 560001',
    timezone: '(GMT+05:30) Asia/Kolkata',
  };

  const businessDisplayName = authBusinessName || location.name;
  const currentBusinessId = user?.id || location.id;
  
  // Filter queues to only show queues for this location/business
  const displayQueuesList = Object.values(queues).filter(q => q.locationId === currentBusinessId);

  // Set default queue in dropdown once loaded
  useEffect(() => {
    if (displayQueuesList.length > 0 && !staffQueueId) {
      setStaffQueueId(displayQueuesList[0].id);
    }
  }, [displayQueuesList, staffQueueId]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail || !staffQueueId || !user) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(staffEmail.trim())) {
      showToast('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setGeneratedLink(null);
    setCopied(false);

    try {
      const token = await createStaffInvite(staffEmail, staffQueueId, user.id);
      const host = typeof window !== 'undefined' ? window.location.origin : '';
      const inviteUrl = `${host}/staff/invite/${token}`;
      setGeneratedLink(inviteUrl);
      setStaffEmail('');
      showToast('Invite link generated successfully!');
    } catch (err) {
      console.error('Error generating staff invite:', err);
      showToast('Failed to generate invite link. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await deleteStaffInvite(inviteId);
      showToast('Invite cancelled successfully.');
    } catch (err) {
      console.error('Error deleting invite:', err);
      showToast('Failed to cancel invite.');
    }
  };

  const copyToClipboard = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        setInviteCopiedId(id);
        setTimeout(() => setInviteCopiedId(null), 2000);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      showToast('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  if (isAuthLoading || !user) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>
        <RefreshCw className="pulse-animation" style={{ width: '24px', height: '24px', marginRight: '8px', color: '#2563eb' }} />
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
        <DashboardHeader subtext={`Manage onboarding invites and credentials for ${businessDisplayName}`} />

        {/* Inner Content */}
        <div style={{ padding: '32px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '28px', alignItems: 'flex-start' }}>
            
            {/* INVITE GENERATOR FORM */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                <UserPlus style={{ width: '22px', height: '22px', color: '#2563eb' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Generate Staff Invite Link</h3>
              </div>

              <form onSubmit={handleCreateInvite} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '12px' }}>Staff Email Address *</label>
                    <div className="form-input-wrapper">
                      <Mail className="form-input-icon" style={{ width: '16px', height: '16px' }} />
                      <input 
                        type="email" 
                        className="form-input" 
                        placeholder="e.g. nurse@clinic.com" 
                        style={{ paddingLeft: '36px', borderRadius: '8px' }}
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '12px' }}>Assign to Queue *</label>
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
                      disabled={isSubmitting}
                    >
                      {displayQueuesList.length > 0 ? (
                        displayQueuesList.map(q => (
                          <option key={q.id} value={q.id}>
                            {q.role ? `${q.name} (${q.role})` : q.name}
                          </option>
                        ))
                      ) : (
                        <option value="">No queues available</option>
                      )}
                    </select>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: '#64748b', background: '#eff6ff', padding: '12px', borderRadius: '8px', display: 'flex', gap: '6px', lineHeight: 1.4 }}>
                  <Info style={{ width: '16px', height: '16px', color: '#2563eb', flexShrink: 0 }} />
                  <span>Generating a secure invite link lets the staff member choose their own password during onboarding, while securing their assigned queue console access.</span>
                </div>

                <button type="submit" className="btn-primary" style={{ padding: '12px', borderRadius: '8px', width: 'fit-content', minWidth: '180px' }} disabled={isSubmitting || displayQueuesList.length === 0}>
                  {isSubmitting ? (
                    <Loader2 className="spin" style={{ width: '16px', height: '16px' }} />
                  ) : (
                    <Send style={{ width: '16px', height: '16px' }} />
                  )}
                  {isSubmitting ? 'Generating...' : 'Generate Invite Link'}
                </button>
              </form>

              {/* GENERATED LINK VIEW */}
              {generatedLink && (
                <div style={{ marginTop: '24px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                    <Check style={{ width: '16px', height: '16px' }} />
                    <span>Invite Link Generated! Copy and send it to the staff member:</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      readOnly 
                      value={generatedLink}
                      style={{ flex: 1, padding: '10px', fontSize: '12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#334155', fontFamily: 'monospace' }}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button 
                      onClick={() => copyToClipboard(generatedLink)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '6px',
                        background: copied ? '#15803d' : '#2563eb', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '6px', 
                        padding: '0 16px', 
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                      }}
                    >
                      {copied ? <Check style={{ width: '14px', height: '14px' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* REGISTERED STAFF MEMBERS TABLE */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '320px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <UserCheck style={{ width: '20px', height: '20px', color: '#10b981' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Active Staff Credentials ({activeStaff.length})</h3>
              </div>
              
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ padding: '10px 12px' }}>STAFF NAME</th>
                      <th style={{ padding: '10px 12px' }}>EMAIL/LOGIN</th>
                      <th style={{ padding: '10px 12px' }}>ASSIGNED QUEUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStaff.length > 0 ? (
                      activeStaff.map((st) => (
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
                              {(() => {
                                const targetQueue = queues[st.queueId];
                                return targetQueue 
                                  ? (targetQueue.role ? `${targetQueue.name} (${targetQueue.role})` : targetQueue.name)
                                  : st.queueId;
                              })()}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                          No active staff profiles registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* PENDING INVITES LIST */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              Pending Onboarding Invites ({pendingInvites.length})
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '10px 12px' }}>EMAIL ADDRESS</th>
                    <th style={{ padding: '10px 12px' }}>ASSIGNED QUEUE</th>
                    <th style={{ padding: '10px 12px' }}>CREATED AT</th>
                    <th style={{ padding: '10px 12px' }}>SECURE ONBOARDING LINK</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.length > 0 ? (
                    pendingInvites.map((invite) => {
                      const host = typeof window !== 'undefined' ? window.location.origin : '';
                      const fullLink = `${host}/staff/invite/${invite.token}`;
                      
                      return (
                        <tr key={invite.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px', fontWeight: 600, color: '#334155' }}>
                            {invite.email}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              fontSize: '10px',
                              background: '#eff6ff',
                              color: '#2563eb'
                            }}>
                              {(() => {
                                const targetQueue = queues[invite.assignedQueueId];
                                return targetQueue 
                                  ? (targetQueue.role ? `${targetQueue.name} (${targetQueue.role})` : targetQueue.name)
                                  : invite.assignedQueueId;
                              })()}
                            </span>
                          </td>
                          <td style={{ padding: '12px', color: '#64748b' }}>
                            {new Date(invite.createdAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td style={{ padding: '12px', fontFamily: 'monospace', color: '#475569', fontSize: '11px' }}>
                            {fullLink}
                          </td>
                          <td style={{ padding: '12px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              onClick={() => copyToClipboard(fullLink, invite.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 10px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                background: inviteCopiedId === invite.id ? '#ecfdf5' : 'white',
                                color: inviteCopiedId === invite.id ? '#10b981' : '#475569',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '11px',
                                transition: 'all 0.15s'
                              }}
                              title="Copy Link"
                            >
                              {inviteCopiedId === invite.id ? <Check style={{ width: '12px', height: '12px' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                              {inviteCopiedId === invite.id ? 'Copied' : 'Copy'}
                            </button>
                            
                            <button
                              onClick={() => handleCancelInvite(invite.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 10px',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                background: 'white',
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '11px',
                                transition: 'all 0.15s'
                              }}
                              title="Cancel Invite"
                            >
                              <Trash2 style={{ width: '12px', height: '12px' }} />
                              Cancel
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                        No pending staff onboarding invites.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

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
          gap: '8px'
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
          {toastMsg}
        </div>
      )}

    </div>
  );
}
