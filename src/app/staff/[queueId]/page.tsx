'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueueStore } from '@/store/queueStore';
import { 
  Stethoscope, 
  User, 
  Clock, 
  Users, 
  Play, 
  Pause, 
  RefreshCw, 
  LogOut, 
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  Search,
  CheckCircle,
  MoreVertical,
  MinusCircle,
  HelpCircle,
  TrendingUp,
  X,
  XCircle,
  Loader2,
  Megaphone,
  Calendar,
  Phone
} from 'lucide-react';
import Link from 'next/link';
import { callNextPatient, skipPatient, toggleHalt } from '@/services/queueService';
import { setAnnouncement, clearAnnouncement } from '@/services/announcementService';
import { Queue } from '@/types';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

interface PageProps {
  params: Promise<{ queueId: string }>;
}

export default function StaffConsolePage({ params }: PageProps) {
  // Resolve params using React.use() as per Next.js 16 async params rule
  const { queueId } = use(params);
  const router = useRouter();

  // Zustand Store
  const queues = useQueueStore((state) => state.queues);
  const currentStaffProfile = useQueueStore((state) => state.currentStaffProfile);
  const logoutStaff = useQueueStore((state) => state.logoutStaff);
  
  // Store Actions
  const pauseQueue = useQueueStore((state) => state.pauseQueue);
  const resumeQueue = useQueueStore((state) => state.resumeQueue);
  const nextCustomer = useQueueStore((state) => state.nextCustomer);
  const skipCustomer = useQueueStore((state) => state.skipCustomer);
  const recallCustomer = useQueueStore((state) => state.recallCustomer);
  const toggleHaltQueue = useQueueStore((state) => state.toggleHaltQueue);

  // Real-time synchronization trigger specifically for this queueId
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    async function setupSync() {
      try {
        const { doc, onSnapshot } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const docRef = doc(db, 'queues', queueId);
        
        unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const queueObj = {
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
            } as Queue;
            
            // Update the Zustand store's queues record
            useQueueStore.setState((state) => ({
              queues: {
                ...state.queues,
                [queueId]: queueObj
              }
            }));
          }
        }, (err) => {
          console.error('Error onSnapshot for queueId:', err);
        });
      } catch (err) {
        console.error('Error setting up onSnapshot for queueId:', err);
      }
    }
    
    setupSync();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [queueId]);

  // Local UI State
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseDuration, setPauseDuration] = useState('15 minutes');
  const [customDuration, setCustomDuration] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [recallActive, setRecallActive] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState('');

  // Authentication, Route Guard & Isolation State
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [assignedQueueId, setAssignedQueueId] = useState<string | null>(null);

  // White-Label Branding State
  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [businessServices, setBusinessServices] = useState<any[]>([]);

  // Appointments Console States
  const [activeTab, setActiveTab] = useState<'walkins' | 'appointments'>('walkins');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [appointmentsDate, setAppointmentsDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

  // Cancellation Modal States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingApptId, setCancellingApptId] = useState('');
  const [cancellationReasonText, setCancellationReasonText] = useState('');
  const [isSubmittingCancellation, setIsSubmittingCancellation] = useState(false);

  // Subscribe to business white-label details in real-time
  useEffect(() => {
    const queueObj = queues[queueId];
    if (!queueObj?.businessId) return;

    const bizRef = doc(db, 'businesses', queueObj.businessId);
    const unsubscribe = onSnapshot(bizRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBusinessName(data.businessName || '');
        setLogoUrl(data.logoUrl || '');
        setBusinessServices(data.services || []);
      }
    }, (err) => {
      console.error('Error listening to business branding in staff console:', err);
    });

    return () => unsubscribe();
  }, [queueId, queues]);

  // Sync appointments in real-time
  useEffect(() => {
    const queueObj = queues[queueId];
    if (activeTab !== 'appointments' || !queueObj?.businessId) return;

    setIsLoadingAppointments(true);
    const apptsRef = collection(db, 'appointments');
    const q = query(
      apptsRef,
      where('workspaceId', '==', queueObj.businessId),
      where('date', '==', appointmentsDate)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      // Sort chronologically by startTime
      fetched.sort((a, b) => {
        const timeA = a.startTime || '';
        const timeB = b.startTime || '';
        return timeA.localeCompare(timeB);
      });

      setAppointments(fetched);
      setIsLoadingAppointments(false);
    }, (err) => {
      console.error('Error syncing appointments:', err);
      setIsLoadingAppointments(false);
    });

    return () => unsubscribe();
  }, [activeTab, queueId, queues, appointmentsDate]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return '#2563eb';
      case 'completed': return '#10b981';
      case 'cancelled': return '#ef4444';
      default: return '#cbd5e1';
    }
  };

  const getServiceName = (serviceId: string) => {
    const service = businessServices.find(s => s.id === serviceId);
    return service ? service.name : 'Unknown Service';
  };

  const handleConfirmCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingApptId || !cancellationReasonText.trim() || isSubmittingCancellation) return;

    setIsSubmittingCancellation(true);
    try {
      const response = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          appointmentId: cancellingApptId, 
          cancellationReason: cancellationReasonText.trim() 
        })
      });
      if (!response.ok) {
        throw new Error('Server returned an error status');
      }
      setShowCancelModal(false);
      setCancellingApptId('');
      setCancellationReasonText('');
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      alert('Failed to cancel appointment. Please try again.');
    } finally {
      setIsSubmittingCancellation(false);
    }
  };

  const handleUpdateStatus = async (appointmentId: string, newStatus: 'completed' | 'cancelled') => {
    try {
      if (newStatus === 'cancelled') {
        const response = await fetch('/api/appointments/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId })
        });
        if (!response.ok) {
          throw new Error('Server returned an error status');
        }
      } else {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const apptRef = doc(db, 'appointments', appointmentId);
        await updateDoc(apptRef, { status: newStatus });
      }
    } catch (err) {
      console.error('Error updating appointment status:', err);
      alert('Failed to update appointment status. Please try again.');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/staff/login');
        return;
      }

      try {
        const staffDocRef = doc(db, 'staff', firebaseUser.uid);
        const staffDocSnap = await getDoc(staffDocRef);

        let dbQueueId = '';
        let staffName = firebaseUser.displayName || '';

        if (staffDocSnap.exists()) {
          const data = staffDocSnap.data();
          dbQueueId = data.assignedQueueId || data.queueId || '';
          staffName = data.name || data.displayName || staffName;
        } else {
          const staffQuery = query(
            collection(db, 'staff'),
            where('email', '==', firebaseUser.email?.toLowerCase())
          );
          const querySnap = await getDocs(staffQuery);
          if (!querySnap.empty) {
            const data = querySnap.docs[0].data();
            dbQueueId = data.assignedQueueId || data.queueId || '';
            staffName = data.name || data.displayName || staffName;
          }
        }

        setAssignedQueueId(dbQueueId);

        if (dbQueueId && dbQueueId === queueId) {
          setIsAuthorized(true);
          const profile = {
            id: firebaseUser.uid,
            name: staffName || firebaseUser.email || 'Staff Member',
            email: firebaseUser.email || '',
            queueId: dbQueueId
          };
          useQueueStore.setState({ currentStaffProfile: profile });
          if (typeof window !== 'undefined') {
            localStorage.setItem('qt_staff_profile', JSON.stringify(profile));
          }
        } else {
          setIsAuthorized(false);
        }
      } catch (err) {
        console.error('Error verifying staff route guard:', err);
        setIsAuthorized(false);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, [queueId, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      logoutStaff();
      router.push('/staff/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Show loading while checking authorization
  if (authLoading) {
    return (
      <div className="gateway-container" style={{ background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <RefreshCw className="pulse-animation" style={{ width: '32px', height: '32px', margin: '0 auto 16px auto', color: '#2563eb' }} />
          <div>Verifying credentials...</div>
        </div>
      </div>
    );
  }

  // Deny access if unauthorized or assignedQueueId doesn't match this queueId
  if (isAuthorized === false) {
    return (
      <div className="gateway-container" style={{ background: '#fef2f2' }}>
        <div className="gateway-card" style={{ maxWidth: '440px', padding: '36px', textAlign: 'center', border: '1px solid #fee2e2' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert style={{ width: '28px', height: '28px' }} />
            </div>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#991b1b' }}>Access Denied</h2>
          <p style={{ color: '#7f1d1d', fontSize: '14px', marginTop: '8px', lineHeight: 1.5 }}>
            You are assigned to manage another queue.
            You are strictly blocked from viewing or managing other providers' queues.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px' }}>
            {assignedQueueId && (
              <button 
                className="btn-primary" 
                onClick={() => router.push(`/staff/${assignedQueueId}`)}
              >
                Go to My Assigned Console
              </button>
            )}
            <button 
              className="btn-secondary" 
              onClick={handleLogout}
              style={{ border: '1px solid #cbd5e1', color: '#64748b', background: 'white' }}
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const queue = queues[queueId];
  if (!queue) {
    return (
      <div className="gateway-container">
        <div>Queue not found.</div>
      </div>
    );
  }

  const isPaused = queue.status === 'paused';
  
  // Find current serving & next customer
  const servingCustomer = queue.entries.find(e => e.status === 'serving');
  const nextInLine = queue.entries.find(e => e.status === 'next');
  
  // Calculate waitlist count
  const waitingEntries = queue.entries.filter(e => e.status === 'waiting' || e.status === 'next');
  const totalWaiting = waitingEntries.length;

  // Filter list of patients for display
  const filteredEntries = waitingEntries.filter(e => 
    e.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.tokenNumber.toString().includes(searchQuery)
  );

  const handlePauseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalDuration = customDuration.trim() ? customDuration : pauseDuration;
    pauseQueue(queueId, finalDuration);
    setShowPauseModal(false);
    setCustomDuration('');
  };

  const triggerRecall = () => {
    setRecallActive(true);
    recallCustomer(queueId);
    setTimeout(() => setRecallActive(false), 800); // Visual blink animation
  };

  return (
    <div className="portal-shell" style={{ maxWidth: '480px', position: 'relative', paddingBottom: '36px' }}>
      
      {/* Console Header */}
      <header className="portal-header" style={{ borderBottom: '1px solid #e2e8f0', background: 'white', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={logoUrl} 
              alt="Logo" 
              style={{ 
                height: '36px', 
                maxWidth: '120px', 
                objectFit: 'contain',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
                padding: '2px',
                backgroundColor: '#f8fafc'
              }} 
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="avatar-icon-wrapper" style={{ width: '36px', height: '36px', fontSize: '16px' }}>
              <Stethoscope style={{ width: '18px', height: '18px' }} />
            </div>
          )}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>
              {businessName || 'Staff Console'}
            </div>
            <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{queue.name}</h1>
            <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, margin: '2px 0 0 0' }}>{queue.specialty}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span 
            className={`status-badge ${queue.isHalted ? 'paused' : 'live'}`} 
            style={{ 
              padding: '3px 8px', 
              fontSize: '11px', 
              backgroundColor: queue.isHalted ? '#ef4444' : '#10b981', 
              color: 'white',
              border: 'none'
            }}
          >
            {queue.isHalted ? 'Halted' : 'Active'}
          </span>
          <button 
            onClick={handleLogout}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#64748b', 
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px'
            }}
            title="Log Out"
          >
            <LogOut style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
      </header>

      {/* Main Console content */}
      <main style={{ flex: 1, padding: '16px 20px', background: '#f8fafc', overflowY: 'auto' }}>
        
        {/* Toggle View Tabs */}
        <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px', background: 'white' }}>
          <button
            type="button"
            onClick={() => setActiveTab('walkins')}
            style={{
              flex: 1,
              padding: '10px 0',
              fontSize: '13px',
              fontWeight: 700,
              background: activeTab === 'walkins' ? '#2563eb' : 'white',
              color: activeTab === 'walkins' ? 'white' : '#64748b',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Live Walk-ins
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('appointments')}
            style={{
              flex: 1,
              padding: '10px 0',
              fontSize: '13px',
              fontWeight: 700,
              background: activeTab === 'appointments' ? '#2563eb' : 'white',
              color: activeTab === 'appointments' ? 'white' : '#64748b',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Appointments
          </button>
        </div>

        {activeTab === 'walkins' ? (
          <>
            {isPaused && (
          <div className="pause-banner" style={{ marginBottom: '16px' }}>
            <Pause style={{ width: '18px', height: '18px', color: '#ea580c', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div className="pause-banner-title">Queue is Paused</div>
              <div>Patients see resume time: <strong>{queue.estimatedResumeTime}</strong></div>
            </div>
            <button 
              onClick={() => resumeQueue(queueId)}
              style={{ marginLeft: 'auto', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, color: '#c2410c', cursor: 'pointer' }}
            >
              Resume
            </button>
          </div>
        )}

        {/* ACTIVE CALL CARD */}
        <div className="queue-card" style={{ padding: '32px 24px', background: 'white', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current Serving Token
          </div>
          
          <div style={{ transition: 'all 0.15s ease' }} className={recallActive ? 'pulse-animation' : ''}>
            <div style={{ fontSize: '80px', fontWeight: 900, color: recallActive ? '#ef4444' : '#2563eb', margin: '16px 0' }}>
              {queue.currentToken === 0 || !queue.currentToken ? '--' : `#${queue.currentToken}`}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {servingCustomer ? (
                <>
                  <span>{servingCustomer.customerName}</span>
                  {servingCustomer.isAppointment && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fef3c7', color: '#b45309', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                      ⭐ Appointment
                    </span>
                  )}
                </>
              ) : 'No patient is active'}
            </div>
          </div>

          {/* Next customer hint */}
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
            <span>Next in line:</span>
            {nextInLine ? (
              <strong style={{ color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span>#{nextInLine.tokenNumber} {nextInLine.customerName}</span>
                {nextInLine.isAppointment && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', background: '#fef3c7', color: '#b45309', fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', border: '1px solid #fde68a' }}>
                    ⭐ VIP
                  </span>
                )}
              </strong>
            ) : (
              <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>None</span>
            )}
          </div>
        </div>

        {/* STATS PANEL */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', margin: '14px 0' }}>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{queue.waitingCount}</div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '2px' }}>Waiting</div>
          </div>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>~{queue.averageWaitTimeMin}m</div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '2px' }}>Avg Wait</div>
          </div>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{queue.totalServedToday}</div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '2px' }}>Served</div>
          </div>
        </div>

        {/* ACTION BUTTON GRID */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button 
              className="btn-primary" 
              onClick={async () => {
                if (isCalling || queue.waitingCount === 0) return;
                setIsCalling(true);
                try {
                  await callNextPatient(queueId);
                } catch (e) {
                  console.error("Failed calling next token", e);
                } finally {
                  setIsCalling(false);
                }
              }} 
              disabled={queue.waitingCount === 0 || isCalling}
              style={{ 
                width: '100%', 
                padding: '16px', 
                fontSize: '15px', 
                fontWeight: 700, 
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                cursor: (queue.waitingCount === 0 || isCalling) ? 'default' : 'pointer',
                opacity: (queue.waitingCount === 0 || isCalling) ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
            >
              <Play style={{ width: '18px', height: '18px', fill: 'currentColor' }} />
              {isCalling ? 'Calling Patient...' : 'Call Next Patient'}
            </button>

            <button 
              className="btn-secondary" 
              onClick={async () => {
                if (isSkipping || queue.waitingCount === 0) return;
                setIsSkipping(true);
                try {
                  await skipPatient(queueId);
                } catch (e) {
                  console.error("Failed skipping patient", e);
                } finally {
                  setIsSkipping(false);
                }
              }}
              disabled={queue.waitingCount === 0 || isSkipping}
              style={{ 
                width: '100%', 
                padding: '16px', 
                fontSize: '15px', 
                fontWeight: 700, 
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#fffbeb', 
                color: '#d97706', 
                border: '1px solid #fde68a',
                cursor: (queue.waitingCount === 0 || isSkipping) ? 'default' : 'pointer',
                opacity: (queue.waitingCount === 0 || isSkipping) ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
            >
              <MinusCircle style={{ width: '18px', height: '18px' }} />
              {isSkipping ? 'Skipping...' : 'Skip Patient'}
            </button>
          </div>
          
          <button 
            className="btn-secondary" 
            onClick={triggerRecall}
            disabled={!servingCustomer}
            style={{ 
              background: 'white', 
              color: '#334155', 
              border: '1px solid #cbd5e1',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: !servingCustomer ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              width: '100%',
              opacity: !servingCustomer ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw className={recallActive ? 'spin' : ''} style={{ width: '14px', height: '14px' }} />
            Recall Active Patient
          </button>

          <button 
            className="btn-primary" 
            onClick={() => {
              if (isPaused) {
                resumeQueue(queueId);
              } else {
                setShowPauseModal(true);
              }
            }}
            style={{ 
              width: '100%',
              backgroundColor: isPaused ? '#10b981' : '#f97316',
              color: 'white',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {isPaused ? <Play style={{ width: '16px', height: '16px' }} /> : <Pause style={{ width: '16px', height: '16px' }} />}
            {isPaused ? 'Resume Queue (Go Live)' : 'Pause Queue (Set Resume Time)'}
          </button>

          <button
            onClick={async () => {
              try {
                await toggleHalt(queueId, queue.isHalted);
              } catch (e) {
                console.error("Failed to toggle halt status", e);
              }
            }}
            style={{
              width: '100%',
              backgroundColor: queue.isHalted ? '#10b981' : '#fff1f2',
              border: queue.isHalted ? 'none' : '1px solid #ffe4e6',
              color: queue.isHalted ? 'white' : '#e11d48',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <AlertTriangle style={{ width: '16px', height: '16px' }} />
            {queue.isHalted ? 'Resume walk-ins (Open Queue)' : 'Halt walk-ins (Close Queue)'}
          </button>
        </div>

        {/* QUEUE ANNOUNCEMENT CARD */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
            <Megaphone style={{ width: '16px', height: '16px', color: '#2563eb' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Queue Announcement</h3>
          </div>

          {queue.currentAnnouncement ? (
            <div style={{
              border: '1px solid #fed7aa',
              borderRadius: '6px',
              padding: '10px 12px',
              background: '#fff7ed',
              color: '#c2410c',
              fontSize: '12px',
              fontWeight: 500,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '12px'
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <strong>Active:</strong> "{queue.currentAnnouncement}"
              </span>
              <button
                onClick={async () => {
                  try {
                    await clearAnnouncement(queueId);
                    setAnnouncementMsg('');
                  } catch (e) {
                    console.error("Failed to clear queue announcement", e);
                  }
                }}
                style={{
                  background: 'white',
                  border: '1px solid #fdba74',
                  borderRadius: '4px',
                  color: '#ea580c',
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Clear
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginBottom: '12px' }}>
              No active announcement for this queue room.
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text"
              placeholder="Type delay alert, notice, etc..."
              value={announcementMsg}
              onChange={(e) => setAnnouncementMsg(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                color: '#0f172a'
              }}
            />
            <button
              onClick={async () => {
                if (!announcementMsg.trim()) return;
                try {
                  await setAnnouncement(queueId, announcementMsg.trim());
                  setAnnouncementMsg('');
                } catch (e) {
                  console.error("Failed to set queue announcement", e);
                }
              }}
              disabled={!announcementMsg.trim()}
              style={{
                padding: '8px 14px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: announcementMsg.trim() ? 'pointer' : 'default',
                opacity: announcementMsg.trim() ? 1 : 0.6
              }}
            >
              Set
            </button>
          </div>
        </div>

        {/* UPCOMING PATIENT LIST */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ padding: '0 16px 12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Upcoming Patients ({totalWaiting})</h3>
            
            {/* Simple Search bar */}
            <div className="form-input-wrapper" style={{ width: '150px' }}>
              <Search style={{ width: '12px', height: '12px', position: 'absolute', left: '8px', color: '#64748b' }} />
              <input 
                type="text" 
                placeholder="Search..." 
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '4px 6px 4px 26px', fontSize: '11px', borderRadius: '6px' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ padding: '10px 16px' }}>TOKEN</th>
                  <th style={{ padding: '10px 16px' }}>PATIENT NAME</th>
                  <th style={{ padding: '10px 16px' }}>WAIT TIME</th>
                  <th style={{ padding: '10px 16px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length > 0 ? (
                  filteredEntries.map((entry, index) => {
                    // Calculate dynamic wait time representation
                    const waitMin = index * queue.averageWaitTimeMin + (servingCustomer ? queue.averageWaitTimeMin : 0);
                    
                    return (
                      <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563eb' }}>
                          #{entry.tokenNumber}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{entry.customerName}</span>
                            {entry.isAppointment && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: '#fef3c7', color: '#b45309', fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                                ⭐ VIP
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>
                          ~{waitMin} min
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '10px',
                            background: entry.status === 'next' ? '#eff6ff' : '#fffbeb',
                            color: entry.status === 'next' ? '#2563eb' : '#d97706'
                          }}>
                            {entry.status === 'next' ? 'Next' : 'Waiting'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                      {searchQuery ? 'No matching patients found' : 'Queue is empty'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Date Selector Header */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar style={{ width: '18px', height: '18px', color: '#2563eb' }} />
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>Select Date</span>
              </div>
              <input 
                type="date" 
                value={appointmentsDate}
                onChange={(e) => setAppointmentsDate(e.target.value)}
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
            </div>

            {/* Appointments List */}
            {isLoadingAppointments ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '180px', flexDirection: 'column', gap: '10px', color: '#64748b', fontSize: '13px' }}>
                <Loader2 className="animate-spin" style={{ width: '28px', height: '28px', color: '#2563eb' }} />
                <span>Loading appointments...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {appointments.length > 0 ? (
                  appointments.map((appt) => {
                    const timeDisplay = `${formatTimeTo12Hour(appt.startTime)} - ${formatTimeTo12Hour(appt.endTime)}`;
                    const leftBorderColor = getStatusColor(appt.status);
                    
                    return (
                      <div 
                        key={appt.id} 
                        style={{
                          background: 'white',
                          border: '1px solid #e2e8f0',
                          borderLeft: `4px solid ${leftBorderColor}`,
                          borderRadius: '8px',
                          padding: '16px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock style={{ width: '12px', height: '12px' }} />
                              <span>{timeDisplay}</span>
                            </div>
                            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '4px 0 2px 0' }}>{appt.customerName}</h4>
                            <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Phone style={{ width: '12px', height: '12px' }} />
                              <span>{appt.customerPhone}</span>
                            </div>
                          </div>
                          
                          {/* Actions button group */}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {appt.status === 'scheduled' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancellingApptId(appt.id);
                                  setCancellationReasonText('');
                                  setShowCancelModal(true);
                                }}
                                style={{
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                            )}
                            {appt.status !== 'scheduled' && (
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '10.5px',
                                textTransform: 'capitalize',
                                background: appt.status === 'completed' ? '#ecfdf5' : '#fef2f2',
                                color: appt.status === 'completed' ? '#065f46' : '#991b1b'
                              }}>
                                {appt.status}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#475569' }}>
                          <span>Queue Booked:</span>
                          <strong style={{ color: '#1e293b' }}>{appt.queueName || getServiceName(appt.serviceId)}</strong>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '32px 16px', textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#94a3b8', fontSize: '13px', fontStyle: 'italic', background: 'white' }}>
                    No appointments scheduled for this date.
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </main>

      {/* PAUSE MODAL POPUP DIALOG */}
      {showPauseModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="gateway-card" style={{
            maxWidth: '380px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #cbd5e1',
            background: 'white',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0f172a', fontSize: '16px' }}>
                <Pause style={{ width: '18px', height: '18px', color: '#f97316' }} />
                <span>Pause Patient Queue</span>
              </div>
              <button 
                onClick={() => setShowPauseModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <form onSubmit={handlePauseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Presets */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>
                  Choose pause duration
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {['15 minutes', '30 minutes', '45 minutes', '1 hour'].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => {
                        setPauseDuration(time);
                        setCustomDuration('');
                      }}
                      style={{
                        background: pauseDuration === time && !customDuration ? '#eff6ff' : 'white',
                        border: '1px solid',
                        borderColor: pauseDuration === time && !customDuration ? '#2563eb' : '#cbd5e1',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: pauseDuration === time && !customDuration ? '#2563eb' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
              {/* Custom Duration Input */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>
                  Or enter specific resume time
                </label>
                <div className="form-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Clock style={{ width: '14px', height: '14px', position: 'absolute', left: '12px', color: '#64748b' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. 2:30 PM or 45 mins" 
                    style={{ paddingLeft: '34px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', borderRadius: '6px', fontSize: '13px', width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1' }}
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#64748b', background: '#fff7ed', border: '1px solid #ffe6d5', padding: '10px', borderRadius: '6px', lineHeight: 1.4 }}>
                <strong>Note:</strong> Customers will instantly see this pause notice on their live tracking screens and won't be able to join the queue until resumed.
              </div>

              <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '4px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setShowPauseModal(false)}
                  style={{ flex: 1, padding: '10px', border: '1px solid #cbd5e1', color: '#475569', background: 'white' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  style={{ flex: 1, padding: '10px', backgroundColor: '#f97316' }}
                >
                  Confirm Pause
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CANCELLATION MODAL POPUP DIALOG */}
      {showCancelModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="gateway-card" style={{
            maxWidth: '380px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #cbd5e1',
            background: 'white',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0f172a', fontSize: '16px' }}>
                <XCircle style={{ width: '18px', height: '18px', color: '#ef4444' }} />
                <span>Cancel Appointment</span>
              </div>
              <button 
                onClick={() => {
                  setShowCancelModal(false);
                  setCancellingApptId('');
                  setCancellationReasonText('');
                }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <form onSubmit={handleConfirmCancellation} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>
                  Reason for Cancellation (Required)
                </label>
                <textarea 
                  placeholder="e.g. Customer requested cancellation / Staff scheduling conflict" 
                  value={cancellationReasonText} 
                  onChange={(e) => setCancellationReasonText(e.target.value)} 
                  required
                  disabled={isSubmittingCancellation}
                  className="form-input"
                  style={{ 
                    borderRadius: '6px', 
                    fontSize: '12.5px', 
                    minHeight: '80px', 
                    fontFamily: 'inherit', 
                    resize: 'vertical',
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    border: '1px solid #cbd5e1'
                  }}
                />
                <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0' }}>
                  Please enter at least 3 characters.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancellingApptId('');
                    setCancellationReasonText('');
                  }}
                  disabled={isSubmittingCancellation}
                  style={{
                    flex: 1,
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '10px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  Nevermind
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCancellation || cancellationReasonText.trim().length < 3}
                  style={{
                    flex: 1,
                    background: (isSubmittingCancellation || cancellationReasonText.trim().length < 3) ? '#fca5a5' : '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: (isSubmittingCancellation || cancellationReasonText.trim().length < 3) ? 'default' : 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {isSubmittingCancellation ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        {/* Powered by QueueTag Watermark Footer */}
        <footer style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '36px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '11px',
          color: '#94a3b8',
          zIndex: 999,
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.02)'
        }}>
          <span>Powered by</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600, color: '#64748b' }}>
            <svg style={{ width: '12px', height: '12px', color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>QueueTag</span>
          </div>
        </footer>
      </div>
    );
  }
