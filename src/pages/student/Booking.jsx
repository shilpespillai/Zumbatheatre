import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  isSameMonth, isSameDay, addDays, parseISO, startOfDay
} from 'date-fns';
import { 
  ChevronLeft, Calendar as CalendarIcon, Clock, MapPin, 
  Sparkles, ShieldCheck, Heart, Share2, Star,
  CreditCard, ExternalLink, Banknote, Landmark, Ticket
} from 'lucide-react';
import { toast } from 'sonner';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import CalendarContainer from '../../components/CalendarContainer';

export default function StudentBooking() {
  const { teacherId } = useParams();
  const navigate = useNavigate();
  const { user, profile, fetchProfile } = useAuth();

  const [teacher, setTeacher] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [booking, setBooking] = useState(false);
  const [studentCredits, setStudentCredits] = useState(0);
  const [allStudentBookings, setAllStudentBookings] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [loyaltyEligible, setLoyaltyEligible] = useState(false);

  const findCollision = useCallback((session) => {
    if (!session || allStudentBookings.length === 0) return null;
    
    const sessionStart = new Date(session.start_time).getTime();
    const sessionEnd = sessionStart + (session.routines?.duration_minutes || 60) * 60 * 1000;

    return allStudentBookings.find(booking => {
      if (booking.schedule_id === session.id) return false; 
      
      const bStart = new Date(booking.schedules.start_time).getTime();
      const bEnd = bStart + (booking.schedules.routines?.duration_minutes || 60) * 60 * 1000;
      
      return sessionStart < bEnd && sessionEnd > bStart;
    });
  }, [allStudentBookings]);

  const fetchTeacher = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', teacherId)
      .single();
    if (error) {
      console.error('[Booking] Fetch teacher error:', error);
      return;
    }
    const teacherData = data;

    if (teacherData) {
      const settings = teacherData.payment_settings || {};
      const config = settings.config || {};
      const enabledMethods = settings.enabledMethods || [];
      
      let available = [];
      if (enabledMethods.length > 0) {
        available = enabledMethods;
      } else {
        // Fallback for legacy data
        if (config.paypal_url) available.push('paypal');
        if (config.bank_instructions) available.push('manual');
      }
      
      // ONLY set default if not already selected to avoid resetting on re-fetches
      setSelectedMethod(current => current || settings.method || (available.length > 0 ? available[0] : null));
      setTeacher(teacherData);
    }
  }, [teacherId]);

  const fetchSchedules = useCallback(async () => {
    const firstDay = startOfMonth(currentMonth);
    const lastDay = endOfMonth(currentMonth);
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get('sessionId');

    const { data, error } = await supabase
      .from('schedules')
      .select('*, routines(name, description, duration_minutes)')
      .eq('teacher_id', teacherId)
      .eq('status', 'SCHEDULED')
      .gte('start_time', firstDay.toISOString())
      .lte('start_time', lastDay.toISOString());

    if (error) {
      console.error('[Booking] Fetch schedules error:', error);
      setLoading(false);
      return;
    }

    const schedulesData = data || [];
    setSchedules(schedulesData);

    if (sessionId) {
      const session = schedulesData.find(s => s.id === sessionId);
      if (session) {
        setSelectedSession(session);
        setSelectedDate(parseISO(session.start_time));
      }
    }

    setLoading(false);
  }, [teacherId, currentMonth]);

  const fetchCredits = useCallback(async () => {
    if (!profile?.id || !teacherId) return;
    try {
      const { data, error } = await supabase
        .from('credits')
        .select('balance')
        .eq('student_id', profile.id)
        .eq('teacher_id', teacherId)
        .single();
      
      if (!error && data) {
        setStudentCredits(parseFloat(data.balance));
      } else {
        setStudentCredits(0);
      }
    } catch (err) {
      console.error('[Booking] Fetch credits error:', err);
    }
  }, [profile?.id, teacherId]);

  const fetchAllStudentBookings = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, schedules(teacher_id, start_time, routines(name, duration_minutes))')
        .eq('student_id', profile.id)
        .not('payment_status', 'in', '("CANCELLED","VOID")')
        .not('status', 'in', '("CANCELLED","STUDENT CANCELLED")');
      
      if (!error) {
        setAllStudentBookings(data || []);
        
        // Calculate Loyalty Eligibility
        const teacherLoyalty = teacher?.loyalty_settings || { required_sessions: 10, enabled: true };
        if (teacherLoyalty.enabled !== false) {
          const teacherBookings = (data || []).filter(b => 
            (b.teacher_id === teacherId || b.schedules?.teacher_id === teacherId) && 
            ['PAID', 'PENDING'].includes(b.payment_status) && 
            b.payment_method !== 'LOYALTY_REWARD'
          );
          const required = teacherLoyalty.required_sessions || 10;
          const progress = teacherBookings.length % (required + 1);
          setLoyaltyEligible(progress === required);
        }
      }
    } catch (err) {
      console.error('[Booking] Fetch all bookings error:', err);
    }
  }, [profile?.id, teacherId, teacher?.loyalty_settings]);

  // 1. Fetch Teacher Profile (Once per teacherId)
  useEffect(() => {
    if (teacherId) {
      fetchTeacher();
    }
  }, [teacherId, fetchTeacher]);

  // 2. Fetch Schedules (When month changes)
  useEffect(() => {
    if (teacherId) {
      setLoading(true);
      fetchSchedules();
    }
  }, [teacherId, currentMonth, fetchSchedules]);

  // 3. Fetch User Context (Credits/Bookings)
  useEffect(() => {
    if (profile?.id && teacherId) {
      fetchCredits();
      fetchAllStudentBookings();
    }
  }, [profile?.id, teacherId, fetchCredits, fetchAllStudentBookings]);

  // 4. Auto-Link to this teacher if visiting their booking page
  useEffect(() => {
    const autoLinkTeacher = async () => {
      // Only proceed if we have a valid logged in student and they are visiting a specific teacher
      if (profile?.id && teacherId && profile.linked_teacher_id !== teacherId) {
        console.log('[Booking] Synchronizing stage context:', teacherId);
        const { error } = await supabase
          .from('profiles')
          .update({ linked_teacher_id: teacherId })
          .eq('id', profile.id);
        
        if (!error) {
          // Re-sync AuthContext so the Dashboard knows which stage we are now in
          await fetchProfile(profile.id);
        }
      }
    };

    autoLinkTeacher();
  }, [profile?.id, teacherId, profile?.linked_teacher_id, fetchProfile]);

  const handleBooking = async (paymentType = 'normal') => {
    if (!profile) {
      toast.info('Please join via stage code to book a session');
      navigate('/auth');
      return;
    }
    if (!selectedSession) {
      toast.error('Please select a session to book.');
      return;
    }

    // Silent Auth students now have a real session, so we only block if totally unauthenticated
    if (!user?.id) {
      toast.error('Sign-in required', {
        description: 'Please enter the stage with your name to book sessions.'
      });
      navigate('/auth');
      return;
    }

    const toastId = toast.loading('Processing your booking...');

    try {
      // 1. Prevent Duplicate Bookings - Check Supabase
      const { data: existingBookings, error: checkError } = await supabase
        .from('bookings')
        .select('id')
        .eq('student_id', profile.id)
        .eq('schedule_id', selectedSession.id)
        .not('payment_status', 'in', '("CANCELLED","VOID")');
      
      if (existingBookings && existingBookings.length > 0) {
        toast.error('You have already reserved a spot for this session.', { id: toastId });
        setBooking(false);
        return;
      }

      if (paymentType === 'credits') {
        if (studentCredits < selectedSession.price) {
          toast.error('Insufficient credits for this stage.', { id: toastId });
          setBooking(false);
          return;
        }

        // Fetch latest credits to be safe
        const { data: currentCredits, error: fetchErr } = await supabase
          .from('credits')
          .select('balance')
          .eq('student_id', profile.id)
          .eq('teacher_id', teacherId)
          .single();

        if (fetchErr) throw fetchErr;

        // Deduct Credits
        const { error: creditError } = await supabase
          .from('credits')
          .update({ balance: (Number(currentCredits.balance) || 0) - selectedSession.price })
          .eq('student_id', profile.id)
          .eq('teacher_id', teacherId);
        
        if (creditError) throw creditError;

        // Create booking in Supabase
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            student_id: profile.id,
            schedule_id: selectedSession.id,
            amount: Number(selectedSession.price),
            payment_method: 'CREDITS',
            payment_status: 'PAID',
            status: 'CONFIRMED'
          })
          .select()
          .single();
        
        if (bookingError) throw bookingError;

        // Log payment record
        await supabase.from('payments').insert({
          booking_id: bookingData.id,
          student_id: profile.id,
          teacher_id: teacherId,
          amount: selectedSession.price,
          status: 'SUCCEEDED'
        });

        toast.success('Booked instantly using your credits!', { id: toastId });
        navigate('/student/dashboard');
        return;
      }

      if (paymentType === 'loyalty') {
        // Create booking in Supabase for $0
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            student_id: profile.id,
            schedule_id: selectedSession.id,
            amount: 0,
            payment_method: 'LOYALTY_REWARD',
            payment_status: 'PAID',
            status: 'CONFIRMED'
          })
          .select()
          .single();
        
        if (bookingError) throw bookingError;

        await supabase.from('payments').insert({
          booking_id: bookingData.id,
          student_id: profile.id,
          teacher_id: teacherId,
          amount: 0,
          status: 'SUCCEEDED'
        });

        toast.success('Congratulations! Your 11th session is FREE.', { id: toastId });
        navigate('/student/dashboard');
        return;
      }

      const paymentMethod = selectedMethod || 'manual';
      const paymentConfig = teacher?.payment_settings?.config || {};

      if (['paypal', 'cash', 'bank', 'manual'].includes(paymentMethod)) {
        // PayPal, Cash & Bank Flow Insertion in Supabase
        const { error: bookingError } = await supabase
          .from('bookings')
          .insert({
            student_id: profile.id,
            schedule_id: selectedSession.id,
            amount: Number(selectedSession.price),
            payment_method: paymentMethod.toUpperCase(),
            payment_status: 'PENDING',
            status: 'CONFIRMED'
          })
          .select();

        if (bookingError) throw bookingError;

        if (paymentMethod === 'paypal') {
          toast.success('Redirecting to PayPal...', { id: toastId });
          setTimeout(() => {
            const paypalUrl = paymentConfig.paypal_url;
            const finalUrl = paypalUrl.startsWith('http') ? paypalUrl : `https://${paypalUrl}`;
            window.open(finalUrl, '_blank');
            navigate('/student/dashboard');
          }, 1000);
        } else {
          toast.success('Spot reserved! Follow instructions on your dashboard.', { id: toastId });
          navigate('/student/dashboard');
        }
      }

    } catch (error) {
      console.error('[Booking] Error:', error);
      toast.error('Failed to book session. Please try again.', { id: toastId });
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-bloom-white text-[#4A3B3E] p-6 sm:p-10">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-16 gap-8">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate(-1)} className="p-4 bg-white rounded-2xl border border-rose-petal/10 hover:bg-rose-petal/5 transition-all shadow-sm">
              <ChevronLeft className="w-6 h-6 text-rose-bloom" />
            </button>
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-[2.5rem] bg-gradient-to-br from-rose-bloom to-rose-petal rotate-3 shadow-xl shadow-rose-bloom/20 overflow-hidden flex items-center justify-center">
                {teacher?.avatar_url ? (
                  <img src={teacher.avatar_url} className="w-full h-full object-cover" alt="Profile" />
                ) : (
                  <Sparkles className="text-white w-10 h-10" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                   <h1 className="text-3xl font-black text-studio-dark">{teacher?.full_name || 'Instructor'}</h1>
                   <div className="bg-rose-bloom/10 px-3 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 text-rose-bloom fill-rose-bloom" />
                      <span className="text-[10px] font-black text-rose-bloom uppercase tracking-widest">Master</span>
                   </div>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-bloom/40">Dance Studio Certified</p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button className="p-4 bg-white rounded-2xl border border-rose-petal/10 hover:bg-rose-petal/5 transition-all shadow-sm">
              <Heart className="w-5 h-5 text-rose-bloom" />
            </button>
            <button className="p-4 bg-white rounded-2xl border border-rose-petal/10 hover:bg-rose-petal/5 transition-all shadow-sm">
              <Share2 className="w-5 h-5 text-rose-bloom" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
           <div className="lg:col-span-3">
              <section className="bg-white/40 p-10 rounded-[3.5rem] border border-white/50 shadow-2xl shadow-rose-bloom/5 mb-12">
                 <div className="mb-10 flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-black text-studio-dark">Class Availability</h3>
                      <p className="text-xs font-bold text-rose-bloom/40 uppercase tracking-widest mt-1">Select a slot to book</p>
                    </div>
                 </div>
                 <CalendarContainer 
                  role="student"
                  events={schedules}
                  onDateClick={setSelectedDate}
                  onEventClick={setSelectedSession}
                 />
              </section>

              <div className="p-10 bg-white/70 rounded-[3rem] border border-rose-petal/20">
                 <h3 className="text-xl font-black text-studio-dark mb-6">About the Instructor</h3>
                 <p className="text-studio-dark/60 font-medium leading-relaxed max-w-2xl">
                    With over 10 years of experience in rhythmic movement, {teacher?.full_name?.split(' ')[0]} brings a theatrical flair to every session. Expect high-energy routines, custom-curated soundtracks, and a supportive community vibe.
                 </p>
              </div>
           </div>

           <div className="space-y-8">
              <div className="p-10 bg-gradient-to-br from-studio-dark to-[#4A3B3E] rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-bloom/20 blur-[80px] rounded-full" />
                <h3 className="text-xl font-black mb-8 relative z-10">Booking Summary</h3>
                
                <AnimatePresence mode="wait">
                  {selectedSession ? (
                    <Motion.div 
                      key="selected"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-6 relative z-10"
                    >
                      <div className="p-6 bg-white/10 rounded-2xl border border-white/10">
                        <div className="text-[10px] font-black text-rose-petal uppercase tracking-[0.2em] mb-4">You're booking</div>
                        
                        {(() => {
                          const conflict = findCollision(selectedSession);
                          if (conflict) {
                            return (
                              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/40 rounded-2xl flex items-start gap-3 animate-pulse">
                                <div className="p-2 bg-red-500 rounded-lg text-white">
                                  <Clock className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="text-[10px] font-black uppercase text-red-200 tracking-widest leading-tight">Schedule Conflict</div>
                                  <div className="text-[9px] font-bold text-white/80 leading-tight mt-1">
                                    Overlaps with "{conflict.schedules?.routines?.name}" at {format(parseISO(conflict.schedules?.start_time), 'h:mm a')}.
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        <div className="text-2xl font-black mb-1">{selectedSession.routines?.name}</div>
                        <div className="flex items-center gap-3 mt-2">
                           <div className="px-2 py-0.5 rounded-full bg-rose-bloom/20 border border-rose-bloom/30 text-[8px] font-black text-rose-bloom uppercase tracking-widest">
                              {selectedSession.routines?.difficulty || 'Intermediate'}
                           </div>
                           <div className="text-[10px] font-bold text-white/60">
                              {selectedSession.routines?.duration_minutes} MINS
                           </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold opacity-60 mt-4">
                           <Clock className="w-4 h-4" /> 
                           {format(parseISO(selectedSession.start_time), 'MMM d, h:mm a')}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold opacity-60 mt-2">
                           <MapPin className="w-4 h-4" /> 
                           {selectedSession.location}
                        </div>
                      </div>

                      <div className="space-y-4 px-2">
                        <div className="space-y-3 mb-6">
                           <div className="text-[10px] font-black text-rose-bloom/40 uppercase tracking-[0.2em] ml-1">Choose Payment Mode</div>
                           <div className="grid grid-cols-1 gap-2">
                              {(() => {
                                const config = teacher?.payment_settings?.config || {};
                                const enabledMethods = teacher?.payment_settings?.enabledMethods || [];
                                
                                // Helper to check if method is enabled AND configured
                                const isAvailable = (id) => {
                                  let isConfigured = false;
                                  if (id === 'paypal') isConfigured = !!config.paypal_url;
                                  if (id === 'cash') isConfigured = true; // Cash is always "configured" if enabled
                                  if (id === 'bank') isConfigured = !!config.bank_instructions;

                                  // Support legacy (if manual was used, treat as bank for backward compat in settings)
                                  if (id === 'bank' && !isConfigured && !!config.bank_instructions) isConfigured = true;

                                  if (!enabledMethods || enabledMethods.length === 0) {
                                    return id === 'paypal' ? isConfigured : (id === 'bank' && isConfigured);
                                  }
                                  return enabledMethods.includes(id) && isConfigured;
                                };

                                return (
                                  <>
                                    {isAvailable('paypal') && (
                                      <button 
                                        onClick={() => setSelectedMethod('paypal')}
                                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedMethod === 'paypal' ? 'bg-rose-bloom/10 border-rose-bloom text-rose-bloom shadow-lg shadow-rose-bloom/10' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'}`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selectedMethod === 'paypal' ? 'border-rose-bloom shadow-[0_0_8px_rgba(255,107,129,0.3)]' : 'border-white/10'}`}>
                                            {selectedMethod === 'paypal' && <div className="w-1.5 h-1.5 bg-rose-bloom rounded-full" />}
                                          </div>
                                          <span className="text-[10px] font-black uppercase tracking-widest">PayPal</span>
                                        </div>
                                        <ExternalLink className={`w-4 h-4 ${selectedMethod === 'paypal' ? 'text-rose-bloom' : 'text-white/20'}`} />
                                      </button>
                                    )}
                                    {isAvailable('cash') && (
                                      <button 
                                        onClick={() => setSelectedMethod('cash')}
                                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedMethod === 'cash' ? 'bg-rose-bloom/10 border-rose-bloom text-rose-bloom shadow-lg shadow-rose-bloom/10' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'}`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selectedMethod === 'cash' ? 'border-rose-bloom shadow-[0_0_8px_rgba(255,107,129,0.3)]' : 'border-white/10'}`}>
                                            {selectedMethod === 'cash' && <div className="w-1.5 h-1.5 bg-rose-bloom rounded-full" />}
                                          </div>
                                          <span className="text-[10px] font-black uppercase tracking-widest">Cash at Studio</span>
                                        </div>
                                        <Banknote className={`w-4 h-4 ${selectedMethod === 'cash' ? 'text-rose-bloom' : 'text-white/20'}`} />
                                      </button>
                                    )}
                                    {isAvailable('bank') && (
                                      <button 
                                        onClick={() => setSelectedMethod('bank')}
                                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedMethod === 'bank' ? 'bg-rose-bloom/10 border-rose-bloom text-rose-bloom shadow-lg shadow-rose-bloom/10' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'}`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selectedMethod === 'bank' ? 'border-rose-bloom shadow-[0_0_8px_rgba(255,107,129,0.3)]' : 'border-white/10'}`}>
                                            {selectedMethod === 'bank' && <div className="w-1.5 h-1.5 bg-rose-bloom rounded-full" />}
                                          </div>
                                          <span className="text-[10px] font-black uppercase tracking-widest">Bank Transfer</span>
                                        </div>
                                        <Landmark className={`w-4 h-4 ${selectedMethod === 'bank' ? 'text-rose-bloom' : 'text-white/20'}`} />
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                           </div>
                        </div>

                        {(selectedMethod === 'bank' || selectedMethod === 'manual') && teacher?.payment_settings?.config?.bank_instructions && (
                          <div className="p-6 bg-rose-bloom/5 rounded-[2rem] border border-rose-bloom/20 mb-6 animate-in fade-in slide-in-from-top-2">
                            <div className="text-[10px] font-black text-rose-bloom uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                              <Landmark className="w-4 h-4" /> Transfer Instructions
                            </div>
                            <div className="p-4 bg-white rounded-xl border border-rose-bloom/10 text-[11px] text-studio-dark font-mono leading-relaxed break-words whitespace-pre-wrap">
                              {teacher.payment_settings.config.bank_instructions}
                            </div>
                            <p className="text-[8px] font-bold text-rose-bloom/40 uppercase tracking-widest mt-3 text-center">Please use your name as the reference.</p>
                          </div>
                        )}

                        <div className="flex justify-between items-center px-1">
                          <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Available Seats</span>
                          <span className="text-[10px] font-black text-rose-petal tracking-widest">
                            {(selectedSession.seats_taken || 0)} / {(selectedSession.max_seats || 20)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Total Energy</span>
                          <span className="text-2xl font-black text-rose-bloom tracking-tight">${selectedSession.price}</span>
                        </div>
                      </div>

                      {(() => {
                        const myBooking = allStudentBookings.find(b => b.schedule_id === selectedSession.id);
                        if (myBooking) {
                          const isPaid = myBooking.payment_status === 'PAID';
                          return (
                            <div className="py-8 text-center bg-white/5 rounded-[2.5rem] border border-white/10 mt-4">
                              <div className={`w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center ${isPaid ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-bloom/20 text-rose-bloom'}`}>
                                {isPaid ? <CheckCircle2 className="w-8 h-8" /> : <Sparkles className="w-8 h-8" />}
                              </div>
                              <h4 className="text-xl font-black mb-2 uppercase tracking-tight">You're All Set!</h4>
                              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-6">
                                {isPaid ? 'You have a confirmed spot for this routine.' : 'Your reservation is pending confirmation.'}
                              </p>
                              <button 
                                onClick={() => navigate('/student/bookings')}
                                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                              >
                                View My Bookings
                              </button>
                            </div>
                          );
                        }

                        const isExpired = selectedSession && new Date(selectedSession.start_time) < new Date();
                        return (
                          <>
                            {studentCredits >= selectedSession.price && !loyaltyEligible && (
                              <button 
                                onClick={() => handleBooking('credits')}
                                disabled={booking || isExpired}
                                className="w-full py-5 bg-rose-bloom text-white border border-rose-bloom/30 text-rose-bloom rounded-[2.5rem] flex items-center justify-center gap-3 hover:bg-rose-bloom/80 transition-all font-black uppercase tracking-widest text-xs mb-2 shadow-lg shadow-rose-bloom/20 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Sparkles className="w-5 h-5 text-white" /> Use ${selectedSession.price} Credits
                              </button>
                            )}

                            {loyaltyEligible && (
                              <button 
                                onClick={() => handleBooking('loyalty')}
                                disabled={booking || isExpired}
                                className="w-full py-6 bg-gradient-to-r from-apricot to-rose-bloom text-white rounded-[2.5rem] flex items-center justify-center gap-3 hover:opacity-90 transition-all font-black uppercase tracking-widest text-xs mb-6 shadow-xl shadow-apricot/30 disabled:opacity-30 animate-bounce"
                              >
                                <Ticket className="w-6 h-6" /> Claim Free Loyalty Session!
                              </button>
                            )}

                            <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/5 text-center mb-6">
                               <div className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">Your Stage Credits</div>
                               <div className="text-sm font-black text-rose-petal">${studentCredits.toFixed(2)}</div>
                            </div>

                            <button 
                              onClick={handleBooking}
                              disabled={booking || isExpired || loyaltyEligible}
                              className={`w-full ${loyaltyEligible ? 'opacity-20 pointer-events-none' : 'btn-premium bg-rose-bloom'} text-white py-6 rounded-[2.5rem] shadow-xl shadow-rose-bloom/30 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed`}
                            >
                              {booking ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                              ) : isExpired ? (
                                'Session Expired'
                              ) : (
                                <>
                                  {selectedMethod === 'paypal' ? <ExternalLink className="w-5 h-5" /> : 
                                   <ShieldCheck className="w-5 h-5" />}
                                  {selectedMethod === 'paypal' ? 'Online Payment' : 'Reserve Now'}
                                </>
                              )}
                            </button>
                          </>
                        );
                      })()}
                        <p className="text-center text-[10px] font-bold opacity-40 uppercase tracking-widest">
                          {selectedMethod === 'paypal' ? 'Instant Confirmation' : 'Reservation Only'}
                        </p>
                    </Motion.div>
                  ) : (
                    <Motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="py-12 text-center opacity-30 flex flex-col items-center relative z-10"
                    >
                      <CalendarIcon className="w-12 h-12 mb-4" />
                      <p className="text-sm font-black uppercase tracking-widest">Select a session<br/>to continue</p>
                    </Motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-8 bg-rose-petal/10 rounded-[2.5rem] border border-rose-petal/20">
                 <h4 className="text-xs font-black text-rose-bloom uppercase tracking-[0.2em] mb-4">Vibe Check</h4>
                 <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="w-2 h-2 rounded-full bg-rose-bloom" />
                       <span className="text-xs font-bold text-studio-dark/60">High Energy Theater Style</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="w-2 h-2 rounded-full bg-rose-bloom" />
                       <span className="text-xs font-bold text-studio-dark/60">Premium Sound System</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
