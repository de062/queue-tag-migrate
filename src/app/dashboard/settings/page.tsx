'use client';

import { useState, useEffect } from 'react';
import { useQueueStore } from '@/store/queueStore';
import { useAuthStore } from '@/store/authStore';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import { 
  Settings, 
  ChevronDown, 
  Calendar,
  Building,
  Mail,
  MapPin,
  Bell,
  Trash2,
  Lock,
  Save,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  Image as ImageIcon,
  Palette,
  Loader2,
  Phone,
  Plus,
  Trash,
  Copy,
  Check
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { updateEnterpriseSettings, deleteWorkspace, updateAppointmentSettings } from '@/services/settingsService';
import { QRCodeSVG } from 'qrcode.react';

const defaultOperatingHours = {
  monday: { isOpen: true, openTime: '09:00', closeTime: '17:00', breaks: [] },
  tuesday: { isOpen: true, openTime: '09:00', closeTime: '17:00', breaks: [] },
  wednesday: { isOpen: true, openTime: '09:00', closeTime: '17:00', breaks: [] },
  thursday: { isOpen: true, openTime: '09:00', closeTime: '17:00', breaks: [] },
  friday: { isOpen: true, openTime: '09:00', closeTime: '17:00', breaks: [] },
  saturday: { isOpen: false, openTime: '09:00', closeTime: '17:00', breaks: [] },
  sunday: { isOpen: false, openTime: '09:00', closeTime: '17:00', breaks: [] }
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuthStore();
  const updateBusinessProfile = useQueueStore((state) => state.updateBusinessProfile);

  // White-label branding form states
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('Other');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [publicPhone, setPublicPhone] = useState('');
  const [publicEmail, setPublicEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  
  // File upload state bindings
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Toggles state
  const [requirePhone, setRequirePhone] = useState(false);
  const [enableSMS, setEnableSMS] = useState(true);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Workspace modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Appointment settings states
  const [appointmentsEnabled, setAppointmentsEnabled] = useState(false);
  const [bookingSlug, setBookingSlug] = useState('');
  const [operatingHours, setOperatingHours] = useState<any>(defaultOperatingHours);
  const [services, setServices] = useState<any[]>([]);
  const [selectedQueueForService, setSelectedQueueForService] = useState('');
  const [availableQueues, setAvailableQueues] = useState<any[]>([]);
  const [newServiceDuration, setNewServiceDuration] = useState(30);
  const [newServiceDescription, setNewServiceDescription] = useState('');
  const [isSavingAppointments, setIsSavingAppointments] = useState(false);
  const [appointmentsSuccessMsg, setAppointmentsSuccessMsg] = useState<string | null>(null);
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);

  // File size validation and conversion to Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File size validation (500KB = 500 * 1024 bytes)
    if (file.size > 500 * 1024) {
      alert('File is too large. Please select an image under 500KB.');
      setSelectedFile(null);
      setFilePreview(null);
      // Clear file input value
      e.target.value = '';
      return;
    }

    setSelectedFile(file);

    // Convert file to Base64 data URL string
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.onerror = () => {
      console.error('Error converting file to Base64');
      alert('Failed to read logo file. Please try another image.');
      setSelectedFile(null);
      setFilePreview(null);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  // Supabase sync for settings
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) { router.push('/login'); return; }

    const businessId = user.id;

    const fetchBiz = async () => {
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      if (data) {
        setBusinessName(data.name || '');
        setBusinessCategory(data.business_category || 'Other');
        setBusinessAddress(data.address || '');
        setBusinessEmail(data.email || user.email || '');
        setLogoUrl(data.logo_url || '');
        setPrimaryColor(data.primary_color || '#2563eb');
        setRequirePhone(data.require_phone_number ?? false);
        setEnableSMS(data.enable_sms_alerts ?? true);
        setPublicPhone(data.public_phone || '');
        setPublicEmail(data.public_email || '');
        setAppointmentsEnabled(data.appointments_enabled ?? false);
        setOperatingHours(data.operating_hours || defaultOperatingHours);
        setServices(data.services || []);

        let currentSlug = data.booking_slug;
        if (!currentSlug) {
          const baseSlug = (data.name || 'booking')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          currentSlug = `${baseSlug || 'booking'}-${Math.random().toString(36).substring(2, 7)}`;
          supabase.from('businesses').update({ booking_slug: currentSlug }).eq('id', businessId)
            .then(({ error }) => { if (error) console.error('Error auto-saving booking slug:', error); });
        }
        setBookingSlug(currentSlug);
      }
    };

    fetchBiz();

    const bizChannel = supabase
      .channel(`settings-biz:${businessId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'businesses',
          filter: `id=eq.${businessId}` }, fetchBiz)
      .subscribe();

    return () => { supabase.removeChannel(bizChannel); };
  }, [user, isAuthLoading, router]);

  // Subscribe to queues of this business for selection
  useEffect(() => {
    if (isAuthLoading || !user) return;

    const fetchQueues = async () => {
      const { data } = await supabase
        .from('queues')
        .select('id, name, specialty')
        .eq('business_id', user.id);
      setAvailableQueues(data ?? []);
    };
    fetchQueues();

    const channel = supabase
      .channel(`settings-queues:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues',
          filter: `business_id=eq.${user.id}` }, fetchQueues)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isAuthLoading]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setSuccessMsg(null);

    try {
      let finalLogoUrl = logoUrl;

      // If a Base64 file preview exists, save it directly to Firestore settings
      if (filePreview && filePreview.startsWith('data:')) {
        finalLogoUrl = filePreview;
        setLogoUrl(finalLogoUrl);
        setSelectedFile(null);
      }

      await updateEnterpriseSettings(
        businessName.trim(),
        finalLogoUrl.trim(),
        primaryColor.trim(),
        businessAddress.trim(),
        businessEmail.trim(),
        businessCategory.trim(),
        requirePhone,
        enableSMS,
        publicPhone.trim(),
        publicEmail.trim()
      );
      
      // Update local store sync
      updateBusinessProfile(businessName.trim(), businessAddress.trim());

      setSuccessMsg('Branding and profile settings saved successfully!');
      
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Failed to save white-label settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRequirePhone = async () => {
    if (!user) return;
    const nextVal = !requirePhone;
    setRequirePhone(nextVal);
    try {
      await supabase.from('businesses').update({ require_phone_number: nextVal }).eq('id', user.id);
    } catch (err) {
      console.error('Failed to update requirePhoneNumber preference:', err);
    }
  };

  const handleToggleEnableSMS = async () => {
    if (!user) return;
    const nextVal = !enableSMS;
    setEnableSMS(nextVal);
    try {
      await supabase.from('businesses').update({ enable_sms_alerts: nextVal }).eq('id', user.id);
    } catch (err) {
      console.error('Failed to update enableSmsAlerts preference:', err);
    }
  };

  const handleToggleAppointments = async () => {
    if (!user) return;
    const previousState = appointmentsEnabled;
    const nextVal = !appointmentsEnabled;
    setAppointmentsEnabled(nextVal);
    try {
      await supabase.from('businesses').update({ appointments_enabled: nextVal }).eq('id', user.id);
    } catch (err) {
      console.error('Failed to update appointmentsEnabled preference:', err);
      alert('Failed to update appointment settings. Reverting to previous state.');
      setAppointmentsEnabled(previousState);
    }
  };

  const handleDeleteWorkspaceClick = () => {
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await deleteWorkspace();
      localStorage.removeItem('qt_current_business');
      localStorage.removeItem('qt_staff_profile');
      alert('Workspace successfully deleted.');
      router.push('/login');
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      alert('Failed to delete workspace. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Appointment schedule handlers
  const handleToggleDay = (day: string) => {
    setOperatingHours((prev: any) => ({
      ...prev,
      [day]: {
        ...prev[day],
        isOpen: !prev[day].isOpen
      }
    }));
  };

  const handleTimeChange = (day: string, field: 'openTime' | 'closeTime', val: string) => {
    setOperatingHours((prev: any) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: val
      }
    }));
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueForService) return;

    const targetQueue = availableQueues.find(q => q.id === selectedQueueForService);
    if (!targetQueue) return;

    const newService = {
      id: Math.random().toString(36).substring(2, 9),
      queueId: targetQueue.id,
      queueName: targetQueue.role ? `${targetQueue.name} (${targetQueue.role})` : targetQueue.name,
      durationMinutes: Number(newServiceDuration),
      description: newServiceDescription.trim()
    };

    setServices((prev) => [...prev, newService]);
    setSelectedQueueForService('');
    setNewServiceDuration(30);
    setNewServiceDescription('');
  };

  const handleDeleteService = (id: string) => {
    setServices((prev) => prev.filter(s => s.id !== id));
  };

  const handleSaveAppointments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSavingAppointments(true);
    setAppointmentsSuccessMsg(null);

    try {
      await updateAppointmentSettings(
        appointmentsEnabled,
        bookingSlug,
        operatingHours,
        services
      );
      setAppointmentsSuccessMsg('Appointment settings saved successfully!');
      setTimeout(() => setAppointmentsSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Error saving appointment settings:', err);
      alert('Failed to save appointment settings. Please try again.');
    } finally {
      setIsSavingAppointments(false);
    }
  };

  const handleCopyBookingLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setBookingLinkCopied(true);
      setTimeout(() => setBookingLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy booking link:', err);
    }
  };

  const handleDownloadQRCode = () => {
    const svgElement = document.getElementById('booking-qr-code');
    if (!svgElement) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `booking-qr-${bookingSlug}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hostUrl = typeof window !== 'undefined' ? window.location.origin : 'https://queuetag.com';
  const bookingUrl = `${hostUrl}/book/${bookingSlug}`;

  if (isAuthLoading) {
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
        <div style={{ fontSize: '14px', fontWeight: 500 }}>Loading settings...</div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <DashboardHeader subtext="Workspace settings for" />

        {/* Content Body */}
        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '720px' }}>
            
            {/* Title Section */}
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>General Settings</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                Manage your business workspace profile configurations, white-label branding, and client preferences.
              </p>
            </div>

            {/* Success Alert */}
            {successMsg && (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                padding: '14px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle style={{ width: '16px', height: '16px', color: '#10b981' }} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* 1. Business Profile Card */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <Building style={{ width: '18px', height: '18px', color: '#64748b' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Business Profile & White-Label Branding</h3>
              </div>

              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Name, Category, and Email Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Business Name *</label>
                    <div className="form-input-wrapper">
                      <Building className="form-input-icon" style={{ width: '16px', height: '16px' }} />
                      <input 
                        type="text" 
                        className="form-input" 
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        style={{ paddingLeft: '38px', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Business Category *</label>
                    <select
                      value={businessCategory}
                      onChange={(e) => setBusinessCategory(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#0f172a',
                        outline: 'none',
                        background: 'white',
                        height: '38px',
                        cursor: 'pointer'
                      }}
                      required
                    >
                      <option value="Healthcare">Healthcare</option>
                      <option value="Salon & Spa">Salon & Spa</option>
                      <option value="Retail">Retail</option>
                      <option value="Food & Beverage">Food & Beverage</option>
                      <option value="Government/DMV">Government/DMV</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Contact Support Email *</label>
                    <div className="form-input-wrapper">
                      <Mail className="form-input-icon" style={{ width: '16px', height: '16px' }} />
                      <input 
                        type="email" 
                        className="form-input" 
                        required
                        value={businessEmail}
                        onChange={(e) => setBusinessEmail(e.target.value)}
                        style={{ paddingLeft: '38px', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* White-Label Settings Grid (Logo and Brand Color) */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Upload Business Logo</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input 
                        type="file" 
                        accept="image/*"
                        key={selectedFile ? selectedFile.name : 'empty'}
                        onChange={handleFileChange}
                        style={{
                          fontSize: '13px',
                          color: '#475569',
                          cursor: 'pointer',
                          padding: '6px 12px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          background: '#f8fafc',
                          width: '100%'
                        }}
                      />
                      <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '-2px' }}>
                        Maximum file size: 500KB (PNG or JPG)
                      </span>
                      {(filePreview || logoUrl) && (
                        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {filePreview ? 'Unsaved Preview:' : 'Current Logo:'}
                          </span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={filePreview || logoUrl} 
                            alt="Logo preview" 
                            style={{ height: '40px', maxWidth: '140px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px', backgroundColor: '#f8fafc' }} 
                            onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                          />
                          {filePreview && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFile(null);
                                setFilePreview(null);
                              }}
                              style={{
                                fontSize: '11.5px',
                                color: '#ef4444',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: '0',
                                fontWeight: 500
                              }}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Brand Primary Color</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="color" 
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        style={{ 
                          width: '40px', 
                          height: '38px', 
                          padding: '0', 
                          border: '1px solid #cbd5e1', 
                          borderRadius: '8px', 
                          cursor: 'pointer',
                          backgroundColor: 'transparent'
                        }}
                      />
                      <input 
                        type="text" 
                        className="form-input" 
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        placeholder="#2563eb"
                        maxLength={7}
                        style={{ borderRadius: '8px', fontSize: '13px', flex: 1 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Location Address</label>
                  <div className="form-input-wrapper">
                    <MapPin className="form-input-icon" style={{ width: '16px', height: '16px' }} />
                    <input 
                      type="text" 
                      className="form-input" 
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      placeholder="Enter physical business address"
                      style={{ paddingLeft: '38px', borderRadius: '8px', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Public Contact Phone</label>
                  <div className="form-input-wrapper">
                    <Phone className="form-input-icon" style={{ width: '16px', height: '16px' }} />
                    <input 
                      type="text" 
                      className="form-input" 
                      value={publicPhone}
                      onChange={(e) => setPublicPhone(e.target.value)}
                      placeholder="e.g. +1 (555) 000-0000"
                      style={{ paddingLeft: '38px', borderRadius: '8px', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Public Contact Email</label>
                  <div className="form-input-wrapper">
                    <Mail className="form-input-icon" style={{ width: '16px', height: '16px' }} />
                    <input 
                      type="email" 
                      className="form-input" 
                      value={publicEmail}
                      onChange={(e) => setPublicEmail(e.target.value)}
                      placeholder="e.g. contact@business.com"
                      style={{ paddingLeft: '38px', borderRadius: '8px', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isSaving}
                  style={{ width: 'fit-content', borderRadius: '8px', padding: '10px 20px', alignSelf: 'flex-end', display: 'flex', gap: '8px', alignItems: 'center' }}
                >
                  {isSaving ? (
                    <Loader2 className="animate-spin" style={{ width: '15px', height: '15px' }} />
                  ) : (
                    <Save style={{ width: '15px', height: '15px' }} />
                  )}
                  {isSaving ? 'Saving Workspace...' : 'Save Workspace branding'}
                </button>
              </form>
            </div>

            {/* 2. Queue Preferences Toggles */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <Settings style={{ width: '18px', height: '18px', color: '#64748b' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Queue Preferences</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Preference 1 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#334155' }}>Require Phone Number to Join</div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>Customers must provide a valid phone number before joining walk-ins.</div>
                  </div>
                  
                  <div onClick={handleToggleRequirePhone} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    {requirePhone ? (
                      <ToggleRight style={{ width: '40px', height: '40px', color: '#2563eb' }} />
                    ) : (
                      <ToggleLeft style={{ width: '40px', height: '40px', color: '#cbd5e1' }} />
                    )}
                  </div>
                </div>

                {/* Preference 2 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#334155' }}>Enable SMS Reminders & Alerts</div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>Automatically send SMS token alerts to customers when their turn is close.</div>
                  </div>
                  
                  <div onClick={handleToggleEnableSMS} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    {enableSMS ? (
                      <ToggleRight style={{ width: '40px', height: '40px', color: '#2563eb' }} />
                    ) : (
                      <ToggleLeft style={{ width: '40px', height: '40px', color: '#cbd5e1' }} />
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* 3. Danger Zone (Distinct Card at bottom) */}
            <div style={{
              background: '#fdfafb',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', borderBottom: '1px solid #fee2e2', paddingBottom: '12px' }}>
                <ShieldAlert style={{ width: '18px', height: '18px', color: '#ef4444' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#991b1b' }}>Danger Zone</h3>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#7f1d1d' }}>Delete Workspace</div>
                  <div style={{ fontSize: '11.5px', color: '#991b1b', marginTop: '4px', lineHeight: 1.4, maxWidth: '440px' }}>
                    Permanently delete your workspace, all service desks, staff members, or queues, active tokens, and all historical data. This cannot be undone.
                  </div>
                </div>

                <button 
                  onClick={handleDeleteWorkspaceClick}
                  style={{
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 18px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                >
                  <Trash2 style={{ width: '15px', height: '15px' }} />
                  Delete Workspace
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* APPOINTMENT SETTINGS (Full-width card) */}
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          marginTop: '28px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
            <Calendar style={{ width: '22px', height: '22px', color: '#2563eb' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Appointment Settings</h3>
          </div>

          {/* Success Message */}
          {appointmentsSuccessMsg && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle style={{ width: '16px', height: '16px' }} />
              <span>{appointmentsSuccessMsg}</span>
            </div>
          )}

          {/* Master Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Enable Appointments & VIP Fast-Pass</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Allow customers to book remote queue slots in advance for specific times.</div>
            </div>
            <div 
              onClick={handleToggleAppointments} 
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {appointmentsEnabled ? (
                <ToggleRight style={{ width: '44px', height: '44px', color: '#2563eb' }} />
              ) : (
                <ToggleLeft style={{ width: '44px', height: '44px', color: '#cbd5e1' }} />
              )}
            </div>
          </div>

          {appointmentsEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              
              {/* 1. Booking Link & QR Code Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', background: '#eff6ff', padding: '24px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a8a', margin: 0 }}>Your Booking Link</h4>
                  <p style={{ fontSize: '12.5px', color: '#1e40af', lineHeight: 1.5, margin: 0 }}>
                    Share this custom link with your customers or print the QR code to allow them to reserve walk-in appointments.
                  </p>
                  
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <input 
                      type="text" 
                      readOnly 
                      value={bookingUrl}
                      style={{ flex: 1, padding: '10px', fontSize: '12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#334155', fontFamily: 'monospace' }}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button 
                      type="button"
                      onClick={handleCopyBookingLink}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        background: bookingLinkCopied ? '#15803d' : '#2563eb', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '8px', 
                        padding: '0 16px', 
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        transition: 'all 0.15s'
                      }}
                    >
                      {bookingLinkCopied ? <Check style={{ width: '14px', height: '14px' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
                      {bookingLinkCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', borderLeft: '1px solid #bfdbfe', paddingLeft: '24px' }}>
                  {bookingSlug && (
                    <QRCodeSVG 
                      id="booking-qr-code" 
                      value={bookingUrl} 
                      size={110} 
                      level="H" 
                      includeMargin={true}
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleDownloadQRCode}
                    style={{
                      background: 'white',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    Download QR Code
                  </button>
                </div>
              </div>

              {/* 2. Operating Hours Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Weekly Operating Hours</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  {Object.keys(defaultOperatingHours).map((day) => {
                    const dayConfig = operatingHours[day] || defaultOperatingHours[day as keyof typeof defaultOperatingHours];
                    return (
                      <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ width: '120px', textTransform: 'capitalize', fontWeight: 700, color: '#334155', fontSize: '13px' }}>
                          {day}
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="checkbox" 
                            id={`toggle-${day}`} 
                            checked={dayConfig.isOpen} 
                            onChange={() => handleToggleDay(day)} 
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <label htmlFor={`toggle-${day}`} style={{ fontSize: '12.5px', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                            {dayConfig.isOpen ? 'Open' : 'Closed'}
                          </label>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: dayConfig.isOpen ? 1 : 0.4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11.5px', color: '#64748b' }}>From:</span>
                            <input 
                              type="time" 
                              value={dayConfig.openTime || '09:00'} 
                              onChange={(e) => handleTimeChange(day, 'openTime', e.target.value)} 
                              disabled={!dayConfig.isOpen}
                              style={{ border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '6px', fontSize: '12.5px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11.5px', color: '#64748b' }}>To:</span>
                            <input 
                              type="time" 
                              value={dayConfig.closeTime || '17:00'} 
                              onChange={(e) => handleTimeChange(day, 'closeTime', e.target.value)} 
                              disabled={!dayConfig.isOpen}
                              style={{ border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '6px', fontSize: '12.5px' }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Bookable Queues Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '28px', alignItems: 'flex-start' }}>
                
                {/* Current Bookable Queues List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Bookable Queues ({services.length})</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                    {services.length > 0 ? (
                      services.map((service: any) => (
                        <div key={service.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#fafafa' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '13.5px' }}>{service.queueName || service.name}</div>
                            <div style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 600, marginTop: '2px' }}>{service.durationMinutes} minutes duration</div>
                            {service.description && (
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', lineHeight: 1.4 }}>{service.description}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteService(service.id)}
                            style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                            title="Remove booking configuration"
                          >
                            <Trash style={{ width: '16px', height: '16px' }} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>
                        No queues enabled for booking yet. Configure a queue on the right.
                      </div>
                    )}
                  </div>
                </div>

                {/* Configure Queue Form */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus style={{ width: '16px', height: '16px', color: '#2563eb' }} />
                    <span>Configure Queue for Booking</span>
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11.5px' }}>Select Queue *</label>
                      <select 
                        value={selectedQueueForService} 
                        onChange={(e) => setSelectedQueueForService(e.target.value)} 
                        className="form-input"
                        style={{ borderRadius: '6px', fontSize: '12.5px', height: '38px', padding: '0 10px', boxSizing: 'border-box' }}
                      >
                        <option value="">-- Choose a Queue --</option>
                        {availableQueues.map((q) => {
                          const display = q.role ? `${q.name} (${q.role})` : q.name;
                          return (
                            <option key={q.id} value={q.id}>{display}</option>
                          );
                        })}
                      </select>
                    </div>



                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11.5px' }}>Duration (Minutes) *</label>
                      <input 
                        type="number" 
                        min={1} 
                        value={newServiceDuration} 
                        onChange={(e) => setNewServiceDuration(Number(e.target.value))} 
                        className="form-input"
                        style={{ borderRadius: '6px', fontSize: '12.5px' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11.5px' }}>Description (Optional)</label>
                      <textarea 
                        placeholder="Provide a brief description of this queue/appointment type..." 
                        value={newServiceDescription} 
                        onChange={(e) => setNewServiceDescription(e.target.value)} 
                        className="form-input"
                        style={{ borderRadius: '6px', fontSize: '12.5px', minHeight: '60px', fontFamily: 'inherit', resize: 'vertical' }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddService}
                      disabled={!selectedQueueForService}
                      style={{
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: selectedQueueForService ? 'pointer' : 'not-allowed',
                        opacity: selectedQueueForService ? 1 : 0.6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      Enable Booking
                    </button>
                  </div>
                </div>

              </div>

              {/* Save Configurations Form Action */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '20px', marginTop: '10px' }}>
                <button 
                  type="button"
                  onClick={handleSaveAppointments}
                  disabled={isSavingAppointments}
                  style={{
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                >
                  {isSavingAppointments ? (
                    <Loader2 className="animate-spin" style={{ width: '15px', height: '15px' }} />
                  ) : (
                    <Save style={{ width: '15px', height: '15px' }} />
                  )}
                  {isSavingAppointments ? 'Saving Settings...' : 'Save Appointment Settings'}
                </button>
              </div>

            </div>
          )}
        </div>

      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
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
          <div style={{
            maxWidth: '440px',
            width: '100%',
            padding: '28px',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #fee2e2',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #fee2e2', paddingBottom: '12px' }}>
              <ShieldAlert style={{ width: '22px', height: '22px', color: '#ef4444' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#991b1b', margin: 0 }}>
                Confirm Permanent Deletion
              </h3>
            </div>
            
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: 0 }}>
              This action is <strong>irreversible</strong> and will permanently wipe your workspace document, all service queues, active tokens, staff credentials, and historical logs.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#7f1d1d' }}>
                Type <span style={{ fontFamily: 'monospace', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>DELETE</span> to confirm:
              </label>
              <input
                type="text"
                placeholder="DELETE"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  color: '#991b1b',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                style={{
                  flex: 1,
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: deleteConfirmText === 'DELETE' && !isDeleting ? 'pointer' : 'not-allowed',
                  opacity: deleteConfirmText === 'DELETE' && !isDeleting ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="animate-spin" style={{ width: '14px', height: '14px' }} />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                    <span>Delete Workspace</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
