'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import { 
  Megaphone,
  AlertCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Globe
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Queue } from '@/types';
import { 
  setAnnouncement, 
  clearAnnouncement, 
  setGlobalAnnouncement, 
  clearGlobalAnnouncement 
} from '@/services/announcementService';

export default function AnnouncementsPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuthStore();

  // Real-time Firestore States
  const [queuesList, setQueuesList] = useState<Queue[]>([]);
  const [globalAnnouncement, setGlobalAnnouncementText] = useState('');
  const [isSyncing, setIsSyncing] = useState(true);

  // Form Inputs
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [queueMessage, setQueueMessage] = useState('');
  const [globalMessage, setGlobalMessage] = useState('');

  // UI Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync queues and business document in real-time
  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // 1. Direct real-time listener on queues
    const q = query(
      collection(db, 'queues'),
      where('businessId', '==', user.uid)
    );

    const unsubscribeQueues = onSnapshot(q, (snapshot) => {
      const list: Queue[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          locationId: data.businessId || data.locationId || '',
          businessId: data.businessId || data.locationId || '',
          name: data.name || '',
          specialty: data.specialty || '',
          status: data.status || 'live',
          averageWaitTimeMin: data.averageWaitTimeMin || 15,
          totalServedToday: data.totalServedToday || 0,
          isAppointmentEnabled: data.isAppointmentEnabled || false,
          isHalted: data.isHalted || false,
          entries: data.entries || [],
          currentToken: data.currentToken || 0,
          waitingCount: data.waitingCount || 0,
          workingHours: data.workingHours || '9:00 AM - 6:00 PM',
          currentAnnouncement: data.currentAnnouncement || '',
        } as Queue);
      });
      setQueuesList(list);
      setIsSyncing(false);
    }, (err) => {
      console.error('Error listening to queues:', err);
    });

    // 2. Direct real-time listener on business document (for Global Announcement)
    const bizRef = doc(db, 'businesses', user.uid);
    const unsubscribeBusiness = onSnapshot(bizRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGlobalAnnouncementText(data?.globalAnnouncement || '');
      }
    }, (err) => {
      console.error('Error listening to business details:', err);
    });

    return () => {
      unsubscribeQueues();
      unsubscribeBusiness();
    };
  }, [user, isAuthLoading, router]);

  // Set default selected queue once queues list loads
  useEffect(() => {
    if (queuesList.length > 0 && !selectedQueueId) {
      setSelectedQueueId(queuesList[0].id);
    }
  }, [queuesList, selectedQueueId]);

  const selectedQueue = queuesList.find(q => q.id === selectedQueueId);
  const activeQueueAnnouncement = selectedQueue?.currentAnnouncement || '';

  // Broadcast Global Business Announcement
  const handleGlobalBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !globalMessage.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await setGlobalAnnouncement(user.uid, globalMessage.trim());
      setSuccessMsg('Successfully broadcasted Global Business Announcement!');
      setGlobalMessage('');
      
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
    } catch (err) {
      setErrorMsg('Failed to publish global announcement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear Global Business Announcement
  const handleClearGlobal = async () => {
    if (!user) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await clearGlobalAnnouncement(user.uid);
      setSuccessMsg('Global Business Announcement cleared.');
      
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
    } catch (err) {
      setErrorMsg('Failed to clear global announcement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Broadcast Queue-Specific Announcement
  const handleQueueBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueId || !queueMessage.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await setAnnouncement(selectedQueueId, queueMessage.trim());
      setSuccessMsg(`Successfully broadcasted announcement to "${selectedQueue?.name}"!`);
      setQueueMessage('');
      
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
    } catch (err) {
      setErrorMsg('Failed to publish queue announcement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear Queue-Specific Announcement
  const handleClearQueue = async () => {
    if (!selectedQueueId) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await clearAnnouncement(selectedQueueId);
      setSuccessMsg(`Announcement cleared from "${selectedQueue?.name}".`);
      
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
    } catch (err) {
      setErrorMsg('Failed to clear queue announcement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || (isSyncing && queuesList.length === 0)) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>
        <RefreshCw className="pulse-animation" style={{ width: '24px', height: '24px', marginRight: '8px', color: '#2563eb' }} />
        Loading Announcements Hub...
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
        <DashboardHeader subtext="Announcements for" />

        {/* Content Body */}
        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '800px' }}>
            
            {/* Title Section */}
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Live Announcement Broadcasts</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                Broadcast messages, delay alerts, or general notices globally or to specific queue rooms in real-time.
              </p>
            </div>

            {/* Status Messages */}
            {successMsg && (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                padding: '14px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle style={{ width: '16px', height: '16px', color: '#059669' }} />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                padding: '14px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <XCircle style={{ width: '16px', height: '16px', color: '#dc2626' }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* SECTION 1: GLOBAL BUSINESS ANNOUNCEMENT */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Globe style={{ width: '18px', height: '18px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Global Business Announcement</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Appears on the Customer Portal pre-join landing page</p>
                </div>
              </div>

              {globalAnnouncement ? (
                <div style={{
                  border: '1px solid #fed7aa',
                  borderRadius: '8px',
                  padding: '16px',
                  background: '#fff7ed',
                  color: '#c2410c',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <Megaphone style={{ width: '16px', height: '16px', color: '#ea580c', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ fontSize: '12px', color: '#ea580c', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Active Global Announcement</strong>
                      <p style={{ fontSize: '13px', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
                        {globalAnnouncement}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={handleClearGlobal}
                    disabled={isSubmitting}
                    style={{
                      alignSelf: 'flex-end',
                      background: 'white',
                      border: '1px solid #fdba74',
                      borderRadius: '6px',
                      color: '#ea580c',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '6px 12px',
                      cursor: 'pointer'
                    }}
                  >
                    Clear Global Announcement
                  </button>
                </div>
              ) : (
                <div style={{
                  padding: '14px',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '13px',
                  fontStyle: 'italic',
                  marginBottom: '20px'
                }}>
                  No active Global Announcement. Publish one below!
                </div>
              )}

              <form onSubmit={handleGlobalBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>New Global Announcement Content</label>
                  <textarea 
                    placeholder="e.g. Welcome! All clinical rooms will observe a brief lunch break pause between 1:00 PM and 1:45 PM today."
                    value={globalMessage}
                    onChange={(e) => setGlobalMessage(e.target.value)}
                    required
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontFamily: 'var(--font-sans)',
                      color: '#0f172a',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <button 
                  type="submit" 
                  style={{
                    width: 'fit-content',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    alignSelf: 'flex-end',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                  disabled={isSubmitting || !globalMessage.trim()}
                >
                  {isSubmitting ? 'Broadcasting...' : 'Broadcast Global Message'}
                </button>
              </form>
            </div>

            {/* SECTION 2: QUEUE-SPECIFIC ANNOUNCEMENT */}
            {queuesList.length === 0 ? (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                padding: '24px',
                borderRadius: '12px',
                textAlign: 'center',
                color: '#b45309'
              }}>
                <AlertTriangle style={{ width: '32px', height: '32px', margin: '0 auto 12px auto', color: '#d97706' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>No Queues Available</h3>
                <p style={{ fontSize: '13px', color: '#d97706', marginTop: '4px', maxWidth: '380px', margin: '4px auto 0 auto', lineHeight: 1.4 }}>
                  You must configure at least one queue room before you can broadcast queue-specific alerts.
                </p>
              </div>
            ) : (
              <>
                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Megaphone style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Queue-Specific Announcement</h3>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Appears only inside the waiting room of the selected doctor/room</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Queue Dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Select Target Queue Room *</label>
                      <select 
                        value={selectedQueueId}
                        onChange={(e) => setSelectedQueueId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          fontSize: '13px',
                          color: '#0f172a',
                          background: 'white',
                          outline: 'none',
                          fontFamily: 'var(--font-sans)'
                        }}
                      >
                        {queuesList.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.name} ({q.specialty})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Active display for selected queue */}
                    {selectedQueue && (
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '8px' }}>
                          Current Broadcast for "{selectedQueue.name}":
                        </strong>
                        {activeQueueAnnouncement ? (
                          <div style={{
                            border: '1px solid #fed7aa',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            background: '#fff7ed',
                            color: '#c2410c',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <Megaphone style={{ width: '14px', height: '14px', color: '#ea580c', flexShrink: 0 }} />
                              <span style={{ fontSize: '13px', fontWeight: 500 }}>{activeQueueAnnouncement}</span>
                            </div>
                            <button 
                              onClick={handleClearQueue}
                              disabled={isSubmitting}
                              style={{
                                background: 'white',
                                border: '1px solid #fdba74',
                                borderRadius: '4px',
                                color: '#ea580c',
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '4px 10px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Clear Alert
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                            No active announcement for this queue room.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Publish Form */}
                    <form onSubmit={handleQueueBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>New Broadcast Message Content</label>
                        <textarea 
                          placeholder="e.g. Dr. John is called to emergency surgery. Delays of 20-30 mins are expected."
                          value={queueMessage}
                          onChange={(e) => setQueueMessage(e.target.value)}
                          required
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontFamily: 'var(--font-sans)',
                            color: '#0f172a',
                            outline: 'none',
                            resize: 'vertical'
                          }}
                        />
                      </div>

                      <button 
                        type="submit" 
                        style={{
                          width: 'fit-content',
                          borderRadius: '8px',
                          padding: '8px 18px',
                          alignSelf: 'flex-end',
                          background: '#2563eb',
                          color: 'white',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          opacity: isSubmitting ? 0.7 : 1
                        }}
                        disabled={isSubmitting || !queueMessage.trim()}
                      >
                        {isSubmitting ? 'Broadcasting...' : 'Broadcast to Queue'}
                      </button>
                    </form>

                  </div>
                </div>

                {/* SECTION 3: ACTIVE BROADCASTS DIRECTORY */}
                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      Active Broadcasts Directory ({queuesList.filter(q => q.currentAnnouncement).length} active)
                    </h3>
                    {isSyncing && (
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <RefreshCw className="pulse-animation" style={{ width: '12px', height: '12px' }} />
                        Syncing
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {queuesList.map((q) => (
                      <div key={q.id} style={{
                        padding: '12px 16px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                        background: q.currentAnnouncement ? '#fdf8f2' : 'white',
                        borderColor: q.currentAnnouncement ? '#fed7aa' : '#e2e8f0'
                      }}>
                        <div>
                          <strong style={{ color: '#334155' }}>{q.name}</strong>
                          <div style={{ color: q.currentAnnouncement ? '#c2410c' : '#64748b', marginTop: '2px', fontSize: '12px' }}>
                            {q.currentAnnouncement ? `Alert: "${q.currentAnnouncement}"` : 'Status: No active alerts'}
                          </div>
                        </div>
                        {q.currentAnnouncement && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: '#ffedd5',
                            color: '#ea580c',
                            fontWeight: 700,
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            border: '1px solid #fdba74'
                          }}>
                            Live Alert
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          </div>

        </div>

      </main>

    </div>
  );
}
