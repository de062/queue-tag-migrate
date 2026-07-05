'use client';

import { use, useState, useEffect } from 'react';
import { useQueueStore } from '@/store/queueStore';
import { 
  User, 
  Clock, 
  Users, 
  Bell, 
  ArrowLeft, 
  RefreshCw, 
  LogOut, 
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  Play,
  Pause,
  ChevronRight,
  Sparkles,
  Megaphone,
  Building,
  Phone,
  Mail,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { Queue } from '@/types';
import PhoneInput from '@/components/PhoneInput';

interface PageProps {
  params: Promise<{ locationId: string }>;
}

export default function CustomerPortal({ params }: PageProps) {
  // Resolve params using React.use() as per Next.js 16 breaking change rules
  const { locationId } = use(params);

  // Zustand Store hooks
  const locations = useQueueStore((state) => state.locations);
  const queues = useQueueStore((state) => state.queues);
  const currentCustomerId = useQueueStore((state) => state.currentCustomerId);
  const currentCustomerQueueId = useQueueStore((state) => state.currentCustomerQueueId);
  const joinQueue = useQueueStore((state) => state.joinQueue);
  const leaveQueue = useQueueStore((state) => state.leaveQueue);
  const announcements = useQueueStore((state) => state.announcements);
  
  // Local UI State
  const [activeStep, setActiveStep] = useState<'selection' | 'join' | 'tracking'>('selection');
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [joinedAtTime, setJoinedAtTime] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPhoneValid, setIsPhoneValid] = useState(true);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [simulatedOtpHint, setSimulatedOtpHint] = useState<string | null>(null);
  const [pendingJoinArgs, setPendingJoinArgs] = useState<{ queueId: string; name: string; phone: string } | null>(null);

  // Real-time Firestore Sync & Verification States
  const initLiveSync = useQueueStore((state) => state.initLiveSync);
  const [isLoading, setIsLoading] = useState(true);
  const [businessExists, setBusinessExists] = useState<boolean | null>(null);
  const [globalAnnouncementText, setGlobalAnnouncementText] = useState('');
  const [trackedQueueData, setTrackedQueueData] = useState<Queue | null>(null);

  // White-Label Branding State
  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [requirePhoneNumber, setRequirePhoneNumber] = useState(false);
  const [businessAddress, setBusinessAddress] = useState('');
  const [publicPhone, setPublicPhone] = useState('');
  const [publicEmail, setPublicEmail] = useState('');

  // VIP Identity Verification States
  const [identityPhone, setIdentityPhone] = useState('');
  const [isIdentityPhoneValid, setIsIdentityPhoneValid] = useState(true);
  const [hasIdentified, setHasIdentified] = useState(false);
  const [vipAppointment, setVipAppointment] = useState<any>(null);
  const [isCheckingVip, setIsCheckingVip] = useState(false);
  const [businessServices, setBusinessServices] = useState<any[]>([]);
  const [isSubmittingVip, setIsSubmittingVip] = useState(false);

  // Simulator controls
  const pauseQueue = useQueueStore((state) => state.pauseQueue);
  const resumeQueue = useQueueStore((state) => state.resumeQueue);
  const nextCustomer = useQueueStore((state) => state.nextCustomer);
  const toggleHaltQueue = useQueueStore((state) => state.toggleHaltQueue);

  // Sync effect
  useEffect(() => {
    if (!locationId) return;
    
    console.log(`STEP 1: CustomerPortal Sync Mounted for ${locationId}`);
    const unsubscribe = initLiveSync(locationId);
    let businessChannel: any;
    
    // Subscribe to business details (for global announcement and business name) in real-time
    const subscribeBusiness = async () => {
      const { supabase } = await import('@/lib/supabase');

      const fetchBiz = async () => {
        const { data } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', locationId)
          .maybeSingle();

        if (data) {
          setBusinessExists(true);
          setGlobalAnnouncementText(data.global_announcement || '');
          setBusinessName(data.name || '');
          setLogoUrl(data.logo_url || '');
          setPrimaryColor(data.primary_color || '#2563eb');
          setRequirePhoneNumber(data.require_phone_number || false);
          setBusinessAddress(data.address || '');
          setPublicPhone(data.public_phone || '');
          setPublicEmail(data.public_email || '');
          setBusinessServices(data.services || []);
          if (data.name) {
            useQueueStore.setState((state) => ({
              locations: {
                ...state.locations,
                [locationId]: {
                  ...(state.locations[locationId] || { id: locationId, type: 'Clinic' }),
                  name: data.name,
                },
              },
            }));
          }
        } else {
          // Check if there are queues anyway (for demo fallback)
          const { data: queuesData } = await supabase
            .from('queues')
            .select('id')
            .eq('business_id', locationId)
            .limit(1);
          setBusinessExists((queuesData ?? []).length > 0);
        }
        setIsLoading(false);
      };

      fetchBiz();

      businessChannel = supabase
        .channel(`biz-kiosk:${locationId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'businesses',
            filter: `id=eq.${locationId}` }, fetchBiz)
        .subscribe();
    };

    subscribeBusiness();

    return () => {
      if (unsubscribe) unsubscribe();
      if (businessChannel) {
        import('@/lib/supabase').then(({ supabase }) => supabase.removeChannel(businessChannel));
      }
    };
  }, [locationId, initLiveSync]);

  // Real-time listener specifically for the queue the customer has joined
  useEffect(() => {
    if (!currentCustomerQueueId) {
      setTrackedQueueData(null);
      return;
    }

    let queueChannel: any;

    const subscribeQueue = async () => {
      const { supabase } = await import('@/lib/supabase');

      const fetchQueue = async () => {
        const { data } = await supabase
          .from('queues')
          .select('*, queue_entries(*)')
          .eq('id', currentCustomerQueueId)
          .single();
        if (data) {
          setTrackedQueueData({
            id: data.id,
            locationId: data.business_id,
            businessId: data.business_id,
            name: data.name ?? '',
            specialty: data.specialty ?? '',
            status: data.status === 'live' ? 'live' : 'paused',
            averageWaitTimeMin: data.average_wait_time_min ?? 15,
            totalServedToday: data.total_served_today ?? 0,
            isAppointmentEnabled: data.is_appointment_enabled ?? false,
            isHalted: data.is_halted ?? false,
            entries: (data.queue_entries ?? [])
              .filter((e: any) => ['waiting', 'next', 'serving'].includes(e.status))
              .map((e: any) => ({
                id: e.id, tokenNumber: e.token_number, customerName: e.customer_name,
                phoneNumber: e.phone_number, joinedAt: e.joined_at, status: e.status,
                isAppointment: e.is_appointment, appointmentId: e.appointment_id,
              }))
              .sort((a: any, b: any) => a.tokenNumber - b.tokenNumber),
            currentToken: data.current_token ?? 0,
            waitingCount: data.waiting_count ?? 0,
            workingHours: data.working_hours ?? '9:00 AM - 6:00 PM',
            currentAnnouncement: data.current_announcement ?? '',
            lastCalledPatient: data.last_called_patient ?? undefined,
          } as Queue);
        }
      };

      fetchQueue();

      queueChannel = supabase
        .channel(`customer-queue:${currentCustomerQueueId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queues',
            filter: `id=eq.${currentCustomerQueueId}` }, fetchQueue)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries',
            filter: `queue_id=eq.${currentCustomerQueueId}` }, fetchQueue)
        .subscribe();
    };

    subscribeQueue();

    return () => {
      if (queueChannel) {
        import('@/lib/supabase').then(({ supabase }) => supabase.removeChannel(queueChannel));
      }
    };
  }, [currentCustomerQueueId]);

  const location = locations[locationId] || locations['abc-clinic'] || {
    id: locationId,
    name: 'ABC Clinic',
    type: 'Clinic',
  };

  // Keep track of navigation state based on whether customer has an active token
  useEffect(() => {
    const queue = currentCustomerQueueId ? queues[currentCustomerQueueId] : null;
    const entryExists = queue?.entries.some(e => e.id === currentCustomerId);

    if (currentCustomerId && currentCustomerQueueId && entryExists) {
      setActiveStep('tracking');
      setIsJoined(true);
      if (!joinedAtTime) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setJoinedAtTime(timeStr);
      }
    } else {
      // If the customer state is stale (e.g. store restarted but localStorage has old IDs),
      // clear the localStorage keys to prevent a blank screen and redirect back to selection.
      if (currentCustomerId || currentCustomerQueueId) {
        useQueueStore.getState().resetCustomerState();
      }
      setActiveStep('selection');
      setIsJoined(false);
      setFullName('');
      setPhoneNumber('');
    }
  }, [currentCustomerId, currentCustomerQueueId, queues, joinedAtTime]);

  const getServiceName = (serviceId: string) => {
    const service = businessServices.find(s => s.id === serviceId);
    return service ? service.name : 'Scheduled Service';
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

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identityPhone.trim() || !isIdentityPhoneValid || isCheckingVip) return;

    setIsCheckingVip(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { supabase } = await import('@/lib/supabase');

      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('workspace_id', locationId)
        .eq('customer_phone', identityPhone.trim())
        .eq('date', todayStr)
        .eq('status', 'scheduled')
        .limit(1)
        .maybeSingle();

      if (data) {
        setVipAppointment({
          id: data.id,
          customerName: data.customer_name,
          customerPhone: data.customer_phone,
          date: data.date,
          startTime: typeof data.start_time === 'string' ? data.start_time.slice(0, 5) : data.start_time,
          endTime: typeof data.end_time === 'string' ? data.end_time.slice(0, 5) : data.end_time,
          status: data.status,
          workspaceId: data.workspace_id,
        });
        setFullName(data.customer_name || '');
        setPhoneNumber(identityPhone.trim());
        setIsPhoneValid(true);
      } else {
        setVipAppointment(null);
        setPhoneNumber(identityPhone.trim());
        setIsPhoneValid(true);
      }
      setHasIdentified(true);
    } catch (err) {
      console.error('Error looking up VIP appointment:', err);
      setPhoneNumber(identityPhone.trim());
      setIsPhoneValid(true);
      setHasIdentified(true);
    } finally {
      setIsCheckingVip(false);
    }
  };

  const handleVipCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vipAppointment || isSubmittingVip) return;

    setIsSubmittingVip(true);
    try {
      // 1. Update appointment status to 'arrived'
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('appointments').update({ status: 'arrived' }).eq('id', vipAppointment.id);

      // 2. Inject directly into live walk-ins queue matching the booked queueId
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setJoinedAtTime(timeStr);

      const targetQueueId = vipAppointment.queueId || selectedQueueId;
      if (!targetQueueId) {
        throw new Error('No target queue selected or configured.');
      }

      await joinQueue(targetQueueId, vipAppointment.customerName, identityPhone.trim(), true, vipAppointment.id);
      setActiveStep('tracking');
      setIsJoined(true);
    } catch (err) {
      console.error('Error in VIP check-in:', err);
      alert('Failed to check in. Please try again or join standard walk-in.');
    } finally {
      setIsSubmittingVip(false);
    }
  };

  // Handle joining a queue
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !selectedQueueId || isSubmitting) return;
    
    if (requirePhoneNumber && (!phoneNumber.trim() || !isPhoneValid)) {
      alert('Please enter a valid phone number to join the queue.');
      return;
    }

    if (phoneNumber.trim() && !isPhoneValid) {
      alert('Please enter a valid phone number or clear the input to join.');
      return;
    }

    if (phoneNumber.trim()) {
      const isVerified = localStorage.getItem(`verified_phone_${phoneNumber.trim()}`) === 'true';
      if (!isVerified) {
        setPendingJoinArgs({ queueId: selectedQueueId, name: fullName, phone: phoneNumber.trim() });
        setShowOtpModal(true);
        try {
          const res = await fetch('/api/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phoneNumber.trim() })
          });
          const data = await res.json();
          if (data.simulated && data.devOtp) {
            setSimulatedOtpHint(data.devOtp);
          }
        } catch (err) {
          console.error('Failed to send OTP:', err);
        }
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setJoinedAtTime(timeStr);

      await joinQueue(selectedQueueId, fullName, phoneNumber);
      setActiveStep('tracking');
      setIsJoined(true);
    } catch (err) {
      console.error('Failed to join queue:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle leaving queue
  const handleLeave = async () => {
    if (currentCustomerQueueId && currentCustomerId) {
      if (confirm('Are you sure you want to leave the queue? You will lose your token.')) {
        try {
          await leaveQueue(currentCustomerQueueId, currentCustomerId);
        } catch (err) {
          console.error('Failed to leave queue:', err);
        }
      }
    }
  };

  // Selected queue data (for join page)
  const activeSelectedQueue = selectedQueueId ? queues[selectedQueueId] : null;

  // Active tracked queue data (for tracker page)
  const trackedQueue = currentCustomerQueueId ? queues[currentCustomerQueueId] : null;
  const userEntry = trackedQueue?.entries.find(e => e.id === currentCustomerId);

  // Helper for estimated wait time
  const getEstimatedWait = (queue: any, entry: any) => {
    if (!queue || !entry) return '0 min';
    if (entry.status === 'serving') return '0 min';
    
    // Count entries ahead
    const peopleAhead = queue.entries.filter(
      (e: any) => (e.status === 'waiting' || e.status === 'next') && e.tokenNumber < entry.tokenNumber
    ).length;

    // Estimated wait time
    const waitMin = Math.max(5, peopleAhead * (queue.averageWaitTimeMin || 15));
    if (queue.status === 'paused') {
      return `~${waitMin} min (Paused - Resumes ${queue.estimatedResumeTime || 'soon'})`;
    }
    return `~${waitMin} min`;
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', color: '#64748b' }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid #e2e8f0',
          borderTop: '3px solid #2563eb',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ fontSize: '14px', fontWeight: 500 }}>Loading customer portal...</div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  if (businessExists === false) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '40px 32px', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 20px auto' }}>
            ⚠️
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            Business Not Found
          </h3>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, marginBottom: '24px' }}>
            The business ID in the URL does not exist or has no active queues. Please double check the QR code or link.
          </p>
          <Link href="/" style={{ display: 'inline-block', width: '100%', background: '#2563eb', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-shell">
      {activeStep === 'selection' && (
        <>
          <header className="portal-header">
            <div className="brand">
              {/* Removed duplicate logo to keep header clean and prevent double rendering */}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#64748b',
                border: '1px solid #e2e8f0',
                padding: '4px 8px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}>
                <span>EN</span>
                <span style={{ fontSize: '9px', opacity: 0.8 }}>▼</span>
              </div>
            </div>
          </header>
 
          <main style={{ flex: 1 }}>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px' }}>
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={logoUrl} 
                  alt={`${businessName || location.name} Logo`} 
                  style={{ 
                    maxHeight: '64px', 
                    width: 'auto', 
                    objectFit: 'contain',
                    marginBottom: '16px',
                    display: 'block',
                    marginLeft: 'auto',
                    marginRight: 'auto'
                  }} 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: 0 }}>
                Welcome to {businessName || location.name}
                <svg style={{ width: '18px', height: '18px', color: primaryColor }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" />
                </svg>
              </h1>
              <p style={{ color: '#64748b', fontSize: '14px', marginTop: '2px' }}>Please select a queue to join</p>
            </div>

            {/* Global Business Announcement Card */}
            {globalAnnouncementText && (
              <div style={{ padding: '8px 20px 0 20px' }}>
                <div className="info-alert" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#b45309', cursor: 'default' }}>
                  <div className="info-alert-content" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '16px', lineHeight: 1, marginTop: '2px' }}>📢</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>Announcement</div>
                      <div style={{ fontSize: '12px', marginTop: '2px', lineHeight: 1.4 }}>{globalAnnouncementText}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ padding: '16px 20px 0 20px', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🔍 No QR Code? Search Clinic or Enter Queue ID</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Enter clinic code or queue name..."
                    value={manualSearchQuery}
                    onChange={(e) => setManualSearchQuery(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', fontSize: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none' }}
                  />
                  {manualSearchQuery && (
                    <button
                      onClick={() => setManualSearchQuery('')}
                      style={{ background: '#f1f5f9', border: 'none', padding: '0 12px', minHeight: '44px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="card-grid">
              {Object.values(queues).filter(q => {
                if (!manualSearchQuery.trim()) return true;
                const query = manualSearchQuery.toLowerCase();
                return q.name.toLowerCase().includes(query) || q.id.toLowerCase().includes(query) || (q.role && q.role.toLowerCase().includes(query));
              }).map((queue) => {
                const isPaused = queue.status === 'paused';
                const isHalted = !!queue.isHalted;
                const isAppointmentEnabled = !!queue.isAppointmentEnabled;
                const totalWaiting = queue.entries.filter(e => e.status === 'waiting' || e.status === 'next').length;
                
                return (
                  <div key={queue.id} className={`queue-card ${isHalted ? 'halted' : isPaused ? 'paused' : ''}`}>
                    <div className="queue-card-header">
                      <div className="avatar-icon-wrapper">
                        <Users style={{ width: '22px', height: '22px' }} />
                      </div>
                      <div className="queue-title-info">
                        <div className="queue-name">
                          {queue.name}
                        </div>
                        {queue.role && <div className="queue-specialty">{queue.role}</div>}
                      </div>
                      {isHalted ? (
                        <span className="status-badge halted">
                          Halted
                        </span>
                      ) : isPaused ? (
                        <span className="status-badge paused">
                          Paused
                        </span>
                      ) : (
                        <span className="status-badge live">
                          Live
                        </span>
                      )}
                    </div>

                    {isHalted ? (
                      <div className="pause-banner" style={{ backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#b91c1c' }}>
                        <span style={{ fontSize: '18px', lineHeight: 1, marginRight: '4px' }}>⚠️</span>
                        <div>
                          <div className="pause-banner-title" style={{ color: '#991b1b', fontWeight: 700 }}>Walk-ins Halted</div>
                          <div>This queue has reached capacity and is not accepting new walk-ins at this time.</div>
                        </div>
                      </div>
                    ) : isPaused ? (
                      <div className="pause-banner">
                        <Pause style={{ width: '18px', height: '18px', color: '#ea580c', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <div className="pause-banner-title">Queue is currently paused</div>
                          <div>Estimated resume time: <strong>{queue.estimatedResumeTime || '15 minutes'}</strong></div>
                        </div>
                      </div>
                    ) : null}

                    <div className="queue-stats-row">
                      <div className="stat-item">
                        <div className="stat-num">{totalWaiting}</div>
                        <div className="stat-lbl">People waiting</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-num">~{isPaused || isHalted ? '--' : queue.averageWaitTimeMin * totalWaiting || '0'} min</div>
                        <div className="stat-lbl">Estimated wait</div>
                      </div>
                    </div>

                    <button 
                      className="btn-primary" 
                      disabled={isPaused || isHalted}
                      onClick={() => {
                        setSelectedQueueId(queue.id);
                        setActiveStep('join');
                      }}
                      style={{
                        backgroundColor: (isPaused || isHalted) ? undefined : primaryColor,
                        borderColor: (isPaused || isHalted) ? undefined : primaryColor
                      }}
                    >
                      Join Queue
                      <ChevronRight style={{ width: '16px', height: '16px' }} />
                    </button>

                    {isAppointmentEnabled && (
                      <button 
                        className="btn-appointment"
                        onClick={() => {
                          alert(`Booking appointment flow would open here for ${queue.name} (${queue.specialty}). (Optional slot booking)`);
                        }}
                      >
                        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Book Appointment
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Info Alert Box */}
            <div style={{ padding: '0 20px 20px 20px' }}>
              <div className="info-alert">
                <div className="info-alert-content">
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    backgroundColor: '#eff6ff', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#2563eb'
                  }}>
                    <Bell style={{ width: '16px', height: '16px' }} />
                  </div>
                  <div>
                    <div className="info-alert-text">Please remain nearby</div>
                    <div className="info-alert-subtext">You will be notified when your turn is close.</div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </>
      )}

      {/* 2. JOIN QUEUE FORM VIEW */}
      {activeStep === 'join' && activeSelectedQueue && (
        <>
          <header className="portal-header">
            <button className="back-link" onClick={() => {
              setActiveStep('selection');
              setHasIdentified(false);
              setIdentityPhone('');
              setVipAppointment(null);
            }}>
              <ArrowLeft style={{ width: '18px', height: '18px' }} />
              <span>Back</span>
            </button>
            <div className="brand">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={logoUrl} 
                  alt={businessName || location.name} 
                  style={{ 
                    maxHeight: '28px', 
                    width: 'auto', 
                    objectFit: 'contain'
                  }} 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                  {businessName || location.name}
                </span>
              )}
            </div>
          </header>

          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', padding: '0 20px 10px 20px' }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  style={{ 
                    maxHeight: '64px', 
                    width: 'auto', 
                    objectFit: 'contain',
                    margin: '0 auto 16px auto',
                    display: 'block'
                  }} 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div style={{ 
                  width: '64px', 
                  height: '64px', 
                  borderRadius: '50%', 
                  backgroundColor: '#eff6ff', 
                  color: primaryColor,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}>
                  <Users style={{ width: '32px', height: '32px' }} />
                </div>
              )}
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{activeSelectedQueue.name}</h2>
              {activeSelectedQueue.role && <p style={{ color: '#64748b', fontSize: '14px', marginTop: '2px' }}>{activeSelectedQueue.role}</p>}
            </div>

            {!hasIdentified ? (
              <form onSubmit={handleIdentify} className="form-container">
                <div className="queue-card" style={{ boxShadow: 'var(--shadow-md)', border: '1px solid #cbd5e1' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Identify Yourself</h3>
                  <p style={{ fontSize: '12.5px', color: '#4b5563', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                    Please verify your phone number to check if you have an active appointment for today.
                  </p>
                  
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Phone Number *</label>
                    <PhoneInput
                      value={identityPhone}
                      onChange={(val, isValid) => {
                        setIdentityPhone(val);
                        setIsIdentityPhoneValid(isValid);
                      }}
                      required={true}
                      disabled={isCheckingVip}
                    />
                    {!isIdentityPhoneValid && identityPhone && (
                      <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', marginBottom: 0 }}>
                        Please enter a valid phone number for the selected country.
                      </p>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={isCheckingVip || !identityPhone.trim() || !isIdentityPhoneValid}
                    style={{
                      backgroundColor: primaryColor,
                      borderColor: primaryColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: (isCheckingVip || !identityPhone.trim() || !isIdentityPhoneValid) ? 'default' : 'pointer'
                    }}
                  >
                    {isCheckingVip ? (
                      <>
                        <Loader2 className="animate-spin" style={{ width: '16px', height: '16px' }} />
                        <span>Searching...</span>
                      </>
                    ) : (
                      'Verify Details'
                    )}
                  </button>
                </div>
              </form>
            ) : vipAppointment ? (
              <form onSubmit={handleVipCheckin} className="form-container">
                <div className="queue-card" style={{ 
                  boxShadow: 'var(--shadow-md)', 
                  border: '2px solid #fbbf24', 
                  background: '#fffbeb',
                  borderRadius: '12px',
                  padding: '24px',
                  textAlign: 'center'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <div style={{ 
                      width: '48px', 
                      height: '48px', 
                      borderRadius: '50%', 
                      background: '#fef3c7', 
                      color: '#b45309', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: '20px'
                    }}>
                      ⭐
                    </div>
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#92400e', marginBottom: '8px', textAlign: 'center' }}>
                    VIP Fast-Pass
                  </h3>
                  
                  <p style={{ fontSize: '14px', color: '#b45309', lineHeight: 1.5, margin: '0 0 20px 0', textAlign: 'center', fontWeight: 500 }}>
                    Welcome back, <strong>{vipAppointment.customerName}</strong>! We found your appointment for <strong>{getServiceName(vipAppointment.serviceId)}</strong> at <strong>{formatTimeTo12Hour(vipAppointment.startTime)}</strong>.
                  </p>

                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={isSubmittingVip}
                    style={{
                      backgroundColor: '#d97706',
                      borderColor: '#d97706',
                      width: '100%',
                      padding: '14px',
                      fontSize: '15px',
                      fontWeight: 700,
                      borderRadius: '8px',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {isSubmittingVip ? (
                      <>
                        <Loader2 className="animate-spin" style={{ width: '16px', height: '16px' }} />
                        <span>Checking in...</span>
                      </>
                    ) : (
                      'Check In Now'
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setVipAppointment(null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#b45309',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginTop: '12px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      width: '100%',
                      textAlign: 'center'
                    }}
                  >
                    Join Walk-in Queue instead
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleJoin} className="form-container">
              <div className="queue-card" style={{ boxShadow: 'var(--shadow-md)', border: '1px solid #cbd5e1' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Join the Queue</h3>
                
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className="form-input-wrapper">
                    <User className="form-input-icon" />
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter your full name" 
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">
                    Phone Number {requirePhoneNumber ? <span style={{ color: '#ef4444' }}>*</span> : <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>}
                  </label>
                  <PhoneInput
                    value={phoneNumber}
                    onChange={(val, isValid) => {
                      setPhoneNumber(val);
                      setIsPhoneValid(isValid);
                    }}
                    required={requirePhoneNumber}
                    disabled={isSubmitting}
                  />
                  {!isPhoneValid && phoneNumber && (
                    <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', marginBottom: 0 }}>
                      Please enter a valid phone number for the selected country.
                    </p>
                  )}
                </div>

                <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 16px 0', lineHeight: 1.4 }}>
                  We'll notify you when your turn is near.
                </p>

                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: primaryColor,
                    borderColor: primaryColor
                  }}
                >
                  {isSubmitting ? 'Joining Queue...' : 'Join Queue'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', color: '#64748b', fontSize: '12px', marginTop: '10px' }}>
                <ShieldCheck style={{ width: '16px', height: '16px', color: '#10b981' }} />
                <span>Your details are secure and will only be used for queue management.</span>
              </div>
            </form>
            )}
          </main>
        </>
      )}

      {/* 3. LIVE TRACKING VIEW */}
      {activeStep === 'tracking' && trackedQueue && userEntry && (
        <>
          <header className="portal-header" style={{ paddingBottom: '8px' }}>
            <button className="back-link" onClick={() => {
              if (confirm('Go back to the selection screen? You will remain in the queue.')) {
                setActiveStep('selection');
              }
            }}>
              <ArrowLeft style={{ width: '18px', height: '18px' }} />
              <span>Selection</span>
            </button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{location.name}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{trackedQueue.name}</div>
            </div>
            <div style={{ width: '40px' }} /> {/* Spacer */}
          </header>

          {/* Queue-Specific Announcement Banner */}
          {trackedQueueData?.currentAnnouncement && (
            <div className="announcement-banner" style={{
              background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
              borderBottom: '1px solid #fed7aa',
              padding: '12px 20px',
              color: '#c2410c',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              fontSize: '13px',
              lineHeight: 1.4,
              fontWeight: 500
            }}>
              <Megaphone style={{ width: '16px', height: '16px', color: '#ea580c', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <strong style={{ color: '#9a3412', marginRight: '4px' }}>Announcement:</strong>
                {trackedQueueData.currentAnnouncement}
              </div>
            </div>
          )}
 
          <main className="tracker-container" style={{ flex: 1 }}>
            
            {/* Status Badges */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
              {trackedQueue.role && (
                <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  {trackedQueue.role}
                </span>
              )}
              {trackedQueue.isHalted ? (
                <span className="status-badge halted">
                  Halted
                </span>
              ) : trackedQueue.status === 'paused' ? (
                <span className="status-badge paused">
                  Paused
                </span>
              ) : (
                <span className="status-badge live">
                  Live
                </span>
              )}
            </div>

            {/* Halted Banner or Paused Banner */}
            {trackedQueue.isHalted ? (
              <div className="pause-banner" style={{ margin: '0', backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#b91c1c' }}>
                <span style={{ fontSize: '18px', lineHeight: 1, marginRight: '4px' }}>⚠️</span>
                <div>
                  <div className="pause-banner-title" style={{ color: '#991b1b', fontWeight: 700 }}>Walk-ins Halted</div>
                  <div>This queue has reached capacity and is not accepting new walk-ins at this time. You will still be served!</div>
                </div>
              </div>
            ) : trackedQueue.status === 'paused' ? (
              <div className="pause-banner" style={{ margin: '0' }}>
                <Pause style={{ width: '18px', height: '18px', color: '#ea580c', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div className="pause-banner-title">Queue is currently paused</div>
                  <div>Estimated resume time: <strong>{trackedQueue.estimatedResumeTime || '15 minutes'}</strong>. Please stay in line.</div>
                </div>
              </div>
            ) : null}

            {/* Serving Banner */}
            <div className="serving-banner">
              <div className="serving-lbl">Currently Serving</div>
              
              {/* Token Number */}
              {trackedQueue.entries.some(e => e.status === 'serving') ? (
                (() => {
                  const serving = trackedQueue.entries.find(e => e.status === 'serving');
                  return (
                    <>
                      <div className="serving-token">#{serving?.tokenNumber}</div>
                      <div className="serving-name">{serving?.customerName}</div>
                    </>
                  );
                })()
              ) : (
                <>
                  <div className="serving-token" style={{ color: '#94a3b8' }}>--</div>
                  <div className="serving-name" style={{ color: '#94a3b8', fontWeight: 400 }}>No one is currently active</div>
                </>
              )}

              {/* Progress Timeline */}
              <div className="timeline-container">
                <div className="timeline-line">
                  {/* Fill timeline bar up to currently serving */}
                  <div 
                    className="timeline-line-fill" 
                    style={{ width: '40%' }}
                  />
                </div>
                
                {(() => {
                  const serving = trackedQueue.entries.find(e => e.status === 'serving');
                  const servingToken = serving ? serving.tokenNumber : 1;
                  // Show 6 nodes representing timeline progression around current serving
                  const startToken = Math.max(1, servingToken - 2);
                  const timelineTokens = Array.from({ length: 5 }, (_, i) => startToken + i);
                  
                  return timelineTokens.map((tok, idx) => {
                    let nodeClass = '';
                    if (tok < servingToken) {
                      nodeClass = 'passed';
                    } else if (tok === servingToken) {
                      nodeClass = 'active';
                    }
                    
                    return (
                      <div key={idx} className={`timeline-node ${nodeClass}`}>
                        <span className="timeline-lbl" style={{ left: idx === 0 ? '-4px' : idx === 4 ? '-14px' : '-6px' }}>{tok}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Your Token Badge */}
            <div className="user-token-card">
              <div className="user-token-lbl">Your Token</div>
              <div className="user-token-num">#{userEntry.tokenNumber}</div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                {userEntry.customerName}
              </div>
            </div>

            {/* Stats grid */}
            {(() => {
              const peopleAhead = trackedQueue.entries.filter(
                (e) => (e.status === 'waiting' || e.status === 'next') && e.tokenNumber < userEntry.tokenNumber
              ).length;
              
              return (
                <div className="quick-stats-grid">
                  <div className="quick-stat-card">
                    <div className="quick-stat-icon-wrapper blue">
                      <Users style={{ width: '20px', height: '20px' }} />
                    </div>
                    <div className="quick-stat-info">
                      <span className="quick-stat-title">People Ahead</span>
                      <span className="quick-stat-val">{userEntry.status === 'serving' ? '0' : peopleAhead} {peopleAhead === 1 ? 'person' : 'people'}</span>
                    </div>
                  </div>

                  <div className="quick-stat-card">
                    <div className="quick-stat-icon-wrapper green">
                      <Clock style={{ width: '20px', height: '20px' }} />
                    </div>
                    <div className="quick-stat-info">
                      <span className="quick-stat-title">Est. Wait</span>
                      <span className="quick-stat-val">
                        {trackedQueue.status === 'paused' ? 'Paused' : getEstimatedWait(trackedQueue, userEntry)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Informational Bell */}
            <div className="info-alert" style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
              <div className="info-alert-content">
                <Bell className="info-alert-icon" style={{ color: '#0284c7' }} />
                <div>
                  <div className="info-alert-text" style={{ color: '#0369a1' }}>You will be notified when your turn is near</div>
                  <div className="info-alert-subtext" style={{ color: '#075985' }}>Please keep this page open in your browser.</div>
                </div>
              </div>
            </div>

            {/* Leave Queue button */}
            <button className="btn-secondary" onClick={handleLeave}>
              <LogOut style={{ width: '16px', height: '16px' }} />
              Leave Queue
            </button>

          </main>

          <footer className="tracker-footer">
            <span>Queue ID: <strong>{trackedQueue.id.toUpperCase()}{userEntry.tokenNumber}</strong></span>
            <span>•</span>
            <span>Joined at {joinedAtTime}</span>
            <span>•</span>
            <RefreshCw style={{ width: '12px', height: '12px', cursor: 'pointer', animation: 'spin 4s linear infinite' }} />
          </footer>
        </>
      )}

      {/* DEVELOPER SIMULATOR BAR */}
      {queues['dr-john'] && queues['dr-sarah'] && (
        <div className="demo-console">
          <div className="demo-console-header">
            <span>Real-time DB Simulator (Staff Actions)</span>
            <span className="demo-console-pill">Zustand Mock Sync</span>
          </div>
          
          <div className="demo-console-row">
            {/* Dr. John Control */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>Dr. John (QJ1024)</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button 
                  className={`demo-btn ${queues['dr-john']?.status === 'paused' ? 'active-pause' : ''}`}
                  onClick={() => {
                    if (queues['dr-john']?.status === 'paused') {
                      resumeQueue('dr-john');
                    } else {
                      pauseQueue('dr-john', '15 mins');
                    }
                  }}
                >
                  {queues['dr-john']?.status === 'paused' ? <Play style={{ width: '12px', height: '12px' }} /> : <Pause style={{ width: '12px', height: '12px' }} />}
                  {queues['dr-john']?.status === 'paused' ? 'Resume' : 'Pause'}
                </button>
                <button className="demo-btn" onClick={() => nextCustomer('dr-john')}>
                  Next Token
                </button>
                <button 
                  className={`demo-btn ${queues['dr-john']?.isHalted ? 'active-pause' : ''}`}
                  onClick={() => toggleHaltQueue('dr-john')}
                  style={queues['dr-john']?.isHalted ? { backgroundColor: '#ef4444', borderColor: '#ef4444' } : {}}
                >
                  {queues['dr-john']?.isHalted ? 'Resume Walk' : 'Halt Walk'}
                </button>
              </div>
            </div>

            {/* Dr. Sarah Control */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>Dr. Sarah (QS5082)</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button 
                  className={`demo-btn ${queues['dr-sarah']?.status === 'paused' ? 'active-pause' : ''}`}
                  onClick={() => {
                    if (queues['dr-sarah']?.status === 'paused') {
                      resumeQueue('dr-sarah');
                    } else {
                      pauseQueue('dr-sarah', '2:30 PM');
                    }
                  }}
                >
                  {queues['dr-sarah']?.status === 'paused' ? <Play style={{ width: '12px', height: '12px' }} /> : <Pause style={{ width: '12px', height: '12px' }} />}
                  {queues['dr-sarah']?.status === 'paused' ? 'Resume' : 'Pause'}
                </button>
                <button className="demo-btn" onClick={() => nextCustomer('dr-sarah')}>
                  Next Token
                </button>
                <button 
                  className={`demo-btn ${queues['dr-sarah']?.isHalted ? 'active-pause' : ''}`}
                  onClick={() => toggleHaltQueue('dr-sarah')}
                  style={queues['dr-sarah']?.isHalted ? { backgroundColor: '#ef4444', borderColor: '#ef4444' } : {}}
                >
                  {queues['dr-sarah']?.isHalted ? 'Resume Walk' : 'Halt Walk'}
                </button>
              </div>
            </div>
          </div>

          {/* Appointment Option Toggles for Demo */}
          <div className="demo-console-row" style={{ borderTop: '1px solid #334155', paddingTop: '8px', marginTop: '4px', justifyContent: 'space-between', fontSize: '11px', display: 'flex', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#94a3b8' }}>
              <input 
                type="checkbox" 
                checked={!!queues['dr-john']?.isAppointmentEnabled} 
                onChange={() => {
                  const q = queues['dr-john'];
                  if (q) {
                    useQueueStore.getState().updateQueue(
                      'dr-john', 
                      q.name, 
                      q.specialty, 
                      q.averageWaitTimeMin, 
                      !q.isAppointmentEnabled, 
                      q.isHalted
                    );
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
              <span>Enable John Appointments</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#94a3b8' }}>
              <input 
                type="checkbox" 
                checked={!!queues['dr-sarah']?.isAppointmentEnabled} 
                onChange={() => {
                  const q = queues['dr-sarah'];
                  if (q) {
                    useQueueStore.getState().updateQueue(
                      'dr-sarah', 
                      q.name, 
                      q.specialty, 
                      q.averageWaitTimeMin, 
                      !q.isAppointmentEnabled, 
                      q.isHalted
                    );
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
              <span>Enable Sarah Appointments</span>
            </label>
          </div>
        </div>
      )}
      
      {/* Business Address & Contact Info Footer */}
      {(businessAddress || publicPhone || publicEmail) && (
        <div style={{
          width: '100%',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          textAlign: 'left',
          gap: '12px',
          boxSizing: 'border-box',
          marginTop: '40px'
        }}>
          {businessAddress && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563', fontSize: '14px' }}>
              <Building style={{ width: '16px', height: '16px', color: '#4b5563', flexShrink: 0 }} />
              <span>{businessAddress}</span>
            </div>
          )}
          {publicPhone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563', fontSize: '14px' }}>
              <Phone style={{ width: '16px', height: '16px', color: '#4b5563', flexShrink: 0 }} />
              <span>{publicPhone}</span>
            </div>
          )}
          {publicEmail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563', fontSize: '14px' }}>
              <Mail style={{ width: '16px', height: '16px', color: '#4b5563', flexShrink: 0 }} />
              <span>{publicEmail}</span>
            </div>
          )}
        </div>
      )}

      {/* Spacer to make sure content is not covered by fixed simulator & watermark */}
      <div style={{ height: '130px', flexShrink: 0 }} />

      {/* Powered by QueueTag Watermark Footer */}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '440px',
        height: '36px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
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
      {showOtpModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '400px', width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📱</div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Verify Your Mobile</h3>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, marginBottom: '16px' }}>
              We sent a 6-digit verification code to <strong>{pendingJoinArgs?.phone}</strong>.
            </p>
            {simulatedOtpHint && (
              <div style={{ background: '#fef9c3', border: '1px solid #fde047', color: '#854d0e', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>
                💡 Dev Mode Hint: Your code is {simulatedOtpHint}
              </div>
            )}
            <input
              type="text"
              maxLength={6}
              placeholder="Enter 6-digit code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              style={{
                width: '100%', padding: '12px', fontSize: '18px', textAlign: 'center', letterSpacing: '0.2em',
                border: '2px solid #cbd5e1', borderRadius: '8px', marginBottom: '16px', outline: 'none', boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => { setShowOtpModal(false); setOtpCode(''); setSimulatedOtpHint(null); }}
                style={{ flex: 1, padding: '12px', minHeight: '44px', background: '#f1f5f9', color: '#475569', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isVerifyingOtp || otpCode.length < 4}
                onClick={async () => {
                  if (!pendingJoinArgs) return;
                  setIsVerifyingOtp(true);
                  try {
                    const res = await fetch('/api/otp/verify', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ phone: pendingJoinArgs.phone, code: otpCode })
                    });
                    const data = await res.json();
                    if (data.success) {
                      localStorage.setItem(`verified_phone_${pendingJoinArgs.phone}`, 'true');
                      setShowOtpModal(false);
                      setOtpCode('');
                      setSimulatedOtpHint(null);
                      setIsSubmitting(true);
                      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      setJoinedAtTime(timeStr);
                      await joinQueue(pendingJoinArgs.queueId, pendingJoinArgs.name, pendingJoinArgs.phone);
                      setActiveStep('tracking');
                      setIsJoined(true);
                    } else {
                      alert(data.error || 'Invalid OTP code');
                    }
                  } catch (err) {
                    console.error('OTP verify error:', err);
                    alert('Verification failed. Please try again.');
                  } finally {
                    setIsVerifyingOtp(false);
                    setIsSubmitting(false);
                  }
                }}
                style={{ flex: 1, padding: '12px', minHeight: '44px', background: primaryColor, color: 'white', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                {isVerifyingOtp ? 'Verifying...' : 'Verify & Join'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
