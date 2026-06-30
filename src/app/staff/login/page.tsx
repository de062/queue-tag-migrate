'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueueStore } from '@/store/queueStore';
import { Mail, Lock, LogIn, Users, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export default function StaffLoginPage() {
  const router = useRouter();
  const currentStaffProfile = useQueueStore((state) => state.currentStaffProfile);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in in Firebase, fetch profile and redirect directly to their queue console
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const staffDocRef = doc(db, 'staff', firebaseUser.uid);
          const staffDocSnap = await getDoc(staffDocRef);

          let assignedQueueId = '';
          let staffName = firebaseUser.displayName || '';

          if (staffDocSnap.exists()) {
            const data = staffDocSnap.data();
            assignedQueueId = data.assignedQueueId || data.queueId || '';
            staffName = data.name || data.displayName || staffName;
          } else {
            const staffQuery = query(
              collection(db, 'staff'),
              where('email', '==', firebaseUser.email?.toLowerCase())
            );
            const querySnap = await getDocs(staffQuery);
            if (!querySnap.empty) {
              const data = querySnap.docs[0].data();
              assignedQueueId = data.assignedQueueId || data.queueId || '';
              staffName = data.name || data.displayName || staffName;
            }
          }

          if (assignedQueueId) {
            const profile = {
              id: firebaseUser.uid,
              name: staffName || firebaseUser.email || 'Staff Member',
              email: firebaseUser.email || '',
              queueId: assignedQueueId
            };
            useQueueStore.setState({ currentStaffProfile: profile });
            if (typeof window !== 'undefined') {
              localStorage.setItem('qt_staff_profile', JSON.stringify(profile));
            }
            router.push(`/staff/${assignedQueueId}`);
          }
        } catch (err) {
          console.error('Error auto-redirecting authenticated staff:', err);
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email || !password) {
      setError('Please enter both email and password.');
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const firebaseUser = userCredential.user;

      // Fetch the staff member's document from the Firestore "staff" collection
      const staffDocRef = doc(db, 'staff', firebaseUser.uid);
      const staffDocSnap = await getDoc(staffDocRef);

      let assignedQueueId = '';
      let staffName = firebaseUser.displayName || '';

      if (staffDocSnap.exists()) {
        const data = staffDocSnap.data();
        assignedQueueId = data.assignedQueueId || data.queueId || '';
        staffName = data.name || data.displayName || staffName;
      } else {
        const staffQuery = query(
          collection(db, 'staff'),
          where('email', '==', email.trim().toLowerCase())
        );
        const querySnap = await getDocs(staffQuery);
        if (!querySnap.empty) {
          const data = querySnap.docs[0].data();
          assignedQueueId = data.assignedQueueId || data.queueId || '';
          staffName = data.name || data.displayName || staffName;
        }
      }

      if (!assignedQueueId) {
        throw new Error('No assigned queue found for this staff profile.');
      }

      const profile = {
        id: firebaseUser.uid,
        name: staffName || firebaseUser.email || 'Staff Member',
        email: firebaseUser.email || email.trim(),
        queueId: assignedQueueId
      };

      // Set to Zustand store & local storage
      useQueueStore.setState({ currentStaffProfile: profile });
      if (typeof window !== 'undefined') {
        localStorage.setItem('qt_staff_profile', JSON.stringify(profile));
      }

      router.push(`/staff/${assignedQueueId}`);
    } catch (err: any) {
      console.error('Staff Login Error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(err.message || 'An unexpected error occurred during login.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="gateway-container" style={{ background: '#f8fafc' }}>
      <Link href="/" className="back-link" style={{ position: 'absolute', top: '24px', left: '24px' }}>
        <ArrowLeft style={{ width: '16px', height: '16px' }} />
        <span>Back to Gateway</span>
      </Link>

      <div className="gateway-card" style={{ maxWidth: '400px', padding: '40px 32px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        <div className="gateway-header" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users style={{ width: '24px', height: '24px' }} />
            </div>
          </div>
          <h1 className="gateway-title" style={{ fontSize: '22px', fontWeight: 800, marginTop: '16px' }}>Staff Portal</h1>
          <p className="gateway-subtitle" style={{ fontSize: '13px', color: '#64748b' }}>Log in to manage your assigned service queues</p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Email Address</label>
            <div className="form-input-wrapper">
              <Mail className="form-input-icon" style={{ width: '16px', height: '16px' }} />
              <input 
                type="email" 
                className="form-input" 
                placeholder="e.g. john@queuetag.com" 
                style={{ paddingLeft: '38px', borderRadius: '8px' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Password</label>
            <div className="form-input-wrapper">
              <Lock className="form-input-icon" style={{ width: '16px', height: '16px' }} />
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••" 
                style={{ paddingLeft: '38px', borderRadius: '8px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ padding: '11px', borderRadius: '8px', marginTop: '4px' }} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="spin" style={{ width: '16px', height: '16px' }} />
            ) : (
              <LogIn style={{ width: '16px', height: '16px' }} />
            )}
            {isLoading ? 'Logging In...' : 'Log In to Console'}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', textAlign: 'center' }}>
            Demo Profiles (No Password Required)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button 
              type="button"
              onClick={() => { setEmail('john@queuetag.com'); setPassword('password'); }}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', color: '#334155', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>John - Team Lead</span>
              <code style={{ fontSize: '10px', color: '#2563eb' }}>john@queuetag.com</code>
            </button>
            <button 
              type="button"
              onClick={() => { setEmail('sarah@queuetag.com'); setPassword('password'); }}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', color: '#334155', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>Sarah - Service Coordinator</span>
              <code style={{ fontSize: '10px', color: '#2563eb' }}>sarah@queuetag.com</code>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
