import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  isSameMonth, isSameDay, addDays, parseISO, startOfDay
} from 'date-fns';
import { 
  ChevronLeft, Calendar as CalendarIcon, Clock, MapPin, 
  Sparkles, ShieldCheck, Heart, Share2, Star
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import CalendarContainer from '../../components/CalendarContainer';

export default function StudentBooking() {
  const { teacherId } = useParams();
  const navigate = useNavigate();
  const { user, isDevBypass } = useAuth();
  const [teacher, setTeacher] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    fetchTeacher();
    fetchSchedules();
  }, [teacherId, currentMonth]);

  const fetchTeacher = async () => {
    if (isDevBypass) {
      const mockProfiles = JSON.parse(localStorage.getItem('zumba_mock_profiles') || '{}');
      setTeacher(mockProfiles[teacherId] || null);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', teacherId)
      .single();
    setTeacher(data);
  };

  const fetchSchedules = async () => {
    const firstDay = startOfMonth(currentMonth);
    const lastDay = endOfMonth(currentMonth);

    if (isDevBypass) {
        const mockSchedules = JSON.parse(localStorage.getItem('zumba_mock_schedules') || '[]');
        const mockRoutines = JSON.parse(localStorage.getItem('zumba_mock_routines') || '[]');
        
        const filtered = mockSchedules
            .filter(s => s.teacher_id === teacherId && s.status === 'SCHEDULED')
            .map(s => ({
                ...s,
                routines: mockRoutines.find(r => r.id === s.routine_id) || { name: 'Routine' }
            }));
        setSchedules(filtered);
        setLoading(false);
        return;
    }

    const { data } = await supabase
      .from('schedules')
      .select('*, routines(name, description, duration_minutes)')
      .eq('teacher_id', teacherId)
      .eq('status', 'SCHEDULED')
      .gte('start_time', firstDay.toISOString())
      .lte('start_time', lastDay.toISOString());

    setSchedules(data || []);
    setLoading(false);
  };

  const handleBooking = async () => {
    if (!user) {
      toast.info('Please sign in to book a session');
      navigate('/auth');
      return;
    }
    if (!selectedSession) {
      toast.error('Please select a session to book.');
      return;
    }

    setBooking(true);
    toast.loading('Processing your booking...');

    try {
      if (isDevBypass) {
          // Simulate booking persistence
          const mockBookings = JSON.parse(localStorage.getItem('zumba_mock_bookings') || '[]');
          const newBooking = {
              id: `mock-book-${Date.now()}`,
              student_id: user.id,
              schedule_id: selectedSession.id,
              payment_status: 'PAID',
              created_at: new Date().toISOString()
          };
          mockBookings.push(newBooking);
          localStorage.setItem('zumba_mock_bookings', JSON.stringify(mockBookings));
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          toast.success('Mock Booking successful!');
          navigate('/student/dashboard');
          return;
      }

      // In a real implementation, this would redirect to Stripe
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call

      toast.success('Booking successful! Redirecting to secure payment...');
      setTimeout(() => {
        toast.info('This feature will be integrated with your Stripe account.');
      }, 1500);

    } catch (error) {
      console.error('Booking error:', error);
      toast.error('Failed to book session. Please try again.');
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
                   <h1 className="text-3xl font-black text-zumba-dark">{teacher?.full_name || 'Instructor'}</h1>
                   <div className="bg-rose-bloom/10 px-3 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 text-rose-bloom fill-rose-bloom" />
                      <span className="text-[10px] font-black text-rose-bloom uppercase tracking-widest">Master</span>
                   </div>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-bloom/40">Zumba Theatre® Certified</p>
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
                      <h3 className="text-2xl font-black text-zumba-dark">Class Availability</h3>
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
                 <h3 className="text-xl font-black text-zumba-dark mb-6">About the Instructor</h3>
                 <p className="text-zumba-dark/60 font-medium leading-relaxed max-w-2xl">
                    With over 10 years of experience in rhythmic movement, {teacher?.full_name?.split(' ')[0]} brings a theatrical flair to every session. Expect high-energy routines, custom-curated soundtracks, and a supportive community vibe.
                 </p>
              </div>
           </div>

           <div className="space-y-8">
              <div className="p-10 bg-gradient-to-br from-zumba-dark to-[#4A3B3E] rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-bloom/20 blur-[80px] rounded-full" />
                <h3 className="text-xl font-black mb-8 relative z-10">Booking Summary</h3>
                
                <AnimatePresence mode="wait">
                  {selectedSession ? (
                    <motion.div 
                      key="selected"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-6 relative z-10"
                    >
                      <div className="p-6 bg-white/10 rounded-2xl border border-white/10">
                        <div className="text-[10px] font-black text-rose-petal uppercase tracking-[0.2em] mb-4">You're booking</div>
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
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold opacity-40">Available Seats</span>
                          <span className="text-sm font-black text-rose-petal">12 / 20</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold opacity-40">Class Credit</span>
                          <span className="text-xl font-black text-rose-bloom">${selectedSession.price}</span>
                        </div>
                      </div>

                      <button 
                        onClick={handleBooking}
                        disabled={booking}
                        className="w-full btn-premium bg-rose-bloom text-white py-6 rounded-[2.5rem] shadow-xl shadow-rose-bloom/30 flex items-center justify-center gap-3"
                      >
                        {booking ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                        Secure My Spot
                      </button>
                      <p className="text-center text-[10px] font-bold opacity-40 uppercase tracking-widest">Instant Confirmation</p>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="py-12 text-center opacity-30 flex flex-col items-center relative z-10"
                    >
                      <CalendarIcon className="w-12 h-12 mb-4" />
                      <p className="text-sm font-black uppercase tracking-widest">Select a session<br/>to continue</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-8 bg-rose-petal/10 rounded-[2.5rem] border border-rose-petal/20">
                 <h4 className="text-xs font-black text-rose-bloom uppercase tracking-[0.2em] mb-4">Vibe Check</h4>
                 <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="w-2 h-2 rounded-full bg-rose-bloom" />
                       <span className="text-xs font-bold text-zumba-dark/60">High Energy Theater Style</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="w-2 h-2 rounded-full bg-rose-bloom" />
                       <span className="text-xs font-bold text-zumba-dark/60">Premium Sound System</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
