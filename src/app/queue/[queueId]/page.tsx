'use client';

import { use, useState, useEffect } from 'react';
import { useQueueStore } from '@/store/queueStore';
import { User, Clock, Users, ArrowLeft, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { Queue } from '@/types';
import { supabase } from '@/lib/supabase';

interface PageProps {
  params: Promise<{ queueId: string }>;
}

export default function CustomerPublicQueuePage({ params }: PageProps) {
  const { queueId } = use(params);
  const [isMounted, setIsMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [simulatedOtpHint, setSimulatedOtpHint] = useState<string | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string>('');

  // Zustand Store
  const queues = useQueueStore((state) => state.queues);
  const currentCustomerId = useQueueStore((state) => state.currentCustomerId);
  const joinQueue = useQueueStore((state) => state.joinQueue);

  // Real-time synchronization trigger specifically for this queueId
  useEffect(() => {
    setIsMounted(true);

    const fetchQueue = async () => {
      try {
        const { data, error } = await supabase
          .from('queues')
          .select('*')
          .eq('id', queueId)
          .maybeSingle();

        if (error || !data) return;

        const queueObj = {
          id: data.id,
          locationId: data.business_id || '',
          businessId: data.business_id || '',
          name: data.name || '',
          specialty: data.specialty || '',
          role: data.role || '',
          status: data.status || 'live',
          averageWaitTimeMin: data.average_wait_time_min || 15,
          totalServedToday: data.total_served_today || 0,
          isAppointmentEnabled: data.is_appointment_enabled || false,
          isHalted: data.is_halted || false,
          entries: data.entries || [],
          currentToken: data.current_token || 0,
          waitingCount: data.waiting_count || 0,
          workingHours: data.working_hours || '9:00 AM - 6:00 PM',
          currentAnnouncement: data.current_announcement || '',
        } as Queue;

        useQueueStore.setState((state) => ({
          queues: {
            ...state.queues,
            [queueId]: queueObj,
          },
        }));
      } catch (err) {
        console.error('Error fetching queueId:', err);
      }
    };

    fetchQueue();

    const channel = supabase
      .channel(`public-queue:${queueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues',
          filter: `id=eq.${queueId}` }, fetchQueue)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queueId]);

  const queue = queues[queueId];
  
  // Resolve check-in status from queue entries
  const userEntry = queue?.entries.find(e => e.id === currentCustomerId);
  const isJoined = !!userEntry;

  // White-Label Branding State
  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [requirePhoneNumber, setRequirePhoneNumber] = useState(false);

  // Subscribe to business settings in real-time
  useEffect(() => {
    if (!queue?.businessId) return;

    const fetchBusiness = async () => {
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('name, logo_url, primary_color, require_phone_number')
          .eq('id', queue.businessId)
          .maybeSingle();

        if (error || !data) return;
        setBusinessName(data.name || '');
        setLogoUrl(data.logo_url || '');
        setPrimaryColor(data.primary_color || '#2563eb');
        setRequirePhoneNumber(data.require_phone_number || false);
      } catch (e) {
        console.error('Error syncing business settings:', e);
      }
    };

    fetchBusiness();

    const channel = supabase
      .channel(`public-queue-biz:${queue.businessId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'businesses',
          filter: `id=eq.${queue.businessId}` }, fetchBusiness)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queue?.businessId]);

  // Prevent initial render hydration warning mismatch
  if (!isMounted) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>
        Loading Portal...
      </div>
    );
  }

  if (!queue) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Queue Not Found</h2>
        <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '320px', lineHeight: 1.5 }}>
          The requested check-in counter or room does not exist or has been deleted.
        </p>
        <Link href="/" style={{ color: '#2563eb', fontSize: '14px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft style={{ width: '16px', height: '16px' }} />
          <span>Return Home</span>
        </Link>
      </div>
    );
  }

  const handleJoin = async () => {
    if (isJoined || isSubmitting || queue.isHalted) return;

    let phone: string | undefined = undefined;
    if (requirePhoneNumber) {
      const enteredPhone = window.prompt("A phone number is required to join this queue. Please enter your phone number:");
      if (enteredPhone === null) {
        return; // User cancelled
      }
      if (!enteredPhone.trim()) {
        alert("You must provide a phone number to join the queue.");
        return;
      }
      phone = enteredPhone.trim();
    } else {
      const enteredPhone = window.prompt("Enter your mobile number for SMS notifications (Optional, press OK or Cancel to skip):");
      if (enteredPhone && enteredPhone.trim()) {
        phone = enteredPhone.trim();
      }
    }

    if (phone) {
      const isVerified = localStorage.getItem(`verified_phone_${phone}`) === 'true';
      if (!isVerified) {
        setPendingPhone(phone);
        setShowOtpModal(true);
        try {
          const res = await fetch('/api/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
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
      await joinQueue(queueId, 'Walk-in Customer', phone);
    } catch (e) {
      console.error('Failed to join queue:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'var(--font-sans)',
      color: '#0f172a',
      position: 'relative'
    }}>
      {/* Mobile Shell Wrapper */}
      <div style={{
        maxWidth: '480px',
        width: '100%',
        margin: '0 auto',
        background: 'white',
        minHeight: '100vh',
        boxShadow: '0 0 40px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid #f1f5f9',
        borderRight: '1px solid #f1f5f9',
        position: 'relative',
        paddingBottom: '36px'
      }}>
        {/* Header */}
        <header style={{
          padding: '24px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={logoUrl} 
              alt="Logo" 
              style={{ 
                height: '48px', 
                width: 'auto', 
                objectFit: 'contain'
              }} 
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#eff6ff',
              color: primaryColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>
              <Users style={{ width: '22px', height: '22px' }} />
            </div>
          )}
          <div>
            {businessName && (
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', lineHeight: 1.2 }}>
                {businessName}
              </div>
            )}
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {queue.name}
            </h1>
            {queue.role && (
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0', fontWeight: 500 }}>
                {queue.role}
              </p>
            )}
          </div>

          <span style={{
            marginLeft: 'auto',
            padding: '4px 10px',
            borderRadius: '100px',
            fontSize: '11px',
            fontWeight: 700,
            background: queue.isHalted ? '#fef2f2' : '#ecfdf5',
            color: queue.isHalted ? '#ef4444' : '#10b981',
          }}>
            {queue.isHalted ? 'Halted' : 'Open'}
          </span>
        </header>

        {/* Announcement Alert Banner */}
        {queue.currentAnnouncement && (
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
              {queue.currentAnnouncement}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main style={{ flex: 1, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {queue.isHalted ? (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '12px',
              padding: '16px',
              color: '#991b1b',
              fontSize: '13px',
              lineHeight: 1.5,
              fontWeight: 500
            }}>
              ⚠️ <strong>Notice:</strong> This queue has reached capacity and is not accepting new walk-ins at this time.
            </div>
          ) : queue.status === 'paused' ? (
            <div style={{
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              borderRadius: '12px',
              padding: '16px',
              color: '#9a3412',
              fontSize: '13px',
              lineHeight: 1.5,
              fontWeight: 500
            }}>
              ⏸️ <strong>Queue Paused:</strong> This queue is temporarily paused. Estimated resume time: <strong>{queue.estimatedResumeTime || 'soon'}</strong>. Please stay in line!
            </div>
          ) : null}

          {/* Metrics Panel */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '16px',
          }}>
            {/* Metric 1 */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Currently Serving
              </div>
              <div style={{ fontSize: '54px', fontWeight: 900, color: '#2563eb', margin: '12px 0 4px 0' }}>
                {queue.currentToken === 0 || !queue.currentToken ? '--' : `#${queue.currentToken}`}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                Estimated wait time: ~{queue.averageWaitTimeMin} mins per client
              </div>
            </div>

            {/* Metric 2 */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                People Ahead of You
              </div>
              <div style={{ fontSize: '54px', fontWeight: 900, color: '#0f172a', margin: '12px 0 4px 0' }}>
                {queue.waitingCount}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                Customers currently waiting in line
              </div>
            </div>
          </div>

          {/* Quick info banner */}
          <div style={{
            background: '#eff6ff',
            border: '1px solid #dbeafe',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '12px',
            color: '#1e40af',
            lineHeight: 1.5,
            fontWeight: 500
          }}>
            ℹ️ Scan at the counter upon arrival. Once joined, please remain nearby and check this page for updates on your turn.
          </div>

        </main>

        {/* Massive Bottom-Anchored Join Line Button */}
        <div style={{
          padding: '24px',
          borderTop: '1px solid #f1f5f9',
          background: 'white',
          position: 'sticky',
          bottom: '36px',
          zIndex: 50
        }}>
          <button
            onClick={handleJoin}
            disabled={isJoined || isSubmitting || queue.isHalted}
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '16px',
              fontWeight: 700,
              borderRadius: '12px',
              border: 'none',
              background: isJoined ? '#10b981' : primaryColor,
              color: 'white',
              cursor: (isJoined || queue.isHalted) ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: `0 4px 12px ${primaryColor}26`,
              opacity: (isSubmitting || queue.isHalted) ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
            className="btn-join-line"
          >
            {isSubmitting ? (
              <span>Joining Line...</span>
            ) : isJoined ? (
              <span>✓ You are in line! (Token #{userEntry?.tokenNumber})</span>
            ) : (
              <span>Join Line</span>
            )}
          </button>
        </div>

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
              We sent a 6-digit verification code to <strong>{pendingPhone}</strong>.
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
                  setIsVerifyingOtp(true);
                  try {
                    const res = await fetch('/api/otp/verify', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ phone: pendingPhone, code: otpCode })
                    });
                    const data = await res.json();
                    if (data.success) {
                      localStorage.setItem(`verified_phone_${pendingPhone}`, 'true');
                      setShowOtpModal(false);
                      setOtpCode('');
                      setSimulatedOtpHint(null);
                      setIsSubmitting(true);
                      await joinQueue(queueId, 'Walk-in Customer', pendingPhone);
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
