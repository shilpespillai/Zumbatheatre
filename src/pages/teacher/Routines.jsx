import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Edit2, Clock, DollarSign, Package, ChevronLeft, Save, X, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export default function Routines() {
  const { user } = useAuth();
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration_minutes: 60,
    default_price: 15.00
  });

  const fetchRoutines = useCallback(async () => {
    try {
      if (!user) return;
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRoutines(data || []);
    } catch (error) {
      toast.error('Failed to fetch routines');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRoutines();
  }, [fetchRoutines]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        teacher_id: user.id
      };

      if (editingRoutine) {
        const { error } = await supabase
          .from('routines')
          .update(payload)
          .eq('id', editingRoutine.id);
        if (error) throw error;
        toast.success('Routine updated successfully');
      } else {
        const { error } = await supabase
          .from('routines')
          .insert([payload]);
        if (error) throw error;
        toast.success('New routine created');
      }

      setIsModalOpen(false);
      setEditingRoutine(null);
      setFormData({ name: '', description: '', duration_minutes: 60, default_price: 15.00 });
      fetchRoutines();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteRoutine = async (id) => {
    if (!confirm('Are you sure you want to delete this routine? This will not affect existing scheduled classes.')) return;
    
    try {
      const { error } = await supabase
        .from('routines')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Routine deleted');
      fetchRoutines();
    } catch (err) {
      console.error('[Routines] Delete error:', err);
      toast.error('Could not delete routine');
    }
  };

  const openEdit = (routine) => {
    setEditingRoutine(routine);
    setFormData({
      name: routine.name,
      description: routine.description,
      duration_minutes: routine.duration_minutes,
      default_price: routine.default_price
    });
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-bloom-white text-theatre-dark p-6 sm:p-10 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-6">
             <a href="/teacher/dashboard" className="p-4 bg-white rounded-2xl border border-apricot/50 hover:bg-apricot/5 transition-all shadow-sm">
               <ChevronLeft className="w-5 h-5 text-rose-bloom" />
             </a>
             <div>
              <h1 className="text-3xl font-black mb-1 text-theatre-dark font-display italic">Signature Routines</h1>
              <p className="text-rose-bloom/40 font-black tracking-widest uppercase text-[10px]">Define your signature energy</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setEditingRoutine(null);
              setFormData({ name: '', description: '', duration_minutes: 60, default_price: 15.00 });
              setIsModalOpen(true);
            }}
            className="btn-premium bg-gradient-to-r from-rose-bloom to-apricot text-white flex items-center gap-3 hover:scale-105 transition-transform shadow-xl shadow-rose-bloom/20"
          >
            <Plus className="w-5 h-5" />
            New Routine
          </button>
        </header>

        {loading && routines.length === 0 ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-rose-bloom/20 border-t-rose-bloom rounded-full animate-spin" />
          </div>
        ) : routines.length === 0 ? (
          <div className="glass p-20 rounded-[4rem] text-center border-dashed border-2 border-apricot/40">
             <Package className="w-20 h-20 text-rose-bloom/10 mx-auto mb-6" />
             <h3 className="text-2xl font-black mb-2 text-theatre-dark">No Routines Yet</h3>
             <p className="text-theatre-dark/40 max-w-sm mx-auto font-medium">Create your first class template using the button above to start scheduling your sessions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {routines.map((routine) => (
                <Motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={routine.id}                   className="glass p-8 rounded-[3rem] relative group border border-apricot/50 hover:border-rose-bloom transition-all duration-500 hover:-translate-y-2 shadow-xl shadow-rose-bloom/5"
                >
                  <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => openEdit(routine)} className="p-3 bg-white/60 rounded-xl hover:bg-white text-theatre-dark/40 hover:text-rose-bloom border border-apricot/30 transition-all"><Edit2 className="w-4 h-4" /></button>
                     <button onClick={() => deleteRoutine(routine.id)} className="p-3 bg-white/60 rounded-xl hover:bg-red-50 text-theatre-dark/40 hover:text-red-500 border border-apricot/30 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>

                  <div className="w-16 h-16 bg-gradient-to-br from-rose-bloom/10 to-apricot/10 rounded-[2rem] flex items-center justify-center mb-8 border border-apricot/30 group-hover:rotate-6 transition-transform">
                    <Package className="w-7 h-7 text-rose-bloom" />
                  </div>

                  <h3 className="text-2xl font-black mb-3 text-theatre-dark font-display capitalize">{routine.name}</h3>
                  <p className="text-theatre-dark/60 text-sm mb-10 line-clamp-2 font-medium leading-relaxed">{routine.description || 'No description provided.'}</p>

                  <div className="flex items-center gap-6 pt-6 border-t border-white/5">
                    <div className="flex items-center gap-2 text-white/60">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-bold">{routine.duration_minutes}m</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/60">
                      <DollarSign className="w-4 h-4 text-lime-400" />
                      <span className="text-sm font-bold">${routine.default_price}</span>
                    </div>
                  </div>
                </Motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
              <Motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <Motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="glass w-full max-w-xl p-10 rounded-[3rem] relative z-20 border border-white/20"
              >
                <div className="flex justify-between items-center mb-10">
                   <h2 className="text-3xl font-black">{editingRoutine ? 'Edit Routine' : 'New Routine'}</h2>
                   <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><X/></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-white/40">Routine Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. Studio High Intensity"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-white/5 border border-white/20 rounded-2xl py-5 px-6 focus:outline-none focus:border-purple-500 transition-all font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-white/40">Description</label>
                    <textarea 
                      placeholder="What can students expect?"
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full bg-white/5 border border-white/20 rounded-2xl py-5 px-6 focus:outline-none focus:border-purple-500 transition-all font-bold resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-white/40">Duration (Min)</label>
                      <div className="relative">
                        <Clock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                        <input 
                          type="number" 
                          required
                          value={formData.duration_minutes}
                          onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value)})}
                          className="w-full bg-white/5 border border-white/20 rounded-2xl py-5 pl-14 pr-6 focus:outline-none focus:border-purple-500 transition-all font-bold"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-white/40">Default Price ($)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                        <input 
                          type="number" 
                          step="0.01"
                          required
                          value={formData.default_price}
                          onChange={(e) => setFormData({...formData, default_price: parseFloat(e.target.value)})}
                          className="w-full bg-white/5 border border-white/20 rounded-2xl py-5 pl-14 pr-6 focus:outline-none focus:border-purple-500 transition-all font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full btn-premium bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black py-6 rounded-[2rem] hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-purple-900/30"
                  >
                    <Save className="w-5 h-5" />
                    {editingRoutine ? 'Save Changes' : 'Create Routine'}
                  </button>
                </form>
              </Motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
