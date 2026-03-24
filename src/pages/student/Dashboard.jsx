import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Calendar as CalendarIcon, Clock, MapPin, 
  Sparkles, Search, SlidersHorizontal, Heart, Ticket, Eye, Lock, ArrowRight, X,
  LogOut, Settings as SettingsIcon, CheckCircle2, Activity, PieChart, BarChart3,
  DollarSign, TrendingUp
} from 'lucide-react';
import { isSameDay, format, parseISO, subDays, eachDayOfInterval, subMonths, isSameMonth } from 'date-fns';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart as RePieChart, Pie, RadialBarChart, RadialBar, Legend
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
  const [timeRange, setTimeRange] = useState('90days');
  const [studentCredits, setStudentCredits] = useState(0);
  const [visitedStages, setVisitedStages] = useState([]);
  const navigate = useNavigate();


  useEffect(() => {
    const pendingCode = localStorage.getItem('pending_teacher_code');
    const currentCode = profile?.stage_code;
    
    if (profile?.visited_stages) {
      setVisitedStages(profile.visited_stages);
    }
    
    if (pendingCode) {
      syncTeacherLink(pendingCode);
    } else if (profile?.linked_teacher_id) {
      fetchTeacherProfile(profile.linked_teacher_id);
      fetchAllAvailableSchedules(profile.linked_teacher_id);
    } else if (currentCode && !profile?.linked_teacher_id) {
      syncTeacherLink(currentCode);
    } else {
      setLoading(false);
    }
  }, [profile?.linked_teacher_id, profile?.role, profile?.id, profile?.stage_code]);

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
        if (profile?.id) {
          await supabase.from('profiles').update({ linked_teacher_id: teacher.id }).eq('id', profile.id);
        }
        
        localStorage.removeItem('pending_teacher_code');
        await fetchProfile();
        
        if (teacher.id !== profile?.linked_teacher_id) {
          toast.success(`Connected to instructor: ${teacher.full_name}`);
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
        .eq('status', 'SCHEDULED')
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
        .select('full_name, avatar_url, loyalty_settings')
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
        .eq('status', 'SCHEDULED')
        .limit(20);
      if (error) throw error;
      setGlobalSchedules(data || []);
    } catch (err) {
      console.error('[Dashboard] Global fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSwitchStage = async (teacherLink) => {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      // 1. Update active link in DB
      await supabase.from('profiles').update({ linked_teacher_id: teacherLink.teacher_id }).eq('id', profile.id);
      
      // 3. Update visited stages order
      const updatedVisited = visitedStages.map(s => 
        s.teacher_id === teacherLink.teacher_id ? { ...s, last_visited: new Date().toISOString() } : s
      ).sort((a, b) => new Date(b.last_visited) - new Date(a.last_visited));
      
      await supabase.from('profiles').update({ visited_stages: updatedVisited }).eq('id', profile.id);
      setVisitedStages(updatedVisited);

      // 4. Refresh Dashboard
      toast.success(`Switched to: ${teacherLink.full_name}'s Stage`);
      await fetchTeacherProfile(teacherLink.teacher_id);
      await fetchAllAvailableSchedules(teacherLink.teacher_id);
    } catch (err) {
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
        .select('*, schedules(id, start_time, routines(name))')
        .eq('student_id', profile.id)
        .in('payment_status', ['PAID', 'PENDING', 'VOID']);
      
      if (error) throw error;
      setMyBookings(data || []);
    } catch (err) {
      console.error('[Dashboard] Fetch bookings error:', err);
    }
  }, [profile?.id]);

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
      count: paidBookings.filter(booking => isSameDay(parseISO(booking.schedules.start_time), date)).length
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

    // Loyalty Progress (Specific to active teacher)
    const activeTeacherBookings = paidBookings.filter(b => b.teacher_id === profile?.linked_teacher_id);
    const loyaltySettings = teacherProfile?.loyalty_settings || { required_sessions: 10, enabled: true };
    const loyaltyCount = activeTeacherBookings.length % (loyaltySettings.required_sessions + 1);
    const sessionsRemaining = loyaltySettings.required_sessions - loyaltyCount;

    setStudentStats({
      totalSessions, routineVariety: routineVarietyWithPerformance, routineCategoryMix, attendanceTrend, energyBurn: Math.round(totalEnergyBurn),
      consistency: dayStats, totalSpent: Math.round(totalSpent), monthlySpent: Math.round(monthlySpent), quarterlySpent: Math.round(quarterlySpent),
      ytdSpent: Math.round(ytdSpent), spendingTrend,
      loyaltyProgress: {
        current: loyaltyCount,
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
    setLoading(true);
    try {
      if (profile?.id) {
        await supabase.from('profiles').update({ linked_teacher_id: null }).eq('id', profile.id);
      }
      localStorage.removeItem('studio_guest_session');
      localStorage.removeItem('pending_teacher_code');
      await fetchProfile();
      toast.success('Stage presence cleared.');
      setTimeout(() => { window.location.href = '/'; }, 500);
    } catch (err) {
      console.error('[Dashboard] Disconnect error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.id && profile?.linked_teacher_id) {
      fetchMyBookings();
    } else {
      setMyBookings([]);
      setStudentStats({
        totalSessions: 0, routineVariety: [], routineCategoryMix: [], attendanceTrend: [], energyBurn: 0, consistency: [],
        totalSpent: 0, monthlySpent: 0, quarterlySpent: 0, ytdSpent: 0, spendingTrend: []
      });
    }
  }, [profile?.id, profile?.linked_teacher_id, fetchMyBookings]);

  useEffect(() => {
    if (myBookings.length > 0 && allSchedules.length > 0) {
      calculateStudentMetrics(myBookings, allSchedules);
    }
  }, [myBookings, allSchedules, calculateStudentMetrics]);

  useEffect(() => {
    if (profile?.id && profile?.linked_teacher_id) {
      fetchStudentCredits();
    }
  }, [profile?.id, profile?.linked_teacher_id, fetchStudentCredits]);

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
          <div className="flex gap-4">
             <button onClick={() => navigate('/student/bookings')} className="px-8 py-5 bg-white border border-apricot/40 text-rose-bloom rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-sm flex items-center gap-3">
                <Ticket className="w-5 h-5" /> My Bookings
             </button>
             <a href="/student/settings" className="p-5 bg-white rounded-2xl border border-apricot/40 hover:bg-apricot/5 shadow-sm"><SettingsIcon className="w-6 h-6 text-rose-bloom" /></a>
             <button onClick={signOut} className="p-5 bg-white rounded-2xl border border-studio-dark/20 hover:bg-rose-petal/5 transition-all shadow-sm"><LogOut className="w-6 h-6 text-rose-bloom" /></button>
          </div>
        </header>

        <div className="flex justify-center mb-16">
          <div className="bg-white/40 backdrop-blur-3xl p-2 rounded-3xl border border-apricot/20 flex gap-2 items-center shadow-xl">
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
          !profile?.linked_teacher_id ? (
            <div className="flex flex-col items-center justify-center py-32 bg-white/40 backdrop-blur-xl rounded-[4rem] border-2 border-dashed border-apricot/50">
               <Lock className="w-16 h-16 text-rose-bloom mb-10 opacity-30" />
               <h2 className="text-4xl font-black text-studio-dark mb-4 text-center tracking-tighter">Your private stage is waiting.</h2>
               <p className="text-studio-dark/40 font-bold uppercase tracking-widest text-[9px] mb-12 max-w-sm text-center">Enter your instructor's code to unlock exclusive choreography.</p>
               <form onSubmit={handleJoinStage} className="w-full max-w-md flex flex-col gap-4">
                  <input type="text" placeholder="CODE" value={linkingCode} onChange={(e) => setLinkingCode(e.target.value)} className="w-full bg-white border border-apricot/60 rounded-2xl py-6 px-8 text-center text-xl font-black text-rose-bloom uppercase tracking-widest" />
                  <button className="w-full bg-studio-dark text-white py-6 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3">Unlock Stage <ArrowRight className="w-5 h-5" /></button>
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
                          .length > 0 ? (
                          (isGlobalMode ? globalSchedules : allSchedules)
                            .filter(s => isSameDay(parseISO(s.start_time), selectedDate))
                            .map((session, idx) => (
                              <div key={idx} className="bg-white p-6 rounded-3xl border border-apricot/10 hover:border-rose-bloom transition-all group/card shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                  <div className="flex items-center gap-3">
                                    <div className="p-3 bg-apricot/5 rounded-2xl">
                                      <Clock className="w-4 h-4 text-rose-bloom" />
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-black text-rose-bloom uppercase tracking-widest">{format(parseISO(session.start_time), 'h:mm a')}</div>
                                      <div className="text-[8px] font-bold text-studio-dark/30 uppercase tracking-tighter">{session.routines?.duration_minutes || 60} MIN</div>
                                    </div>
                                  </div>
                                  <div className="text-lg font-black text-studio-dark">${session.price}</div>
                                </div>
                                
                                <h5 className="text-sm font-black text-studio-dark mb-6 group-hover/card:text-rose-bloom transition-colors">{session.routines?.name}</h5>
                                
                                 {(() => {
                                   const myBooking = myBookings.find(b => b.schedule_id === session.id);
                                   const isFull = (session.seats_taken || 0) >= (session.max_seats || 20);
                                   
                                   if (myBooking) {
                                     const isPaid = myBooking.payment_status === 'PAID';
                                     return (
                                       <div className={`w-full py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 border-2 ${isPaid ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-bloom/10 text-rose-bloom border-rose-bloom/20'}`}>
                                         {isPaid ? <CheckCircle2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                                         {isPaid ? 'PAID & READY' : 'RESERVED'}
                                       </div>
                                     );
                                   }

                                   if (isFull) {
                                     return (
                                       <div className="w-full py-4 bg-studio-dark/10 text-studio-dark/40 rounded-2xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 cursor-not-allowed">
                                         <X className="w-4 h-4" /> SOLD OUT
                                       </div>
                                     );
                                   }

                                   return (
                                     <button
                                       onClick={() => navigate(`/student/book/${session.teacher_id}${isGlobalMode ? '' : `?sessionId=${session.id}`}`)}
                                       className="w-full py-4 bg-studio-dark text-white rounded-2xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 hover:bg-rose-bloom transition-all shadow-lg shadow-studio-dark/10"
                                     >
                                       Book Routine <ArrowRight className="w-4 h-4" />
                                     </button>
                                   );
                                 })()}
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
                                <Heart className="w-3 h-3 text-rose-bloom fill-rose-bloom" />
                              )}
                            </div>
                          ))}
                          <div className={`aspect-square rounded-xl flex items-center justify-center border-2 border-dashed ${
                             studentStats.loyaltyProgress?.isUnlocked ? 'bg-apricot border-white animate-bounce' : 'bg-white/5 border-white/20 opacity-50'
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

                  <div className="bg-white/60 p-10 rounded-[3rem] border border-apricot/40 text-center">
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
                        <linearGradient id="colorStudentGrowth" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FE7A8A" stopOpacity={0.2}/><stop offset="95%" stopColor="#FE7A8A" stopOpacity={0}/></linearGradient>
                      </defs>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#4A3B3E40' }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ backgroundColor: '#4A3B3E', borderRadius: '16px', border: 'none', color: '#fff', fontSize: '10px' }} />
                      <Area type="monotone" dataKey="amount" stroke="#FE7A8A" strokeWidth={5} fill="url(#colorStudentGrowth)" animationDuration={2000} />
                      <Area type="monotone" dataKey="sessions" stroke="#4A3B3E" strokeWidth={2} strokeDasharray="4 4" fill="transparent" />
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
                        <Pie data={studentStats.routineCategoryMix} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" stroke="none">
                          {studentStats.routineCategoryMix.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#FE7A8A', '#FFB38A', '#4A3B3E', '#FFB38A'][index % 4]} />
                          ))}
                        </Pie>
                        <Tooltip />
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
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#4A3B3E40' }} />
                        <YAxis hide />
                        <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                          {studentStats.consistency.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#FE7A8A' : '#FE7A8A20'} />
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
      </div>
    </div>
  );
}
