import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabaseClient';
import { Calendar as CalendarIcon, Users, TrendingUp, Plus, LogOut, Settings as SettingsIcon, Package, Sparkles, X, Save, Clock, MapPin, Trash2, ShieldCheck, ArrowRight, RefreshCw, Copy, Lock, AlertTriangle } from 'lucide-react';
import CalendarContainer from '../../components/CalendarContainer';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { isSameDay, format, parseISO } from 'date-fns';

export default function TeacherDashboard() {
  const { profile, signOut, user, isDevBypass } = useAuth();
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

    // Storage listener to sync across tabs in mock mode
    const handleStorageChange = (e) => {
      if (e.key === 'zumba_mock_schedules' || e.key === 'zumba_mock_routines' || e.key === 'zumba_mock_bookings') {
        fetchAllSchedules();
        fetchRoutines();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user?.id]); // Only depend on user ID to avoid profile-change loops



  const fetchRoutines = async () => {
    if (isDevBypass) {
      const mockRoutines = JSON.parse(localStorage.getItem('zumba_mock_routines') || '[]');
      if (mockRoutines.length === 0) {
        const defaults = [
          { id: 'mock-r1', name: 'Zumba Gold', duration_minutes: 60, default_price: 15.00 },
          { id: 'mock-r2', name: 'Evening Energy', duration_minutes: 45, default_price: 12.00 }
        ];
        setRoutines(defaults);
        localStorage.setItem('zumba_mock_routines', JSON.stringify(defaults));
      } else {
        setRoutines(mockRoutines);
      }
      return;
    }
    const { data } = await supabase
      .from('routines')
      .select('*')
      .eq('teacher_id', user.id);
    setRoutines(data || []);
  };

  const ensureInviteCode = async () => {
    if (profile?.role?.toUpperCase() !== 'TEACHER') return;
    
    if (profile.stage_code) {
      setInviteCode(profile.stage_code);
      return;
    }

    // Generate code if missing
    const newCode = `ZUMBA-${profile.full_name?.split(' ')[0].toUpperCase() || 'STAGE'}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    try {
      if (isDevBypass) {
        const mockProfile = JSON.parse(localStorage.getItem('zumba_mock_profile') || '{}');
        mockProfile.invite_code = newCode;
        localStorage.setItem('zumba_mock_profile', JSON.stringify(mockProfile));
        
        // Also update the persistent profiles list
        const stableId = mockProfile.id;
        const savedProfiles = JSON.parse(localStorage.getItem('zumba_mock_profiles') || '{}');
        if (savedProfiles[stableId]) {
          savedProfiles[stableId].invite_code = newCode;
          localStorage.setItem('zumba_mock_profiles', JSON.stringify(savedProfiles));
        }
      } else {
        await supabase.from('profiles').update({ stage_code: newCode }).eq('id', user.id);
      }
      setInviteCode(newCode);
      return newCode;
    } catch (e) {
      console.error('Code generation failed', e);
      throw e;
    }
  };

  const handleRefreshInviteCode = async () => {
    const toastId = toast.loading('Refreshing stage code...');
    try {
      const newCode = `ZUMBA-${profile.full_name?.split(' ')[0].toUpperCase() || 'STAGE'}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      if (isDevBypass) {
        const mockProfile = JSON.parse(localStorage.getItem('zumba_mock_profile') || '{}');
        mockProfile.invite_code = newCode;
        localStorage.setItem('zumba_mock_profile', JSON.stringify(mockProfile));
        
        const savedProfiles = JSON.parse(localStorage.getItem('zumba_mock_profiles') || '{}');
        if (savedProfiles[user.id]) {
          savedProfiles[user.id].invite_code = newCode;
          localStorage.setItem('zumba_mock_profiles', JSON.stringify(savedProfiles));
        }
      } else {
        const { error } = await supabase.from('profiles').update({ invite_code: newCode }).eq('id', user.id);
        if (error) throw error;
      }
      
      setInviteCode(newCode);
      toast.success('Stage code refreshed!', { id: toastId });
    } catch (error) {
      toast.error('Failed to refresh code', { id: toastId });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Code copied to clipboard!');
  };
  const fetchAllSchedules = async () => {
    let schedulesData = [];
    if (isDevBypass) {
        const mockSchedules = JSON.parse(localStorage.getItem('zumba_mock_schedules') || '[]');
        const mockRoutines = JSON.parse(localStorage.getItem('zumba_mock_routines') || '[]');
        
        schedulesData = mockSchedules
            .filter(s => {
                const match = String(s.teacher_id).trim() === String(user.id).trim();
                return match;
            })
            .map(s => ({
                ...s,
                routines: mockRoutines.find(r => r.id === s.routine_id) || { name: 'Routine' }
            }));
    } else {
        const { data, error } = await supabase
          .from('schedules')
          .select('*, routines(name, duration_minutes)')
          .eq('teacher_id', user.id);
        
        if (error) console.error('Fetch error:', error);
        schedulesData = data || [];
    }

    setSchedules(schedulesData);
    fetchBookings(schedulesData);
    setLoading(false);
  };

  const fetchBookings = async (currentSchedules) => {
    const activeSchedules = currentSchedules || schedules;
    if (isDevBypass) {
      const mockBookings = JSON.parse(localStorage.getItem('zumba_mock_bookings') || '[]');
      const mockProfiles = JSON.parse(localStorage.getItem('zumba_mock_profiles') || '{}');
      
      const enriched = mockBookings.map(b => ({
        ...b,
        student: mockProfiles[b.student_id] || { full_name: 'Unknown Student' }
      }));
      setBookings(enriched);
      return;
    }

    if (!activeSchedules || activeSchedules.length === 0) return;

    const { data } = await supabase
      .from('bookings')
      .select('*, student:student_id(full_name, avatar_url, email)')
      .in('schedule_id', activeSchedules.map(s => s.id));
    
    setBookings(data || []);
  };

  const handleQuickRoutineSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      const payload = { ...newRoutineData, teacher_id: user.id };
      let createdRoutine;

      if (isDevBypass) {
        const existing = JSON.parse(localStorage.getItem('zumba_mock_routines') || '[]');
        createdRoutine = { ...payload, id: 'mock-r' + Date.now() };
        localStorage.setItem('zumba_mock_routines', JSON.stringify([...existing, createdRoutine]));
      } else {
        const { data, error } = await supabase.from('routines').insert([payload]).select().single();
        if (error) throw error;
        createdRoutine = data;
      }

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
      if (isDevBypass) {
        const existing = JSON.parse(localStorage.getItem('zumba_mock_routines') || '[]');
        const filtered = existing.filter(r => r.id !== formData.routine_id);
        localStorage.setItem('zumba_mock_routines', JSON.stringify(filtered));
      } else {
        const { error } = await supabase.from('routines').delete().eq('id', formData.routine_id);
        if (error) throw error;
      }
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

      if (isDevBypass) {
        const existing = JSON.parse(localStorage.getItem('zumba_mock_schedules') || '[]');
        localStorage.setItem('zumba_mock_schedules', JSON.stringify([...existing, { ...newSchedule, id: 'mock-s' + Date.now() }]));
      } else {
        const { error } = await supabase.from('schedules').insert([newSchedule]);
        if (error) throw error;
      }
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
      if (isDevBypass) {
        const mockBookings = JSON.parse(localStorage.getItem('zumba_mock_bookings') || '[]');
        const updatedBookings = mockBookings.map(b => 
          b.id === bookingId ? { ...b, payment_status: 'PAID', payment_method: 'MANUAL' } : b
        );
        localStorage.setItem('zumba_mock_bookings', JSON.stringify(updatedBookings));
      } else {
        const { error } = await supabase
          .from('bookings')
          .update({ payment_status: 'PAID', payment_method: 'MANUAL' })
          .eq('id', bookingId);
        if (error) throw error;
      }
      
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
      if (isDevBypass) {
        // 1. Update Schedule Status
        const mockSchedules = JSON.parse(localStorage.getItem('zumba_mock_schedules') || '[]');
        const updatedSchedules = mockSchedules.map(s => s.id === scheduleId ? { ...s, status: 'CANCELLED' } : s);
        localStorage.setItem('zumba_mock_schedules', JSON.stringify(updatedSchedules));

        // 2. Process Refunds (Identify PAID & NOT YET CANCELLED bookings BEFORE we update them)
        const mockBookings = JSON.parse(localStorage.getItem('zumba_mock_bookings') || '[]');
        const paidBookings = mockBookings.filter(b => 
          b.schedule_id === scheduleId && 
          b.payment_status === 'PAID' && 
          b.status !== 'CANCELLED'
        );

        // 3. Sync: Mark ALL bookings for this schedule as CANCELLED
        const syncedBookings = mockBookings.map(b => 
          b.schedule_id === scheduleId ? { ...b, status: 'CANCELLED', payment_status: 'CANCELLED' } : b
        );
        localStorage.setItem('zumba_mock_bookings', JSON.stringify(syncedBookings));

        if (paidBookings.length > 0) {
          const mockCredits = JSON.parse(localStorage.getItem('zumba_mock_credits') || '[]');
          
          paidBookings.forEach(booking => {
            const index = mockCredits.findIndex(c => c.student_id === booking.student_id && c.teacher_id === user.id);
            if (index !== -1) {
              mockCredits[index].balance += booking.price;
            } else {
              mockCredits.push({
                id: 'c-' + Date.now() + Math.random(),
                student_id: booking.student_id,
                teacher_id: user.id,
                balance: booking.price,
                last_updated: new Date().toISOString()
              });
            }
          });
          localStorage.setItem('zumba_mock_credits', JSON.stringify(mockCredits));
          console.log(`[REFUND] Processed ${paidBookings.length} refunds. Already cancelled bookings were skipped.`);
          toast.success(`Session cancelled. Credits issued to ${paidBookings.length} students.`);
        } else {
          toast.success('Session cancelled.');
        }
      } else {
        const { error } = await supabase.from('schedules').update({ status: 'CANCELLED' }).eq('id', scheduleId);
        if (error) throw error;
        toast.success('Session cancelled.');
      }
      fetchAllSchedules();
    } catch (error) {
      toast.error('Failed to cancel session');
    }
  };

  return (
    <div className="min-h-screen bg-bloom-white text-theatre-dark p-6 sm:p-10">
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
              <h1 className="text-3xl font-black text-theatre-dark font-display italic">
                Lovely to see you, <span className="text-gradient-sunset capitalize">{profile?.full_name || 'Instructor'}</span>!
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-theatre-dark/90 mt-1">Teacher Dashboard</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
             <div className="flex items-center gap-2 bg-white/50 border border-apricot/40 px-4 py-2 rounded-2xl shadow-sm group hover:border-rose-bloom transition-all">
                <div className="flex flex-col items-start mr-4">
                  <span className="text-[8px] font-black uppercase tracking-widest text-theatre-dark/30 leading-none mb-1">Stage Code</span>
                  <span className="text-xs font-black text-rose-bloom font-mono tracking-wider">{inviteCode || '...'}</span>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => copyToClipboard(inviteCode)}
                    className="p-2 hover:bg-rose-bloom/10 rounded-lg text-theatre-dark/40 hover:text-rose-bloom transition-all"
                    title="Copy Code"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleRefreshInviteCode}
                    className="p-2 hover:bg-rose-bloom/10 rounded-lg text-theatre-dark/40 hover:text-rose-bloom transition-all"
                    title="Refresh Code"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
             </div>
             
             <a href="/teacher/settings" className="p-4 bg-bloom-white rounded-2xl border border-apricot/60 hover:bg-apricot/5 transition-all shadow-sm group">
               <SettingsIcon className="w-5 h-5 text-rose-bloom group-hover:rotate-45 transition-transform" />
             </a>
             <button onClick={signOut} className="p-4 bg-white rounded-2xl border border-theatre-dark/20 hover:bg-rose-petal/5 transition-all shadow-sm">
               <LogOut className="w-5 h-5 text-rose-bloom" />
             </button>
          </div>
        </header>

        {/* Removed Subscription Banner to allow free access */}

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-12 items-start transition-all duration-700">
          <section className="xl:col-span-3 bg-bloom-white/80 p-10 rounded-[3.5rem] border border-apricot/60 shadow-2xl shadow-rose-bloom/5">
            <div className="flex justify-between items-center mb-10">
               <h3 className="text-2xl font-black text-rose-bloom tracking-tight">Zumba Timings</h3>
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
                          <div className="text-theatre-dark font-bold mb-2">{slot.routines?.name}</div>
                          
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
                               <div key={i} className="text-[9px] font-bold text-theatre-dark/40 flex items-center gap-1">
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
                            <div className="flex items-center gap-2 text-[10px] text-theatre-dark/40">
                              <MapPin className="w-3 h-3" /> {slot.location}
                            </div>
                            {slot.status === 'CANCELLED' ? (
                              <div className="text-[10px] font-black text-rose-bloom uppercase tracking-tighter bg-rose-bloom/5 px-3 py-1 rounded-lg">
                                Cancelled
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
                  <div className="py-12 text-center text-theatre-dark/30 font-bold uppercase tracking-widest text-[10px]">
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
                   <div className="px-3 py-1 bg-theatre-dark/5 border border-theatre-dark/10 rounded-full flex items-center gap-1.5 shadow-sm">
                      <Lock className="w-3 h-3 text-theatre-dark/40" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-theatre-dark/40">Premium</span>
                   </div>
                </div>
              )}
              <TrendingUp className={`w-10 h-10 mb-6 opacity-40 ${profile?.is_subscribed ? 'text-rose-bloom' : 'text-theatre-dark/40'}`} />
              <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${profile?.is_subscribed ? 'text-rose-bloom' : 'text-theatre-dark/40'}`}>Growth Energy</div>
              <div className="text-4xl font-black text-theatre-dark">Analytics</div>
            </a>
            
          </aside>
        </div>
      </div>

      {/* Modal for Scheduling */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-rose-bloom/20 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-bloom-white w-full max-w-xl p-10 rounded-[3rem] relative z-20 overflow-hidden shadow-2xl border border-apricot/50">
               <div className="flex justify-between items-center mb-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-bloom/10 rounded-2xl">
                      <Sparkles className="w-6 h-6 text-rose-bloom" />
                    </div>
                    <h2 className="text-3xl font-black text-theatre-dark">Add New Slot</h2>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-apricot/10 rounded-xl transition-colors text-theatre-dark/30"><X/></button>
               </div>

               <form onSubmit={handleScheduleSubmit} className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center ml-2">
                       <label className="text-xs font-black uppercase tracking-widest text-theatre-dark/40">Select Routine</label>
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
                        <motion.div 
                          key="quick-add"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="bg-apricot/5 p-6 rounded-[2rem] border border-apricot/20 space-y-4"
                        >
                           <div className="space-y-1">
                             <label className="text-[10px] font-black text-theatre-dark/30 uppercase ml-1">Routine Name</label>
                             <input 
                              type="text" 
                              placeholder="e.g. Zumba Morning Glow"
                              value={newRoutineData.name}
                              onChange={e => setNewRoutineData({...newRoutineData, name: e.target.value})}
                              className="w-full bg-white border border-apricot/20 rounded-xl py-3 px-4 text-sm font-bold focus:border-rose-bloom outline-none transition-all"
                             />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1">
                               <label className="text-[10px] font-black text-theatre-dark/30 uppercase ml-1">Duration (Min)</label>
                               <input 
                                type="number" 
                                value={newRoutineData.duration_minutes}
                                onChange={e => setNewRoutineData({...newRoutineData, duration_minutes: parseInt(e.target.value)})}
                                className="w-full bg-white border border-apricot/40 rounded-xl py-3 px-4 text-sm font-bold focus:border-rose-bloom outline-none transition-all"
                               />
                             </div>
                             <div className="space-y-1">
                               <label className="text-[10px] font-black text-theatre-dark/30 uppercase ml-1">Price ($)</label>
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
                        </motion.div>
                      ) : (
                        <motion.div 
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
                                className="w-full bg-white/60 border border-apricot/40 rounded-2xl py-5 pl-14 pr-12 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark appearance-none cursor-pointer"
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
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {routines.length === 0 && !isAddingRoutine && (
                      <p className="text-[10px] font-bold text-rose-bloom italic ml-4">No routines found. Click Quick Create to add your first!</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-theatre-dark/40">Start Time</label>
                      <input 
                        type="time" 
                        required
                        value={formData.start_time}
                        onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                        className="w-full bg-white/60 border border-apricot/40 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-theatre-dark/40 ml-2">Price ($)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="Default"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        className="w-full bg-white/60 border border-apricot/40 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-theatre-dark/40 ml-2">Location</label>
                    <input 
                      type="text" 
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      className="w-full bg-white/60 border border-apricot/20 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark"
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Stylish Cancellation Modal */}
      <AnimatePresence>
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsCancelModalOpen(false)} 
              className="absolute inset-0 bg-theatre-dark/60 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="bg-white max-w-md w-full p-10 rounded-[3rem] relative z-20 shadow-2xl border border-rose-bloom/20 text-center"
            >
              <div className="w-20 h-20 bg-rose-bloom/10 rounded-full flex items-center justify-center mx-auto mb-8">
                <AlertTriangle className="w-10 h-10 text-rose-bloom" />
              </div>
              
              <h2 className="text-3xl font-black text-theatre-dark mb-4 italic">Lowering the Curtain?</h2>
              <p className="text-theatre-dark/60 font-medium text-sm mb-10 leading-relaxed px-4">
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
                  className="w-full py-5 bg-theatre-dark/5 text-theatre-dark/40 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-theatre-dark/10 transition-all border border-theatre-dark/5"
                >
                  Keep Scheduled
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Attendance Modal (Inlined for reliability) */}
      <AnimatePresence>
        {isAttendanceModalOpen && selectedSessionForAttendance && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsAttendanceModalOpen(false)} 
              className="absolute inset-0 bg-theatre-dark/40 backdrop-blur-md" 
            />
            <motion.div 
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
                      <h2 className="text-3xl font-black text-theatre-dark">Registered Students</h2>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-theatre-dark/40 mt-1">
                        {selectedSessionForAttendance.routines?.name} • {selectedSessionForAttendance.start_time ? format(parseISO(selectedSessionForAttendance.start_time), 'MMM d, h:mm a') : '...'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setIsAttendanceModalOpen(false)} className="p-3 hover:bg-apricot/10 rounded-xl transition-colors text-theatre-dark/30"><X/></button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                   <div className="bg-bloom-white p-4 rounded-2xl border border-apricot/30 text-center">
                      <div className="text-[8px] font-black uppercase text-theatre-dark/30 mb-1">Total Booked</div>
                      <div className="text-xl font-black text-theatre-dark">{selectedSessionForAttendance.bookings?.length || 0}</div>
                   </div>
                   <div className="bg-bloom-white p-4 rounded-2xl border border-apricot/30 text-center">
                      <div className="text-[8px] font-black uppercase text-theatre-dark/30 mb-1">Remaining</div>
                      <div className="text-xl font-black text-rose-bloom">{(selectedSessionForAttendance.max_seats || 0) - (selectedSessionForAttendance.bookings?.length || 0)}</div>
                   </div>
                   <div className="bg-bloom-white p-4 rounded-2xl border border-apricot/30 text-center">
                      <div className="text-[8px] font-black uppercase text-theatre-dark/30 mb-1">Capacity</div>
                      <div className="text-xl font-black text-theatre-dark/40">{selectedSessionForAttendance.max_seats}</div>
                   </div>
                </div>
              </div>

              <div className="overflow-y-auto p-10 custom-scrollbar flex-1">
                {(selectedSessionForAttendance.bookings?.length || 0) > 0 ? (
                  <div className="space-y-4">
                    {selectedSessionForAttendance.bookings.map((booking, i) => (
                      <motion.div 
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
                            <div className="font-black text-theatre-dark">{booking.student?.full_name}</div>
                            <div className="text-[10px] font-bold text-theatre-dark/30 uppercase tracking-widest">{booking.student?.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                             booking.payment_status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-bloom/10 text-rose-bloom border-rose-bloom/20'
                           }`}>
                             {booking.payment_status === 'PAID' ? (booking.payment_method === 'CREDITS' ? 'Paid (Credits)' : 'Paid') : booking.payment_status}
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
                           <button className="p-2 opacity-0 group-hover:opacity-100 transition-all text-theatre-dark/20 hover:text-theatre-dark">
                              <ArrowRight className="w-4 h-4" />
                           </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 bg-apricot/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Users className="w-8 h-8 text-theatre-dark/10" />
                    </div>
                    <p className="text-sm font-black text-theatre-dark/20 uppercase tracking-[0.2em]">No students registered yet</p>
                  </div>
                )}
              </div>

              <div className="p-10 border-t border-apricot/20 bg-apricot/5 shrink-0">
                 <button className="w-full py-5 bg-white border border-apricot/30 rounded-2xl text-[10px] font-black uppercase tracking-widest text-theatre-dark hover:bg-white/80 transition-all flex items-center justify-center gap-2">
                    Export Attendance List
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Error Modal */}
      <AnimatePresence>
        {isErrorModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsErrorModalOpen(false)} className="absolute inset-0 bg-theatre-dark/60 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-bloom-white w-full max-w-md p-10 rounded-[3.5rem] relative z-20 text-center shadow-2xl border border-rose-bloom/20">
              <div className="w-20 h-20 bg-rose-bloom/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
                <AlertTriangle className="w-10 h-10 text-rose-bloom" />
              </div>
              <h2 className="text-3xl font-black text-theatre-dark mb-4 italic">Time Warp Detected.</h2>
              <p className="text-sm text-theatre-dark/40 font-bold uppercase tracking-widest leading-loose mb-10">
                {errorMessage || "The rhythm of the stage only flows forward. Past sessions cannot be scheduled."}
              </p>
              <button 
                onClick={() => {
                  const now = new Date();
                  setFormData(prev => ({ ...prev, start_time: format(now, 'HH:mm') }));
                  setIsErrorModalOpen(false);
                }}
                className="w-full py-5 bg-theatre-dark text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-rose-bloom transition-all shadow-xl shadow-theatre-dark/20"
              >
                Sync with Present
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
