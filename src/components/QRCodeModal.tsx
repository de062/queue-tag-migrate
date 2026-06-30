'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Copy, Download, Check, QrCode, Loader2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toPng } from 'html-to-image';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  businessName?: string;
}

export default function QRCodeModal({ isOpen, onClose, businessId, businessName = 'Our Clinic' }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [resolvedBusinessName, setResolvedBusinessName] = useState(businessName);
  const [isDownloading, setIsDownloading] = useState(false);

  const posterRef = useRef<HTMLDivElement>(null);

  // Sync origin for QR link creation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // Sync business details (logo and name) from Firestore in real-time
  useEffect(() => {
    if (!isOpen || !businessId) return;

    const bizRef = doc(db, 'businesses', businessId);
    const unsubscribe = onSnapshot(bizRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.logoUrl) {
          setLogoUrl(data.logoUrl);
        }
        if (data.businessName) {
          setResolvedBusinessName(data.businessName);
        }
      }
    }, (err) => {
      console.error('Error fetching business branding for QR poster:', err);
    });

    return () => unsubscribe();
  }, [isOpen, businessId]);

  if (!isOpen) return null;

  const directoryUrl = `${origin || 'https://queuetag.com'}/b/${businessId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(directoryUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadPoster = async () => {
    if (!posterRef.current || isDownloading) return;
    setIsDownloading(true);

    try {
      // Small timeout to allow images and canvas elements to settle
      await new Promise((resolve) => setTimeout(resolve, 350));

      const dataUrl = await toPng(posterRef.current, {
        quality: 1.0,
        pixelRatio: 2, // High resolution (retina display resolution)
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${resolvedBusinessName.replace(/[^a-zA-Z0-9]+/g, '-')}-CheckIn-Poster.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error capturing printable poster image:', error);
      alert('Failed to generate high-res printable poster. Please try again.');
    } finally {
      setIsDownloading(false);
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
      {/* Modal Card */}
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '20px',
          padding: '36px',
          maxWidth: '460px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          className="hover-scale"
        >
          <X style={{ width: '16px', height: '16px' }} />
        </button>

        {/* Header Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#eff6ff',
          color: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #dbeafe',
        }}>
          <QrCode style={{ width: '28px', height: '28px' }} />
        </div>

        {/* Modal Info */}
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Customer Check-In QR
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: 1.4 }}>
            Point your camera here to view the live dashboard listings for <strong>{resolvedBusinessName}</strong> and check in virtual tokens.
          </p>
        </div>

        {/* QR Code Preview */}
        <div style={{
          padding: '24px',
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <QRCodeCanvas 
            value={directoryUrl} 
            size={200}
            level="H"
            includeMargin={false}
          />
        </div>

        {/* Action Controls */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Link display & copy */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: '#f8fafc', 
            border: '1px solid #cbd5e1', 
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              flex: 1, 
              padding: '12px 14px', 
              fontSize: '12px', 
              color: '#475569', 
              fontFamily: 'monospace', 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              textAlign: 'left'
            }}>
              {directoryUrl}
            </div>
            <button 
              onClick={handleCopy}
              style={{
                background: 'white',
                borderLeft: '1px solid #cbd5e1',
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                padding: '12px 16px',
                color: '#2563eb',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
              className="hover-bg-slate"
            >
              {copied ? (
                <>
                  <Check style={{ width: '14px', height: '14px', color: '#10b981' }} />
                  <span style={{ fontSize: '11px', color: '#10b981' }}>Copied</span>
                </>
              ) : (
                <>
                  <Copy style={{ width: '14px', height: '14px' }} />
                  <span style={{ fontSize: '11px' }}>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Download Branded Poster button */}
          <button 
            onClick={handleDownloadPoster}
            disabled={isDownloading}
            style={{
              width: '100%',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isDownloading ? 'not-allowed' : 'pointer',
              opacity: isDownloading ? 0.8 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.2s',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
            }}
            className="btn-primary"
          >
            {isDownloading ? (
              <>
                <Loader2 className="animate-spin" style={{ width: '16px', height: '16px' }} />
                <span>Generating Poster...</span>
              </>
            ) : (
              <>
                <Download style={{ width: '16px', height: '16px' }} />
                <span>Download Printable Poster</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Visually Hidden Branded Poster Template for Capture */}
      <div 
        ref={posterRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '600px',
          height: '880px',
          background: '#ffffff',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '60px 40px',
          boxSizing: 'border-box',
          border: '20px solid #2563eb', // Thick branding border
          borderRadius: '24px',
        }}
      >
        {/* Top Section: Logo & Name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt="Logo" 
              style={{ maxHeight: '90px', maxWidth: '240px', objectFit: 'contain', marginBottom: '8px' }} 
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <svg style={{ width: '32px', height: '32px', color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', color: '#2563eb' }}>QueueTag</span>
            </div>
          )}
          
          <h1 style={{ fontSize: '38px', fontWeight: 800, color: '#0f172a', margin: 0, textAlign: 'center', lineHeight: 1.2 }}>
            {resolvedBusinessName}
          </h1>
          
          <p style={{ fontSize: '18px', fontWeight: 600, color: '#475569', margin: '4px 0 0 0', textAlign: 'center' }}>
            Scan to Check-In or Join the Queue
          </p>
        </div>

        {/* Middle Section: High-Res QR Code */}
        <div style={{
          padding: '24px',
          background: 'white',
          border: '2px solid #e2e8f0',
          borderRadius: '24px',
          boxShadow: '0 10px 20px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '20px',
          marginBottom: '20px'
        }}>
          <QRCodeCanvas 
            value={directoryUrl} 
            size={300}
            level="H"
            includeMargin={false}
          />
        </div>

        {/* Bottom Section: Instructions & Brand Info */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%', borderTop: '2px dashed #e2e8f0', paddingTop: '28px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>
            1. Open your phone camera • 2. Point at QR code • 3. Join queue virtual tracker
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#94a3b8', marginTop: '16px' }}>
            <span>Powered by</span>
            <span style={{ fontWeight: 700, color: '#64748b' }}>QueueTag</span>
          </div>
        </div>
      </div>
    </div>
  );
}
