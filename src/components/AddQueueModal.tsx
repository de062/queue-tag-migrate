'use client';

import { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';

interface AddQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, role?: string) => Promise<void>;
}

export default function AddQueueModal({ isOpen, onClose, onSubmit }: AddQueueModalProps) {
  const [queueName, setQueueName] = useState('');
  const [queueRole, setQueueRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueName.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(queueName.trim(), queueRole.trim());
      setQueueName('');
      setQueueRole('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create queue. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      style={{
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
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          className="close-button"
        >
          <X style={{ width: '18px', height: '18px' }} />
        </button>

        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Create New Queue
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: 1.4 }}>
            Add a new service desk, staff member, or check-in counter.
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '12px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Queue Name *
            </label>
            <input 
              type="text"
              placeholder="e.g. Counter 3 or Salon Station 1"
              value={queueName}
              onChange={(e) => setQueueName(e.target.value)}
              required
              disabled={isSubmitting}
              autoFocus
              style={{
                width: '100%',
                padding: '11px 14px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
                color: '#0f172a',
                boxSizing: 'border-box'
              }}
              className="modal-input"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Staff Role / Subtitle (Optional)
            </label>
            <input 
              type="text"
              placeholder="e.g. Hair Stylist, Cashier, Consultant"
              value={queueRole}
              onChange={(e) => setQueueRole(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '11px 14px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
                color: '#0f172a',
                boxSizing: 'border-box'
              }}
              className="modal-input"
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                flex: 1,
                background: 'white',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !queueName.trim()}
              style={{
                flex: 1,
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: (!queueName.trim() || isSubmitting) ? 0.7 : 1,
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus style={{ width: '16px', height: '16px' }} />
                  <span>Create Queue</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
