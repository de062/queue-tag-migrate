'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueueStore } from '@/store/queueStore';
import { 
  Lock, 
  User, 
  Stethoscope, 
  AlertCircle, 
  Loader2, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  Key,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

interface PageProps {
  params: Promise<{ token: string }>;
}

interface InviteDetails {
  id: string;
  email: string;
  assignedQueueId: string;
  businessId: string;
}

export default function StaffOnboardingPage({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();

  // Onboarding Form States
  const [staffName, setStaffName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Validation States
  const [isValidating, setIsValidating] = useState(true);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [queueName, setQueueName] = useState('Assigned Queue');
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      try {
        const q = query(collection(db, 'staffInvites'), where('token', '==', token));
        const querySnap = await getDocs(q);
        
        if (querySnap.empty) {
          setInvite(null);
          setIsValidating(false);
          return;
        }

        const docSnap = querySnap.docs[0];
        const data = docSnap.data();
        const details: InviteDetails = {
          id: docSnap.id,
          email: data.email || '',
          assignedQueueId: data.assignedQueueId || '',
          businessId: data.businessId || ''
        };

        setInvite(details);

        // Fetch queue name
        if (details.assignedQueueId) {
          const queueDocRef = doc(db, 'queues', details.assignedQueueId);
          const queueDocSnap = await getDoc(queueDocRef);
          if (queueDocSnap.exists()) {
            setQueueName(queueDocSnap.data().name || 'Assigned Queue');
          }
        }
      } catch (err) {
        console.error('Error validating onboarding token:', err);
        setError('Failed to validate onboarding link. Please try again.');
      } finally {
        setIsValidating(false);
      }
    }

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!invite) return;

    if (!staffName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setPasswordError('Password must be at least 8 characters long, contain at least one number, and at least one special character.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, invite.email, password);
      const user = userCredential.user;

      // 2. Set user display name in Auth
      await updateProfile(user, { displayName: staffName.trim() });

      // 3. Create staff profile document in Firestore staff collection
      await setDoc(doc(db, 'staff', user.uid), {
        id: user.uid,
        name: staffName.trim(),
        email: invite.email,
        assignedQueueId: invite.assignedQueueId,
        queueId: invite.assignedQueueId,
        businessId: invite.businessId,
        createdAt: new Date().toISOString()
      });

      // 4. Update Zustand state & localStorage for console session initialization
      const profile = {
        id: user.uid,
        name: staffName.trim(),
        email: invite.email,
        queueId: invite.assignedQueueId
      };
      
      useQueueStore.setState({ currentStaffProfile: profile });
      if (typeof window !== 'undefined') {
        localStorage.setItem('qt_staff_profile', JSON.stringify(profile));
      }

      // 5. Delete invite token from Firestore
      await deleteDoc(doc(db, 'staffInvites', invite.id));

      // 6. Redirect to the assigned queue console
      router.push(`/staff/${invite.assignedQueueId}`);
    } catch (err: any) {
      console.error('Error during staff onboarding:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already registered in Firebase Authentication. Please contact your admin.');
      } else {
        setError(err.message || 'An unexpected error occurred during onboarding.');
      }
      setIsSubmitting(false);
    }
  };

  // 1. LOADING STATE
  if (isValidating) {
    return (
      <div className="gateway-container" style={{ background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <RefreshCw className="pulse-animation" style={{ width: '36px', height: '36px', margin: '0 auto 16px auto', color: '#2563eb' }} />
          <div style={{ fontWeight: 600 }}>Validating Onboarding Token...</div>
        </div>
      </div>
    );
  }

  // 2. INVALID / EXPIRED LINK STATE
  if (!invite) {
    return (
      <div className="gateway-container" style={{ background: '#fef2f2' }}>
        <div className="gateway-card" style={{ maxWidth: '440px', padding: '40px 32px', textAlign: 'center', border: '1px solid #fee2e2' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle style={{ width: '28px', height: '28px' }} />
            </div>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#991b1b' }}>Invalid or Expired Link</h2>
          <p style={{ color: '#7f1d1d', fontSize: '14px', marginTop: '12px', lineHeight: 1.5 }}>
            This onboarding invite link is invalid, expired, or has already been used. Please request a new invite link from your clinic administrator.
          </p>
          <div style={{ marginTop: '24px', borderTop: '1px solid #fee2e2', paddingTop: '20px' }}>
            <Link href="/" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', justifySelf: 'center', gap: '8px', border: '1px solid #cbd5e1', color: '#64748b', background: 'white', textDecoration: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
              Go to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. VALID FORM STATE
  return (
    <div className="gateway-container" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)' }}>
      
      <div className="gateway-card" style={{ maxWidth: '420px', padding: '40px 36px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', background: 'white' }}>
        
        {/* Onboarding Header */}
        <div className="gateway-header" style={{ marginBottom: '28px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.08)' }}>
              <Stethoscope style={{ width: '28px', height: '28px' }} />
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', color: '#047857', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, marginBottom: '10px' }}>
            <Sparkles style={{ width: '12px', height: '12px' }} />
            <span>Secure Invitation Verified</span>
          </div>
          <h1 className="gateway-title" style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>Staff Onboarding</h1>
          <p className="gateway-subtitle" style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
            Choose a password to activate your staff console credentials
          </p>
        </div>

        {/* Assigned Queue Notice */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div><strong>Onboarding email:</strong> <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{invite.email}</span></div>
          <div><strong>Assigned Queue:</strong> <strong style={{ color: '#0f172a' }}>{queueName}</strong></div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Your Full Name *</label>
            <div className="form-input-wrapper">
              <User className="form-input-icon" style={{ width: '16px', height: '16px' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Dr. Sarah Jenkins" 
                style={{ paddingLeft: '38px', borderRadius: '8px' }}
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Create Password *</label>
            <div className="form-input-wrapper">
              <Lock className="form-input-icon" style={{ width: '16px', height: '16px' }} />
              <input 
                type="password" 
                className="form-input" 
                placeholder="Min 8 chars, 1 number, 1 special" 
                style={{ paddingLeft: '38px', borderRadius: '8px' }}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                required
                disabled={isSubmitting}
              />
            </div>
            {passwordError && <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', marginBottom: 0 }}>{passwordError}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Confirm Password *</label>
            <div className="form-input-wrapper">
              <Key className="form-input-icon" style={{ width: '16px', height: '16px' }} />
              <input 
                type="password" 
                className="form-input" 
                placeholder="Re-enter password" 
                style={{ paddingLeft: '38px', borderRadius: '8px' }}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ padding: '12px', borderRadius: '8px', marginTop: '10px', fontSize: '14px', fontWeight: 700 }} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="spin" style={{ width: '16px', height: '16px' }} />
            ) : (
              <ShieldCheck style={{ width: '16px', height: '16px' }} />
            )}
            {isSubmitting ? 'Registering Credentials...' : 'Activate Console Profile'}
          </button>
        </form>

      </div>
    </div>
  );
}
