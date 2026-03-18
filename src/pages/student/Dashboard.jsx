import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Calendar as CalendarIcon, Clock, MapPin, 
  Sparkles, Search, SlidersHorizontal, Heart, Ticket, Eye, Lock, ArrowRight, X,
  LogOut, Settings as SettingsIcon, CheckCircle2, Activity, PieChart, BarChart3
} from 'lucide-react';
import { isSameDay, format, parseISO, subDays, eachDayOfInterval } from 'date-fns';
import { toast } from 'sonner';
import CalendarContainer from '../../components/CalendarContainer';

export default function StudentDashboard() {
  const { profile: authProfile, signOut, isDevBypass, fetchProfile } = useAuth();
  const [guestProfile, setGuestProfile] = useState(() => {
    return JSON.parse(localStorage.getItem('zumba_guest_session') || 'null');
  });
  
  const profile = authProfile || guestProfile;
  
  const [allSchedules, setAllSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linkingCode, setLinkingCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [myBookings, setMyBookings] = useState([]);
  const [studentStats, setStudentStats] = useState({
    totalSessions: 0,
    routineVariety: [],
    attendanceTrend: []
  });
  const navigate = useNavigate();

  useEffect(() => {
    // If we have a guest session but no linked_teacher_id, try to resolve it from the stage_code
    if (guestProfile && !guestProfile.linked_teacher_id && guestProfile.stage_code) {
      resolveGuestTeacher(guestProfile.stage_code);
    }
  }, [guestProfile]);

  const resolveGuestTeacher = async (code) => {
    try {
      let teacher = null;
      if (isDevBypass) {
        const savedProfiles = JSON.parse(localStorage.getItem('zumba_mock_profiles') || '{}');
        teacher = Object.values(savedProfiles).find(p => 
          p.invite_code?.toUpperCase() === code.toUpperCase().trim()
        );
      } else {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('invite_code', code.toUpperCase().trim())
          .single();
        teacher = data;
      }

      if (teacher) {
        const updated = { ...guestProfile, linked_teacher_id: teacher.id };
        setGuestProfile(updated);
        localStorage.setItem('zumba_guest_session', JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Guest resolve teacher error:', err);
    }
  };

  useEffect(() => {
    fetchAllAvailableSchedules();
    if (profile?.linked_teacher_id) {
      fetchTeacherProfile(profile.linked_teacher_id);
    } else if (!profile?.is_guest) {
      setTeacherProfile(null);
      // Auto-link if code exists in localStorage from Auth (for legacy or logged in flow)
      const pendingCode = localStorage.getItem('pending_teacher_code');
      if (pendingCode && profile?.role?.toUpperCase() === 'STUDENT') {
        handleAutoLink(pendingCode);
      }
    }

    // Storage listener to sync across tabs in mock mode
    const handleStorageChange = (e) => {
      if (e.key === 'zumba_mock_schedules' || e.key === 'zumba_mock_routines' || e.key === 'zumba_mock_profiles' || e.key === 'zumba_guest_session') {
        if (e.key === 'zumba_guest_session') {
           setGuestProfile(JSON.parse(e.newValue || 'null'));
        }
        fetchAllAvailableSchedules();
        if (profile?.linked_teacher_id) fetchTeacherProfile(profile.linked_teacher_id);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [profile?.linked_teacher_id, profile?.role, guestProfile?.id]);

  const handleAutoLink = async (code) => {
    if (linking) return;
    console.log('[Dashboard] Auto-linking stage code:', code);
    setLinking(true);
    try {
      let teacher = null;

      if (isDevBypass) {
        const savedProfiles = JSON.parse(localStorage.getItem('zumba_mock_profiles') || '{}');
        teacher = Object.values(savedProfiles).find(p => 
          p.invite_code?.toUpperCase() === code.toUpperCase().trim() && 
          p.role?.toUpperCase() === 'TEACHER'
        );
      } else {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('invite_code', code.toUpperCase().trim())
          .single();
        teacher = data;
      }

      if (teacher) {
        console.log('[Dashboard] Found teacher for auto-link:', teacher.full_name);
        if (isDevBypass) {
          const mockProfile = JSON.parse(localStorage.getItem('zumba_mock_profile') || '{}');
          mockProfile.linked_teacher_id = teacher.id;
          localStorage.setItem('zumba_mock_profile', JSON.stringify(mockProfile));
          
          const savedProfiles = JSON.parse(localStorage.getItem('zumba_mock_profiles') || '{}');
          if (savedProfiles[mockProfile.id]) {
            savedProfiles[mockProfile.id].linked_teacher_id = teacher.id;
            localStorage.setItem('zumba_mock_profiles', JSON.stringify(savedProfiles));
          }
        } else {
          await supabase
            .from('profiles')
            .update({ linked_teacher_id: teacher.id })
            .eq('id', profile.id);
        }
        localStorage.removeItem('pending_teacher_code');
        await fetchProfile();
        toast.success(`Connected to instructor: ${teacher.full_name}`);
      } else {
        console.warn('[Dashboard] Auto-link failed: Teacher code not found.');
      }
    } catch (err) {
      console.error('[Dashboard] Auto-link error:', err);
    } finally {
      setLinking(false);
    }
  };

  useEffect(() => {
    if (profile?.id && profile?.linked_teacher_id) {
      fetchMyBookings();
    } else {
      setMyBookings([]);
      setStudentStats({
        totalSessions: 0,
        routineVariety: [],
        attendanceTrend: []
      });
    }
  }, [profile?.id, profile?.linked_teacher_id]);

  useEffect(() => {
    if (myBookings.length > 0 && allSchedules.length > 0) {
      calculateStudentMetrics(myBookings, allSchedules);
    }
  }, [myBookings, allSchedules]);

  const fetchAllAvailableSchedules = async () => {
    if (!profile?.linked_teacher_id) {
      setAllSchedules([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    console.log('Fetching available schedules...');

    if (isDevBypass) {
      const mockSchedules = JSON.parse(localStorage.getItem('zumba_mock_schedules') || '[]');
      const mockRoutines = JSON.parse(localStorage.getItem('zumba_mock_routines') || '[]');
      const mockProfiles = JSON.parse(localStorage.getItem('zumba_mock_profiles') || '{}');
      
      console.log('[Sync Debug] Local linked_teacher_id:', profile.linked_teacher_id);
      console.log('[Sync Debug] Total mock schedules in storage:', mockSchedules.length);

      const teacherSchedules = mockSchedules
        .filter(s => {
          const match = String(s.teacher_id).trim() === String(profile.linked_teacher_id).trim();
          const notCancelled = s.status !== 'CANCELLED';
          return match && notCancelled;
        })
        .map(s => ({
          ...s,
          routines: mockRoutines.find(r => r.id === s.routine_id) || { name: 'Routine' },
          profiles: { full_name: mockProfiles[s.teacher_id]?.full_name || 'Instructor' }
        }));
      
      console.log('[Sync Debug] Found schedules for this teacher:', teacherSchedules.length);
      
      setAllSchedules(teacherSchedules);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('schedules')
      .select('*, routines(name, duration_minutes), profiles(full_name)')
      .eq('teacher_id', profile.linked_teacher_id)
      .eq('status', 'SCHEDULED');
    
    if (error) console.error('Fetch error:', error);
    setAllSchedules(data || []);
    setLoading(false);
  };

  const fetchTeacherProfile = async (teacherId) => {
    if (isDevBypass) {
      const mockProfiles = JSON.parse(localStorage.getItem('zumba_mock_profiles') || '{}');
      const teacher = mockProfiles[teacherId];
      if (teacher) {
        setTeacherProfile({ full_name: teacher.full_name, avatar_url: teacher.avatar_url });
      } else {
        setTeacherProfile(null);
      }
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', teacherId)
      .single();

    if (error) {
      console.error('Error fetching teacher profile:', error);
      setTeacherProfile(null);
    } else {
      setTeacherProfile(data);
    }
  };

  const fetchMyBookings = async () => {
    if (!profile?.id) return;

    if (isDevBypass) {
      const mockBookings = JSON.parse(localStorage.getItem('zumba_mock_bookings') || '[]');
      const mockSchedules = JSON.parse(localStorage.getItem('zumba_mock_schedules') || '[]');
      const mockRoutines = JSON.parse(localStorage.getItem('zumba_mock_routines') || '[]');
      
      const enrichedBookings = mockBookings
        .filter(b => b.student_id === profile.id)
        .map(b => {
          const schedule = mockSchedules.find(s => s.id === b.schedule_id);
          const routine = schedule ? mockRoutines.find(r => r.id === schedule.routine_id) : null;
          return {
            ...b,
            schedules: {
              ...schedule,
              routines: routine || { name: 'Routine' }
            }
          };
        });
      
      setMyBookings(enrichedBookings);
      return;
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('*, schedules(start_time, routines(name))')
      .eq('student_id', profile.id)
      .in('payment_status', ['PAID', 'PENDING', 'VOID']);

    if (error) {
      console.error('Error fetching my bookings:', error);
      setMyBookings([]);
    } else {
      setMyBookings(data || []);
    }
  };

  const calculateStudentMetrics = (bookings, schedules) => {
    const paidBookings = bookings.filter(b => b.payment_status === 'PAID');
    const totalSessions = paidBookings.length;

    const routineCounts = {};
    paidBookings.forEach(booking => {
      const routineName = booking.schedules?.routines?.name;
      if (routineName) {
        routineCounts[routineName] = (routineCounts[routineName] || 0) + 1;
      }
    });

    const routineVariety = Object.entries(routineCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const totalRoutineBookings = routineVariety.reduce((sum, r) => sum + r.count, 0);
    const routineVarietyWithPerformance = routineVariety.map(r => ({
      ...r,
      performance: totalRoutineBookings > 0 ? (r.count / totalRoutineBookings) * 100 : 0
    }));

    const today = new Date();
    const twoWeeksAgo = subDays(today, 13);
    const dateRange = eachDayOfInterval({ start: twoWeeksAgo, end: today });

    const attendanceTrend = dateRange.map(date => {
      const count = paidBookings.filter(booking => 
        isSameDay(parseISO(booking.schedules.start_time), date)
      ).length;
      return {
        date: format(date, 'MMM d'),
        count: count
      };
    });

    setStudentStats({
      totalSessions,
      routineVariety: routineVarietyWithPerformance,
      attendanceTrend
    });
  };

  const handleJoinStage = async (e) => {
    e.preventDefault();
    if (!linkingCode || linking) return;
    handleAutoLink(linkingCode);
  };

  return (
    <div className="min-h-screen bg-bloom-white text-theatre-dark p-6 sm:p-10">
      <div className="max-w-[1600px] mx-auto">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-16 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
               <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-theatre-dark via-[#FFB38A] to-rose-bloom tracking-tight font-display italic">
                 Welcome, <span className="capitalize">{profile?.full_name?.split(' ')[0] || 'Dancer'}!</span>
               </h1>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-theatre-dark/80 mt-1">Welcome to limelight with Student Dashboard</p>
          </div>

          <div className="flex gap-4">
             <button 
              onClick={() => navigate('/student/bookings')}
              className="px-8 py-5 bg-white border border-apricot/40 text-rose-bloom rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-sm flex items-center gap-3 hover:-translate-y-1 transition-all"
             >
                <Ticket className="w-5 h-5 text-rose-bloom" />
                My Bookings
             </button>
             <a 
               href="/student/settings" 
               className="p-5 bg-white rounded-2xl border border-apricot/40 hover:bg-apricot/5 transition-all shadow-sm flex items-center justify-center"
               title="Settings"
             >
                <SettingsIcon className="w-6 h-6 text-rose-bloom" />
             </a>
             <button 
               onClick={signOut}
               className="p-5 bg-white rounded-2xl border border-theatre-dark/20 hover:bg-rose-petal/5 transition-all shadow-sm flex items-center justify-center"
               title="Sign Out"
             >
                <LogOut className="w-6 h-6 text-rose-bloom" />
             </button>
             <button className="p-5 bg-white rounded-2xl border border-theatre-dark/20 hover:bg-rose-petal/5 transition-all shadow-sm">
                <Heart className="w-6 h-6 text-rose-bloom" />
             </button>
          </div>
        </header>

        {!profile?.linked_teacher_id ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white/40 backdrop-blur-xl rounded-[4rem] border-2 border-dashed border-apricot/50">
             <div className="w-24 h-24 bg-rose-bloom/10 rounded-full flex items-center justify-center mb-10">
                <Lock className="w-10 h-10 text-rose-bloom shadow-glow" />
             </div>
             <h2 className="text-4xl font-black text-theatre-dark mb-4 text-center">Your private stage is waiting.</h2>
             <p className="text-theatre-dark/40 font-bold uppercase tracking-widest text-xs mb-12 max-w-sm text-center">Enter your instructor's code to unlock their exclusive classes and energy.</p>
             
             <form onSubmit={handleJoinStage} className="w-full max-w-md flex flex-col gap-4 px-6">
                <input 
                  type="text"
                  placeholder="CODE (e.g. ZUMBA-1234)"
                  value={linkingCode}
                  onChange={(e) => setLinkingCode(e.target.value)}
                  className="w-full bg-white border border-apricot/60 rounded-2xl py-6 px-8 focus:outline-none focus:border-rose-bloom transition-all font-mono font-black text-center text-xl tracking-widest text-rose-bloom shadow-xl shadow-rose-bloom/5 uppercase"
                />
                <button 
                  disabled={linking || !linkingCode}
                  className="w-full btn-premium bg-theatre-dark text-white py-6 rounded-2xl flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {linking ? <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : "Unlock Stage"}
                  <ArrowRight className="w-5 h-5" />
                </button>
             </form>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-12 items-start">
            <section className="xl:col-span-3 bg-bloom-white/80 p-10 rounded-[3.5rem] border border-apricot/60 shadow-2xl shadow-rose-bloom/5">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-2xl font-black text-rose-bloom tracking-tight capitalize">{teacherProfile?.full_name || 'Instructor'}'s Class</h3>
                 <div className="p-3 bg-white rounded-xl border border-theatre-dark/20 text-[10px] font-black text-rose-bloom/60 uppercase tracking-widest">
                   Private Access
                 </div>
              </div>
              
              <CalendarContainer 
                role="student"
                events={allSchedules}
                onDateClick={setSelectedDate}
                onEventClick={(evt) => setSelectedDate(parseISO(evt.start_time))}
              />
            </section>

            <aside className="space-y-8">
              <div className="glass p-10 rounded-[3rem]">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-rose-bloom tracking-tight">
                    {format(selectedDate, 'MMM d')} Sessions
                  </h3>
                </div>
                
                <div className="space-y-4">
                  {allSchedules.filter(s => isSameDay(parseISO(s.start_time), selectedDate)).length > 0 ? (
                    allSchedules
                      .filter(s => isSameDay(parseISO(s.start_time), selectedDate))
                      .sort((a,b) => a.start_time.localeCompare(b.start_time))
                      .map((slot, idx) => (
                        <div key={idx} className="p-6 bg-bloom-white/60 rounded-3xl border border-apricot/30 group hover:border-rose-bloom transition-all">
                          <div className="text-rose-bloom font-black text-xs mb-2">{format(parseISO(slot.start_time), 'hh:mm a')}</div>
                          <div className="text-theatre-dark font-black text-lg mb-4">{slot.routines?.name}</div>
                          <div className="flex items-center gap-2 text-[10px] text-theatre-dark/40 mb-6">
                            <MapPin className="w-3 h-3" /> {slot.location}
                          </div>
                          
                          {myBookings.some(b => b.schedule_id === slot.id && b.payment_status === 'PAID') ? (
                            <div className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                              <CheckCircle2 className="w-4 h-4" /> Paid
                            </div>
                          ) : (
                            <button 
                              onClick={() => navigate(`/student/book/${profile.linked_teacher_id}?sessionId=${slot.id}`)}
                              className="w-full py-4 bg-theatre-dark text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-rose-bloom transition-colors"
                            >
                              <Ticket className="w-4 h-4" /> Pay
                            </button>
                          )}
                        </div>
                      ))
                  ) : (
                    <div className="py-20 text-center text-theatre-dark/20 font-black uppercase tracking-[0.2em] text-[10px] border-2 border-dashed border-apricot/40 rounded-[2rem]">
                      No sessions today
                    </div>
                  )}
                </div>
              </div>

              <div className="glass p-8 rounded-[2.5rem] text-center">
                 <h3 className="text-xs font-black text-rose-bloom uppercase tracking-widest mb-4">Current Stage</h3>
                 <p className="text-[10px] font-bold text-theatre-dark/60 mb-8 max-w-xs mx-auto">Connected to {teacherProfile?.full_name || 'Instructor'}</p>
                 <button 
                  onClick={async () => {
                    if (confirm('Disconnect from this instructor? You will need their code to rejoin.')) {
                      if (isDevBypass) {
                        const mockProfile = JSON.parse(localStorage.getItem('zumba_mock_profile') || '{}');
                        delete mockProfile.linked_teacher_id;
                        localStorage.setItem('zumba_mock_profile', JSON.stringify(mockProfile));

                        const savedProfiles = JSON.parse(localStorage.getItem('zumba_mock_profiles') || '{}');
                        if (savedProfiles[mockProfile.id]) {
                          delete savedProfiles[mockProfile.id].linked_teacher_id;
                          localStorage.setItem('zumba_mock_profiles', JSON.stringify(savedProfiles));
                        }
                      } else {
                        await supabase.from('profiles').update({ linked_teacher_id: null }).eq('id', profile.id);
                      }
                      await fetchProfile();
                    }
                  }}
                  className="w-full py-4 bg-red-500/5 border border-red-500/30 rounded-2xl text-red-500 font-black uppercase tracking-widest text-[10px] hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                 >
                   <X className="w-4 h-4" /> Disconnect Stage
                 </button>
              </div>
            </aside>
          </div>
        )}

        {profile?.role?.toUpperCase() === 'STUDENT' && (
          <div className="mt-24 space-y-12">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-rose-bloom/10 rounded-2xl flex items-center justify-center">
                 <Activity className="w-6 h-6 text-rose-bloom" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-theatre-dark tracking-tight">My Theatre Performance</h2>
                <p className="text-[10px] font-bold text-rose-bloom uppercase tracking-[0.2em]">Personal Energy & Participation Analytics</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-1 space-y-8">
                <div className="bg-white/70 backdrop-blur-3xl p-8 rounded-[3rem] border border-theatre-dark/20 shadow-xl shadow-rose-bloom/5 relative overflow-hidden group">
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-bloom/5 rounded-full blur-2xl group-hover:bg-rose-bloom/10 transition-all" />
                  <CalendarIcon className="w-10 h-10 text-rose-bloom mb-6 opacity-40" />
                  <div className="text-[10px] font-black text-rose-bloom uppercase tracking-widest mb-1">Total Sessions</div>
                  <div className="text-4xl font-black text-theatre-dark">{studentStats.totalSessions}</div>
                </div>

                <div className="bg-white/70 backdrop-blur-3xl p-10 rounded-[3rem] border border-theatre-dark/20 shadow-2xl shadow-rose-bloom/5">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black text-theatre-dark">Routine Mix</h3>
                    <PieChart className="w-5 h-5 text-rose-bloom opacity-40" />
                  </div>
                  <div className="space-y-6">
                    {studentStats.routineVariety.length === 0 ? (
                      <p className="text-[10px] font-bold text-theatre-dark/20 uppercase tracking-widest text-center py-10">Join a class to see stats</p>
                    ) : studentStats.routineVariety.map((r, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-theatre-dark/60">
                          <span>{r.name}</span>
                          <span className="text-rose-bloom">{r.count}</span>
                        </div>
                        <div className="h-1.5 bg-rose-petal/10 rounded-full overflow-hidden">
                           <div className="h-full bg-rose-bloom" style={{ width: `${r.performance}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3 bg-white/70 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-theatre-dark/20 shadow-2xl shadow-rose-bloom/5 relative overflow-hidden">
                <div className="flex justify-between items-center mb-16">
                   <div>
                      <h3 className="text-2xl font-black text-theatre-dark mb-1">Rhythm Trends</h3>
                      <p className="text-[10px] font-black text-[#4A3B3E]/40 uppercase tracking-widest">Attendance over the last 14 days</p>
                   </div>
                   <div className="flex gap-2">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-rose-bloom">
                        <div className="w-2 h-2 rounded-full bg-rose-bloom" /> Participation
                      </div>
                   </div>
                </div>
                
                <div className="h-48 flex items-end justify-between gap-1 mt-12 px-2 relative mb-8">
                   <div className="absolute inset-x-0 bottom-0 h-full flex flex-col justify-between pointer-events-none opacity-5">
                      {[1,2,3,4].map(i => <div key={i} className="border-t border-theatre-dark w-full" />)}
                   </div>

                   {studentStats.attendanceTrend.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        <div 
                          className="w-full max-w-[15px] bg-gradient-to-t from-rose-bloom to-rose-petal rounded-t-full transition-all duration-500"
                          style={{ height: `${(d.count / (Math.max(...studentStats.attendanceTrend.map(t => t.count), 1))) * 100}%` }}
                        >
                          {d.count > 0 && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-theatre-dark text-white text-[8px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                              {d.count}
                            </div>
                          )}
                        </div>
                        <div className="text-[6px] font-black text-theatre-dark/10 uppercase mt-4 absolute -bottom-8 rotate-45 origin-left whitespace-nowrap">
                          {d.date}
                        </div>
                      </div>
                   ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
