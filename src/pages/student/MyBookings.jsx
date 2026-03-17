import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { 
  Calendar, Clock, MapPin, ChevronLeft, 
  Ticket, AlertCircle, CheckCircle2, XCircle, Sparkles
} from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchBookings();
  }, [user]);

  const fetchBookings = async () => {
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
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status, startTime) => {
    if (status === 'PAID') return 'text-rose-bloom bg-rose-bloom/10 border-rose-bloom/20';
    if (status === 'REFUNDED') return 'text-theatre-dark/40 bg-zinc-100 border-zinc-200';
    if (!isAfter(parseISO(startTime), new Date())) return 'text-theatre-dark/20 bg-zinc-50 border-zinc-100';
    return 'text-peach bg-peach/10 border-peach/20';
  };

  return (
    <div className="min-h-screen bg-bloom-white text-theatre-dark p-6 sm:p-10 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-rose-bloom blur-[150px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-lavender blur-[150px] rounded-full" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <header className="flex items-center gap-6 mb-16">
           <a href="/student/dashboard" className="p-4 bg-white rounded-2xl border border-rose-petal/10 hover:bg-rose-petal/5 transition-all shadow-sm">
             <ChevronLeft className="w-6 h-6 text-rose-bloom" />
           </a>
           <div>
            <h1 className="text-4xl font-black text-theatre-dark mb-1">My Theatre Sessions.</h1>
            <p className="text-rose-bloom/40 font-bold uppercase tracking-[0.2em] text-[10px]">Manage your energy and upcoming rhythms</p>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
             <div className="w-12 h-12 border-4 border-rose-bloom/20 border-t-rose-bloom rounded-full animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-xl p-20 rounded-[4rem] text-center border-2 border-dashed border-rose-petal/20 shadow-2xl shadow-rose-bloom/5">
             <Ticket className="w-20 h-20 text-rose-bloom/10 mx-auto mb-8" />
             <h3 className="text-2xl font-black text-theatre-dark/30 mb-4">The Stage is Empty</h3>
             <p className="text-[#4A3B3E]/40 max-w-sm mx-auto mb-10 font-medium leading-relaxed">You haven't reserved your spot in any sessions yet. Let's find your first instructor!</p>
             <a href="/student/dashboard" className="btn-premium bg-gradient-to-r from-rose-bloom to-rose-petal text-white inline-flex items-center gap-2">Discover Classes <Sparkles className="w-4 h-4" /></a>
          </div>
        ) : (
          <div className="space-y-8">
            <AnimatePresence>
              {bookings.map((booking, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={booking.id} 
                  className="bg-white/70 backdrop-blur-xl p-8 rounded-[3rem] border border-rose-petal/10 hover:border-rose-bloom/20 transition-all shadow-xl shadow-rose-bloom/5 flex flex-col md:flex-row gap-8 items-start md:items-center group"
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
                        <h3 className="text-2xl font-black text-theatre-dark tracking-tight">{booking.schedules?.routines?.name}</h3>
                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${getStatusColor(booking.payment_status, booking.schedules?.start_time)}`}>
                          {booking.payment_status === 'PAID' ? 'Confirmed' : booking.payment_status}
                        </div>
                     </div>
                     <p className="text-sm font-bold text-[#4A3B3E]/40 mb-6 uppercase tracking-widest">Instructor: {booking.schedules?.teacher?.full_name}</p>
                     
                     <div className="flex flex-wrap gap-8">
                        <div className="flex items-center gap-2.5 text-xs font-black text-theatre-dark/60">
                           <Calendar className="w-4 h-4 text-rose-bloom" /> 
                           {format(parseISO(booking.schedules?.start_time), 'EEEE, MMM do')}
                        </div>
                        <div className="flex items-center gap-2.5 text-xs font-black text-theatre-dark/60">
                           <Clock className="w-4 h-4 text-rose-bloom" /> 
                           {format(parseISO(booking.schedules?.start_time), 'hh:mm a')}
                        </div>
                        <div className="flex items-center gap-2.5 text-xs font-black text-theatre-dark/60">
                           <MapPin className="w-4 h-4 text-rose-bloom" /> 
                           {booking.schedules?.location}
                        </div>
                     </div>
                  </div>

                  <div className="w-full md:w-auto flex gap-3">
                     <button className="flex-1 md:flex-none px-8 py-5 bg-bloom-white rounded-2xl hover:bg-rose-petal/10 transition-colors text-[10px] font-black uppercase tracking-widest text-theatre-dark">Details</button>
                     {isAfter(parseISO(booking.schedules?.start_time), new Date()) && (
                       <button className="flex-1 md:flex-none px-8 py-5 bg-rose-bloom text-white rounded-2xl hover:scale-105 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-bloom/20">Cancel</button>
                     )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-24 p-12 bg-white/70 backdrop-blur-xl rounded-[4rem] border border-rose-petal/20 flex flex-col md:flex-row items-center gap-10 shadow-2xl shadow-rose-bloom/5"
        >
           <div className="w-20 h-20 bg-rose-bloom text-white rounded-[2rem] flex items-center justify-center rotate-6 shadow-xl shadow-rose-bloom/20">
              <AlertCircle className="w-10 h-10" />
           </div>
           <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-black text-theatre-dark mb-2 tracking-tight">Theatre Policy</h3>
              <p className="text-sm text-[#4A3B3E]/40 font-bold leading-relaxed max-w-xl uppercase tracking-widest text-[10px]">
                 Cancellations must be made at least 12 hours before the session for a full credit refund. 
                 Energy is non-transferable but always shared.
              </p>
           </div>
           <button className="px-10 py-6 bg-zumba-dark text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:translate-x-2 transition-all">Theatre Rules</button>
        </motion.div>
      </div>
    </div>
  );
}
