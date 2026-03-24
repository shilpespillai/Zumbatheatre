import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { 
  Calendar, Clock, MapPin, ChevronLeft, 
  Ticket, AlertCircle, CheckCircle2, XCircle, Sparkles, X, Octagon
} from 'lucide-react';
import { format, parseISO, isAfter, isSameDay, addDays, subDays, startOfDay } from 'date-fns';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function MyBookings() {
  const { profile: authProfile, user } = useAuth();
  const [guestProfile] = useState(() => {
    return JSON.parse(localStorage.getItem('studio_guest_session') || 'null');
  });

  const profile = authProfile || guestProfile;

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);

  useEffect(() => {
    if (profile?.id) fetchBookings();
    else {
      setBookings([]);
      setLoading(false);
    }
  }, [profile?.id, user]);

  const fetchBookings = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          schedules:schedule_id (
            *,
            routines:routine_id (name, duration_minutes),
            teacher:teacher_id (full_name, avatar_url)
          )
        `)
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('[MyBookings] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;
    
    try {
      const teacherId = bookingToCancel.schedules?.teacher_id;
      const refundAmount = Number(bookingToCancel.schedules?.price) || 0;
      const isPaid = bookingToCancel.payment_status === 'PAID';

      // 1. Update Booking Status in Supabase
      const { error: cancelError } = await supabase
        .from('bookings')
        .update({ status: 'CANCELLED', payment_status: 'CANCELLED' })
        .eq('id', bookingToCancel.id);
      
      if (cancelError) throw cancelError;

      // 2. Refund if Paid
      if (isPaid && teacherId && refundAmount > 0) {
        const { data: existingCredit } = await supabase
          .from('credits')
          .select('balance')
          .eq('student_id', profile.id)
          .eq('teacher_id', teacherId)
          .single();

        if (existingCredit) {
          await supabase
            .from('credits')
            .update({ balance: Number(existingCredit.balance) + refundAmount })
            .eq('student_id', profile.id)
            .eq('teacher_id', teacherId);
        } else {
          await supabase
            .from('credits')
            .insert([{
              student_id: profile.id,
              teacher_id: teacherId,
              balance: refundAmount
            }]);
        }
        toast.success(`Cancellation confirmed. ${refundAmount}$ has been added to your studio credits.`);
      } else {
        toast.success('Your reservation has been cancelled and the spot has been released.');
      }
      
      setIsCancelModalOpen(false);
      setBookingToCancel(null);
      fetchBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error('Failed to cancel reservation');
    }
  };

  const getStatusColor = (status, startTime) => {
    const isPast = !isAfter(parseISO(startTime), new Date());
    if (status === 'REFUNDED' || status === 'CANCELLED') return 'text-studio-dark/40 bg-zinc-100 border-zinc-200';
    if (isPast) return 'text-studio-dark/40 bg-zinc-100 border-zinc-200 opacity-60';
    
    if (status === 'PAID') return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
    if (status === 'PENDING') return 'text-orange-600 bg-orange-500/10 border-orange-500/20';
    return 'text-peach bg-peach/10 border-peach/20';
  };

  const filteredBookings = bookings.filter(b => 
    b.schedules?.start_time && 
    isSameDay(parseISO(b.schedules.start_time), selectedDate) &&
    (b.payment_status === 'PAID' || b.payment_status === 'PENDING') &&
    b.status !== 'CANCELLED'
  );

  // Day Picker Logic
  const days = Array.from({ length: 7 }, (_, i) => addDays(subDays(new Date(), 3), i));

  return (
    <div className="min-h-screen bg-bloom-white text-studio-dark p-6 sm:p-10 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-rose-bloom blur-[150px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-lavender blur-[150px] rounded-full" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-8">
           <div className="flex items-center gap-6">
            <a href="/student/dashboard" className="p-4 bg-white rounded-2xl border border-rose-petal/10 hover:bg-rose-petal/5 transition-all shadow-sm">
              <ChevronLeft className="w-6 h-6 text-rose-bloom" />
            </a>
            <div>
              <h1 className="text-4xl font-black text-studio-dark mb-1">My Studio Sessions.</h1>
              <p className="text-rose-bloom/40 font-bold uppercase tracking-[0.2em] text-[10px]">Manage your energy and upcoming rhythms</p>
            </div>
           </div>

           {/* Date Scroller */}
           <div className="flex gap-2 p-2 bg-white/50 backdrop-blur-md rounded-2xl border border-rose-petal/10 overflow-x-auto max-w-full no-scrollbar">
              {days.map((day, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(startOfDay(day))}
                  className={`px-6 py-3 rounded-xl transition-all whitespace-nowrap flex flex-col items-center gap-1 ${
                    isSameDay(day, selectedDate) 
                    ? 'bg-studio-dark text-white shadow-lg' 
                    : 'hover:bg-rose-petal/10 text-studio-dark/40 font-bold'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-tighter">{format(day, 'EEE')}</span>
                  <span className="text-sm font-black">{format(day, 'dd')}</span>
                </button>
              ))}
           </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
             <div className="w-12 h-12 border-4 border-rose-bloom/20 border-t-rose-bloom rounded-full animate-spin" />
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-xl p-20 rounded-[4rem] text-center border-2 border-dashed border-rose-petal/20 shadow-2xl shadow-rose-bloom/5">
             <Ticket className="w-20 h-20 text-rose-bloom/10 mx-auto mb-8" />
             <h3 className="text-2xl font-black text-studio-dark/30 mb-4">The Stage is Empty</h3>
             <p className="text-[#4A3B3E]/40 max-w-sm mx-auto mb-10 font-medium leading-relaxed">No sessions found for {format(selectedDate, 'MMM do')}. Check another date or discover new classes!</p>
             <a href="/student/dashboard" className="btn-premium bg-gradient-to-r from-rose-bloom to-rose-petal text-white inline-flex items-center gap-2">Discover Classes <Sparkles className="w-4 h-4" /></a>
          </div>
        ) : (
          <div className="space-y-8">
            <AnimatePresence>
              {filteredBookings.map((booking, i) => {
                const isPast = new Date(booking.schedules?.start_time) < new Date();
                const isSessionCancelled = booking.schedules?.status === 'CANCELLED';
                const canCancel = !isPast && !isSessionCancelled && booking.status !== 'CANCELLED';

                return (
                  <Motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                    key={booking.id} 
                    className={`bg-white/70 backdrop-blur-xl p-8 rounded-[3rem] border transition-all shadow-xl shadow-rose-bloom/5 flex flex-col md:flex-row gap-8 items-start md:items-center group ${
                      isPast ? 'border-zinc-200 opacity-60 grayscale-[0.8]' : 'border-rose-petal/10 hover:border-rose-bloom/20'
                    }`}
                  >
                    <div className="w-20 h-20 rounded-[1.5rem] bg-rose-petal/10 flex items-center justify-center overflow-hidden border border-rose-petal/20">
                       {booking.schedules?.teacher?.avatar_url ? (
                         <img src={booking.schedules?.teacher?.avatar_url} className="w-full h-full object-cover" alt="Coach" />
                       ) : (
                         <Sparkles className="w-8 h-8 text-rose-bloom/40" />
                       )}
                    </div>

                    <div className="flex-1">
                       <div className="flex flex-wrap items-center gap-4 mb-3">
                          <h3 className="text-2xl font-black text-studio-dark tracking-tight">{booking.schedules?.routines?.name}</h3>
                          <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${getStatusColor(booking.payment_status, booking.schedules?.start_time)}`}>
                            {isSessionCancelled ? 'Session Cancelled' :
                             booking.status === 'CANCELLED' ? 'Cancelled' : 
                             booking.payment_status === 'PAID' ? 'Confirmed' : 
                             booking.payment_status === 'PENDING' ? 'Reserved' : 
                             booking.payment_status}
                          </div>
                          {isPast && (
                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-zinc-100 text-zinc-400 rounded-lg">Completed</span>
                          )}
                       </div>
                       <p className="text-sm font-bold text-[#4A3B3E]/40 mb-6 uppercase tracking-widest">Instructor: {booking.schedules?.teacher?.full_name}</p>
                       
                       <div className="flex flex-wrap gap-8">
                          <div className="flex items-center gap-2.5 text-xs font-black text-studio-dark/60">
                             <Calendar className="w-4 h-4 text-rose-bloom" /> 
                             {format(parseISO(booking.schedules?.start_time), 'EEEE, MMM do')}
                          </div>
                          <div className="flex items-center gap-2.5 text-xs font-black text-studio-dark/60">
                             <Clock className="w-4 h-4 text-rose-bloom" /> 
                             {format(parseISO(booking.schedules?.start_time), 'hh:mm a')}
                          </div>
                          <div className="flex items-center gap-2.5 text-xs font-black text-studio-dark/60">
                             <MapPin className="w-4 h-4 text-rose-bloom" /> 
                             {booking.schedules?.location}
                          </div>
                       </div>
                    </div>

                    <div className="w-full md:w-auto flex gap-3">
                       <button className="flex-1 md:flex-none px-8 py-5 bg-bloom-white rounded-2xl hover:bg-rose-petal/10 transition-colors text-[10px] font-black uppercase tracking-widest text-studio-dark">Details</button>
                       {canCancel && booking.status !== 'CANCELLED' && (
                         <button 
                          onClick={() => { setBookingToCancel(booking); setIsCancelModalOpen(true); }}
                          className="flex-1 md:flex-none px-8 py-5 bg-rose-bloom text-white rounded-2xl hover:scale-105 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-bloom/20"
                         >
                           Cancel Session
                         </button>
                       )}
                       {isPast && (
                         <div className="px-8 py-5 bg-zinc-100 text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-zinc-200">
                           No Actions
                         </div>
                       )}
                    </div>
                  </Motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        <Motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-24 p-12 bg-white/70 backdrop-blur-xl rounded-[4rem] border border-rose-petal/20 flex flex-col md:flex-row items-center gap-10 shadow-2xl shadow-rose-bloom/5"
        >
           <div className="w-20 h-20 bg-rose-bloom text-white rounded-[2rem] flex items-center justify-center rotate-6 shadow-xl shadow-rose-bloom/20">
              <AlertCircle className="w-10 h-10" />
           </div>
           <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-black text-studio-dark mb-2 tracking-tight">Studio Policy</h3>
              <p className="text-sm text-[#4A3B3E]/40 font-bold leading-relaxed max-w-xl uppercase tracking-widest text-[10px]">
                 Cancellations must be made at least 12 hours before the session for a full credit refund. 
                 Refunds are issued as Studio Credits.
              </p>
           </div>
           <button className="px-10 py-6 bg-studio-dark text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:translate-x-2 transition-all">Studio Rules</button>
        </Motion.div>
      </div>

      {/* Professional Cancellation Modal */}
      <AnimatePresence>
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
            <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCancelModalOpen(false)} className="absolute inset-0 bg-studio-dark/40 backdrop-blur-md" />
            <Motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-md p-10 rounded-[3rem] relative z-20 overflow-hidden shadow-2xl border border-rose-petal/20">
               <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-16 h-16 bg-rose-bloom/10 rounded-2xl flex items-center justify-center mb-6">
                    <Octagon className="w-8 h-8 text-rose-bloom" />
                  </div>
                  <h2 className="text-3xl font-black text-studio-dark mb-4 tracking-tight">Wait! Confirm Cancellation?</h2>
                  <p className="text-sm text-[#4A3B3E]/60 font-medium leading-relaxed">
                    Are you sure you want to cancel your spot for <span className="text-rose-bloom font-black">{bookingToCancel?.schedules?.routines?.name}</span>?
                  </p>
                  <p className="text-[10px] text-rose-bloom font-black uppercase tracking-widest mt-4 p-3 bg-rose-bloom/5 rounded-xl border border-rose-bloom/10">
                    {bookingToCancel?.payment_status === 'PAID' 
                      ? `You will receive a refund of ${bookingToCancel?.schedules?.price || 0}$ as Studio Credits.`
                      : "This is a reserved spot. If you confirm, your spot will be released immediately. No payment was made."}
                  </p>
               </div>

               <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleCancelBooking}
                    className="w-full py-5 bg-rose-bloom text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-rose-petal transition-all shadow-xl shadow-rose-bloom/20"
                  >
                    Yes, Cancel Spot & Refund
                  </button>
                  <button 
                    onClick={() => setIsCancelModalOpen(false)}
                    className="w-full py-5 bg-bloom-white text-studio-dark rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-rose-petal/10 transition-all border border-rose-petal/10"
                  >
                    No, Keep My Spot
                  </button>
               </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
