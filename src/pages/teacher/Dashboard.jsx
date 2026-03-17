import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabaseClient';
import { Calendar as CalendarIcon, Users, TrendingUp, Plus, LogOut, Settings as SettingsIcon, Package, Sparkles, X, Save, Clock, MapPin, Trash2, ShieldCheck, ArrowRight } from 'lucide-react';
import CalendarContainer from '../../components/CalendarContainer';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { isSameDay, format, parseISO } from 'date-fns';

export default function TeacherDashboard() {
  const { profile, signOut, user, isDevBypass } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  useEffect(() => {
    if (user) {
        fetchRoutines();
        fetchAllSchedules();
        ensureInviteCode();
    }

    // Storage listener to sync across tabs in mock mode
    const handleStorageChange = (e) => {
      if (e.key === 'zumba_mock_schedules' || e.key === 'zumba_mock_routines') {
        fetchAllSchedules();
        fetchRoutines();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user, profile]);

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
    
    if (profile.invite_code) {
      setInviteCode(profile.invite_code);
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
        await supabase.from('profiles').update({ invite_code: newCode }).eq('id', user.id);
      }
      setInviteCode(newCode);
    } catch (e) {
      console.error('Code generation failed', e);
    }
  };
  const fetchAllSchedules = async () => {
    if (isDevBypass) {
        const mockSchedules = JSON.parse(localStorage.getItem('zumba_mock_schedules') || '[]');
        const mockRoutines = JSON.parse(localStorage.getItem('zumba_mock_routines') || '[]');
        
        console.log('[Sync Debug] Teacher ID:', user.id);
        console.log('[Sync Debug] Total mock schedules in storage (Teacher view):', mockSchedules.length);

        const filteredAndEnriched = mockSchedules
            .filter(s => {
                const match = String(s.teacher_id).trim() === String(user.id).trim();
                const notCancelled = s.status !== 'CANCELLED';
                return match && notCancelled;
            })
            .map(s => ({
                ...s,
                routines: mockRoutines.find(r => r.id === s.routine_id) || { name: 'Routine' }
            }));
            
        console.log('[Sync Debug] Found schedules for this teacher (Teacher view):', filteredAndEnriched.length);
        
        setSchedules(filteredAndEnriched);
        setLoading(false);
        return;
    }
    console.log('Fetching teacher schedules for:', user.id);
    const { data, error } = await supabase
      .from('schedules')
      .select('*, routines(name, duration_minutes)')
      .eq('teacher_id', user.id);
    
    if (error) console.error('Fetch error:', error);
    setSchedules(data || []);
    setLoading(false);
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
      fullStartTime.setHours(parseInt(hours), parseInt(minutes));

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
      toast.error(error.message);
    } finally {
      setModalLoading(false);
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
          <div className="flex gap-4">
             <a href="/teacher/settings" className="p-4 bg-bloom-white rounded-2xl border border-apricot/40 hover:bg-apricot/5 transition-all shadow-sm">
               <SettingsIcon className="w-5 h-5 text-rose-bloom" />
             </a>
             <button onClick={signOut} className="p-4 bg-white rounded-2xl border border-rose-petal/10 hover:bg-rose-petal/5 transition-all shadow-sm">
               <LogOut className="w-5 h-5 text-rose-bloom" />
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-12 items-start">
          <section className="xl:col-span-3 bg-bloom-white/80 p-10 rounded-[3.5rem] border border-apricot/40 shadow-2xl shadow-rose-bloom/5">
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
                    .map((slot, idx) => (
                      <div key={idx} className="p-5 bg-bloom-white/60 rounded-2xl border border-apricot/30 group hover:border-rose-bloom transition-all">
                        <div className="text-rose-bloom font-black text-xs mb-1">{format(parseISO(slot.start_time), 'hh:mm a')}</div>
                        <div className="text-theatre-dark font-bold">{slot.routines?.name}</div>
                        <div className="flex items-center gap-2 text-[10px] text-theatre-dark/40 mt-2">
                          <MapPin className="w-3 h-3" /> {slot.location}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="py-12 text-center text-theatre-dark/30 font-bold uppercase tracking-widest text-[10px]">
                    No sessions today
                  </div>
                )}
              </div>

            </div>

            <a href="/teacher/reports" className="block glass p-8 rounded-[2.5rem] hover:scale-[1.02] transition-all group">
              <TrendingUp className="w-10 h-10 text-rose-bloom mb-6 opacity-40" />
              <div className="text-[10px] font-black text-rose-bloom uppercase tracking-widest mb-1">Growth Energy</div>
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
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-bloom-white w-full max-w-xl p-10 rounded-[3rem] relative z-20 overflow-hidden shadow-2xl border border-apricot/30">
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
                                className="w-full bg-white border border-apricot/20 rounded-xl py-3 px-4 text-sm font-bold focus:border-rose-bloom outline-none transition-all"
                               />
                             </div>
                             <div className="space-y-1">
                               <label className="text-[10px] font-black text-theatre-dark/30 uppercase ml-1">Price ($)</label>
                               <input 
                                type="number" 
                                step="0.01"
                                value={newRoutineData.default_price}
                                onChange={e => setNewRoutineData({...newRoutineData, default_price: parseFloat(e.target.value)})}
                                className="w-full bg-white border border-apricot/20 rounded-xl py-3 px-4 text-sm font-bold focus:border-rose-bloom outline-none transition-all"
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
                                className="w-full bg-white/60 border border-apricot/20 rounded-2xl py-5 pl-14 pr-12 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark appearance-none cursor-pointer"
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
                        className="w-full bg-white/60 border border-apricot/20 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark"
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
                        className="w-full bg-white/60 border border-apricot/20 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark"
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
    </div>
  );
}

