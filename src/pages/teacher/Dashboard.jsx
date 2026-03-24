import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabaseClient';
import { Calendar as CalendarIcon, Users, TrendingUp, Plus, LogOut, Settings as SettingsIcon, Package, Sparkles, X, Save, Clock, MapPin, Trash2, ShieldCheck, ArrowRight, RefreshCw, Copy, Lock, AlertTriangle } from 'lucide-react';
import CalendarContainer from '../../components/CalendarContainer';
import { toast } from 'sonner';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isSameDay, subDays, startOfDay, endOfDay } from 'date-fns';
import { 
  AreaChart, Area, ResponsiveContainer, Tooltip as ReTooltip, XAxis
} from 'recharts';

export default function TeacherDashboard() {
  const { profile, signOut, user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [selectedSessionForAttendance, setSelectedSessionForAttendance] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [isAddingRoutine, setIsAddingRoutine] = useState(false);
  const [newRoutineData, setNewRoutineData] = useState({
    name: '',
    duration_minutes: 60,
    default_price: 15.00
  });
  const [inviteCode, setInviteCode] = useState('');
  // Form State for Scheduling
  const [formData, setFormData] = useState({
    routine_id: '',
    start_time: '18:00',
    price: '',
    location: 'Main Studio',
    max_seats: 20
  });
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedSessionToCancel, setSelectedSessionToCancel] = useState(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [snapshotData, setSnapshotData] = useState({
    totalStudents: 0,
    weeklyRevenue: 0,
    revenueTrend: [],
    studentTrend: []
  });


  const fetchRoutines = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('teacher_id', user.id);
      
      if (error) throw error;
      setRoutines(data || []);
    } catch (err) {
      console.error('[Dashboard] Fetch routines error:', err);
    }
  }, [user.id]);

  const ensureInviteCode = useCallback(async () => {
    if (!user?.id) return;
    
    // PRIORITY 1: Secure Auth Metadata (Unblockable path)
    if (user?.user_metadata?.stage_code) {
      setInviteCode(user.user_metadata.stage_code);
    }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('stage_code')
        .eq('id', user.id)
        .single();
      
      if (!error && data?.stage_code) {
        setInviteCode(data.stage_code);
        return data.stage_code;
      }
      
      // LAZY INITIALIZATION: Only if DB has NULL and no error
      if (!error && !data?.stage_code && profile?.full_name) {
        console.log('[Dashboard] Stage code missing, initializing...');
        const newCode = `STUDIO-${profile.full_name?.split(' ')[0].toUpperCase() || 'STAGE'}-${Math.floor(1000 + Math.random() * 9000)}`;
        
        // Parallel sync: DB + Auth Metadata (Metadata is unblockable fallback)
        await Promise.allSettled([
          supabase.from('profiles').update({ stage_code: newCode }).eq('id', user.id),
          supabase.auth.updateUser({ data: { stage_code: newCode } })
        ]);
        
        setInviteCode(newCode);
        return newCode;
      }
    } catch (e) {
      console.error('[Dashboard] Stage code check failed:', e);
    }
  }, [user?.id, profile?.full_name]);

  const handleRefreshInviteCode = async () => {
    const toastId = toast.loading('Refreshing stage code...');
    try {
      const newCode = `STUDIO-${profile.full_name?.split(' ')[0].toUpperCase() || 'STAGE'}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      const { error: dbError } = await supabase.from('profiles').update({ stage_code: newCode }).eq('id', user.id);
      
      // Always sync to metadata - it's our unblockable source of truth
      const { error: authError } = await supabase.auth.updateUser({ data: { stage_code: newCode } });
      
      if (authError) {
        console.warn('[Dashboard] Metadata sync failed:', authError);
      }

      if (dbError) {
        console.warn('[Dashboard] DB update failed/blocked, relying on Metadata:', dbError);
      }
      
      setInviteCode(newCode);
      toast.success('Stage code refreshed!', { id: toastId });
    } catch (error) {
      console.error('[Dashboard] Code refresh failed:', error);
      toast.error('Failed to refresh code. Please check your connection.', { id: toastId });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Code copied to clipboard!');
  };
  const fetchBookings = useCallback(async (currentSchedules) => {
    const activeSchedules = currentSchedules || schedules;
    if (!activeSchedules || activeSchedules.length === 0) {
      setBookings([]);
      setRecentBookings([]); // Also clear recent bookings
      return;
    }

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, student:student_id(full_name, avatar_url, email)')
        .in('schedule_id', activeSchedules.map(s => s.id))
        .order('created_at', { ascending: false }); // Added order by created_at
      
      if (error) throw error;
      
      setBookings(data || []); // Keep original setBookings call

      // Filter out any invalid bookings or handle null students for recent bookings
      const validRecent = (data || []).map(b => ({
        ...b,
        student: b.student || { full_name: 'Guest Artist', email: 'Anonymous' }
      }));
      setRecentBookings(validRecent);
    } catch (err) {
      console.error('[Dashboard] Fetch bookings error:', err);
    }
  }, [schedules]);

  const fetchSnapshotMetrics = useCallback(async () => {
    try {
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('amount, created_at')
        .eq('teacher_id', user.id);
      
      const { data: studentsData } = await supabase
        .from('bookings')
        .select('student_id, created_at')
        .in('schedule_id', schedules.map(s => s.id));

      if (!paymentsData) return;

      const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i)).reverse();
      
      const revenueTrend = last7Days.map(day => {
        const dayPayments = paymentsData.filter(p => isSameDay(new Date(p.created_at), day));
        return {
          day: format(day, 'EEE'),
          amount: dayPayments.reduce((sum, p) => sum + Number(p.amount), 0)
        };
      });

      const studentTrend = last7Days.map(day => {
        const dayBookings = (studentsData || []).filter(b => isSameDay(new Date(b.created_at), day));
        return {
          day: format(day, 'EEE'),
          count: dayBookings.length
        };
      });

      setSnapshotData({
        totalStudents: new Set((studentsData || []).map(b => b.student_id)).size,
        weeklyRevenue: revenueTrend.reduce((sum, r) => sum + r.amount, 0),
        revenueTrend,
        studentTrend
      });
    } catch (e) {
      console.error('[Dashboard] Snapshot error:', e);
    }
  }, [user.id, schedules]);

  const fetchAllSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*, routines(name, duration_minutes)')
        .eq('teacher_id', user.id);
      
      if (error) throw error;
      const schedulesData = data || [];
      setSchedules(schedulesData);
      fetchBookings(schedulesData);
      fetchSnapshotMetrics();
    } catch (err) {
      console.error('[Dashboard] Fetch schedules error:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id, fetchBookings]);

  const handleQuickRoutineSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      const payload = { ...newRoutineData, teacher_id: user.id };
      let createdRoutine;

      const { data, error } = await supabase.from('routines').insert([payload]).select().single();
      if (error) throw error;
      createdRoutine = data;

      toast.success('Routine created!');
      await fetchRoutines();
      setFormData({ ...formData, routine_id: createdRoutine.id, price: createdRoutine.default_price });
      setIsAddingRoutine(false);
      setNewRoutineData({ name: '', duration_minutes: 60, default_price: 15.00 });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteRoutine = async () => {
    if (!formData.routine_id) return;
    const selected = routines.find(r => r.id === formData.routine_id);
    if (!confirm(`Are you sure you want to delete "${selected?.name}"?`)) return;

    setModalLoading(true);
    try {
      const { error } = await supabase.from('routines').delete().eq('id', formData.routine_id);
      if (error) throw error;
      toast.success('Routine deleted');
      setFormData({ ...formData, routine_id: '', price: '' });
      await fetchRoutines();
    } catch (error) {
      toast.error('Could not delete routine');
    } finally {
      setModalLoading(false);
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);

    try {
      const selectedRoutine = routines.find(r => r.id === formData.routine_id);
      if (!selectedRoutine) throw new Error('Please select a routine');

      const fullStartTime = new Date(selectedDate);
      const [hours, minutes] = formData.start_time.split(':');
      fullStartTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      // Prevent scheduling in the past
      if (fullStartTime < new Date()) {
        throw new Error('Cannot schedule a session in the past.');
      }

      // Prevent Duplicate Time Slots
      const isTaken = schedules.some(s => 
        s.status !== 'CANCELLED' && 
        isSameDay(parseISO(s.start_time), fullStartTime) &&
        format(parseISO(s.start_time), 'HH:mm') === formData.start_time
      );

      if (isTaken) {
        throw new Error(`A session is already scheduled for ${formData.start_time} on this day.`);
      }

      const newSchedule = {
        routine_id: formData.routine_id,
        teacher_id: user.id,
        start_time: fullStartTime.toISOString(),
        price: parseFloat(formData.price || selectedRoutine.default_price),
        location: formData.location,
        max_seats: formData.max_seats,
        status: 'SCHEDULED'
      };

      const { error } = await supabase.from('schedules').insert([newSchedule]);
      if (error) throw error;
      toast.success('Class scheduled successfully!');
      setIsModalOpen(false);
      fetchAllSchedules();
    } catch (error) {
      if (error.message.includes('past')) {
        setErrorMessage(error.message);
        setIsErrorModalOpen(true);
      } else {
        toast.error(error.message);
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleMarkAsPaid = async (bookingId) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          payment_status: 'PAID', 
          payment_method: 'MANUAL',
          status: 'BOOKED'
        })
        .eq('id', bookingId);
      if (error) throw error;
      
      toast.success('Payment confirmed!');
      
      // Update local state for both modals
      const updatedBookingsState = bookings.map(b => 
        b.id === bookingId ? { ...b, payment_status: 'PAID', payment_method: 'MANUAL' } : b
      );
      setBookings(updatedBookingsState);
      
      if (selectedSessionForAttendance) {
        setSelectedSessionForAttendance({
          ...selectedSessionForAttendance,
          bookings: selectedSessionForAttendance.bookings.map(b => 
            b.id === bookingId ? { ...b, payment_status: 'PAID', payment_method: 'MANUAL' } : b
          )
        });
      }
    } catch (error) {
      toast.error('Failed to update payment status');
    }
  };

  const handleCancelSchedule = async (scheduleId) => {
    const sessionToCancel = schedules.find(s => s.id === scheduleId);
    if (sessionToCancel && new Date(sessionToCancel.start_time) < new Date()) {
      toast.error('Cannot cancel a past session.');
      return;
    }

    try {
      // 1. Update Schedule Status permanently in DB
      const { error: scheduleError } = await supabase
        .from('schedules')
        .update({ status: 'CANCELLED' })
        .eq('id', scheduleId);
      
      if (scheduleError) throw scheduleError;

      // 2. Process Refunds for PAID bookings
      const { data: paidBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('schedule_id', scheduleId)
        .eq('payment_status', 'PAID')
        .neq('status', 'CANCELLED');

      if (bookingsError) throw bookingsError;

      if (paidBookings && paidBookings.length > 0) {
        // Sync: Mark ALL bookings for this schedule as CANCELLED in DB
        await supabase
          .from('bookings')
          .update({ status: 'CANCELLED', payment_status: 'REFUNDED' })
          .eq('schedule_id', scheduleId);

        // Issue credits to students
        for (const booking of paidBookings) {
          // Attempt to increment balance, or create if missing
          const { data: existingCredit } = await supabase
            .from('credits')
            .select('balance')
            .eq('student_id', booking.student_id)
            .eq('teacher_id', user.id)
            .single();

          if (existingCredit) {
            await supabase
              .from('credits')
              .update({ balance: Number(existingCredit.balance) + Number(sessionToCancel.price) })
              .eq('student_id', booking.student_id)
              .eq('teacher_id', user.id);
          } else {
            await supabase
              .from('credits')
              .insert([{
                student_id: booking.student_id,
                teacher_id: user.id,
                balance: Number(sessionToCancel.price)
              }]);
          }
        }
        toast.success(`Session cancelled. Credits issued to ${paidBookings.length} students.`);
      } else {
        // Just cancel any outstanding unpaid bookings
        await supabase
          .from('bookings')
          .update({ status: 'CANCELLED' })
          .eq('schedule_id', scheduleId);
        
        toast.success('Session cancelled.');
      }
      
      fetchAllSchedules();
    } catch (error) {
      console.error('[Dashboard] Cancellation failed:', error);
      const msg = error.message || 'Check your connection or permissions.';
      toast.error(`Failed to cancel session: ${msg}`);
    }
  };

  const handleReactivateSchedule = async (scheduleId) => {
    try {
      // 1. Flush out all previous bookings (Cancelled bookings from the earlier drop)
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('schedule_id', scheduleId);
      
      if (deleteError) {
        console.warn('[Dashboard] Booking flush failed (Policy might be missing):', deleteError);
      }

      // 2. Restore Schedule Status
      const { error } = await supabase
        .from('schedules')
        .update({ status: 'SCHEDULED' })
        .eq('id', scheduleId);
      
      if (error) throw error;
      
      // 3. Clear local state for this session if modal is open
      if (selectedSessionForAttendance?.id === scheduleId) {
        setSelectedSessionForAttendance({
          ...selectedSessionForAttendance,
          bookings: []
        });
      }

      toast.success('Session re-activated! Bookings have been cleared for a fresh start.');
      fetchAllSchedules();
    } catch (error) {
      toast.error('Failed to re-activate session');
    }
  };

  useEffect(() => {
    if (user) {
        setLoading(true);
        const loadInit = async () => {
          await fetchRoutines();
          await fetchAllSchedules();
          await ensureInviteCode();
        };
        loadInit();
    }
    
    // Expose for testing
    window.OPEN_ATTENDANCE = (session) => {
      setSelectedSessionForAttendance(session);
      setIsAttendanceModalOpen(true);
    };

  }, [user?.id, fetchRoutines, fetchAllSchedules, ensureInviteCode]);

  return (
    <div className="min-h-screen bg-bloom-white text-studio-dark p-6 sm:p-10">
      <div className="max-w-[1600px] mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-rose-bloom via-[#FFB38A] to-rose-petal flex items-center justify-center rotate-6 shadow-xl shadow-rose-bloom/20 overflow-hidden">
               {profile?.avatar_url ? (
                 <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Profile" />
               ) : (
                 <Sparkles className="text-white w-8 h-8" />
               )}
            </div>
            <div>
              <h1 className="text-3xl font-black text-studio-dark font-display italic">
                Lovely to see you, <span className="text-gradient-sunset capitalize">{profile?.full_name || 'Instructor'}</span>!
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-studio-dark/90 mt-1">Teacher Dashboard</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
             <div className="flex items-center gap-2 bg-white/50 border border-apricot/40 px-4 py-2 rounded-2xl shadow-sm group hover:border-rose-bloom transition-all">
                <div className="flex flex-col items-start mr-4">
                  <span className="text-[8px] font-black uppercase tracking-widest text-studio-dark/30 leading-none mb-1">Stage Code</span>
                  <span className="text-xs font-black text-rose-bloom font-mono tracking-wider">{inviteCode || '...'}</span>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => copyToClipboard(inviteCode)}
                    className="p-2 hover:bg-rose-bloom/10 rounded-lg text-studio-dark/40 hover:text-rose-bloom transition-all"
                    title="Copy Code"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleRefreshInviteCode}
                    className="p-2 hover:bg-rose-bloom/10 rounded-lg text-studio-dark/40 hover:text-rose-bloom transition-all"
                    title="Refresh Code"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
             </div>
             
             <a href="/teacher/settings" className="p-4 bg-bloom-white rounded-2xl border border-apricot/60 hover:bg-apricot/5 transition-all shadow-sm group">
               <SettingsIcon className="w-5 h-5 text-rose-bloom group-hover:rotate-45 transition-transform" />
             </a>
             <button onClick={signOut} className="p-4 bg-white rounded-2xl border border-studio-dark/20 hover:bg-rose-petal/5 transition-all shadow-sm">
               <LogOut className="w-5 h-5 text-rose-bloom" />
             </button>
          </div>
        </header>

        {/* Removed Subscription Banner to allow free access */}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
           <div className="bg-white/60 backdrop-blur-3xl p-8 rounded-[3rem] border border-apricot/30 shadow-xl relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                 <div className="p-3 bg-rose-bloom/10 rounded-2xl"><TrendingUp className="w-5 h-5 text-rose-bloom" /></div>
                 <div className="text-[9px] font-black text-rose-bloom uppercase tracking-widest">+12%</div>
              </div>
              <div className="flex justify-between items-end">
                 <div>
                    <div className="text-[10px] font-black text-studio-dark/30 uppercase tracking-widest mb-1">Weekly Rhythm</div>
                    <div className="text-3xl font-black text-studio-dark">${snapshotData.weeklyRevenue}</div>
                 </div>
                 <div className="h-10 w-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={snapshotData.revenueTrend}>
                        <defs>
                          <linearGradient id="miniRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FE7A8A" stopOpacity={0.4}/><stop offset="95%" stopColor="#FE7A8A" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="amount" stroke="#FE7A8A" strokeWidth={3} fill="url(#miniRevenue)" animationDuration={1500} />
                      </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           <div className="bg-white/60 backdrop-blur-3xl p-8 rounded-[3rem] border border-apricot/30 shadow-xl relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                 <div className="p-3 bg-studio-dark/10 rounded-2xl"><Users className="w-5 h-5 text-studio-dark" /></div>
                 <div className="text-[9px] font-black text-studio-dark/30 uppercase tracking-widest">Live</div>
              </div>
              <div className="flex justify-between items-end">
                 <div>
                    <div className="text-[10px] font-black text-studio-dark/30 uppercase tracking-widest mb-1">Dancer Base</div>
                    <div className="text-3xl font-black text-studio-dark">{snapshotData.totalStudents}</div>
                 </div>
                 <div className="h-10 w-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={snapshotData.studentTrend}>
                        <defs>
                          <linearGradient id="miniStudents" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4A3B3E" stopOpacity={0.4}/><stop offset="95%" stopColor="#4A3B3E" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="count" stroke="#4A3B3E" strokeWidth={3} fill="url(#miniStudents)" animationDuration={1500} />
                      </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           <a href="/teacher/reports" className="lg:col-span-2 bg-studio-dark p-8 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden group hover:bg-studio-dark/95 transition-all">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp className="w-24 h-24 text-white" /></div>
              <div className="relative z-10 flex h-full items-center justify-between">
                 <div>
                   <h4 className="text-2xl font-black text-white italic mb-2">View Full Performance Studio</h4>
                   <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em]">Deep dive into your stage financials & trends</p>
                 </div>
                 <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center group-hover:translate-x-2 transition-transform">
                   <ArrowRight className="text-white w-6 h-6" />
                 </div>
              </div>
           </a>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-12 items-start transition-all duration-700">
           <section className="xl:col-span-3 bg-bloom-white/80 p-10 rounded-[3.5rem] border border-apricot/60 shadow-2xl shadow-rose-bloom/5">
            <div className="flex justify-between items-center mb-10">
               <h3 className="text-2xl font-black text-rose-bloom tracking-tight">Studio Timings</h3>
            </div>
            
            <CalendarContainer 
              role="teacher"
              events={schedules}
              onDateClick={setSelectedDate}
              onAddClick={(date) => {
                setSelectedDate(date);
                setIsModalOpen(true);
              }}
              onEventClick={(evt) => setSelectedDate(parseISO(evt.start_time))}
            />
          </section>

          <aside className="space-y-8">
            <div className="glass p-10 rounded-[3rem]">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-rose-bloom tracking-tight">
                  {format(selectedDate, 'MMM d')} Slots
                </h3>
              </div>
              
              <div className="space-y-4">
                {schedules.filter(s => isSameDay(parseISO(s.start_time), selectedDate)).length > 0 ? (
                  schedules
                    .filter(s => isSameDay(parseISO(s.start_time), selectedDate))
                    .sort((a,b) => a.start_time.localeCompare(b.start_time))
                    .map((slot, idx) => {
                      const sessionBookings = bookings.filter(b => b.schedule_id === slot.id);
                      const isPast = new Date(slot.start_time) < new Date();
                      return (
                        <div 
                          key={idx} 
                          onClick={() => {
                            console.log('[DEBUG] Card Clicked for Slot:', slot.id, 'Bookings:', sessionBookings.length);
                            setSelectedSessionForAttendance({ ...slot, bookings: sessionBookings });
                            setIsAttendanceModalOpen(true);
                          }}
                          className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                            isPast ? 'bg-zinc-50 border-zinc-200 opacity-60' : 'bg-bloom-white/60 border-apricot/40 group hover:border-rose-bloom'
                          }`}
                        >
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Users className="w-8 h-8" />
                          </div>
                          
                          <div className="text-rose-bloom font-black text-xs mb-1">{format(parseISO(slot.start_time), 'hh:mm a')}</div>
                          <div className="text-studio-dark font-bold mb-2">{slot.routines?.name}</div>
                          
                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex -space-x-2">
                               {sessionBookings.slice(0, 3).map((b, i) => (
                                 <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-rose-petal/20 flex items-center justify-center text-[6px] font-black uppercase text-rose-bloom overflow-hidden">
                                    {b.student?.avatar_url ? (
                                      <img src={b.student.avatar_url} className="w-full h-full object-cover" />
                                    ) : (
                                      b.student?.full_name?.charAt(0) || '?'
                                    )}
                                 </div>
                               ))}
                            </div>
                            <span className="text-[9px] font-black text-rose-bloom uppercase tracking-widest">
                              {sessionBookings.length} Registered
                            </span>
                          </div>

                          <div className="space-y-1">
                             {sessionBookings.slice(0, 2).map((b, i) => (
                               <div key={i} className="text-[9px] font-bold text-studio-dark/40 flex items-center gap-1">
                                  <div className="w-1 h-1 rounded-full bg-rose-bloom" />
                                  {b.student?.full_name} {b.payment_method === 'CREDITS' && <span className="text-rose-bloom font-black ml-1">(Credits)</span>}
                               </div>
                             ))}
                             {sessionBookings.length > 2 && (
                               <div className="text-[8px] font-black text-rose-bloom/40 ml-2">
                                  + {sessionBookings.length - 2} more...
                               </div>
                             )}
                          </div>

                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-apricot/20">
                            <div className="flex items-center gap-2 text-[10px] text-studio-dark/40">
                              <MapPin className="w-3 h-3" /> {slot.location}
                            </div>
                            {slot.status === 'CANCELLED' ? (
                              <div className="flex items-center gap-2">
                                <div className="text-[10px] font-black text-rose-bloom uppercase tracking-tighter bg-rose-bloom/5 px-3 py-1 rounded-lg">
                                  Cancelled
                                </div>
                                {!isPast && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReactivateSchedule(slot.id);
                                    }}
                                    className="p-1 px-2 bg-rose-bloom text-white text-[8px] font-black uppercase rounded-lg hover:bg-rose-petal transition-all"
                                    title="Re-activate Session"
                                  >
                                    Re-activate
                                  </button>
                                )}
                              </div>
                            ) : isPast ? (
                              <div className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter bg-zinc-100 px-3 py-1 rounded-lg">
                                Completed
                              </div>
                            ) : (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSessionToCancel(slot);
                                  setIsCancelModalOpen(true);
                                }}
                                className="text-[10px] font-black text-rose-bloom/40 hover:text-rose-bloom uppercase tracking-tighter transition-colors"
                              >
                                Cancel Session
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="py-12 text-center text-studio-dark/30 font-bold uppercase tracking-widest text-[10px]">
                    No sessions today
                  </div>
                )}
              </div>

            </div>

            <a 
              href={profile?.is_subscribed ? "/teacher/reports" : "/teacher/subscription"} 
              className="block glass p-8 rounded-[2.5rem] hover:scale-[1.02] transition-all group relative overflow-hidden"
            >
              {!profile?.is_subscribed && (
                <div className="absolute top-6 right-6 flex flex-col items-end gap-2">
                   <div className="px-3 py-1 bg-studio-dark/5 border border-studio-dark/10 rounded-full flex items-center gap-1.5 shadow-sm">
                      <Lock className="w-3 h-3 text-studio-dark/40" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-studio-dark/40">Premium</span>
                   </div>
                </div>
              )}
              <TrendingUp className={`w-10 h-10 mb-6 opacity-40 ${profile?.is_subscribed ? 'text-rose-bloom' : 'text-studio-dark/40'}`} />
              <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${profile?.is_subscribed ? 'text-rose-bloom' : 'text-studio-dark/40'}`}>Growth Energy</div>
              <div className="text-4xl font-black text-studio-dark">Analytics</div>
            </a>
            
          </aside>
        </div>
      </div>

      {/* Modal for Scheduling */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
            <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-rose-bloom/20 backdrop-blur-md" />
            <Motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-bloom-white w-full max-w-xl p-10 rounded-[3rem] relative z-20 overflow-hidden shadow-2xl border border-apricot/50">
               <div className="flex justify-between items-center mb-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-bloom/10 rounded-2xl">
                      <Sparkles className="w-6 h-6 text-rose-bloom" />
                    </div>
                    <h2 className="text-3xl font-black text-studio-dark">Add New Slot</h2>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-apricot/10 rounded-xl transition-colors text-studio-dark/30"><X/></button>
               </div>

               <form onSubmit={handleScheduleSubmit} className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center ml-2">
                       <label className="text-xs font-black uppercase tracking-widest text-studio-dark/40">Select Routine</label>
                       <button 
                        type="button"
                        onClick={() => setIsAddingRoutine(!isAddingRoutine)}
                        className="text-[10px] font-black text-rose-bloom uppercase tracking-widest hover:text-rose-petal transition-colors"
                       >
                         {isAddingRoutine ? '← Back to Selection' : '+ Quick Create New'}
                       </button>
                    </div>

                    <AnimatePresence mode="wait">
                      {isAddingRoutine ? (
                        <Motion.div 
                          key="quick-add"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="bg-apricot/5 p-6 rounded-[2rem] border border-apricot/20 space-y-4"
                        >
                           <div className="space-y-1">
                             <label className="text-[10px] font-black text-studio-dark/30 uppercase ml-1">Routine Name</label>
                             <input 
                              type="text" 
                              placeholder="e.g. Studio Morning Glow"
                              value={newRoutineData.name}
                              onChange={e => setNewRoutineData({...newRoutineData, name: e.target.value})}
                              className="w-full bg-white border border-apricot/20 rounded-xl py-3 px-4 text-sm font-bold focus:border-rose-bloom outline-none transition-all"
                             />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1">
                               <label className="text-[10px] font-black text-studio-dark/30 uppercase ml-1">Duration (Min)</label>
                               <input 
                                type="number" 
                                value={newRoutineData.duration_minutes}
                                onChange={e => setNewRoutineData({...newRoutineData, duration_minutes: parseInt(e.target.value)})}
                                className="w-full bg-white border border-apricot/40 rounded-xl py-3 px-4 text-sm font-bold focus:border-rose-bloom outline-none transition-all"
                               />
                             </div>
                             <div className="space-y-1">
                               <label className="text-[10px] font-black text-studio-dark/30 uppercase ml-1">Price ($)</label>
                               <input 
                                type="number" 
                                step="0.01"
                                value={newRoutineData.default_price}
                                onChange={e => setNewRoutineData({...newRoutineData, default_price: parseFloat(e.target.value)})}
                                className="w-full bg-white border border-apricot/40 rounded-xl py-3 px-4 text-sm font-bold focus:border-rose-bloom outline-none transition-all"
                               />
                             </div>
                           </div>
                           <button 
                            type="button"
                            onClick={handleQuickRoutineSubmit}
                            className="w-full py-4 bg-rose-bloom text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-petal transition-all shadow-lg shadow-rose-bloom/20"
                           >
                             Save & Use this Routine
                           </button>
                        </Motion.div>
                      ) : (
                        <Motion.div 
                          key="select-routine"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="relative group"
                        >
                          <div className="flex gap-4 items-center">
                            <div className="relative flex-1 group">
                              <Package className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-bloom/40 group-focus-within:text-rose-bloom transition-colors pointer-events-none" />
                              <select 
                                required
                                value={formData.routine_id}
                                onChange={(e) => {
                                  const rId = e.target.value;
                                  const selected = routines.find(r => r.id === rId);
                                  setFormData({
                                    ...formData, 
                                    routine_id: rId, 
                                    price: selected ? selected.default_price : ''
                                  });
                                }}
                                className="w-full bg-white/60 border border-apricot/40 rounded-2xl py-5 pl-14 pr-12 focus:outline-none focus:border-rose-bloom transition-all font-bold text-studio-dark appearance-none cursor-pointer"
                              >
                                <option value="">Choose a Signature Routine...</option>
                                {routines.map(r => (
                                  <option key={r.id} value={r.id}>{r.name} ({r.duration_minutes}m)</option>
                                ))}
                              </select>
                              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg className="w-5 h-5 text-rose-bloom/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                              </div>
                            </div>
                            {formData.routine_id && (
                              <button 
                                type="button"
                                onClick={handleDeleteRoutine}
                                className="p-5 bg-rose-petal/10 hover:bg-rose-petal/20 text-rose-bloom rounded-2xl transition-all"
                                title="Delete this routine"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </Motion.div>
                      )}
                    </AnimatePresence>
                    {routines.length === 0 && !isAddingRoutine && (
                      <p className="text-[10px] font-bold text-rose-bloom italic ml-4">No routines found. Click Quick Create to add your first!</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-studio-dark/40">Start Time</label>
                      <input 
                        type="time" 
                        required
                        value={formData.start_time}
                        onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                        className="w-full bg-white/60 border border-apricot/40 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-studio-dark"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-studio-dark/40 ml-2">Price ($)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="Default"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        className="w-full bg-white/60 border border-apricot/40 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-studio-dark"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-studio-dark/40 ml-2">Location</label>
                    <input 
                      type="text" 
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      className="w-full bg-white/60 border border-apricot/20 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-studio-dark"
                    />
                  </div>

                  <button 
                    disabled={routines.length === 0 || modalLoading}
                    type="submit" 
                    className="w-full btn-premium bg-gradient-to-r from-rose-bloom to-apricot text-white font-black py-6 rounded-[2rem] hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-rose-bloom/30 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    {modalLoading ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5 text-white/50" />}
                    Confirm Schedule
                  </button>
               </form>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Stylish Cancellation Modal */}
      <AnimatePresence>
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <Motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsCancelModalOpen(false)} 
              className="absolute inset-0 bg-studio-dark/60 backdrop-blur-xl" 
            />
            <Motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="bg-white max-w-md w-full p-10 rounded-[3rem] relative z-20 shadow-2xl border border-rose-bloom/20 text-center"
            >
              <div className="w-20 h-20 bg-rose-bloom/10 rounded-full flex items-center justify-center mx-auto mb-8">
                <AlertTriangle className="w-10 h-10 text-rose-bloom" />
              </div>
              
              <h2 className="text-3xl font-black text-studio-dark mb-4 italic">Lowering the Curtain?</h2>
              <p className="text-studio-dark/60 font-medium text-sm mb-10 leading-relaxed px-4">
                Are you sure you want to cancel <span className="text-rose-bloom font-black">"{selectedSessionToCancel?.routines?.name}"</span>? 
                This will automatically issue credits to all registered students for your stage.
              </p>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => {
                    handleCancelSchedule(selectedSessionToCancel.id);
                    setIsCancelModalOpen(false);
                  }}
                  className="w-full py-5 bg-rose-bloom text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-rose-petal transition-all shadow-xl shadow-rose-bloom/20"
                >
                  Yes, Cancel & Refund
                </button>
                <button 
                  onClick={() => setIsCancelModalOpen(false)}
                  className="w-full py-5 bg-studio-dark/5 text-studio-dark/40 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-studio-dark/10 transition-all border border-studio-dark/5"
                >
                  Keep Scheduled
                </button>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Attendance Modal (Inlined for reliability) */}
      <AnimatePresence>
        {isAttendanceModalOpen && selectedSessionForAttendance && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
            <Motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsAttendanceModalOpen(false)} 
              className="absolute inset-0 bg-studio-dark/40 backdrop-blur-md" 
            />
            <Motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="bg-bloom-white w-full max-w-2xl rounded-[3rem] relative z-20 overflow-hidden shadow-2xl border border-apricot/50 flex flex-col max-h-[90vh]"
            >
              <div className="p-10 border-b border-apricot/20 shrink-0">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-bloom/10 rounded-2xl">
                      <Users className="w-6 h-6 text-rose-bloom" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-studio-dark">Registered Students</h2>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-studio-dark/40 mt-1">
                        {selectedSessionForAttendance.routines?.name} • {selectedSessionForAttendance.start_time ? format(parseISO(selectedSessionForAttendance.start_time), 'MMM d, h:mm a') : '...'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setIsAttendanceModalOpen(false)} className="p-3 hover:bg-apricot/10 rounded-xl transition-colors text-studio-dark/30"><X/></button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                   <div className="bg-bloom-white p-4 rounded-2xl border border-apricot/30 text-center">
                      <div className="text-[8px] font-black uppercase text-studio-dark/30 mb-1">Total Booked</div>
                      <div className="text-xl font-black text-studio-dark">
                        {(selectedSessionForAttendance.bookings || []).filter(b => selectedSessionForAttendance.status === 'CANCELLED' || b.status !== 'CANCELLED').length}
                      </div>
                   </div>
                   <div className="bg-bloom-white p-4 rounded-2xl border border-apricot/30 text-center">
                      <div className="text-[8px] font-black uppercase text-studio-dark/30 mb-1">Remaining</div>
                      <div className="text-xl font-black text-rose-bloom">
                        {(selectedSessionForAttendance.max_seats || 0) - (selectedSessionForAttendance.bookings || []).filter(b => selectedSessionForAttendance.status === 'CANCELLED' || b.status !== 'CANCELLED').length}
                      </div>
                   </div>
                   <div className="bg-bloom-white p-4 rounded-2xl border border-apricot/30 text-center">
                      <div className="text-[8px] font-black uppercase text-studio-dark/30 mb-1">Capacity</div>
                      <div className="text-xl font-black text-studio-dark/40">{selectedSessionForAttendance.max_seats}</div>
                   </div>
                </div>
              </div>

              <div className="overflow-y-auto p-10 custom-scrollbar flex-1">
                {((selectedSessionForAttendance.bookings || []).filter(b => selectedSessionForAttendance.status === 'CANCELLED' || b.status !== 'CANCELLED').length) > 0 ? (
                  <div className="space-y-4">
                    {(selectedSessionForAttendance.bookings || [])
                      .filter(b => selectedSessionForAttendance.status === 'CANCELLED' || b.status !== 'CANCELLED')
                      .map((booking, i) => (
                      <Motion.div 
                        key={booking.id || i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between p-4 bg-white rounded-2xl border border-apricot/20 hover:border-rose-bloom/30 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-rose-petal/10 border border-rose-petal/20 overflow-hidden flex items-center justify-center">
                            {booking.student?.avatar_url ? (
                              <img src={booking.student.avatar_url} className="w-full h-full object-cover" alt={booking.student.full_name} />
                            ) : (
                              <div className="text-lg font-black text-rose-bloom uppercase">{booking.student?.full_name?.charAt(0)}</div>
                            )}
                          </div>
                          <div>
                            <div className="font-black text-studio-dark">{booking.student?.full_name}</div>
                            <div className="text-[10px] font-bold text-studio-dark/30 uppercase tracking-widest">
                              {booking.student?.email || 'Anonymous Student'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                             booking.status === 'CANCELLED' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                             booking.payment_status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-bloom/10 text-rose-bloom border-rose-bloom/20'
                           }`}>
                             {booking.status === 'CANCELLED' ? (
                               booking.payment_status === 'REFUNDED' ? 'Cancelled - Credit Refunded' : 'Cancelled'
                             ) : (
                               booking.payment_status === 'PAID' ? (booking.payment_method === 'CREDITS' ? 'Paid (Credits)' : 'Paid') : booking.payment_status
                             )}
                           </div>
                           {booking.payment_status === 'PENDING' && (
                             <button 
                               onClick={() => handleMarkAsPaid(booking.id)}
                               className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl transition-all flex items-center gap-2 group/btn"
                               title="Confirm Cash Payment"
                             >
                                <span className="text-[8px] font-black uppercase tracking-widest hidden group-hover/btn:block">Mark Paid</span>
                                <Plus className="w-4 h-4" />
                             </button>
                           )}
                           <button className="p-2 opacity-0 group-hover:opacity-100 transition-all text-studio-dark/20 hover:text-studio-dark">
                              <ArrowRight className="w-4 h-4" />
                           </button>
                        </div>
                      </Motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 bg-apricot/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Users className="w-8 h-8 text-studio-dark/10" />
                    </div>
                    <p className="text-sm font-black text-studio-dark/20 uppercase tracking-[0.2em]">No students registered yet</p>
                  </div>
                )}
              </div>

              <div className="p-10 border-t border-apricot/20 bg-apricot/5 shrink-0">
                 <button className="w-full py-5 bg-white border border-apricot/30 rounded-2xl text-[10px] font-black uppercase tracking-widest text-studio-dark hover:bg-white/80 transition-all flex items-center justify-center gap-2">
                    Export Attendance List
                 </button>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Error Modal */}
      <AnimatePresence>
        {isErrorModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsErrorModalOpen(false)} className="absolute inset-0 bg-studio-dark/60 backdrop-blur-xl" />
            <Motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-bloom-white w-full max-w-md p-10 rounded-[3.5rem] relative z-20 text-center shadow-2xl border border-rose-bloom/20">
              <div className="w-20 h-20 bg-rose-bloom/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
                <AlertTriangle className="w-10 h-10 text-rose-bloom" />
              </div>
              <h2 className="text-3xl font-black text-studio-dark mb-4 italic">Time Warp Detected.</h2>
              <p className="text-sm text-studio-dark/40 font-bold uppercase tracking-widest leading-loose mb-10">
                {errorMessage || "The rhythm of the stage only flows forward. Past sessions cannot be scheduled."}
              </p>
              <button 
                onClick={() => {
                  const now = new Date();
                  setFormData(prev => ({ ...prev, start_time: format(now, 'HH:mm') }));
                  setIsErrorModalOpen(false);
                }}
                className="w-full py-5 bg-studio-dark text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-rose-bloom transition-all shadow-xl shadow-studio-dark/20"
              >
                Sync with Present
              </button>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
