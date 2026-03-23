import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabaseClient';
import { Search, Star, MapPin, Calendar, User, Play, Filter, Sparkles } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export default function StudentBrowse() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'TEACHER');

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.bio?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-bloom-white text-theatre-dark p-6 sm:p-10 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-rose-bloom blur-[150px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-lavender blur-[150px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="mb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-rose-bloom/10 px-4 py-2 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-rose-bloom" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-bloom">Premium Instructors</span>
          </div>
          <h1 className="text-5xl font-black text-theatre-dark mb-6 tracking-tight">Find Your Rhythm.</h1>
          <p className="text-[#4A3B3E]/40 font-bold max-w-lg mx-auto mb-12 leading-relaxed uppercase tracking-widest text-xs">
            Browse our world-class certified instructors and find the energy that matches your style.
          </p>

          <div className="flex flex-col md:flex-row gap-4 max-w-3xl mx-auto">
            <div className="flex-1 relative group">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-bloom/40 group-focus-within:text-rose-bloom transition-colors" />
               <input 
                type="text" 
                placeholder="Search by name or style..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-rose-petal/20 rounded-[2rem] py-6 pl-16 pr-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark shadow-sm"
               />
            </div>
            <button className="px-10 py-6 bg-white rounded-[2rem] border border-rose-petal/20 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-rose-petal/5 transition-colors shadow-sm text-theatre-dark/60">
              <Filter className="w-4 h-4" /> Filters
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
             <div className="w-12 h-12 border-4 border-rose-bloom/20 border-t-rose-bloom rounded-full animate-spin" />
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="text-center py-32 bg-white/40 backdrop-blur-xl rounded-[4rem] border-2 border-dashed border-rose-petal/20">
             <User className="w-24 h-24 text-rose-bloom/10 mx-auto mb-8" />
             <h3 className="text-2xl font-black text-theatre-dark/30 uppercase tracking-widest">Stage is Quiet</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredTeachers.map((teacher, i) => (
              <Motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={teacher.id}
                className="bg-white/70 backdrop-blur-xl rounded-[3.5rem] overflow-hidden group hover:border-rose-bloom/30 transition-all duration-500 flex flex-col border border-rose-petal/10 shadow-xl shadow-rose-bloom/5"
              >
                <div className="relative h-72 overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-t from-white/20 via-transparent to-transparent z-10" />
                   {teacher.avatar_url ? (
                     <img src={teacher.avatar_url} alt={teacher.full_name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                   ) : (
                     <div className="w-full h-full bg-rose-petal/10 flex items-center justify-center">
                        <User className="w-20 h-20 text-rose-bloom/20" />
                     </div>
                   )}
                   <div className="absolute bottom-6 left-8 z-20">
                      <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full border border-rose-petal/10 shadow-sm">
                         <Star className="w-3 h-3 text-rose-bloom fill-current" />
                         <span className="text-[10px] font-black uppercase tracking-widest text-theatre-dark">4.9 (120 Energy)</span>
                      </div>
                   </div>
                </div>

                <div className="p-10 flex-1 flex flex-col">
                   <h3 className="text-3xl font-black text-theatre-dark mb-2 tracking-tight">{teacher.full_name}</h3>
                   <div className="flex items-center gap-2 text-rose-bloom/40 text-[10px] font-black uppercase tracking-widest mb-6">
                      <MapPin className="w-3.5 h-3.5" /> Core Theatre NYC
                   </div>
                   <p className="text-[#4A3B3E]/60 text-sm leading-relaxed mb-10 line-clamp-3 font-medium">
                      {teacher.bio || "Experience the high-energy theatrical Zumba movement with a certified master instructor."}
                   </p>

                   <div className="mt-auto flex gap-4">
                      <a 
                        href={`/student/book/${teacher.id}`} 
                        className="flex-1 btn-premium bg-gradient-to-r from-rose-bloom to-rose-petal text-white flex items-center justify-center gap-3 hover:scale-[1.02]"
                      >
                         <Calendar className="w-4 h-4" />
                         View Calendar
                      </a>
                      <button className="p-5 bg-white rounded-2xl border border-rose-petal/10 hover:bg-rose-petal/5 transition-all text-rose-bloom shadow-sm">
                        <Play className="w-5 h-5 fill-current" />
                      </button>
                   </div>
                </div>
              </Motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
