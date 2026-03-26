import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Plus, Calendar as CalendarIcon, Clock, MapPin, 
  Sparkles, Search, SlidersHorizontal, Heart, Ticket, Eye, Lock, ArrowRight, X,
  LogOut, Settings as SettingsIcon, CheckCircle2, Activity, PieChart, BarChart3,
  DollarSign, TrendingUp, XCircle, ChevronLeft, ChevronDown, ShieldCheck, Landmark, Check, ExternalLink
} from 'lucide-react';
import { isSameDay, format, parseISO, subDays, eachDayOfInterval, subMonths, isSameMonth } from 'date-fns';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart as RePieChart, Pie, Sector
} from 'recharts';
import { toast } from 'sonner';
import CalendarContainer from '../../components/CalendarContainer';

const SEED_TEACHERS = [
  { id: 'seed-smruti-3617', full_name: 'Smruti Pillai', invite_code: 'STUDIO-SMRUTIPILLAI-3617', role: 'TEACHER' },
  { id: 'seed-angella-5640', full_name: 'Angella', invite_code: 'STUDIO-ANGELLA-5640', role: 'TEACHER' }
];

export default function StudentDashboard() {
  const { profile, signOut, fetchProfile } = useAuth();
  const [allSchedules, setAllSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linkingCode, setLinkingCode] = useState('');
  const [linking, setLinking] = useState(false);
  const syncLockRef = React.useRef(false);
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [myBookings, setMyBookings] = useState([]);
  const [globalSchedules, setGlobalSchedules] = useState([]);
  const [isGlobalMode, setIsGlobalMode] = useState(false);
  const [activeTab, setActiveTab] = useState('studio'); 
  const [studentStats, setStudentStats] = useState({
    totalSessions: 0,
    routineVariety: [],
    routineCategoryMix: [],
    attendanceTrend: [],
    energyBurn: 0,
    consistency: [],
    totalSpent: 0,
    monthlySpent: 0,
    quarterlySpent: 0,
    ytdSpent: 0,
    spendingTrend: []
  });
  const [timeRange, setTimeRange] = useState('30days');
  const [activeIndex, setActiveIndex] = useState(0);
  const [conflicts, setConflicts] = useState(new Set());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState(null);

  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-studio-dark/95 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl">
          <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <p className="text-xs font-black text-white">
                {entry.name === 'amount' ? `$${entry.value}` : `${entry.value} Sessions`}
              </p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderActiveShape = (props) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
      <g>
        <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="text-[10px] font-black uppercase tracking-tighter shadow-sm">
          {payload.name}
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 6}
          outerRadius={outerRadius + 10}
          fill={fill}
        />
      </g>
    );
  };
  const [studentCredits, setStudentCredits] = useState(0);
  const [visitedStages, setVisitedStages] = useState([]);
  const navigate = useNavigate();


  useEffect(() => {
    const initDashboard = async () => {
      const pendingCode = localStorage.getItem('pending_teacher_code');
      const currentCode = profile?.stage_code;
      
      if (profile?.visited_stages) {
        setVisitedStages(profile.visited_stages);
      }
      
      if (pendingCode) {
        syncTeacherLink(pendingCode);
      } else if (profile?.linked_teacher_id) {
        // Parallelizing everything to avoid waterfall
        try {
          await Promise.allSettled([
            fetchTeacherProfile(profile.linked_teacher_id),
            fetchAllAvailableSchedules(profile.linked_teacher_id),
            fetchMyBookings(),
            fetchStudentCredits()
          ]);
        } finally {
          setLoading(false);
        }
      } else if (profile?.visited_stages?.length > 0 && !profile?.linked_teacher_id) {
        // [PHASE 32] SOFT RECOVERY: If primary link is missing, auto-reconnect to most recent stage from history
        const latestStage = profile.visited_stages[profile.visited_stages.length - 1];
        console.log('[Dashboard] Soft Recovery: Re-linking to most recent stage:', latestStage.stage_code);
        handleSwitchStage(latestStage);
      } else {
        setLoading(false);
      }
    };

    if (profile?.id) initDashboard();
  }, [profile?.linked_teacher_id, profile?.id, profile?.stage_code]);

  const syncTeacherLink = async (code) => {
    if (!code || linking || syncLockRef.current) return;
    syncLockRef.current = true;
    setLinking(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('stage_code', code.toUpperCase().trim())
        .single();
      
      if (error) {
        console.warn('[Dashboard] Teacher lookup error:', error);
        toast.error('Could not find that stage.');
        return;
      }
      const teacher = data;

      if (teacher) {
        // ONLY Proceed if we have a valid student profile ID to link to
        if (profile?.id) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ linked_teacher_id: teacher.id })
            .eq('id', profile.id);
          
          // Explicitly update Auth Metadata for immediate fallback sync
          await supabase.auth.updateUser({ 
            data: { linked_teacher_id: teacher.id } 
          });
          
          if (updateError) {
            console.error('[Dashboard] Failed to link teacher:', updateError);
            toast.error('Failed to link to instructor. Retrying...');
            return; // Don't clear storage or fetch profile if update failed
          }

          localStorage.removeItem('pending_teacher_code');
          const { forceRefreshProfile } = useAuth();
          await forceRefreshProfile(); // Phase 32: Force real sync
          
          if (teacher.id !== profile?.linked_teacher_id) {
            toast.success(`Connected to instructor: ${teacher.full_name}`);
          }
        } else {
          // If profile ID isn't ready yet, the useEffect dependency on profile.id 
          // will trigger this again once it arrives. Don't clear storage yet.
          return;
        }

        await fetchTeacherProfile(teacher.id);
        await fetchAllAvailableSchedules(teacher.id);

        // Update Visited Stages History
        const currentVisited = profile?.visited_stages || [];
        const isAlreadyVisited = currentVisited.some(s => s.teacher_id === teacher.id);
        
        if (!isAlreadyVisited) {
          const newStageEntry = {
            teacher_id: teacher.id,
            full_name: teacher.full_name,
            stage_code: code.toUpperCase().trim(),
            last_visited: new Date().toISOString()
          };
          const updatedVisited = [newStageEntry, ...currentVisited].slice(0, 10);
          
          if (profile?.id) {
            await supabase.from('profiles').update({ visited_stages: updatedVisited }).eq('id', profile.id);
          }
          setVisitedStages(updatedVisited);
        } else {
          // Move to front/Update timestamp
          const updatedVisited = currentVisited.map(s => 
            s.teacher_id === teacher.id ? { ...s, last_visited: new Date().toISOString(), stage_code: code.toUpperCase().trim() } : s
          ).sort((a, b) => new Date(b.last_visited) - new Date(a.last_visited));
          
          if (profile?.id) {
            await supabase.from('profiles').update({ visited_stages: updatedVisited }).eq('id', profile.id);
          }
          setVisitedStages(updatedVisited);
        }
      } else {
        localStorage.removeItem('pending_teacher_code');
        if (code !== '') toast.error('Invalid stage code. Please check with your instructor.');
      }
    } catch (err) {
      console.error('[Dashboard] Sync error:', err);
    } finally {
      if (profile?.visited_stages) {
        setVisitedStages(profile.visited_stages);
      }
      syncLockRef.current = false;
      setLinking(false);
      setLoading(false);
    }
  };

  const fetchStudentCredits = useCallback(async () => {
    if (!profile?.id || !profile?.linked_teacher_id) return;
    try {
      const { data, error } = await supabase
        .from('credits')
        .select('balance')
        .eq('student_id', profile.id)
        .eq('teacher_id', profile.linked_teacher_id)
        .single();
      
      if (!error && data) {
        setStudentCredits(parseFloat(data.balance));
      } else {
        setStudentCredits(0);
      }
    } catch (err) {
      console.error('[Dashboard] Fetch credits error:', err);
    }
  }, [profile?.id, profile?.linked_teacher_id]);

  const fetchAllAvailableSchedules = useCallback(async (explicitTeacherId) => {
    const teacherId = explicitTeacherId || profile?.linked_teacher_id;
    if (!teacherId) { setAllSchedules([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          routines (
            name,
            duration_minutes
          ),
          profiles (
            full_name
          )
        `)
        .eq('teacher_id', teacherId)
        .in('status', ['SCHEDULED', 'CANCELLED'])
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      setAllSchedules(data || []);
    } catch (err) {
      console.error('[Dashboard] Fetch schedules error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.linked_teacher_id]);

  const fetchTeacherProfile = useCallback(async (explicitTeacherId) => {
    const teacherId = explicitTeacherId || profile?.linked_teacher_id;
    if (!teacherId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, loyalty_settings, payment_settings')
        .eq('id', teacherId)
        .single();
      
      if (!error && data) setTeacherProfile(data);
    } catch (err) {
      console.error('[Dashboard] Fetch teacher profile error:', err);
    }
  }, [profile?.linked_teacher_id]);

  const fetchGlobalSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          routines (name, duration_minutes),
          profiles (full_name)
        `)
        .in('status', ['SCHEDULED', 'CANCELLED'])
        .limit(20);
      if (error) throw error;
      setGlobalSchedules(data || []);
    } catch (err) {
      console.error('[Dashboard] Global fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSwitchStage = async (stage) => {
    setLoading(true);
    try {
      // 1. Update active teacher in DB
      await supabase.from('profiles').update({ linked_teacher_id: stage.teacher_id }).eq('id', profile.id);
      
      // Explicitly update Auth Metadata for immediate fallback sync
      await supabase.auth.updateUser({ 
        data: { linked_teacher_id: stage.teacher_id } 
      });
      
      // 2. Clear local storage and trigger re-fetch
      localStorage.removeItem('pending_teacher_code');
      const { forceRefreshProfile } = useAuth();
      await forceRefreshProfile(); // Phase 32: Force real sync
      
      // 3. UI Feedback
      toast.success(`Switched to ${stage.full_name}'s Stage`);
      setActiveTab('studio');
      setIsGlobalMode(false);
    } catch (err) {
      console.error('[Dashboard] Switch stage error:', err);
      toast.error('Failed to switch stage');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBookings = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, schedules(id, start_time, teacher_id, routines(name))')
        .eq('student_id', profile.id)
        .in('payment_status', ['PAID', 'PENDING', 'VOID'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMyBookings(data || []);
    } catch (err) {
      console.error('[Dashboard] Fetch bookings error:', err);
    }
  }, [profile?.id]);

  const handleConfirmPayment = async (bookingId) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          payment_confirmed_by_student: true,
          payment_confirmed_at: new Date().toISOString()
        })
        .eq('id', bookingId);
      
      if (error) throw error;
      toast.success("Payment notified! We'll verify the funds soon.");
      fetchMyBookings();
      setShowPaymentModal(false);
    } catch (err) {
      console.error('[Dashboard] Confirm payment error:', err);
      toast.error("Failed to notify payment.");
    }
  };

  const calculateStudentMetrics = useCallback((bookings, schedules) => {
    let startDate;
    const now = new Date();
    if (timeRange === '30days') startDate = subDays(now, 30);
    else if (timeRange === '90days') startDate = subDays(now, 90);
    else if (timeRange === 'year') startDate = subDays(now, 365);
    else if (timeRange === 'ytd') startDate = new Date(now.getFullYear(), 0, 1);
    else startDate = new Date(0);

    const paidBookings = bookings.filter(b => b.payment_status === 'PAID' && b.schedules?.start_time && new Date(b.schedules.start_time) >= startDate);
    const totalSessions = paidBookings.length;
    
    // Routine Variety
    const routineCounts = {};
    paidBookings.forEach(booking => {
      const routineName = booking.schedules?.routines?.name;
      if (routineName) routineCounts[routineName] = (routineCounts[routineName] || 0) + 1;
    });
    const routineVariety = Object.entries(routineCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const totalRoutineBookings = routineVariety.reduce((sum, r) => sum + r.count, 0);
    const routineVarietyWithPerformance = routineVariety.map(r => ({ ...r, performance: totalRoutineBookings > 0 ? (r.count / totalRoutineBookings) * 100 : 0 }));

    // Routine Category Mix
    const categoryCounts = { 'HIIT': 0, 'Yoga': 0, 'Studio': 0, 'Strength': 0 };
    paidBookings.forEach(booking => {
      const name = (booking.schedules?.routines?.name || '').toUpperCase();
      if (name.includes('STUDIO')) categoryCounts['Studio']++;
      else if (name.includes('YOGA')) categoryCounts['Yoga']++;
      else if (name.includes('HIIT') || name.includes('CARDIO')) categoryCounts['HIIT']++;
      else categoryCounts['Strength']++;
    });
    const routineCategoryMix = Object.entries(categoryCounts).map(([name, value]) => ({ name, value })).filter(c => c.value > 0);

    // Attendance Trend (Last 14 Days)
    const today = new Date();
    const dateRange = eachDayOfInterval({ start: subDays(today, 13), end: today });
    const attendanceTrend = dateRange.map(date => ({
      date: format(date, 'MMM d'),
      count: paidBookings.filter(booking => booking.schedules?.start_time && isSameDay(parseISO(booking.schedules.start_time), date)).length
    }));

    // Energy Burn (Estimated)
    const totalEnergyBurn = paidBookings.reduce((sum, b) => sum + ((b.schedules?.routines?.duration_minutes || 45) * 8.5), 0);

    // Consistency (Day of Week)
    const dayStats = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => ({ day, count: 0 }));
    paidBookings.forEach(b => {
      if (b.schedules?.start_time) dayStats[new Date(b.schedules.start_time).getDay()].count += 1;
    });

    // Financial Trend (Dynamic)
    const nowRef = new Date();
    const historyMonths = timeRange === 'year' || timeRange === 'ytd' || timeRange === 'all' ? 12 : 6;
    const lastXMonths = Array.from({ length: historyMonths }).map((_, i) => subMonths(nowRef, historyMonths - 1 - i));
    const spendingTrend = lastXMonths.map(monthDate => {
      const monthBookings = paidBookings.filter(b => b.schedules?.start_time && isSameMonth(new Date(b.schedules.start_time), monthDate));
      return {
        month: format(monthDate, 'MMM'),
        amount: monthBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
        sessions: monthBookings.length
      };
    });

    const totalSpent = paidBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const monthlySpent = paidBookings.filter(b => b.schedules?.start_time && isSameMonth(new Date(b.schedules.start_time), now)).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const ytdSpent = paidBookings.filter(b => b.schedules?.start_time && new Date(b.schedules.start_time).getFullYear() === now.getFullYear()).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const quarterlySpent = paidBookings.filter(b => {
      if (!b.schedules?.start_time) return false;
      const d = new Date(b.schedules.start_time);
      return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3);
    }).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    const activeTeacherBookings = bookings.filter(b => {
      const b_tid = b.teacher_id || b.schedules?.teacher_id || b.schedules?.[0]?.teacher_id;
      return b_tid === profile?.linked_teacher_id && 
      ['PAID', 'PENDING'].includes(b.payment_status) &&
      b.payment_method !== 'LOYALTY_REWARD';
    });
    const loyaltySettings = teacherProfile?.loyalty_settings || { required_sessions: 10, enabled: true };
    const required = loyaltySettings.required_sessions || 10;
    const paidCount = activeTeacherBookings.length;
    const rewardCount = bookings.filter(b => {
      const b_tid = b.teacher_id || b.schedules?.teacher_id || b.schedules?.[0]?.teacher_id;
      return b_tid === profile?.linked_teacher_id && b.payment_method === 'LOYALTY_REWARD';
    }).length;
    
    const earnedRewards = Math.floor(paidCount / required);
    const isEligible = earnedRewards > rewardCount;
    const loyaltyProgressCount = isEligible ? required : (paidCount % required);

    setStudentStats({
      totalSessions, routineVariety: routineVarietyWithPerformance, routineCategoryMix, attendanceTrend, energyBurn: Math.round(totalEnergyBurn),
      consistency: dayStats, totalSpent: Math.round(totalSpent), monthlySpent: Math.round(monthlySpent), quarterlySpent: Math.round(quarterlySpent),
      ytdSpent: Math.round(ytdSpent), spendingTrend,
      loyaltyProgress: {
        current: loyaltyProgressCount,
        total: loyaltySettings.required_sessions,
        remaining: sessionsRemaining,
        isUnlocked: loyaltyCount === loyaltySettings.required_sessions
      }
    });
  }, [timeRange, profile?.linked_teacher_id, teacherProfile?.loyalty_settings]);

  const handleJoinStage = async (e) => {
    e.preventDefault();
    if (!linkingCode || linking) return;
    syncTeacherLink(linkingCode);
  };

  const handleDisconnect = async () => {
    // Optimistic cleanup of local storage
    localStorage.removeItem('studio_guest_session');
    localStorage.removeItem('pending_teacher_code');
    
    if (profile?.id) {
      const updatePromise = supabase
        .from('profiles')
        .update({ linked_teacher_id: null })
        .eq('id', profile.id);

      toast.promise(updatePromise, {
        loading: 'Disconnecting from stage...',
        success: 'Stage cleared!',
        error: 'Disconnected (syncing with cloud...)'
      });

      try {
        await updatePromise;
        await fetchProfile(profile.id); // Fast re-sync
        navigate('/');
      } catch (err) {
        navigate('/');
      }
    } else {
      navigate('/');
    }
  };

  const detectConflicts = useCallback((schedules) => {
    const conflictSet = new Set();
    const validSchedules = (schedules || []).filter(s => s?.start_time);
    const sorted = [...validSchedules].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const s1 = sorted[i];
        const s2 = sorted[j];
        
        if (s1.teacher_id === s2.teacher_id) continue;

        const start1 = new Date(s1.start_time).getTime();
        const end1 = start1 + (s1.routines?.duration_minutes || 60) * 60000;
        const start2 = new Date(s2.start_time).getTime();
        const end2 = start2 + (s2.routines?.duration_minutes || 60) * 60000;

        if (start1 < end2 && start2 < end1) {
          conflictSet.add(s1.id);
          conflictSet.add(s2.id);
        }
      }
    }
    setConflicts(conflictSet);
  }, []);

  useEffect(() => {
    if (myBookings.length > 0 && allSchedules.length > 0) {
      calculateStudentMetrics(myBookings, allSchedules);
    }

    if (isGlobalMode && globalSchedules.length > 0) {
      detectConflicts(globalSchedules);
    } else {
      setConflicts(new Set());
    }
  }, [myBookings, allSchedules, globalSchedules, isGlobalMode, calculateStudentMetrics, detectConflicts]);

  // Combined fetch for performance data when switching tabs if needed
  useEffect(() => {
    if (activeTab === 'performance' && profile?.id && profile?.linked_teacher_id) {
      fetchMyBookings();
    }
  }, [activeTab, profile?.id, profile?.linked_teacher_id, fetchMyBookings]);

  return (
    <div className="min-h-screen bg-bloom-white text-studio-dark p-6 sm:p-10">
      <div className="max-w-[1600px] mx-auto">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-16 gap-8">
          <div>
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-studio-dark via-[#FFB38A] to-rose-bloom tracking-tight font-display italic">
              Welcome, <span className="capitalize">{profile?.full_name?.split(' ')[0] || 'Dancer'}!</span>
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-studio-dark/80 mt-1">Student Performance Center</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
             {/* Stage Switcher Dropdown */}
             {visitedStages.length > 1 && (
               <div className="relative group">
                 <button className="px-6 py-5 bg-white/40 backdrop-blur-md border border-rose-petal/20 rounded-2xl font-black uppercase tracking-widest text-[9px] flex items-center gap-2 hover:bg-white/60 transition-all text-studio-dark">
                    My Stages ({visitedStages.length}) <ChevronLeft className="w-3 h-3 -rotate-90" />
                 </button>
                 <div className="absolute top-full right-0 mt-2 w-64 bg-white/95 backdrop-blur-2xl rounded-[2rem] border border-rose-petal/20 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] p-4 scale-95 group-hover:scale-100 origin-top-right">
                    <p className="text-[8px] font-black uppercase tracking-widest text-rose-bloom/40 mb-3 ml-2">Previously Visited</p>
                    <div className="space-y-1">
                      {visitedStages.map((stage) => (
                        <button 
                          key={stage.teacher_id}
                          onClick={() => handleSwitchStage(stage)}
                          className={`w-full p-4 rounded-xl flex items-center justify-between hover:bg-rose-bloom/5 transition-all group/item ${stage.teacher_id === profile?.linked_teacher_id ? 'bg-rose-bloom/10 border border-rose-bloom/10' : ''}`}
                        >
                          <div className="text-left">
                            <div className="text-[11px] font-black text-studio-dark group-hover/item:text-rose-bloom">{stage.full_name}</div>
                            <div className="text-[8px] font-bold text-studio-dark/30 uppercase tracking-tighter">{stage.stage_code}</div>
                          </div>
                          {stage.teacher_id === profile?.linked_teacher_id && <CheckCircle2 className="w-4 h-4 text-rose-bloom" />}
                        </button>
                      ))}
                    </div>
                 </div>
               </div>
             )}

             <button onClick={() => navigate('/student/bookings')} className="px-8 py-5 bg-white border border-apricot text-rose-bloom rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-sm flex items-center gap-3">
                <Ticket className="w-5 h-5" /> My Bookings
             </button>
             <Link to="/student/settings" className="p-5 bg-white rounded-2xl border border-apricot hover:bg-apricot/5 shadow-sm"><SettingsIcon className="w-6 h-6 text-rose-bloom" /></Link>
             <button onClick={signOut} className="p-5 bg-white rounded-2xl border border-studio-dark/20 hover:bg-rose-petal/5 transition-all shadow-sm"><LogOut className="w-6 h-6 text-rose-bloom" /></button>
          </div>
        </header>

        <div className="flex justify-center mb-16">
          <div className="bg-white/40 backdrop-blur-3xl p-2 rounded-3xl border border-apricot/40 flex gap-2 items-center shadow-xl">
            <button onClick={() => setActiveTab('studio')} className={`px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 ${activeTab === 'studio' ? 'bg-studio-dark text-white' : 'text-studio-dark/40'}`}>
              <CalendarIcon className="w-4 h-4" /> Studio Mode
            </button>
            <button onClick={() => setActiveTab('performance')} className={`px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 ${activeTab === 'performance' ? 'bg-rose-bloom text-white' : 'text-studio-dark/40'}`}>
              <Activity className="w-4 h-4" /> Performance Center
            </button>
            <button 
              onClick={() => {
                setActiveTab('studio');
                setIsGlobalMode(!isGlobalMode);
                if (!isGlobalMode) fetchGlobalSchedules();
              }} 
              className={`px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 ${isGlobalMode ? 'bg-apricot text-white' : 'text-studio-dark/40'}`}
            >
              <Sparkles className="w-4 h-4" /> {isGlobalMode ? 'Switch to Active Stage' : 'Global Studio Mode'}
            </button>
          </div>
        </div>

        {activeTab === 'studio' ? (
          loading ? (
            <div className="flex flex-col items-center justify-center py-32 bg-white/40 backdrop-blur-xl rounded-[4rem] border-2 border-dashed border-apricot/50">
               <div className="w-12 h-12 border-4 border-rose-bloom/20 border-t-rose-bloom rounded-full animate-spin mb-6" />
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-bloom/40">Synchronizing Stage...</p>
            </div>
          ) : !profile?.linked_teacher_id ? (
            <div className="flex flex-col items-center justify-center py-32 bg-white/40 backdrop-blur-xl rounded-[4rem] border-2 border-dashed border-apricot/50">
               <Lock className="w-16 h-16 text-rose-bloom mb-10 opacity-30" />
               <h2 className="text-4xl font-black text-studio-dark mb-4 text-center tracking-tighter">Your private stage is waiting.</h2>
               <p className="text-studio-dark/40 font-bold uppercase tracking-widest text-[9px] mb-12 max-w-sm text-center">Enter your instructor's code to unlock exclusive choreography.</p>
               <form onSubmit={handleJoinStage} className="w-full max-w-md flex flex-col gap-4">
                  <input type="text" placeholder="CODE" value={linkingCode} onChange={(e) => setLinkingCode(e.target.value)} className="w-full bg-white border border-apricot/60 rounded-2xl py-6 px-8 text-center text-xl font-black text-rose-bloom uppercase tracking-widest" />
                  <button disabled={linking} className="w-full bg-studio-dark text-white py-6 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3">
                    {linking ? 'Unlocking...' : 'Unlock Stage'} <ArrowRight className="w-5 h-5" />
                  </button>
               </form>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-12">
              <section className="xl:col-span-3 bg-white/60 p-10 rounded-[3.5rem] border border-apricot/60 shadow-xl">
                 <div className="flex justify-between items-center mb-10">
                   <h3 className="text-2xl font-black text-rose-bloom tracking-tight">
                     {isGlobalMode ? 'Combined Global Stage' : `${teacherProfile?.full_name || 'Instructor'}'s Stage`}
                   </h3>
                   {isGlobalMode && (
                     <div className="flex items-center gap-2 bg-red-500/10 px-4 py-2 rounded-full">
                       <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                       <span className="text-[9px] font-black text-red-500 uppercase tracking-widest text-wrap">Collision Detection Active</span>
                     </div>
                   )}
                 </div>
                 <CalendarContainer 
                  role="student" 
                  events={isGlobalMode ? globalSchedules : allSchedules} 
                  onDateClick={setSelectedDate} 
                  onEventClick={(evt) => setSelectedDate(parseISO(evt.start_time))} 
                 />
              </section>
              <aside className="space-y-8">
                  {/* Sessions for Selected Date */}
                  <div className="bg-white/60 p-8 rounded-[3rem] border border-apricot/40 shadow-sm relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-bloom mb-1">Upcoming Stages</div>
                      <h4 className="text-xl font-black mb-6 italic">{format(selectedDate, 'MMMM d')}</h4>
                      
                      <div className="space-y-4">
                        {(isGlobalMode ? globalSchedules : allSchedules)
                          .filter(s => isSameDay(parseISO(s.start_time), selectedDate))
                          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                          .length > 0 ? (
                          (isGlobalMode ? globalSchedules : allSchedules)
                            .filter(s => isSameDay(parseISO(s.start_time), selectedDate))
                            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                            .map((session, idx) => (
                              <div key={idx} className={`flex flex-col gap-4 p-6 bg-white/60 rounded-[2rem] border transition-all ${conflicts.has(session.id) ? 'border-red-500 bg-red-500/5 shadow-lg shadow-red-500/10 animate-pulse' : 'border-rose-petal/30 hover:border-rose-petal/50'}`}>
                                {/* Row 1: Time & Metadata */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={`p-2 rounded-lg ${conflicts.has(session.id) ? 'bg-red-500/20' : 'bg-rose-petal/10'}`}>
                                      <Clock className={`w-3 h-3 ${conflicts.has(session.id) ? 'text-red-600' : 'text-rose-bloom'}`} />
                                    </div>
                                    <div className="text-xs font-black text-studio-dark tracking-tight flex items-center gap-2">
                                      {format(parseISO(session.start_time), 'hh:mm a')}
                                      {conflicts.has(session.id) && (
                                        <span className="text-[7px] bg-red-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-black">Conflict</span>
                                      )}
                                    </div>
                                  </div>
                                  {isGlobalMode && session.profiles?.full_name && (
                                    <div className="text-[7px] font-black text-rose-bloom/60 uppercase tracking-tighter bg-white/40 px-2 py-1 rounded-lg">
                                      Instructor: {session.profiles.full_name}
                                    </div>
                                  )}
                                </div>

                                {/* Row 2: Routine Name */}
                                <div>
                                   <div className="text-lg font-black text-studio-dark italic tracking-tight leading-tight">
                                     {session.routines?.name || 'Standard Session'}
                                   </div>
                                </div>
                                
                                {/* Row 3: Action Button */}
                                <div>
                                  {(() => {
                                     // Find active booking, prioritizing PAID/PENDING over VOID
                                     const myBooking = myBookings
                                                                               .filter(b => {
                                          const b_sid = b.schedule_id || b.schedules?.id || b.schedules?.[0]?.id;
                                          return b_sid === session.id && b.status !== 'CANCELLED' && b.status !== 'STUDENT CANCELLED';
                                        })

                                       .sort((a, b) => {
                                         const priority = { 'PAID': 0, 'PENDING': 1, 'VOID': 2 };
                                         return (priority[a.payment_status] || 9) - (priority[b.payment_status] || 9);
                                       })[0];
                                    const isFull = (session.seats_taken || 0) >= (session.max_seats || 20);
                                    const isCancelled = session.status === 'CANCELLED';
                                    const isPastSession = new Date(session.start_time) < new Date();
                                    
                                    if (isCancelled) {
                                      return (
                                        <div className="w-full py-3 bg-red-500/10 text-red-500 rounded-xl font-black uppercase text-[8px] tracking-widest flex items-center justify-center gap-2 border border-red-500/20">
                                          <XCircle className="w-3 h-3" /> SESSION CANCELLED
                                        </div>
                                      );
                                    }

                                    if (isPastSession) {
                                      return (
                                        <div className="w-full py-3 bg-zinc-100/50 text-zinc-400 rounded-xl font-black uppercase text-[8px] tracking-widest flex items-center justify-center gap-2 border border-zinc-200 cursor-not-allowed">
                                          <Clock className="w-3 h-3" /> SESSION EXPIRED
                                        </div>
                                      );
                                    }

                                    if (myBooking) {
                                      const isPaid = myBooking.payment_status === 'PAID';
                                      const paySettings = teacherProfile?.payment_settings || {};
                                      const paypalUrl = paySettings.config?.paypal_url;
                                      const hasPaypal = paySettings.enabledMethods?.includes('paypal') && paypalUrl;
                                      
                                      return (
                                        <div className="flex flex-col gap-2 w-full">
                                          <div className={`w-full py-3 rounded-xl font-black uppercase text-[8px] tracking-widest flex items-center justify-center gap-2 border shadow-sm ${
                                            isPaid ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                            myBooking.payment_confirmed_by_student ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                            'bg-rose-bloom/10 text-rose-bloom border-rose-bloom/20'
                                          }`}>
                                            {isPaid ? <CheckCircle2 className="w-3 h-3" /> : (myBooking.payment_confirmed_by_student ? <Clock className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />)}
                                            {isPaid ? (myBooking.payment_method === 'LOYALTY_REWARD' ? 'LOYALTY REWARD' : 'PAID & READY') : (myBooking.payment_confirmed_by_student ? 'PENDING VERIFICATION' : 'RESERVED')}
                                          </div>
                                          {!isPaid && (
                                            myBooking.payment_method === 'PAYPAL' && hasPaypal && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const finalUrl = paypalUrl.startsWith('http') ? paypalUrl : `https://${paypalUrl}`;
                                                  window.open(finalUrl, '_blank');
                                                }}
                                                className="w-full py-3 bg-studio-dark text-white rounded-xl font-black uppercase text-[8px] tracking-widest flex items-center justify-center gap-2 hover:bg-rose-bloom transition-all shadow-lg shadow-studio-dark/5"
                                              >
                                                Complete Payment <ArrowRight className="w-3 h-3" />
                                              </button>
                                            )
                                          )}
                                        </div>
                                      );
                                    }

                                    if (isFull) {
                                      return (
                                        <div className="w-full py-3 bg-studio-dark/10 text-studio-dark/40 rounded-xl font-black uppercase text-[8px] tracking-widest flex items-center justify-center gap-2 cursor-not-allowed border border-studio-dark/5">
                                          <X className="w-3 h-3" /> SOLD OUT
                                        </div>
                                      );
                                    }

                                    return (
                                      <button
                                        onClick={() => navigate(`/student/book/${session.teacher_id}${isGlobalMode ? '' : `?sessionId=${session.id}`}`)}
                                        className="w-full py-3 bg-studio-dark text-white rounded-xl font-black uppercase text-[8px] tracking-widest flex items-center justify-center gap-2 hover:bg-rose-bloom transition-all shadow-lg shadow-studio-dark/10"
                                      >
                                        Book Routine <ArrowRight className="w-3 h-3" />
                                      </button>
                                    );
                                  })()}
                                </div>
                              </div>
                            ))
                        ) : (
                          <div className="py-12 text-center">
                            <CalendarIcon className="w-12 h-12 text-studio-dark/10 mx-auto mb-4" />
                            <p className="text-[9px] font-black text-studio-dark/30 uppercase tracking-widest">No sessions scheduled <br /> for this date.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Loyalty Stamp Card */}
                  {teacherProfile?.loyalty_settings?.enabled !== false && (
                    <div className="bg-gradient-to-br from-studio-dark to-rose-bloom p-8 rounded-[3rem] text-white shadow-xl shadow-rose-bloom/10 relative overflow-hidden group">
                      <Sparkles className="absolute -right-2 -top-2 w-16 h-16 text-white/10 group-hover:rotate-12 transition-transform" />
                      <div className="relative z-10">
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60 mb-1">Loyalty Rewards</div>
                        <h4 className="text-lg font-black mb-6 italic">Stage Pass Progress</h4>
                        
                        <div className="grid grid-cols-5 gap-3 mb-6">
                          {Array.from({ length: studentStats.loyaltyProgress?.total || 10 }).map((_, i) => (
                            <div key={i} className={`aspect-square rounded-xl flex items-center justify-center border-2 transition-all ${
                              i < (studentStats.loyaltyProgress?.current || 0)
                              ? 'bg-white border-white scale-110' 
                              : 'bg-white/5 border-white/20'
                            }`}>
                              {i < (studentStats.loyaltyProgress?.current || 0) && (
                                <Heart className="w-3 h-3 text-amber-500 fill-amber-500" />
                              )}
                            </div>
                          ))}
                          <div className={`aspect-square rounded-xl flex items-center justify-center border-2 border-dashed ${
                             studentStats.loyaltyProgress?.isUnlocked ? 'bg-amber-500 border-white animate-bounce shadow-lg shadow-amber-500/40' : 'bg-white/5 border-white/20 opacity-50'
                          }`}>
                            <Ticket className={`w-4 h-4 ${studentStats.loyaltyProgress?.isUnlocked ? 'text-white' : 'text-white/20'}`} />
                          </div>
                        </div>

                        <div className="text-center">
                          {studentStats.loyaltyProgress?.isUnlocked ? (
                            <div className="text-[10px] font-black uppercase tracking-widest text-apricot">Stage Gift Unlocked!</div>
                          ) : (
                            <div className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                              {studentStats.loyaltyProgress?.remaining} classes to your free session
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-white/60 p-10 rounded-[3rem] border border-apricot/60 text-center">
                     <div className="text-[10px] font-black text-rose-bloom uppercase tracking-widest mb-2">Stage Credits</div>
                    <div className="text-4xl font-black text-studio-dark mb-8">${studentCredits.toFixed(2)}</div>
                    <div className="space-y-4">
                      {visitedStages.length > 1 && (
                        <div className="pt-6 border-t border-apricot/20">
                          <div className="text-[9px] font-black text-studio-dark/40 uppercase tracking-widest mb-4">Quick Switch Stage</div>
                          <div className="space-y-2">
                            {visitedStages.filter(s => s.teacher_id !== profile?.linked_teacher_id).map((link, idx) => (
                              <button 
                                key={idx}
                                onClick={() => handleSwitchStage(link)}
                                className="w-full p-4 bg-white border border-apricot/20 rounded-2xl flex items-center justify-between hover:border-rose-bloom transition-all group"
                              >
                                <div className="text-left">
                                  <div className="text-[10px] font-black text-studio-dark group-hover:text-rose-bloom">{link.full_name}</div>
                                  <div className="text-[8px] font-bold text-studio-dark/30 uppercase tracking-tighter">{link.stage_code}</div>
                                </div>
                                <ArrowRight className="w-3 h-3 text-studio-dark/20 group-hover:text-rose-bloom" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <button onClick={handleDisconnect} className="w-full py-4 bg-red-100/50 border border-red-200 text-red-500 rounded-2xl font-black uppercase text-[10px] hover:bg-red-100">Disconnect Stage</button>
                    </div>
                 </div>
              </aside>
            </div>
          )
        ) : (
          <div className="mt-8 space-y-12 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white/70 backdrop-blur-3xl p-10 rounded-[4rem] border border-studio-dark/20 shadow-xl relative overflow-hidden">
               <div className="flex justify-between items-end mb-12 relative z-10">
                  <div>
                    <h2 className="text-3xl font-black text-studio-dark tracking-tight italic">Stage History</h2>
                    <p className="text-[10px] font-black text-rose-bloom uppercase tracking-[0.2em]">Investment & Energy Trends</p>
                 </div>
                 <div className="flex gap-4 items-center">
                   <div className="bg-bloom-white p-1 rounded-2xl border border-apricot/20">
                     <select 
                       value={timeRange}
                       onChange={(e) => setTimeRange(e.target.value)}
                       className="px-4 py-2 bg-transparent text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer border-none"
                     >
                       <option value="30days">Month</option>
                       <option value="90days">Quarter</option>
                       <option value="year">Year</option>
                       <option value="ytd">YTD</option>
                       <option value="all">Total</option>
                     </select>
                   </div>
                   <div className="px-6 py-4 bg-bloom-white rounded-3xl border border-apricot/20 text-center"><div className="text-[9px] font-black text-studio-dark/30 uppercase mb-1">Total Power</div><div className="text-2xl font-black text-studio-dark">${studentStats.totalSpent}</div></div>
                 </div>
               </div>
                <div className="h-72 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={studentStats.spendingTrend}>
                       <defs>
                         <linearGradient id="colorStudentGrowth" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#FE7A8A" stopOpacity={0.6}/>
                           <stop offset="40%" stopColor="#FE7A8A" stopOpacity={0.2}/>
                           <stop offset="95%" stopColor="#FE7A8A" stopOpacity={0}/>
                         </linearGradient>
                       </defs>
                       <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#4A3B3E40' }} dy={10} />
                       <YAxis hide />
                       <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#FE7A8A', strokeWidth: 2, strokeDasharray: '5 5' }} />
                       <Area 
                         type="monotone" 
                         dataKey="amount" 
                         stroke="#FE7A8A" 
                         strokeWidth={6} 
                         fillOpacity={1} 
                         fill="url(#colorStudentGrowth)" 
                         animationDuration={2500}
                         activeDot={{ r: 8, fill: '#FE7A8A', stroke: '#fff', strokeWidth: 4 }}
                       />
                       <Area type="monotone" dataKey="sessions" stroke="#4A3B3E" strokeWidth={2} strokeDasharray="6 6" fill="transparent" />
                     </AreaChart>
                   </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
               <div className="bg-white/70 backdrop-blur-3xl p-10 rounded-[3rem] border border-studio-dark/20 shadow-xl">
                  <div className="flex justify-between items-center mb-10"><h3 className="text-xl font-black text-studio-dark uppercase tracking-tighter">Routine Mix</h3><PieChart className="w-5 h-5 text-rose-bloom opacity-30" /></div>
                   <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie 
                          activeIndex={activeIndex}
                          activeShape={renderActiveShape}
                          data={studentStats.routineCategoryMix} 
                          innerRadius={55} 
                          outerRadius={75} 
                          paddingAngle={10} 
                          dataKey="value" 
                          stroke="none"
                          onMouseEnter={onPieEnter}
                        >
                          {studentStats.routineCategoryMix.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#FE7A8A', '#4A3B3E', '#FFB38A'][index % 3]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-around mt-6">
                    {studentStats.routineCategoryMix.map((entry, index) => (
                      <div key={index} className="text-center"><div className="text-[9px] font-black uppercase text-studio-dark/30 mb-1">{entry.name}</div><div className="text-lg font-black text-studio-dark">{entry.value}</div></div>
                    ))}
                  </div>
               </div>

               <div className="lg:col-span-2 bg-white/70 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-studio-dark/20 shadow-xl">
                  <div className="flex justify-between items-center mb-10"><h3 className="text-xl font-black text-studio-dark uppercase tracking-tighter italic">Weekly Energy</h3><TrendingUp className="w-5 h-5 text-rose-bloom opacity-30" /></div>
                   <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={studentStats.consistency}>
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#4A3B3E40' }} dy={10} />
                        <YAxis hide />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#FE7A8A', fillOpacity: 0.1 }} />
                        <Bar dataKey="count" radius={[12, 12, 12, 12]} barSize={20}>
                          {studentStats.consistency.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#FE7A8A' : '#4A3B3E10'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
               {[
                 { label: 'Total Energy', val: studentStats.totalSessions, icon: Lock, color: 'text-rose-bloom' },
                 { label: 'Energy Burn', val: `${studentStats.energyBurn} KCAL`, icon: Activity, color: 'text-rose-bloom' },
                 { label: 'Consistency', val: `${Math.round((studentStats.totalSessions / 10) * 100)}%`, icon: Sparkles, color: 'text-rose-bloom' },
                 { label: 'Stage Rank', val: 'Lead Dancer', icon: TrendingUp, color: 'text-rose-bloom' }
               ].map((item, i) => (
                 <div key={i} className="bg-white p-10 rounded-[3rem] border border-studio-dark/15 text-center">
                    <div className="text-[10px] font-black text-studio-dark/30 uppercase tracking-widest mb-3">{item.label}</div>
                    <div className="text-3xl font-black text-studio-dark">{item.val}</div>
                 </div>
               ))}
            </div>
          </div>
        )}
        <ManualPaymentModal 
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          booking={selectedBookingForPayment}
          teacherProfile={teacherProfile}
          onConfirm={() => handleConfirmPayment(selectedBookingForPayment.id)}
        />
      </div>
    </div>
  );
}

function ManualPaymentModal({ isOpen, onClose, booking, teacherProfile, onConfirm }) {
  if (!isOpen || !booking) return null;

  const bankInstructions = teacherProfile?.payment_settings?.config?.bank_instructions;

  return (
    <AnimatePresence>
      <Motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="fixed inset-0 z-[100] bg-studio-dark/60 backdrop-blur-md flex items-center justify-center p-6"
      >
        <Motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.9, y: 20 }} 
          onClick={e => e.stopPropagation()}
          className="bg-white w-full max-w-xl rounded-[3rem] overflow-hidden shadow-2xl border border-apricot/30"
        >
          <div className="p-10 border-b border-apricot/10 flex justify-between items-center bg-apricot/5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-bloom/10 rounded-2xl">
                <Landmark className="w-6 h-6 text-rose-bloom" />
              </div>
              <h3 className="text-2xl font-black text-studio-dark italic">Payment Instructions</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-rose-bloom/10 rounded-xl transition-all text-studio-dark/20 hover:text-rose-bloom">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-10 space-y-8">
            {/* Bank Transfer Section */}
            {bankInstructions ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-studio-dark/40">
                  <ShieldCheck className="w-4 h-4" /> Bank Transfer Details
                </div>
                <div className="p-6 bg-bloom-white border-2 border-apricot/10 rounded-2xl font-mono text-xs text-studio-dark whitespace-pre-wrap leading-relaxed">
                  {bankInstructions}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-amber-600 leading-relaxed">
                Bank details haven't been configured by the instructor yet. Please contact them directly or pay in person.
              </div>
            )}

            {/* Cash Section */}
            <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-start gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-widest text-emerald-700 italic">Pay in Person</h4>
                <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-tight">You can also pay in cash at the studio upon arrival.</p>
              </div>
            </div>

            <div className="pt-6 border-t border-apricot/10">
              {booking.payment_method === 'BANK' ? (
                <button
                  disabled={booking.payment_confirmed_by_student}
                  onClick={onConfirm}
                  className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl transition-all ${
                    booking.payment_confirmed_by_student 
                    ? 'bg-emerald-500 text-white cursor-default' 
                    : 'bg-studio-dark text-white hover:bg-rose-bloom shadow-studio-dark/20'
                  }`}
                >
                  {booking.payment_confirmed_by_student ? (
                    <>
                      <Check className="w-4 h-4" /> Transfer Notified
                    </>
                  ) : (
                    <>
                      PAY and confirm <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full py-5 bg-studio-dark text-white hover:bg-rose-bloom rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl shadow-studio-dark/20 transition-all"
                >
                  Got it! <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {booking.payment_method === 'BANK' && (
                <p className="text-[8px] font-bold text-studio-dark/30 uppercase tracking-[0.2em] text-center mt-4">
                  Click only after completing the bank transfer.
                </p>
              )}
            </div>
          </div>
        </Motion.div>
      </Motion.div>
    </AnimatePresence>
  );
}
