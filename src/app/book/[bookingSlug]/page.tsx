'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, 
  Clock, 
  User, 
  Building, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  Phone
} from 'lucide-react';
import Link from 'next/link';
import PhoneInput from '@/components/PhoneInput';

interface PageProps {
  params: Promise<{ bookingSlug: string }>;
}

const addMinutesToTime = (time: string, minutes: number) => {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const finalH = Math.floor(total / 60).toString().padStart(2, '0');
  const finalM = (total % 60).toString().padStart(2, '0');
  return `${finalH}:${finalM}`;
};

export default function CustomerBookingPage({ params }: PageProps) {
  const { bookingSlug } = use(params);
  const router = useRouter();

  // Workspace state
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exists, setExists] = useState<boolean | null>(null);

  // Booking Flow Steps: 'service' | 'date' | 'time' | 'details' | 'confirmed'
  const [step, setStep] = useState<'service' | 'date' | 'time' | 'details' | 'confirmed'>('service');

  // Form states
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(true);

  // Availability state
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query workspace from bookingSlug
  useEffect(() => {
    if (!bookingSlug) return;

    async function fetchWorkspace() {
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('booking_slug', bookingSlug)
          .maybeSingle();

        if (error || !data) {
          setExists(false);
        } else {
          setWorkspaceId(data.id);
          // Normalize snake_case → camelCase for template compatibility
          setWorkspace({
            ...data,
            businessName: data.name,
            primaryColor: data.primary_color,
            appointmentsEnabled: data.appointments_enabled,
            operatingHours: data.operating_hours,
            services: data.services,
          });
          setExists(true);
        }
      } catch (err) {
        console.error('Error fetching booking workspace:', err);
        setExists(false);
      } finally {
        setIsLoading(false);
      }
    }

    fetchWorkspace();
  }, [bookingSlug]);

  // Fetch available slots once date and service are selected
  useEffect(() => {
    if (!workspaceId || !selectedDate || !selectedService) return;

    async function fetchSlots() {
      setIsLoadingSlots(true);
      setAvailableSlots([]);
      setSelectedTime(''); // Reset selection

      try {
        const res = await fetch(
          `/api/appointments/availability?workspaceId=${workspaceId}&date=${selectedDate}&serviceId=${selectedService.id}`
        );
        const data = await res.json();
        if (res.ok && data.slots) {
          setAvailableSlots(data.slots);
        } else {
          console.error('Failed to load slots:', data.error);
        }
      } catch (err) {
        console.error('Error calling availability API:', err);
      } finally {
        setIsLoadingSlots(false);
      }
    }

    fetchSlots();
  }, [workspaceId, selectedDate, selectedService]);

  const brandColor = workspace?.primaryColor || '#2563eb';
  const todayStr = new Date().toISOString().split('T')[0];

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !selectedService || !selectedDate || !selectedTime || !fullName.trim()) return;

    if (!phoneNumber.trim() || !isPhoneValid) {
      alert('Please enter a valid phone number to book.');
      return;
    }

    setIsSubmitting(true);

    try {
      const duration = Number(selectedService.durationMinutes) || 30;
      const endTime = addMinutesToTime(selectedTime, duration);

      const { error } = await supabase.from('appointments').insert({
        workspace_id: workspaceId,
        customer_id: `guest-${Math.random().toString(36).substring(2, 9)}`,
        date: selectedDate,
        start_time: selectedTime,
        end_time: endTime,
        status: 'scheduled',
        customer_name: fullName.trim(),
        customer_phone: phoneNumber,
      });
      if (error) throw error;

      setStep('confirmed');
    } catch (err) {
      console.error('Error creating appointment:', err);
      alert('Failed to submit booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. LOADING SCREEN
  if (isLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px', flexDirection: 'column', gap: '12px' }}>
        <Loader2 className="animate-spin" style={{ width: '32px', height: '32px', color: '#2563eb' }} />
        <span>Loading booking engine...</span>
      </div>
    );
  }

  // 2. ERROR SCREEN (SLUG NOT FOUND OR DISABLED)
  if (!exists || !workspace || !workspace.appointmentsEnabled) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '440px', width: '100%', padding: '40px 32px', background: 'white', border: '1px solid #fee2e2', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle style={{ width: '28px', height: '28px' }} />
            </div>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#991b1b', margin: '0 0 8px 0' }}>Booking Unavailable</h2>
          <p style={{ color: '#7f1d1d', fontSize: '13.5px', lineHeight: 1.5, margin: 0 }}>
            This business booking portal is currently closed or has not activated remote appointments scheduling. Please check back later.
          </p>
          <div style={{ marginTop: '24px', borderTop: '1px solid #fee2e2', paddingTop: '20px' }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', color: '#64748b', background: 'white', textDecoration: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
              Return to Gateway
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
      
      {/* BRANDING HEADER */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '32px', textAlign: 'center' }}>
        {workspace.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={workspace.logoUrl} 
            alt={workspace.businessName} 
            style={{ height: '50px', maxWidth: '180px', objectFit: 'contain', marginBottom: '8px' }} 
          />
        ) : (
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${brandColor}10`, color: brandColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
            <Building style={{ width: '24px', height: '24px' }} />
          </div>
        )}
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          {workspace.businessName}
        </h1>
        <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
          Reserve your booking slot online
        </p>
      </div>

      {/* WIZARD CONTAINER */}
      <div style={{ maxWidth: '480px', width: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        
        {step !== 'confirmed' && (
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', background: '#f8fafc', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Step {step === 'service' ? '1' : step === 'date' ? '2' : step === 'time' ? '3' : '4'} of 4</span>
            <span style={{ color: brandColor }}>
              {step === 'service' ? 'Select Service' : step === 'date' ? 'Choose Date' : step === 'time' ? 'Select Slot' : 'Your Details'}
            </span>
          </div>
        )}

        <div style={{ padding: '28px' }}>

          {/* STEP 1: SELECT SERVICE */}
          {step === 'service' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Choose a Queue</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {workspace.services && workspace.services.length > 0 ? (
                  workspace.services.map((service: any) => (
                    <div 
                      key={service.id} 
                      onClick={() => {
                        setSelectedService(service);
                        setStep('date');
                      }}
                      style={{
                        border: selectedService?.id === service.id ? `2px solid ${brandColor}` : '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '16px',
                        cursor: 'pointer',
                        background: selectedService?.id === service.id ? `${brandColor}05` : 'white',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{service.queueName || service.name}</div>
                        <div style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock style={{ width: '12px', height: '12px' }} />
                          <span>{service.durationMinutes} mins</span>
                        </div>
                        {service.description && (
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', lineHeight: 1.4 }}>{service.description}</div>
                        )}
                      </div>
                      <ChevronRight style={{ width: '18px', height: '18px', color: '#94a3b8' }} />
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>
                    No services configured.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: SELECT DATE */}
          {step === 'date' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                <Calendar style={{ width: '18px', height: '18px', color: brandColor }} />
                <span>Select Appointment Date</span>
              </div>

              <div className="form-group">
                <input 
                  type="date" 
                  min={todayStr}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setStep('service')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  <ChevronLeft style={{ width: '16px', height: '16px' }} />
                  <span>Back</span>
                </button>
                <button 
                  type="button" 
                  disabled={!selectedDate}
                  onClick={() => setStep('time')}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    background: selectedDate ? brandColor : '#cbd5e1', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '8px', 
                    cursor: selectedDate ? 'pointer' : 'not-allowed', 
                    fontSize: '13px', 
                    fontWeight: 600 
                  }}
                >
                  <span>Next</span>
                  <ChevronRight style={{ width: '16px', height: '16px' }} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SELECT TIME */}
          {step === 'time' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                <Clock style={{ width: '18px', height: '18px', color: brandColor }} />
                <span>Select Available Time Slot</span>
              </div>

              {isLoadingSlots ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '120px', flexDirection: 'column', gap: '8px', color: '#64748b', fontSize: '12.5px' }}>
                  <Loader2 className="animate-spin" style={{ width: '24px', height: '24px', color: brandColor }} />
                  <span>Calculating real-time slots...</span>
                </div>
              ) : (
                <>
                  {availableSlots.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          style={{
                            padding: '10px 6px',
                            border: selectedTime === slot ? `2px solid ${brandColor}` : '1px solid #cbd5e1',
                            borderRadius: '8px',
                            background: selectedTime === slot ? `${brandColor}10` : 'white',
                            color: selectedTime === slot ? brandColor : '#334155',
                            fontWeight: selectedTime === slot ? 700 : 500,
                            fontSize: '13px',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#94a3b8', fontSize: '12.5px', lineHeight: 1.4 }}>
                      No available booking slots on this date. The business might be closed, fully booked, or on a break. Please select a different date.
                    </div>
                  )}
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setStep('date')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  <ChevronLeft style={{ width: '16px', height: '16px' }} />
                  <span>Back</span>
                </button>
                <button 
                  type="button" 
                  disabled={!selectedTime}
                  onClick={() => setStep('details')}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    background: selectedTime ? brandColor : '#cbd5e1', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '8px', 
                    cursor: selectedTime ? 'pointer' : 'not-allowed', 
                    fontSize: '13px', 
                    fontWeight: 600 
                  }}
                >
                  <span>Next</span>
                  <ChevronRight style={{ width: '16px', height: '16px' }} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: CUSTOMER DETAILS */}
          {step === 'details' && (
            <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                <User style={{ width: '18px', height: '18px', color: brandColor }} />
                <span>Verify Your Contact Details</span>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px' }}>Your Full Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="form-input"
                  style={{ borderRadius: '8px', fontSize: '13.5px' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px' }}>Phone Number *</label>
                <PhoneInput 
                  value={phoneNumber}
                  onChange={(val, isValid) => {
                    setPhoneNumber(val);
                    setIsPhoneValid(isValid);
                  }}
                  required={true}
                  disabled={isSubmitting}
                />
                {!isPhoneValid && phoneNumber && (
                  <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', marginBottom: 0 }}>
                    Please enter a valid phone number for the selected country.
                  </p>
                )}
              </div>

              {/* Booking Summary Box */}
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <div><strong>Queue:</strong> <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedService?.queueName || selectedService?.name}</span></div>
                <div><strong>Date:</strong> <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedDate}</span></div>
                <div><strong>Time slot:</strong> <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedTime}</span></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setStep('time')}
                  disabled={isSubmitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  <ChevronLeft style={{ width: '16px', height: '16px' }} />
                  <span>Back</span>
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !fullName.trim() || !phoneNumber.trim() || !isPhoneValid}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    background: (fullName.trim() && phoneNumber.trim() && isPhoneValid && !isSubmitting) ? brandColor : '#cbd5e1', 
                    color: 'white', 
                    border: 'none', 
                    padding: '10px 20px', 
                    borderRadius: '8px', 
                    cursor: (fullName.trim() && phoneNumber.trim() && isPhoneValid && !isSubmitting) ? 'pointer' : 'not-allowed', 
                    fontSize: '13px', 
                    fontWeight: 700 
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" style={{ width: '14px', height: '14px' }} />
                      <span>Booking...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle style={{ width: '14px', height: '14px' }} />
                      <span>Confirm Appointment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 5: CONFIRMATION SUCCESS */}
          {step === 'confirmed' && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle style={{ width: '36px', height: '36px' }} />
                </div>
              </div>
              
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#065f46', margin: '0 0 6px 0' }}>Booking Confirmed!</h2>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: 700 }}>
                  <Sparkles style={{ width: '11px', height: '11px' }} />
                  <span>VIP Fast-Pass Reserved</span>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                Your appointment is successfully scheduled. Below is your booking summary:
              </p>

              {/* Confirmation Details Card */}
              <div style={{ width: '100%', background: '#fafafa', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', boxSizing: 'border-box' }}>
                <div><strong>Queue:</strong> <span style={{ color: '#0f172a', fontWeight: 700 }}>{selectedService?.queueName || selectedService?.name}</span></div>
                <div><strong>Date:</strong> <span style={{ color: '#0f172a', fontWeight: 700 }}>{selectedDate}</span></div>
                <div><strong>Time:</strong> <span style={{ color: '#0f172a', fontWeight: 700 }}>{selectedTime}</span></div>
                <div><strong>Guest Name:</strong> <span style={{ color: '#0f172a', fontWeight: 700 }}>{fullName}</span></div>
              </div>

              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', color: '#92400e', padding: '14px', borderRadius: '8px', fontSize: '12px', lineHeight: 1.5, fontWeight: 500, textAlign: 'left' }}>
                📢 <strong>Important Instructions:</strong> On the day of your appointment, please scan the QR code at the front desk to check in. You may arrive anytime before your scheduled slot; checking in 5 minutes early is sufficient.
              </div>

              <div style={{ marginTop: '8px', width: '100%', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <Link 
                  href="/" 
                  style={{ 
                    display: 'flex', 
                    width: '100%', 
                    boxSizing: 'border-box', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: '6px', 
                    background: brandColor, 
                    color: 'white', 
                    textDecoration: 'none', 
                    padding: '11px', 
                    borderRadius: '8px', 
                    fontSize: '13px', 
                    fontWeight: 700 
                  }}
                >
                  Return to Gateway
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
