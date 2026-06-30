'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useQueueStore } from '@/store/queueStore';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Users, 
  ChevronDown, 
  Bell, 
  Calendar,
  ArrowUpRight,
  UserCheck,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';

export interface QueueEvent {
  id?: string;
  queueId: string;
  action: 'join' | 'call' | 'skip';
  patientId: string;
  timestamp: string;
}

// Utility Helpers
function getHourBucket(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    let hour = date.getHours();
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; // '0' becomes '12'
    return `${hour} ${ampm}`;
  } catch (e) {
    return '9 AM';
  }
}

function getNextHour(hourStr: string): string {
  const parts = hourStr.split(' ');
  if (parts.length < 2) return '';
  const numStr = parts[0];
  const ampm = parts[1];
  let num = parseInt(numStr);
  let nextNum = num === 12 ? 1 : num + 1;
  let nextAmpm = ampm;
  if (num === 11 && ampm === 'AM') nextAmpm = 'PM';
  if (num === 11 && ampm === 'PM') nextAmpm = 'AM';
  return `${nextNum} ${nextAmpm}`;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, businessName: authBusinessName, isLoading: isAuthLoading } = useAuthStore();
  const queues = useQueueStore((state) => state.queues);
  const currentBusiness = useQueueStore((state) => state.currentBusiness);
  const locations = useQueueStore((state) => state.locations);
  const initLiveSync = useQueueStore((state) => state.initLiveSync);

  const [events, setEvents] = useState<QueueEvent[]>([]);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    console.log(`STEP 1: Analytics Page Mounted, requesting sync for ${user.uid}`);
    const unsubscribeLiveSync = initLiveSync(user.uid);

    // Set up real-time listener for queueEvents today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayStr = startOfToday.toISOString();

    const q = query(
      collection(db, 'queueEvents'),
      where('timestamp', '>=', startOfTodayStr)
    );

    const unsubscribeEvents = onSnapshot(q, (snapshot) => {
      const list: QueueEvent[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          queueId: data.queueId || '',
          action: data.action || '',
          patientId: data.patientId || '',
          timestamp: data.timestamp || ''
        });
      });
      setEvents(list);
    }, (err) => {
      console.error('Error listening to queue events:', err);
    });

    return () => {
      if (unsubscribeLiveSync) unsubscribeLiveSync();
      unsubscribeEvents();
    };
  }, [initLiveSync, user, isAuthLoading, router]);

  const location = currentBusiness || locations['abc-clinic'] || {
    id: 'abc-clinic',
    name: 'ABC Clinic',
    type: 'Clinic',
  };

  const currentBusinessId = user?.uid || location.id;
  const activeQueuesList = Object.values(queues).filter(q => q.locationId === currentBusinessId);
  const queueIds = activeQueuesList.map(q => q.id);

  // Filter events to only this business's queues
  const filteredEvents = events.filter(e => queueIds.includes(e.queueId));
  const joinEvents = filteredEvents.filter(e => e.action === 'join');
  const callEvents = filteredEvents.filter(e => e.action === 'call');

  // 1. Calculate Live Served (Today)
  const totalServedToday = activeQueuesList.reduce((sum, q) => sum + (q.totalServedToday || 0), 0);
  
  // 2. Calculate Current Waiting Now
  const currentWaitingNow = activeQueuesList.reduce((sum, q) => sum + (q.waitingCount || 0), 0);

  // 3. Calculate Real-Time Average Wait Duration
  let totalWaitMs = 0;
  let waitCount = 0;

  callEvents.forEach(call => {
    const correspondingJoin = joinEvents.find(join => join.patientId === call.patientId);
    if (correspondingJoin) {
      const waitTime = new Date(call.timestamp).getTime() - new Date(correspondingJoin.timestamp).getTime();
      if (waitTime > 0) {
        totalWaitMs += waitTime;
        waitCount++;
      }
    }
  });

  const avgWaitTime = waitCount > 0 
    ? Math.round(totalWaitMs / (waitCount * 60000))
    : (activeQueuesList.length > 0 
        ? Math.round(activeQueuesList.reduce((sum, q) => sum + q.averageWaitTimeMin, 0) / activeQueuesList.length) 
        : 15);

  // 4. Calculate Busiest Peak Hour
  const hourBuckets = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM'];
  const hourlyCounts: Record<string, number> = {};
  hourBuckets.forEach(h => { hourlyCounts[h] = 0; });

  joinEvents.forEach(e => {
    const bucket = getHourBucket(e.timestamp);
    if (bucket in hourlyCounts) {
      hourlyCounts[bucket]++;
    }
  });

  let peakHour = 'None';
  let maxCount = 0;
  Object.entries(hourlyCounts).forEach(([hour, count]) => {
    if (count > maxCount) {
      maxCount = count;
      peakHour = hour;
    }
  });

  const busiestPeakHourText = peakHour !== 'None' ? `${peakHour} - ${getNextHour(peakHour)}` : 'No check-ins yet';
  const busiestPeakHourChange = peakHour !== 'None' ? `${maxCount} check-ins` : 'Across all rooms';

  // 5. Customer Volume Bar Chart Data
  const chartData = hourBuckets.map(hour => ({ name: hour, checkins: hourlyCounts[hour] }));

  // 6. Live AI Insight triggers
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const recentJoinsCount = joinEvents.filter(e => new Date(e.timestamp).getTime() > fifteenMinutesAgo.getTime()).length;
  const isSpiking = recentJoinsCount > 5;
  const waitTimeExceeded = avgWaitTime > 20;
  const showAIAlert = waitTimeExceeded || isSpiking;

  const stats = [
    {
      label: 'Total Served (Today)',
      value: totalServedToday,
      change: 'Live from active queues',
      isPositive: true,
      icon: UserCheck,
      color: '#10b981',
      bgColor: '#ecfdf5',
      isMock: false
    },
    {
      label: 'Avg. Wait Duration',
      value: `${avgWaitTime} mins`,
      change: waitCount > 0 ? 'Based on actual check-ins' : 'Default queue average',
      isPositive: true,
      icon: Clock,
      color: '#2563eb',
      bgColor: '#eff6ff',
      isMock: false
    },
    {
      label: 'Busiest Peak Hour',
      value: busiestPeakHourText,
      change: busiestPeakHourChange,
      isPositive: null,
      icon: TrendingUp,
      color: '#f59e0b',
      bgColor: '#fffbeb',
      isMock: false
    },
    {
      label: 'Current Waiting Now',
      value: currentWaitingNow,
      change: 'Across all active rooms',
      isPositive: null,
      icon: Users,
      color: '#8b5cf6',
      bgColor: '#f5f3ff',
      isMock: false
    }
  ];

  if (isAuthLoading || !user) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>
        <RefreshCw className="pulse-animation" style={{ width: '24px', height: '24px', marginRight: '8px', color: '#2563eb' }} />
        Verifying session...
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
        <DashboardHeader subtext="Analytics overview for" />

        {/* Content Body */}
        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Title Section */}
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Analytics Dashboard</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                Monitor client traffic patterns, peak load intervals, and queue operations response.
              </p>
            </div>

            {/* LIVE AI INSIGHTS ALERT BANNER */}
            {showAIAlert && (
              <div style={{
                background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                border: '1px solid #fed7aa',
                borderRadius: '12px',
                padding: '16px 20px',
                color: '#c2410c',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 4px 6px -1px rgba(249,115,22,0.05)'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'white',
                  border: '1px solid #ffedd5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f97316',
                  boxShadow: '0 2px 4px rgba(249,115,22,0.04)'
                }}>
                  <AlertTriangle style={{ width: '20px', height: '20px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#ea580c' }}>Live AI Operations Insight</div>
                  <div style={{ fontSize: '13px', color: '#7c2d12', marginTop: '2px', fontWeight: 500 }}>
                    {isSpiking && waitTimeExceeded 
                      ? `Traffic spike detected (${recentJoinsCount} check-ins in the last 15 minutes) and average wait time is high (${avgWaitTime} mins). Consider opening another queue room immediately.`
                      : isSpiking
                        ? `Traffic spike detected: ${recentJoinsCount} patients joined the queue in the last 15 minutes. Consider adjusting room allocations.`
                        : `Average wait time is currently elevated at ${avgWaitTime} minutes. Monitor provider efficiency or assign a float clinician.`
                    }
                  </div>
                </div>
              </div>
            )}

            {/* Top Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
              {stats.map((stat, idx) => (
                <div key={idx} style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '135px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{stat.label}</span>
                      {stat.isMock && (
                        <span style={{ 
                          fontSize: '9px', 
                          fontWeight: 700, 
                          padding: '2px 6px', 
                          background: '#f1f5f9', 
                          color: '#64748b', 
                          borderRadius: '4px', 
                          width: 'fit-content',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em'
                        }}>
                          Mock Data
                        </span>
                      )}
                    </div>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: stat.bgColor,
                      color: stat.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <stat.icon style={{ width: '18px', height: '18px' }} />
                    </div>
                  </div>

                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{stat.value}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '11px', color: stat.isPositive ? '#10b981' : stat.isPositive === false ? '#ef4444' : '#64748b' }}>
                      {stat.isPositive !== null && (
                        <ArrowUpRight style={{ width: '12px', height: '12px', transform: stat.isPositive ? 'none' : 'rotate(90deg)' }} />
                      )}
                      <span style={{ fontWeight: 600 }}>{stat.change}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Dynamic Customer Volume Chart */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px 32px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Customer Volume over Time</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Hourly distribution of check-in walk-in tokens today</p>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#2563eb' }}></span>
                    Check-ins
                  </span>
                </div>
              </div>

              {/* Chart Visual Layout */}
              <div style={{ height: '240px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }} 
                      contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', color: 'white', fontSize: '11px', fontWeight: 700 }}
                    />
                    <Bar dataKey="checkins" fill="#eff6ff" radius={[6, 6, 0, 0]} stroke="#dbeafe" strokeWidth={1}>
                      {chartData.map((entry, index) => {
                        const isPeak = entry.checkins > 0 && entry.checkins === Math.max(...chartData.map(d => d.checkins));
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={isPeak ? 'url(#barGrad)' : '#eff6ff'} 
                            stroke={isPeak ? 'none' : '#dbeafe'}
                          />
                        );
                      })}
                    </Bar>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance analysis bottom row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Left card: Room performance */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Queue Service Efficiency</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeQueuesList.map((queue) => {
                    const served = queue.totalServedToday;
                    const waiting = queue.entries.filter(e => e.status === 'waiting' || e.status === 'next').length;
                    const pct = served + waiting > 0 ? Math.round((served / (served + waiting)) * 100) : 100;
                    return (
                      <div key={queue.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: '#334155' }}>{queue.name} ({queue.specialty})</span>
                          <span style={{ color: '#64748b', fontWeight: 500 }}>{pct}% Served today</span>
                        </div>
                        {/* Progress Bar container */}
                        <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: queue.specialty === 'General Physician' ? '#2563eb' : '#10b981', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right card: Quick Insights */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>AI Operations Insights</h3>
                <ul style={{ paddingLeft: '18px', fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '10px', lineHeight: 1.4 }}>
                  <li>
                    <strong>Peak Load Alert:</strong> Busiest traffic peak detected around <strong>11:00 AM</strong>. Consider shifting staff lunch breaks to 1:00 PM to improve efficiency.
                  </li>
                  <li>
                    <strong>Service Wait Optimization:</strong> Patients assigned to general rooms experience 4 mins longer average wait times compared to specialist queues.
                  </li>
                  <li>
                    <strong>Capacity Suggestion:</strong> Overall load is within normal bounds. No queue halts have been triggered today.
                  </li>
                </ul>
              </div>

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}
