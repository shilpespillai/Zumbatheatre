import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  isSameMonth, isSameDay, addDays, parseISO, startOfDay
} from 'date-fns';
import { 
  ChevronLeft, Plus, MapPin, Clock, 
  DollarSign, Package, Calendar as CalendarIcon, X, Save, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import CalendarContainer from '../../components/CalendarContainer';

export default function TeacherCalendar() {
  const { user, isDevBypass } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [routines, setRoutines] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State for Scheduling
  const [formData, setFormData] = useState({
    routine_id: '',
    start_time: '18:00',
    price: '',
    location: 'Main Studio',
    max_seats: 20
  });

  useEffect(() => {
    if (user) {
      fetchRoutines();
      fetchSchedules();
    }

    // Storage listener to sync across tabs in mock mode
    const handleStorageChange = (e) => {
      if (e.key === 'zumba_mock_schedules' || e.key === 'zumba_mock_routines') {
        fetchSchedules();
        fetchRoutines();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user, currentMonth]);

  const fetchRoutines = async () => {
    if (isDevBypass) {
      const mockRoutines = JSON.parse(localStorage.getItem('zumba_mock_routines') || '[]');
      setRoutines(mockRoutines);
      return;
    }
    const { data } = await supabase
      .from('routines')
      .select('*')
      .eq('teacher_id', user.id);
    setRoutines(data || []);
  };

  const fetchSchedules = async () => {
    const firstDay = startOfMonth(currentMonth);
    const lastDay = endOfMonth(currentMonth);

    if (isDevBypass) {
      const mockSchedules = JSON.parse(localStorage.getItem('zumba_mock_schedules') || '[]');
      const mockRoutines = JSON.parse(localStorage.getItem('zumba_mock_routines') || '[]');
      
      const filtered = mockSchedules
        .filter(s => {
          const match = String(s.teacher_id).trim() === String(user.id).trim();
          const notCancelled = s.status !== 'CANCELLED';
          const startTime = new Date(s.start_time);
          const inRange = startTime >= firstDay && startTime <= lastDay;
          return match && notCancelled && inRange;
        })
        .map(s => ({
          ...s,
          routines: mockRoutines.find(r => r.id === s.routine_id) || { name: 'Routine' }
        }));
      
      setSchedules(filtered);
      return;
    }

    const { data, error } = await supabase
      .from('schedules')
      .select('*, routines(name)')
      .eq('teacher_id', user.id)
      .gte('start_time', firstDay.toISOString())
      .lte('start_time', lastDay.toISOString());

    if (error) console.error('Error fetching schedules:', error);
    else setSchedules(data || []);
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedRoutine = routines.find(r => r.id === formData.routine_id);
      if (!selectedRoutine) throw new Error('Please select a routine');

      const fullStartTime = new Date(selectedDate);
      const [hours, minutes] = formData.start_time.split(':');
      fullStartTime.setHours(parseInt(hours), parseInt(minutes));

      if (fullStartTime < new Date()) {
        throw new Error('Cannot schedule a session for a past date or time.');
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
      fetchSchedules();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSession = async (id) => {
    const sessionToCancel = schedules.find(s => s.id === id);
    if (sessionToCancel && new Date(sessionToCancel.start_time) < new Date()) {
      toast.error('Cannot cancel a past session.');
      return;
    }

    if (!confirm('Are you sure you want to cancel this session? This action cannot be undone.')) return;

    try {
      if (isDevBypass) {
        const existing = JSON.parse(localStorage.getItem('zumba_mock_schedules') || '[]');
        const updated = existing.map(s => s.id === id ? { ...s, status: 'CANCELLED' } : s);
        localStorage.setItem('zumba_mock_schedules', JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('schedules')
          .update({ status: 'CANCELLED' })
          .eq('id', id);
        if (error) throw error;
      }
      toast.success('Session cancelled');
      fetchSchedules();
    } catch (error) {
      toast.error('Failed to cancel session');
    }
  };

  return (
    <div className="min-h-screen bg-bloom-white text-[#4A3B3E] p-6 sm:p-10 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
            <a href="/teacher/dashboard" className="p-3 bg-white rounded-2xl border border-theatre-dark/15 hover:bg-rose-petal/5 transition-all shadow-sm">
              <ChevronLeft className="w-5 h-5 text-rose-bloom" />
            </a>
            <div>
              <h1 className="text-3xl font-black text-zumba-dark">Schedule Manager</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-bloom/40 mt-1">Design your party timeline</p>
            </div>
          </div>

          {selectedDate && startOfDay(selectedDate) >= startOfDay(new Date()) && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setIsModalOpen(true)}
              className="btn-premium bg-theatre-dark text-white px-8 py-4 rounded-2xl flex items-center gap-2 hover:bg-rose-bloom transition-all shadow-xl shadow-rose-bloom/10"
            >
              <Plus className="w-5 h-5" /> Quick Schedule
            </motion.button>
          )}
        </header>

        <section className="bg-white/40 p-10 rounded-[3.5rem] border border-apricot/60 shadow-2xl shadow-rose-bloom/5">
          <CalendarContainer 
            role="teacher"
            events={schedules}
            onDateClick={setSelectedDate}
            onAddClick={() => setIsModalOpen(true)}
            onEventClick={() => {}}
          />
        </section>
      </div>

      {/* Modal for Scheduling */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-rose-petal/20 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-xl p-10 rounded-[3rem] relative z-20 overflow-hidden shadow-2xl border border-apricot/40">
               <div className="flex justify-between items-center mb-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-bloom/10 rounded-2xl">
                      <Sparkles className="w-6 h-6 text-rose-bloom" />
                    </div>
                    <h2 className="text-3xl font-black text-zumba-dark">Add New Slot</h2>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-rose-petal/10 rounded-xl transition-colors text-zumba-dark/30"><X/></button>
               </div>

               <form onSubmit={handleScheduleSubmit} className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-white/40">Select Routine</label>
                    <div className="grid grid-cols-1 gap-3">
                       {routines.map(r => (
                         <button 
                          key={r.id}
                          type="button"
                          onClick={() => setFormData({...formData, routine_id: r.id, price: r.default_price})}
                          className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
                            formData.routine_id === r.id ? 'border-purple-500 bg-purple-500/10' : 'border-white/5 bg-white/5 opacity-50'
                          }`}
                         >
                            <span className="font-bold">{r.name}</span>
                            <span className="text-xs opacity-50">{r.duration_minutes}m</span>
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-white/40">Start Time</label>
                      <input 
                        type="time" 
                        required
                        value={formData.start_time}
                        onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                        className="w-full bg-bloom-white border border-apricot/40 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-zumba-dark"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zumba-dark/30 ml-2">Price ($)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="Default"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        className="w-full bg-bloom-white border border-apricot/40 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-zumba-dark"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zumba-dark/30 ml-2">Location</label>
                    <input 
                      type="text" 
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      className="w-full bg-bloom-white border border-rose-petal/20 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-zumba-dark"
                    />
                  </div>

                  {(() => {
                    const fullStartTime = new Date(selectedDate);
                    const [hours, minutes] = formData.start_time.split(':');
                    if (hours && minutes) {
                      fullStartTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                    }
                    const isPastTime = fullStartTime < new Date();

                    return (
                      <div className="space-y-6">
                        {isPastTime && (
                          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-bold animate-pulse">
                            <X className="w-4 h-4" />
                            <span>This time has already passed. Please select a future time.</span>
                          </div>
                        )}
                        <button 
                          disabled={routines.length === 0 || loading || isPastTime}
                          type="submit" 
                          className="w-full btn-premium bg-gradient-to-r from-rose-bloom to-rose-petal text-white font-black py-6 rounded-[2rem] hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-rose-bloom/30 disabled:opacity-30 disabled:pointer-events-none"
                        >
                          {loading ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5 text-white/50" />}
                          {isPastTime ? 'Cannot Schedule in Past' : 'Confirm Schedule'}
                        </button>
                      </div>
                    );
                  })()}
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for viewing sessions for a specific day */}
      <AnimatePresence>
        {selectedDate && !isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedDate(null)} className="absolute inset-0 bg-rose-petal/20 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-xl p-10 rounded-[3rem] relative z-20 overflow-hidden shadow-2xl border border-apricot/40">
               <div className="flex justify-between items-center mb-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-bloom/10 rounded-2xl">
                      <CalendarIcon className="w-6 h-6 text-rose-bloom" />
                    </div>
                    <h2 className="text-2xl font-black text-zumba-dark">Sessions on {format(selectedDate, 'PPP')}</h2>
                  </div>
                  <button onClick={() => setSelectedDate(null)} className="p-3 hover:bg-rose-petal/10 rounded-xl transition-colors text-zumba-dark/30"><X/></button>
               </div>

               <div className="space-y-4">
                  {schedules.filter(s => isSameDay(parseISO(s.start_time), selectedDate)).length > 0 ? (
                    schedules
                      .filter(s => isSameDay(parseISO(s.start_time), selectedDate))
                      .sort((a,b) => a.start_time.localeCompare(b.start_time))
                      .map((slot, idx) => {
                        const isPast = new Date(slot.start_time) < new Date();
                        return (
                          <div key={idx} className={`p-6 rounded-3xl border transition-all ${isPast ? 'bg-zinc-50 border-zinc-200 opacity-60' : 'bg-bloom-white/80 border-apricot/30 group hover:border-rose-bloom'}`}>
                            <div className="flex justify-between items-start mb-4">
                              <div className="text-rose-bloom font-black text-xs">{format(parseISO(slot.start_time), 'hh:mm a')}</div>
                              <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                slot.status === 'CANCELLED' ? 'text-zinc-400 bg-zinc-100 border-zinc-200' : 'text-emerald-600 bg-emerald-50 border-emerald-100'
                              }`}>
                                {slot.status}
                              </div>
                            </div>
                            <div className="text-theatre-dark font-black text-lg mb-2">{slot.routines?.name}</div>
                            <div className="flex items-center gap-2 text-[10px] text-theatre-dark/40 mb-6">
                              <MapPin className="w-3 h-3" /> {slot.location}
                            </div>
                            
                            <div className="flex gap-2">
                              {slot.status !== 'CANCELLED' && !isPast && (
                                <button 
                                  onClick={() => handleCancelSession(slot.id)}
                                  className="px-6 py-2 text-rose-bloom hover:bg-rose-bloom hover:text-white rounded-xl transition-all font-black uppercase tracking-widest text-[9px] border border-rose-bloom/20"
                                >
                                  Cancel Session
                                </button>
                              )}
                              {isPast && (
                                <div className="px-6 py-2 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[9px] border border-zinc-200 bg-zinc-100/50">
                                  Session Completed
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="p-10 border-2 border-dashed border-apricot/20 rounded-2xl text-center">
                      <p className="text-sm font-bold text-zumba-dark/30">No sessions scheduled for this day.</p>
                    </div>
                  )}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
