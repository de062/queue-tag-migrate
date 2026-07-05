'use client';

import { useState, useEffect } from 'react';
import { useQueueStore } from '@/store/queueStore';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  Plus, 
  Settings, 
  UserPlus, 
  Bell, 
  ChevronDown,
  LogOut,
  Trash2,
  Edit2,
  X,
  ShieldCheck,
  Info
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import AddQueueModal from '@/components/AddQueueModal';
import { createNewQueue, updateQueueSettings } from '@/services/queueService';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

export default function DashboardQueuesPage() {
  const router = useRouter();
  const { user, businessName: authBusinessName, isLoading: isAuthLoading } = useAuthStore();
  const queues = useQueueStore((state) => state.queues);
  const currentBusiness = useQueueStore((state) => state.currentBusiness);
  const locations = useQueueStore((state) => state.locations);
  const initLiveSync = useQueueStore((state) => state.initLiveSync);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    console.log(`STEP 1: Queues Page Mounted, requesting sync for ${user.id}`);
    const unsubscribe = initLiveSync(user.id);
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [initLiveSync, user, isAuthLoading, router]);

  // Store Actions
  const updateQueue = useQueueStore((state) => state.updateQueue);
  const deleteQueue = useQueueStore((state) => state.deleteQueue);

  // Modal / Form States
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showAddQueueModal, setShowAddQueueModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  
  // Fields
  const [queueName, setQueueName] = useState('');
  const [queueSpecialty, setQueueSpecialty] = useState('');
  const [queueRole, setQueueRole] = useState('');
  const [queueWaitTime, setQueueWaitTime] = useState(15);
  const [isAppointmentEnabled, setIsAppointmentEnabled] = useState(false);
  const [isHalted, setIsHalted] = useState(false);

  const location = currentBusiness || locations['abc-clinic'] || {
    id: 'abc-clinic',
    name: 'ABC Clinic',
    type: 'Clinic',
    address: '123, MG Road, Bangalore, Karnataka 560001',
    timezone: '(GMT+05:30) Asia/Kolkata',
  };

  const businessDisplayName = authBusinessName || location.name;

  // Filter queues to only show queues for this location/business
  const currentBusinessId = user?.id || location.id;
  const businessQueues = Object.values(queues).filter(q => q.locationId === currentBusinessId);
  
  // Fallback to all queues if new business has no queues yet
  const displayQueuesList = businessQueues.length > 0 ? businessQueues : Object.values(queues).filter(q => q.locationId === currentBusinessId);

  const handleOpenEditModal = (q: any) => {
    setIsEditing(true);
    setEditingQueueId(q.id);
    setQueueName(q.name);
    setQueueSpecialty(q.specialty);
    setQueueRole(q.role || '');
    setQueueWaitTime(q.averageWaitTimeMin);
    setIsAppointmentEnabled(q.isAppointmentEnabled || false);
    setIsHalted(q.isHalted || false);
    setShowQueueModal(true);
  };

  const handleQueueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueName.trim() || !queueSpecialty.trim() || !editingQueueId) return;

    try {
      await updateQueueSettings(editingQueueId, {
        name: queueName.trim(),
        specialty: queueSpecialty.trim(),
        role: queueRole.trim(),
        averageWaitTimeMin: Number(queueWaitTime),
        isAppointmentEnabled,
        isHalted
      });
      setToastMsg('Queue updated successfully!');
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      console.error('Failed to update queue settings:', err);
    }

    setShowQueueModal(false);
    setQueueName('');
    setQueueSpecialty('');
    setQueueRole('');
    setQueueWaitTime(15);
  };

  const handleDeleteQueue = async (qId: string, qName: string) => {
    if (confirm(`Are you sure you want to delete the queue "${qName}"? This will clear all entries.`)) {
      try {
        await supabase.from('queues').delete().eq('id', qId);
        setToastMsg('Queue deleted successfully!');
        setTimeout(() => setToastMsg(null), 3000);
      } catch (err) {
        console.error('Failed to delete queue:', err);
      }
    }
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

      {/* 2. MAIN CONTENT */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <DashboardHeader subtext="Good morning," />

        {/* Content Box */}
        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Title section with Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Service Queues</h2>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                  Manage service queues and customer service desks for <strong>{businessDisplayName}</strong>.
                </p>
              </div>
              <button className="btn-primary" onClick={() => setShowAddQueueModal(true)} style={{ width: 'fit-content', borderRadius: '8px', padding: '10px 18px' }}>
                <Plus style={{ width: '16px', height: '16px' }} />
                Create New Queue
              </button>
            </div>

            {/* Grid List of Queues */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {displayQueuesList.length > 0 ? (
                displayQueuesList.map((queue) => {
                  const waitListCount = queue.entries.filter(e => e.status === 'waiting' || e.status === 'next').length;
                  const isPaused = queue.status === 'paused';

                  return (
                    <div key={queue.id} className="queue-card" style={{ padding: '24px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                      <div className="queue-card-header" style={{ marginBottom: '16px' }}>
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

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9', marginBottom: '20px' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Avg Service Time</div>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#334155', marginTop: '2px' }}>{queue.averageWaitTimeMin} min</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Active Waiting</div>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#334155', marginTop: '2px' }}>{waitListCount} customers</div>
                        </div>
                      </div>

                      {/* Controls */}
                      <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                        <button 
                          className="btn-secondary" 
                          onClick={() => handleOpenEditModal(queue)}
                          style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', color: '#475569', background: 'white' }}
                        >
                          <Edit2 style={{ width: '14px', height: '14px' }} />
                          Edit Details
                        </button>
                        <button 
                          className="btn-secondary" 
                          onClick={() => handleDeleteQueue(queue.id, queue.name)}
                          style={{ flex: 1, padding: '8px', border: '1px solid #fee2e2', color: '#ef4444', background: 'white' }}
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                          Delete Queue
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ gridColumn: 'span 2', background: 'white', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                  <Info style={{ width: '32px', height: '32px', color: '#cbd5e1', margin: '0 auto 12px auto' }} />
                  <div>No active queues found for this business. Click 'Create New Queue' to get started.</div>
                </div>
              )}
            </div>

          </div>

        </div>

      </main>

      {/* CREATE / EDIT QUEUE DIALOG MODAL */}
      {showQueueModal && (
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
                <Users style={{ width: '18px', height: '18px', color: '#2563eb' }} />
                <span>{isEditing ? 'Edit Service Queue' : 'Create New Service Queue'}</span>
              </div>
              <button 
                onClick={() => setShowQueueModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <form onSubmit={handleQueueSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px' }}>Service / Provider Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Dr. John Queue" 
                  style={{ paddingLeft: '14px', borderRadius: '6px', fontSize: '13px', paddingTop: '8px', paddingBottom: '8px' }}
                  value={queueName}
                  onChange={(e) => setQueueName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px' }}>Specialty / Department *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. General Physician" 
                  style={{ paddingLeft: '14px', borderRadius: '6px', fontSize: '13px', paddingTop: '8px', paddingBottom: '8px' }}
                  value={queueSpecialty}
                  onChange={(e) => setQueueSpecialty(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px' }}>Staff Role / Subtitle (Optional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Hair Stylist, Cashier, Consultant" 
                  style={{ paddingLeft: '14px', borderRadius: '6px', fontSize: '13px', paddingTop: '8px', paddingBottom: '8px' }}
                  value={queueRole}
                  onChange={(e) => setQueueRole(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px' }}>Average Service Time (minutes) *</label>
                <div className="form-input-wrapper">
                  <Clock style={{ width: '14px', height: '14px', position: 'absolute', left: '12px', color: '#64748b' }} />
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="e.g. 15" 
                    style={{ paddingLeft: '34px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', borderRadius: '6px', fontSize: '13px' }}
                    value={queueWaitTime}
                    onChange={(e) => setQueueWaitTime(Number(e.target.value))}
                    min={1}
                    required
                  />
                </div>
              </div>

              {/* Advanced Settings section */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginTop: '4px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                  Advanced Settings
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={isAppointmentEnabled}
                      onChange={(e) => setIsAppointmentEnabled(e.target.checked)}
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Accept Appointments (Optional)</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>Allow users to book future calendar slots.</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={isHalted}
                      onChange={(e) => setIsHalted(e.target.checked)}
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#dc2626' }}>Halt Queue / Stop Walk-ins</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>Temporarily stop accepting new walk-in tokens.</div>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#64748b', background: '#eff6ff', border: '1px solid #dbeafe', padding: '10px', borderRadius: '6px', lineHeight: 1.4 }}>
                <strong>Real-time update:</strong> Saving this queue will instantly publish it to your live customer selection portal and admin monitoring monitors.
              </div>

              <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '4px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setShowQueueModal(false)}
                  style={{ flex: 1, padding: '10px', border: '1px solid #cbd5e1', color: '#475569', background: 'white' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  {isEditing ? 'Save Changes' : 'Create Queue'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

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

    </div>
  );
}
