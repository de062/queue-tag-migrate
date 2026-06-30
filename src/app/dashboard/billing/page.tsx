'use client';

import { useState, useEffect } from 'react';
import { useQueueStore } from '@/store/queueStore';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import { CreditCard, Check, Sparkles, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';

export default function BillingPage() {
  const currentBusiness = useQueueStore((state) => state.currentBusiness);
  const locations = useQueueStore((state) => state.locations);
  const upgradeBusinessToPremium = useQueueStore((state) => state.upgradeBusinessToPremium);
  const simulateSubscriptionExpired = useQueueStore((state) => state.simulateSubscriptionExpired);
  const simulateSubscriptionActive = useQueueStore((state) => state.simulateSubscriptionActive);

  const [isMounted, setIsMounted] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStage, setPaymentStage] = useState<'processing' | 'success'>('processing');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const location = currentBusiness || locations['abc-clinic'] || {
    id: 'abc-clinic',
    name: 'ABC Clinic',
    type: 'Clinic',
    planType: 'trial',
    subscriptionStatus: 'active',
    billingCycleEnd: 'Jun 29, 2026',
  };

  const planType = location.planType || 'trial';
  const subscriptionStatus = location.subscriptionStatus || 'active';
  const billingCycleEnd = location.billingCycleEnd || 'Jun 29, 2026';

  // Calculate days remaining for trial
  const getTrialDaysRemaining = () => {
    try {
      const end = new Date(billingCycleEnd);
      const now = new Date();
      const diffTime = end.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 7; // Fallback to 7 if negative or zero
    } catch (e) {
      return 7;
    }
  };

  const handleUpgradeClick = () => {
    setPaymentStage('processing');
    setShowPaymentModal(true);

    // Simulate payment gateway loading
    setTimeout(() => {
      setPaymentStage('success');
      setToastMessage('Payment of ₹499 successful!');
      upgradeBusinessToPremium();

      // Refresh page after success check is viewed
      setTimeout(() => {
        setShowPaymentModal(false);
        setToastMessage(null);
        window.location.reload();
      }, 1500);
    }, 2000);
  };

  const handleSimulateExpired = () => {
    simulateSubscriptionExpired();
    setToastMessage('Simulation: Subscription set to expired');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSimulateResetTrial = () => {
    // Reset to trial active
    useQueueStore.setState((state) => {
      const current = state.currentBusiness || state.locations['abc-clinic'];
      const updatedBusiness = {
        ...current,
        planType: 'trial' as const,
        subscriptionStatus: 'active' as const,
        billingCycleEnd: 'Jun 29, 2026',
      };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('qt_current_business', JSON.stringify(updatedBusiness));
      }
      return {
        currentBusiness: updatedBusiness,
        locations: {
          ...state.locations,
          [current.id]: updatedBusiness
        }
      };
    });
    setToastMessage('Simulation: Reset to Active Trial (Jun 29)');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSimulatePremium = () => {
    upgradeBusinessToPremium();
    setToastMessage('Simulation: Upgraded to Premium Pro');
    setTimeout(() => setToastMessage(null), 3000);
  };

  if (!isMounted) {
    return null;
  }

  const isTrial = planType === 'trial' && subscriptionStatus === 'active';
  const isPremium = planType === 'premium' && subscriptionStatus === 'active';
  const isExpired = subscriptionStatus === 'expired';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Toast Notification */}
      {toastMessage && (
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
          {toastMessage}
        </div>
      )}

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Sandbox Simulation Bar */}
        <div style={{
          background: '#eff6ff',
          borderBottom: '1px solid #bfdbfe',
          padding: '10px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#1e40af', fontWeight: 500 }}>
            <span>🛠️</span>
            <strong>Developer Sandbox:</strong> Simulate subscription states for testing.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleSimulateResetTrial}
              style={{
                fontSize: '11px',
                background: 'white',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '4px 10px',
                fontWeight: 600,
                color: '#2563eb',
                cursor: 'pointer'
              }}
            >
              Reset to Trial
            </button>
            <button 
              onClick={handleSimulateExpired}
              style={{
                fontSize: '11px',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                padding: '4px 10px',
                fontWeight: 600,
                color: '#dc2626',
                cursor: 'pointer'
              }}
            >
              Simulate Expired Paywall
            </button>
            <button 
              onClick={handleSimulatePremium}
              style={{
                fontSize: '11px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '6px',
                padding: '4px 10px',
                fontWeight: 600,
                color: '#059669',
                cursor: 'pointer'
              }}
            >
              Simulate Premium Active
            </button>
          </div>
        </div>

        {/* Dashboard Header */}
        <DashboardHeader subtext="Billing & Subscriptions for" />

        {/* Content Body */}
        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Title */}
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Billing Portal</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                Manage your subscription plans, view renewal dates, and simulate secure payments.
              </p>
            </div>

            {/* Expired Paywall Alert Card */}
            {isExpired && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '12px',
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px'
              }}>
                <AlertTriangle style={{ width: '22px', height: '22px', color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
                    Subscription Inactive
                  </h4>
                  <p style={{ fontSize: '13px', color: '#b91c1c', lineHeight: '20px' }}>
                    Your subscription has expired. Please choose a pricing plan below to reactivate your workspace access and resume room listings.
                  </p>
                </div>
              </div>
            )}

            {/* Active Subscription Info Card */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '20px'
            }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  background: isExpired ? '#fef2f2' : isPremium ? '#ecfdf5' : '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <CreditCard style={{ 
                    width: '24px', 
                    height: '24px', 
                    color: isExpired ? '#ef4444' : isPremium ? '#10b981' : '#2563eb' 
                  }} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                      {isPremium ? 'Premium Pro Plan' : isTrial ? 'Free Trial Plan' : 'Inactive Subscription'}
                    </h3>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: isExpired ? '#fef2f2' : isPremium ? '#ecfdf5' : '#eff6ff',
                      color: isExpired ? '#ef4444' : isPremium ? '#10b981' : '#2563eb'
                    }}>
                      {isExpired ? 'Expired' : isPremium ? 'Active' : 'In Trial'}
                    </span>
                  </div>
                  
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
                    {isTrial && `Your trial ends in ${getTrialDaysRemaining()} days.`}
                    {isPremium && `Next billing date: ${billingCycleEnd}.`}
                    {isExpired && 'Please upgrade to standard Premium tier to reactivate services.'}
                  </p>
                </div>
              </div>

              {!isPremium && (
                <button 
                  onClick={handleUpgradeClick}
                  style={{
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  {isExpired ? 'Reactivate Subscription' : 'Upgrade Now'}
                </button>
              )}
            </div>

            {/* Pricing Section */}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Available Plans</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 340px))', gap: '24px' }}>
                
                {/* Premium Pro Tier Card */}
                <div style={{
                  background: 'white',
                  border: '2px solid #2563eb',
                  borderRadius: '16px',
                  padding: '32px 28px',
                  position: 'relative',
                  boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '24px',
                    background: '#2563eb',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Sparkles style={{ width: '12px', height: '12px' }} />
                    RECOMMENDED
                  </div>

                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Premium Pro Plan</div>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Best for clinics and service centers seeking live synchronization.</p>
                  
                  <div style={{ margin: '24px 0', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a' }}>₹499</span>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>/ month</span>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px', flex: 1 }}>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 0, margin: 0, listStyle: 'none' }}>
                      {[
                        'Unlimited active queues',
                        'Full real-time analytics dashboard',
                        'Customizable customer portal',
                        'Announcement broadcast banners',
                        'Priority provider staff console access'
                      ].map((feature, i) => (
                        <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px', color: '#475569' }}>
                          <Check style={{ width: '16px', height: '16px', color: '#10b981', flexShrink: 0 }} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ marginTop: '28px' }}>
                    <button 
                      onClick={isPremium ? undefined : handleUpgradeClick}
                      disabled={isPremium}
                      style={{
                        width: '100%',
                        background: isPremium ? '#f1f5f9' : '#2563eb',
                        color: isPremium ? '#94a3b8' : 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: isPremium ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      {isPremium ? (
                        <>
                          <ShieldCheck style={{ width: '16px', height: '16px', color: '#10b981' }} />
                          Current Active Plan
                        </>
                      ) : (
                        'Upgrade Now'
                      )}
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Payment gateway simulation modal */}
      {showPaymentModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '36px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}>
            {paymentStage === 'processing' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <Loader2 style={{ width: '48px', height: '48px', color: '#2563eb', animation: 'spin 1.2s linear infinite' }} />
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                    Connecting to payment gateway...
                  </h4>
                  <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '18px' }}>
                    Processing ₹499 transaction via simulated Stripe/Razorpay checkout API. Please do not close or reload.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.1)'
                }}>
                  ✓
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                    Payment of ₹499 Successful!
                  </h4>
                  <p style={{ fontSize: '12px', color: '#64748b' }}>
                    Updating workspace subscription status...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global CSS spinner keyframe */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
