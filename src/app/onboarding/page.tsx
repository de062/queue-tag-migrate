'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueueStore } from '@/store/queueStore';
import { 
  Building2, 
  MapPin, 
  Clock, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  Stethoscope,
  Smile,
  ShieldCheck,
  Briefcase
} from 'lucide-react';
import Link from 'next/link';

interface QueueInput {
  name: string;
  specialty: string;
  averageWaitTimeMin: number;
}

export default function OnboardingWizardPage() {
  const router = useRouter();
  const createBusinessWorkspace = useQueueStore((state) => state.createBusinessWorkspace);

  // Step state: 1, 2, 3
  const [step, setStep] = useState(1);

  // Step 1: Business Profile state
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('Clinic');
  const [businessAddress, setBusinessAddress] = useState('');
  const [timezone, setTimezone] = useState('(GMT+05:30) Asia/Kolkata');

  // Step 2: Create Queues state
  const [queuesList, setQueuesList] = useState<QueueInput[]>([
    { name: 'Dr. John', specialty: 'General Physician', averageWaitTimeMin: 20 }
  ]);
  const [newQueueName, setNewQueueName] = useState('');
  const [newQueueSpecialty, setNewQueueSpecialty] = useState('');
  const [newQueueWaitTime, setNewQueueWaitTime] = useState(15);

  const handleAddQueue = () => {
    if (!newQueueName.trim() || !newQueueSpecialty.trim()) return;

    setQueuesList([
      ...queuesList,
      {
        name: newQueueName.trim(),
        specialty: newQueueSpecialty.trim(),
        averageWaitTimeMin: Number(newQueueWaitTime) || 10
      }
    ]);

    setNewQueueName('');
    setNewQueueSpecialty('');
    setNewQueueWaitTime(15);
  };

  const handleRemoveQueue = (idxToRemove: number) => {
    setQueuesList(queuesList.filter((_, idx) => idx !== idxToRemove));
  };

  const handleFinishOnboarding = () => {
    // If list is empty, default seed
    const finalQueues = queuesList.length > 0 ? queuesList : [
      { name: 'Dr. John', specialty: 'General Physician', averageWaitTimeMin: 20 }
    ];

    // Trigger Zustand Store Action
    createBusinessWorkspace(businessName || 'My Workspace', businessType, timezone, finalQueues);

    // Redirect to dashboard
    router.push('/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Header */}
      <header style={{
        height: '70px',
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div className="brand">
          <svg className="brand-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span>QueueTag</span>
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
          Business Onboarding Wizard
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px' }}>
        
        {/* Progress Header Indicators */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '40px',
          width: '100%',
          maxWidth: '800px',
          marginBottom: '40px'
        }}>
          {[
            { num: 1, title: 'Business Information' },
            { num: 2, title: 'Create Queues' },
            { num: 3, title: 'Review & Confirm' }
          ].map((indicator) => {
            const isActive = step === indicator.num;
            const isCompleted = step > indicator.num;

            return (
              <div key={indicator.num} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                  background: isCompleted ? '#2563eb' : isActive ? '#2563eb' : 'white',
                  color: isCompleted || isActive ? 'white' : '#64748b',
                  border: isCompleted || isActive ? '2px solid #2563eb' : '2px solid #cbd5e1',
                  transition: 'all 0.2s ease'
                }}>
                  {isCompleted ? <Check style={{ width: '16px', height: '16px', strokeWidth: 3 }} /> : indicator.num}
                </div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#0f172a' : '#64748b'
                }}>
                  {indicator.title}
                </div>
              </div>
            );
          })}
        </div>

        {/* STEP 1: BUSINESS PROFILE */}
        {step === 1 && (
          <div className="gateway-card" style={{ maxWidth: '460px', width: '100%', padding: '36px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <Building2 style={{ width: '22px', height: '22px' }} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Tell us about your business</h2>
              <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>This information will help us customize your queue experience.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Business Name *</label>
                <div className="form-input-wrapper">
                  <Building2 className="form-input-icon" style={{ width: '16px', height: '16px' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. ABC Clinic" 
                    style={{ paddingLeft: '38px', borderRadius: '8px' }}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Business Type *</label>
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
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                >
                  <option value="Clinic">Clinic / Medical Practice</option>
                  <option value="Salon">Salon / Spa</option>
                  <option value="Bank">Bank / Finance</option>
                  <option value="Retail">Retail Store</option>
                  <option value="Government">Government Office</option>
                  <option value="Education">Education / Admission Center</option>
                  <option value="Other">Other Service</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Business Address <span style={{ fontWeight: 400, color: '#64748b' }}>(Optional)</span></label>
                <div className="form-input-wrapper">
                  <MapPin className="form-input-icon" style={{ width: '16px', height: '16px' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. 123, Main Street, City" 
                    style={{ paddingLeft: '38px', borderRadius: '8px' }}
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Time Zone *</label>
                <div className="form-input-wrapper">
                  <Clock className="form-input-icon" style={{ width: '16px', height: '16px' }} />
                  <select 
                    style={{
                      width: '100%',
                      padding: '11px 14px 11px 38px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'var(--font-sans)',
                      color: '#0f172a',
                      outline: 'none',
                      background: 'white'
                    }}
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    <option value="(GMT+05:30) Asia/Kolkata">(GMT+05:30) Asia/Kolkata</option>
                    <option value="(GMT-05:00) America/New_York">(GMT-05:00) EST / New York</option>
                    <option value="(GMT+00:00) Europe/London">(GMT+00:00) GMT / London</option>
                    <option value="(GMT+08:00) Asia/Singapore">(GMT+08:00) Asia/Singapore</option>
                  </select>
                </div>
              </div>

              <button 
                type="button" 
                className="btn-primary" 
                style={{ padding: '12px', borderRadius: '8px', marginTop: '8px' }}
                disabled={!businessName.trim()}
                onClick={() => setStep(2)}
              >
                Continue
                <ArrowRight style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
            
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '20px' }}>
              <ShieldCheck style={{ width: '14px', height: '14px', color: '#10b981' }} />
              <span>Your data is secure and will never be shared.</span>
            </div>
          </div>
        )}

        {/* STEP 2: CREATE QUEUES */}
        {step === 2 && (
          <div style={{ display: 'flex', gap: '28px', maxWidth: '850px', width: '100%' }}>
            
            {/* Create Queue Form */}
            <div className="gateway-card" style={{ flex: 1, padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus style={{ width: '16px', height: '16px' }} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Add Queue Service</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Service / Provider Name *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Dr. John, Counter 1, Checkout A" 
                    style={{ paddingLeft: '14px', borderRadius: '8px' }}
                    value={newQueueName}
                    onChange={(e) => setNewQueueName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Specialty / Department Name *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. General Physician, Finance, Returns" 
                    style={{ paddingLeft: '14px', borderRadius: '8px' }}
                    value={newQueueSpecialty}
                    onChange={(e) => setNewQueueSpecialty(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Average Service Time (minutes) *</label>
                  <div className="form-input-wrapper">
                    <Clock className="form-input-icon" style={{ width: '16px', height: '16px', left: '12px' }} />
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="e.g. 15" 
                      style={{ paddingLeft: '36px', borderRadius: '8px' }}
                      value={newQueueWaitTime}
                      onChange={(e) => setNewQueueWaitTime(Number(e.target.value))}
                      min={1}
                    />
                  </div>
                </div>

                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ padding: '10px', borderRadius: '8px', border: '1px dashed #2563eb', color: '#2563eb', background: '#eff6ff', justifyContent: 'center' }}
                  disabled={!newQueueName.trim() || !newQueueSpecialty.trim()}
                  onClick={handleAddQueue}
                >
                  <Plus style={{ width: '16px', height: '16px' }} />
                  Add Queue Service
                </button>
              </div>
            </div>

            {/* List of current Queues */}
            <div className="gateway-card" style={{ flex: 1.1, padding: '32px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>
                Queues to Create ({queuesList.length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', maxHeight: '280px', paddingRight: '4px' }}>
                {queuesList.length > 0 ? (
                  queuesList.map((q, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: 'white'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Stethoscope style={{ width: '16px', height: '16px' }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{q.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{q.specialty} • ~{q.averageWaitTimeMin} mins</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveQueue(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px' }}
                      >
                        <Trash2 style={{ width: '16px', height: '16px' }} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
                    No queues added. Please add at least one service.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ flex: 1, padding: '12px', border: '1px solid #cbd5e1', color: '#475569', background: 'white' }}
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft style={{ width: '16px', height: '16px' }} />
                  Back
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  style={{ flex: 1, padding: '12px' }}
                  disabled={queuesList.length === 0}
                  onClick={() => setStep(3)}
                >
                  Continue
                  <ArrowRight style={{ width: '16px', height: '16px' }} />
                </button>
              </div>
            </div>

          </div>
        )}

        {/* STEP 3: REVIEW & FINALIZE */}
        {step === 3 && (
          <div className="gateway-card" style={{ maxWidth: '500px', width: '100%', padding: '36px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <Check style={{ width: '22px', height: '22px', strokeWidth: 3 }} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Review and confirm</h2>
              <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Please review your workspace details before finalizing.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Profile Card */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#f8fafc' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.02em' }}>Business Details</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>Workspace Name:</span>
                    <strong style={{ color: '#334155' }}>{businessName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>Business Type:</span>
                    <strong style={{ color: '#334155' }}>{businessType}</strong>
                  </div>
                  {businessAddress && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#64748b' }}>Address:</span>
                      <strong style={{ color: '#334155', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{businessAddress}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>Time Zone:</span>
                    <strong style={{ color: '#334155' }}>{timezone}</strong>
                  </div>
                </div>
              </div>

              {/* Queues List */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.02em' }}>Queues ({queuesList.length})</span>
                  <button 
                    onClick={() => setStep(2)}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                  {queuesList.map((q, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
                      <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', background: '#2563eb', borderRadius: '50%' }} />
                        {q.name}
                      </span>
                      <span style={{ color: '#64748b' }}>{q.specialty} (~{q.averageWaitTimeMin}m)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Terms Checkbox note */}
              <div style={{ fontSize: '11px', color: '#64748b', background: '#ecfdf5', border: '1px solid #d1fae5', padding: '10px', borderRadius: '8px', lineHeight: 1.4, display: 'flex', gap: '6px' }}>
                <ShieldCheck style={{ width: '16px', height: '16px', color: '#10b981', flexShrink: 0 }} />
                <span>By creating a workspace, you agree to our Terms of Service and Privacy Policy. Your 14-day trial begins instantly.</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ flex: 1, padding: '12px', border: '1px solid #cbd5e1', color: '#475569', background: 'white' }}
                  onClick={() => setStep(2)}
                >
                  <ArrowLeft style={{ width: '16px', height: '16px' }} />
                  Back
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  style={{ flex: 1.5, padding: '12px', backgroundColor: '#10b981' }}
                  onClick={handleFinishOnboarding}
                >
                  Create Workspace 🚀
                </button>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
