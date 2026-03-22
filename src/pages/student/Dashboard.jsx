import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Calendar as CalendarIcon, Clock, MapPin, 
  Sparkles, Search, SlidersHorizontal, Heart, Ticket, Eye, Lock, ArrowRight, X,
  LogOut, Settings as SettingsIcon, CheckCircle2, Activity, PieChart, BarChart3,
  DollarSign, TrendingUp
} from 'lucide-react';
import { isSameDay, format, parseISO, subDays, eachDayOfInterval, startOfWeek, endOfWeek, subMonths, isSameMonth } from 'date-fns';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart as RePieChart, Pie, RadialBarChart, RadialBar, Legend
} from 'recharts';
import { toast } from 'sonner';
import CalendarContainer from '../../components/CalendarContainer';

const SEED_TEACHERS = [
  { id: 'seed-smruti-3617', full_name: 'Smruti Pillai', invite_code: 'ZUMBA-SMRUTIPILLAI-3617', role: 'TEACHER' },
  { id: 'seed-angella-5640', full_name: 'Angella', invite_code: 'ZUMBA-ANGELLA-5640', role: 'TEACHER' }
];

export default function StudentDashboard() {
  const { profile: authProfile, signOut, fetchProfile } = useAuth();
  const [guestProfile, setGuestProfile] = useState(() => {
    return JSON.parse(localStorage.getItem('zumba_guest_session') || 'null');
  });
  
  const profile = authProfile || guestProfile;
  
  const [allSchedules, setAllSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linkingCode, setLinkingCode] = useState('');
  const [linking, setLinking] = useState(false);
  const syncLockRef = React.useRef(false);
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [myBookings, setMyBookings] = useState([]);
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
  const navigate = useNavigate();


  useEffect(() => {
    const pendingCode = localStorage.getItem('pending_teacher_code');
    const currentCode = profile?.stage_code || guestProfile?.stage_code;
    
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

    const handleStorageChange = (e) => {
      if (e.key === 'zumba_guest_session') {
         const newGuest = JSON.parse(e.newValue || 'null');
         setGuestProfile(newGuest);
         if (newGuest?.linked_teacher_id) {
           fetchTeacherProfile(newGuest.linked_teacher_id);
           fetchAllAvailableSchedules(newGuest.linked_teacher_id);
         }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [profile?.linked_teacher_id, profile?.role, guestProfile?.id, guestProfile?.stage_code]);

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
      teacher = data;

      if (teacher) {
        if (profile?.id) {
          await supabase.from('profiles').update({ linked_teacher_id: teacher.id }).eq('id', profile.id);
        }

        const guestSess = JSON.parse(localStorage.getItem('zumba_guest_session') || 'null');
        // Use existing ID or generate a stable one based on the code to prevent Date.now() loops
        const stableGuestId = guestSess?.id || 'guest-' + btoa(code).slice(0, 12);
        const updatedGuest = guestSess || { id: stableGuestId, role: 'STUDENT', is_guest: true };
        
        updatedGuest.linked_teacher_id = teacher.id;
        updatedGuest.stage_code = code.toUpperCase().trim();
        localStorage.setItem('zumba_guest_session', JSON.stringify(updatedGuest));
        
        // Only update state if it actually changed to prevent unnecessary re-renders
        if (JSON.stringify(updatedGuest) !== JSON.stringify(guestProfile)) {
          setGuestProfile(updatedGuest);
        }
        
        localStorage.removeItem('pending_teacher_code');
        await fetchProfile();
        
        if (teacher.id !== profile?.linked_teacher_id) {
          toast.success(`Connected to instructor: ${teacher.full_name}`);
        }
        await fetchTeacherProfile(teacher.id);
        await fetchAllAvailableSchedules(teacher.id);
      } else {
        localStorage.removeItem('pending_teacher_code');
        const guestSess = JSON.parse(localStorage.getItem('zumba_guest_session') || 'null');
        if (guestSess && guestSess.stage_code === code) {
          delete guestSess.stage_code;
          localStorage.setItem('zumba_guest_session', JSON.stringify(guestSess));
          setGuestProfile(guestSess);
        }
        if (code !== '') toast.error('Invalid stage code. Please check with your instructor.');
      }
    } catch (err) {
      console.error('[Dashboard] Sync error:', err);
    } finally {
      syncLockRef.current = false;
      setLinking(false);
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
  }, [profile?.id, profile?.linked_teacher_id]);

  useEffect(() => {
    if (myBookings.length > 0 && allSchedules.length > 0) {
      calculateStudentMetrics(myBookings, allSchedules);
    }
  }, [myBookings, allSchedules, timeRange]);

  useEffect(() => {
    if (profile?.id && profile?.linked_teacher_id) {
      fetchStudentCredits();
    }
  }, [profile?.id, profile?.linked_teacher_id]);

  const fetchStudentCredits = async () => {
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
  };

  const fetchAllAvailableSchedules = async (explicitTeacherId) => {
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
  };

  const fetchTeacherProfile = async (explicitTeacherId) => {
    const teacherId = explicitTeacherId || profile?.linked_teacher_id;
    if (!teacherId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', teacherId)
        .single();
      
      if (!error && data) setTeacherProfile(data);
    } catch (err) {
      console.error('[Dashboard] Fetch teacher profile error:', err);
    }
  };

  const fetchMyBookings = async () => {
    const studentId = profile?.id || guestProfile?.id;
    if (!studentId) return;
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, schedules(start_time, routines(name))')
        .eq('student_id', studentId)
        .in('payment_status', ['PAID', 'PENDING', 'VOID']);
      
      if (error) throw error;
      setMyBookings(data || []);
    } catch (err) {
      console.error('[Dashboard] Fetch bookings error:', err);
    }
  };

  const calculateStudentMetrics = (bookings, schedules) => {
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
    const categoryCounts = { 'HIIT': 0, 'Yoga': 0, 'Zumba': 0, 'Strength': 0 };
    paidBookings.forEach(booking => {
      const name = (booking.schedules?.routines?.name || '').toUpperCase();
      if (name.includes('ZUMBA')) categoryCounts['Zumba']++;
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

    setStudentStats({
      totalSessions, routineVariety: routineVarietyWithPerformance, routineCategoryMix, attendanceTrend, energyBurn: Math.round(totalEnergyBurn),
      consistency: dayStats, totalSpent: Math.round(totalSpent), monthlySpent: Math.round(monthlySpent), quarterlySpent: Math.round(quarterlySpent),
      ytdSpent: Math.round(ytdSpent), spendingTrend
    });
  };

  const handleJoinStage = async (e) => {
    e.preventDefault();
    if (!linkingCode || linking) return;
    syncTeacherLink(linkingCode);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const studentId = profile?.id || guestProfile?.id;
      if (studentId) {
        await supabase.from('profiles').update({ linked_teacher_id: null }).eq('id', studentId);
      }
      localStorage.removeItem('zumba_guest_session');
      localStorage.removeItem('pending_teacher_code');
      setGuestProfile(null);
      await fetchProfile();
      toast.success('Stage presence cleared.');
      setTimeout(() => { window.location.href = '/'; }, 500);
    } catch (err) {
      console.error('[Dashboard] Disconnect error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bloom-white text-theatre-dark p-6 sm:p-10">
      <div className="max-w-[1600px] mx-auto">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-16 gap-8">
          <div>
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-theatre-dark via-[#FFB38A] to-rose-bloom tracking-tight font-display italic">
              Welcome, <span className="capitalize">{profile?.full_name?.split(' ')[0] || 'Dancer'}!</span>
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-theatre-dark/80 mt-1">Student Performance Center</p>
          </div>
          <div className="flex gap-4">
             <button onClick={() => navigate('/student/bookings')} className="px-8 py-5 bg-white border border-apricot/40 text-rose-bloom rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-sm flex items-center gap-3">
                <Ticket className="w-5 h-5" /> My Bookings
             </button>
             <a href="/student/settings" className="p-5 bg-white rounded-2xl border border-apricot/40 hover:bg-apricot/5 shadow-sm"><SettingsIcon className="w-6 h-6 text-rose-bloom" /></a>
             <button onClick={signOut} className="p-5 bg-white rounded-2xl border border-theatre-dark/20 hover:bg-rose-petal/5 transition-all shadow-sm"><LogOut className="w-6 h-6 text-rose-bloom" /></button>
          </div>
        </header>

        <div className="flex justify-center mb-16">
          <div className="bg-white/40 backdrop-blur-3xl p-2 rounded-3xl border border-apricot/20 flex gap-2 items-center shadow-xl">
            <button onClick={() => setActiveTab('studio')} className={`px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 ${activeTab === 'studio' ? 'bg-theatre-dark text-white' : 'text-theatre-dark/40'}`}>
              <CalendarIcon className="w-4 h-4" /> Studio Mode
            </button>
            <button onClick={() => setActiveTab('performance')} className={`px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 ${activeTab === 'performance' ? 'bg-rose-bloom text-white' : 'text-theatre-dark/40'}`}>
              <Activity className="w-4 h-4" /> Performance Center
            </button>
          </div>
        </div>

        {activeTab === 'studio' ? (
          !profile?.linked_teacher_id ? (
            <div className="flex flex-col items-center justify-center py-32 bg-white/40 backdrop-blur-xl rounded-[4rem] border-2 border-dashed border-apricot/50">
               <Lock className="w-16 h-16 text-rose-bloom mb-10 opacity-30" />
               <h2 className="text-4xl font-black text-theatre-dark mb-4 text-center tracking-tighter">Your private stage is waiting.</h2>
               <p className="text-theatre-dark/40 font-bold uppercase tracking-widest text-[9px] mb-12 max-w-sm text-center">Enter your instructor's code to unlock exclusive choreography.</p>
               <form onSubmit={handleJoinStage} className="w-full max-w-md flex flex-col gap-4">
                  <input type="text" placeholder="CODE" value={linkingCode} onChange={(e) => setLinkingCode(e.target.value)} className="w-full bg-white border border-apricot/60 rounded-2xl py-6 px-8 text-center text-xl font-black text-rose-bloom uppercase tracking-widest" />
                  <button className="w-full bg-theatre-dark text-white py-6 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3">Unlock Stage <ArrowRight className="w-5 h-5" /></button>
               </form>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-12">
              <section className="xl:col-span-3 bg-white/60 p-10 rounded-[3.5rem] border border-apricot/60 shadow-xl">
                 <h3 className="text-2xl font-black text-rose-bloom mb-10 tracking-tight">{teacherProfile?.full_name || 'Instructor'}'s Stage</h3>
                 <CalendarContainer role="student" events={allSchedules} onDateClick={setSelectedDate} onEventClick={(evt) => setSelectedDate(parseISO(evt.start_time))} />
              </section>
              <aside className="space-y-8">
                 <div className="bg-white/60 p-10 rounded-[3rem] border border-apricot/40 shadow-xl">
                    <h3 className="text-xl font-black text-theatre-dark mb-8">{format(selectedDate, 'MMM d')} Sessions</h3>
                    <div className="space-y-4">
                      {allSchedules.filter(s => isSameDay(parseISO(s.start_time), selectedDate)).map((slot, i) => {
                        const isExpired = new Date(slot.start_time) < new Date();
                        const isCancelled = slot.status === 'CANCELLED';
                        const isCompleted = slot.status === 'COMPLETED';
                        const existingBooking = myBookings.find(b => 
                          b.schedule_id === slot.id && 
                          !['CANCELLED', 'VOID'].includes(b.payment_status)
                        );
                        const isBooked = !!existingBooking;
                        const isGreyed = isExpired || isCancelled || isCompleted;
                        const isPaid = existingBooking?.payment_status === 'PAID';
                        
                        return (
                          <div key={i} className={`p-6 rounded-3xl border transition-all ${isGreyed ? 'bg-white/50 border-theatre-dark/10 opacity-50 grayscale' : isBooked ? 'bg-apricot/5 border-apricot/30 shadow-sm' : 'bg-white border-apricot/20 hover:shadow-md'}`}>
                            <div className={`font-black text-xs mb-1 ${isBooked && !isGreyed ? 'text-theatre-dark' : 'text-rose-bloom'}`}>{format(parseISO(slot.start_time), 'hh:mm a')}</div>
                            <div className="text-theatre-dark font-black text-lg mb-4">{slot.routines?.name}</div>
                            {isGreyed || isBooked ? (
                              <div className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-2 ${isBooked && !isGreyed ? 'bg-theatre-dark text-white' : 'bg-theatre-dark/10 text-theatre-dark/40'}`}>
                                {isBooked ? (
                                  <>
                                    {isPaid ? <CheckCircle2 className="w-3 h-3 text-apricot" /> : <Clock className="w-3 h-3 text-apricot" />}
                                    {isPaid ? 'Booked' : 'Reserved'}
                                  </>
                                ) : isCancelled ? (
                                  'Cancelled'
                                ) : isCompleted ? (
                                  'Completed'
                                ) : (
                                  'Expired'
                                )}
                              </div>
                            ) : (
                              <button 
                                onClick={() => navigate(`/student/book/${profile.linked_teacher_id}?sessionId=${slot.id}`)} 
                                className="w-full py-4 bg-theatre-dark text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-bloom transition-all shadow-sm"
                              >
                                Book Now
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                 </div>
                 <div className="bg-white/60 p-10 rounded-[3rem] border border-apricot/40 text-center">
                    <div className="text-[10px] font-black text-rose-bloom uppercase tracking-widest mb-2">Stage Credits</div>
                    <div className="text-4xl font-black text-theatre-dark mb-8">${studentCredits.toFixed(2)}</div>
                    <button onClick={handleDisconnect} className="w-full py-4 bg-red-100/50 border border-red-200 text-red-500 rounded-2xl font-black uppercase text-[10px]">Disconnect Stage</button>
                 </div>
              </aside>
            </div>
          )
        ) : (
          <div className="mt-8 space-y-12 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white/70 backdrop-blur-3xl p-10 rounded-[4rem] border border-theatre-dark/20 shadow-xl relative overflow-hidden">
               <div className="flex justify-between items-end mb-12 relative z-10">
                  <div>
                    <h2 className="text-3xl font-black text-theatre-dark tracking-tight italic">Stage History</h2>
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
                   <div className="px-6 py-4 bg-bloom-white rounded-3xl border border-apricot/20 text-center"><div className="text-[9px] font-black text-theatre-dark/30 uppercase mb-1">Total Power</div><div className="text-2xl font-black text-theatre-dark">${studentStats.totalSpent}</div></div>
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
               <div className="bg-white/70 backdrop-blur-3xl p-10 rounded-[3rem] border border-theatre-dark/20 shadow-xl">
                  <div className="flex justify-between items-center mb-10"><h3 className="text-xl font-black text-theatre-dark uppercase tracking-tighter">Routine Mix</h3><PieChart className="w-5 h-5 text-rose-bloom opacity-30" /></div>
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
                      <div key={index} className="text-center"><div className="text-[9px] font-black uppercase text-theatre-dark/30 mb-1">{entry.name}</div><div className="text-lg font-black text-theatre-dark">{entry.value}</div></div>
                    ))}
                  </div>
               </div>

               <div className="lg:col-span-2 bg-white/70 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-theatre-dark/20 shadow-xl">
                  <div className="flex justify-between items-center mb-10"><h3 className="text-xl font-black text-theatre-dark uppercase tracking-tighter italic">Weekly Energy</h3><TrendingUp className="w-5 h-5 text-rose-bloom opacity-30" /></div>
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
                 <div key={i} className="bg-white p-10 rounded-[3rem] border border-theatre-dark/15 text-center">
                    <div className="text-[10px] font-black text-theatre-dark/30 uppercase tracking-widest mb-3">{item.label}</div>
                    <div className="text-3xl font-black text-theatre-dark">{item.val}</div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
