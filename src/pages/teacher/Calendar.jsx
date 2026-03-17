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
  const { user } = useAuth();
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
  }, [user, currentMonth]);

  const fetchRoutines = async () => {
    const { data } = await supabase
      .from('routines')
      .select('*')
      .eq('teacher_id', user.id);
    setRoutines(data || []);
  };

  const fetchSchedules = async () => {
    const firstDay = startOfMonth(currentMonth);
    const lastDay = endOfMonth(currentMonth);

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

      const { error } = await supabase.from('schedules').insert([{
        routine_id: formData.routine_id,
        teacher_id: user.id,
        start_time: fullStartTime.toISOString(),
        price: parseFloat(formData.price || selectedRoutine.default_price),
        location: formData.location,
        max_seats: formData.max_seats,
        status: 'SCHEDULED'
      }]);

      if (error) throw error;
      toast.success('Class scheduled successfully!');
      setIsModalOpen(false);
      fetchSchedules();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bloom-white text-[#4A3B3E] p-6 sm:p-10 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
            <a href="/teacher/dashboard" className="p-3 bg-white rounded-2xl border border-rose-petal/10 hover:bg-rose-petal/5 transition-all shadow-sm">
              <ChevronLeft className="w-5 h-5 text-rose-bloom" />
            </a>
            <div>
              <h1 className="text-3xl font-black text-zumba-dark">Schedule Manager</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-bloom/40 mt-1">Design your party timeline</p>
            </div>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-premium bg-gradient-to-r from-rose-bloom to-rose-petal text-white flex items-center gap-2 hover:opacity-90"
          >
            <Plus className="w-5 h-5 text-white/50" />
            Quick Schedule
          </button>
        </header>

        <section className="bg-white/40 p-10 rounded-[3.5rem] border border-white/50 shadow-2xl shadow-rose-bloom/5">
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
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-xl p-10 rounded-[3rem] relative z-20 overflow-hidden shadow-2xl border border-rose-petal/20">
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
                       {routines.length === 0 && (
                         <div className="p-10 border-2 border-dashed border-white/10 rounded-2xl text-center">
                            <p className="text-sm font-bold text-white/30">No routines found. <br/><a href="/teacher/routines" className="text-purple-400">Create one first</a></p>
                         </div>
                       )}
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
                        className="w-full bg-bloom-white border border-rose-petal/20 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-zumba-dark"
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
                        className="w-full bg-bloom-white border border-rose-petal/20 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-zumba-dark"
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

                  <button 
                    disabled={routines.length === 0 || loading}
                    type="submit" 
                    className="w-full btn-premium bg-gradient-to-r from-rose-bloom to-rose-petal text-white font-black py-6 rounded-[2rem] hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-rose-bloom/30 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    {loading ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5 text-white/50" />}
                    Confirm Schedule
                  </button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
