import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  User, ShieldCheck, Sparkles, ArrowRight, Check, 
  MapPin, Clock, Heart, Camera
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function Onboarding() {
  const { user, profile, fetchProfile, isDevBypass } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    bio: '',
    stage_code: '',
    specialties: []
  });

  React.useEffect(() => {
    const pendingCode = localStorage.getItem('pending_teacher_code');
    if (pendingCode) {
      setRole('student');
      setFormData(prev => ({ ...prev, stage_code: pendingCode }));
      setStep(2);
      localStorage.removeItem('pending_teacher_code');
    }
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      console.log('[Onboarding] Starting submission...');
      let linkedTeacherId = null;
      if (role === 'student' && formData.stage_code) {
        console.log('[Onboarding] Looking up teacher code:', formData.stage_code);
        const { data: teacher, error: teacherError } = await supabase
          .from('profiles')
          .select('id')
          .eq('invite_code', formData.stage_code.toUpperCase().trim())
          .single();
        
        if (teacherError) console.warn('[Onboarding] Teacher lookup error:', teacherError);
        if (teacher) {
          console.log('[Onboarding] Teacher found:', teacher.id);
          linkedTeacherId = teacher.id;
        }
      }

      console.log('[Onboarding] Upserting profile for user:', user.id);
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: formData.full_name || user.user_metadata?.full_name || user.email.split('@')[0],
          role: role?.toUpperCase(),
          bio: formData.bio,
          linked_teacher_id: linkedTeacherId,
          avatar_url: user.user_metadata?.avatar_url || ''
        });

      if (error) {
        console.error('[Onboarding] Upsert error:', error);
        throw error;
      }
      console.log('[Onboarding] Upsert successful.');
      
      // Assuming isDevBypass is defined elsewhere or will be defined by the user
      // For example: const isDevBypass = process.env.NODE_ENV === 'development';
      if (isDevBypass) {
        const mockProfile = JSON.parse(localStorage.getItem('zumba_mock_profile') || '{}');
        mockProfile.role = role;
        mockProfile.full_name = formData.full_name;
        mockProfile.linked_teacher_id = linkedTeacherId;
        localStorage.setItem('zumba_mock_profile', JSON.stringify(mockProfile));
      }

      console.log('[Onboarding] Refreshing profile state...');
      await fetchProfile();
      console.log('[Onboarding] Profile refreshed. Navigating...');
      
      toast.success(`Welcome to the theatre, ${formData.full_name}!`);
      const targetPath = role?.toUpperCase() === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard';
      navigate(targetPath);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bloom-white flex items-center justify-center p-6 sm:p-10 font-sans overflow-hidden py-20">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-rose-bloom blur-[150px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-lavender blur-[150px] rounded-full" />
      </div>

      <div className="w-full max-w-4xl relative z-10">
        <header className="text-center mb-16">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-16 h-16 bg-gradient-to-br from-rose-bloom to-rose-petal rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 rotate-6 shadow-xl shadow-rose-bloom/20"
          >
            <Sparkles className="text-white w-8 h-8" />
          </motion.div>
          <h1 className="text-4xl font-black text-theatre-dark mb-4">Complete Your Profile.</h1>
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? 'w-8 bg-rose-bloom' : 'w-2 bg-rose-petal/20'}`} />
            ))}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white/70 backdrop-blur-3xl p-10 sm:p-16 rounded-[4rem] border border-rose-petal/20 shadow-2xl shadow-rose-bloom/5"
            >
              <div className="mb-12">
                <h2 className="text-3xl font-black text-theatre-dark mb-3">Who are you?</h2>
                <p className="font-bold text-rose-bloom/40 uppercase tracking-widest text-xs">Choose your role in the party</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <button
                  onClick={() => setRole('student')}
                  className={`p-10 rounded-[3rem] border-2 transition-all text-left group ${
                    role === 'student' ? 'bg-rose-petal/10 border-rose-bloom shadow-xl' : 'bg-white border-rose-petal/10 hover:border-rose-bloom/30'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-colors ${role === 'student' ? 'bg-rose-bloom text-white' : 'bg-rose-petal/10 text-rose-bloom'}`}>
                    <Heart className="w-6 h-6" />
                  </div>
                  <div className="text-xl font-black text-theatre-dark mb-2">Dancer</div>
                  <p className="text-xs font-bold text-[#4A3B3E]/40 leading-relaxed uppercase tracking-widest">Browse, book, and energy-up with master instructors.</p>
                </button>

                <button
                  onClick={() => setRole('teacher')}
                  className={`p-10 rounded-[3rem] border-2 transition-all text-left group ${
                    role === 'teacher' ? 'bg-theatre-dark text-white border-theatre-dark shadow-xl' : 'bg-white border-rose-petal/10 hover:border-rose-bloom/30'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-colors ${role === 'teacher' ? 'bg-rose-bloom text-white' : 'bg-rose-petal/10 text-rose-bloom'}`}>
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className={`text-xl font-black mb-2 ${role === 'teacher' ? 'text-white' : 'text-theatre-dark'}`}>Instructor</div>
                  <p className={`text-xs font-bold leading-relaxed uppercase tracking-widest ${role === 'teacher' ? 'text-white/40' : 'text-[#4A3B3E]/40'}`}>Create routines, manage schedule, and lead the stage.</p>
                </button>
              </div>

              <button
                disabled={!role}
                onClick={() => setStep(2)}
                className="w-full mt-12 btn-premium bg-gradient-to-r from-rose-bloom to-rose-petal text-white py-6 rounded-[2rem] flex items-center justify-center gap-3 shadow-2xl shadow-rose-bloom/30 disabled:opacity-30 transition-all font-black uppercase tracking-widest"
              >
                Next Step <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white/70 backdrop-blur-3xl p-10 sm:p-16 rounded-[4rem] border border-rose-petal/20 shadow-2xl shadow-rose-bloom/5"
            >
              <div className="mb-12">
                <h2 className="text-3xl font-black text-theatre-dark mb-3">The Basics.</h2>
                <p className="font-bold text-rose-bloom/40 uppercase tracking-widest text-xs">Let the community know your name</p>
              </div>

              <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#4A3B3E]/40 ml-2">Display Name</label>
                  <input 
                    type="text" 
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="w-full bg-bloom-white border border-rose-petal/20 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark"
                    placeholder="E.g. Maria Ross"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#4A3B3E]/40 ml-2">Energy Bio</label>
                  <textarea 
                    value={formData.bio}
                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                    className="w-full bg-bloom-white border border-rose-petal/20 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark min-h-[120px]"
                    placeholder="Tell us about your Zumba journey..."
                    required
                  />
                </div>

                {role === 'student' && (
                   <div className="space-y-3 bg-rose-bloom/5 p-8 rounded-[2rem] border border-rose-bloom/10 mt-6">
                     <label className="text-[10px] font-black uppercase tracking-widest text-rose-bloom ml-2">Instructor's Stage Code (Optional)</label>
                     <input 
                       type="text" 
                       value={formData.stage_code}
                       onChange={(e) => setFormData({...formData, stage_code: e.target.value})}
                       className="w-full bg-white border border-rose-bloom/20 rounded-2xl py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-mono font-black text-rose-bloom tracking-widest uppercase"
                       placeholder="E.g. ZUMBA-1234"
                     />
                     <p className="text-[10px] text-rose-bloom/40 ml-2 italic">Don't have a code? You can join your instructor's stage later.</p>
                   </div>
                 )}

                <button
                  type="submit"
                  className="w-full btn-premium bg-gradient-to-r from-rose-bloom to-rose-petal text-white py-6 rounded-[2rem] flex items-center justify-center gap-3 shadow-2xl shadow-rose-bloom/30 transition-all font-black uppercase tracking-widest"
                >
                  Almost there <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white/70 backdrop-blur-3xl p-10 sm:p-16 rounded-[4rem] border border-rose-petal/20 shadow-2xl shadow-rose-bloom/5 text-center"
            >
              <div className="w-24 h-24 bg-rose-petal/20 rounded-full flex items-center justify-center mx-auto mb-10">
                <ShieldCheck className="w-12 h-12 text-rose-bloom" />
              </div>
              <h2 className="text-3xl font-black text-theatre-dark mb-4">You're Ready.</h2>
              <p className="text-theatre-dark/40 font-medium leading-relaxed max-w-sm mx-auto mb-12">
                Your profile is synchronized with the theatre. Let's make some moves.
              </p>

              <div className="p-8 bg-rose-petal/10 rounded-[2.5rem] border border-rose-petal/20 mb-12 text-left">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-bloom" />
                  <span className="text-xs font-black uppercase tracking-widest text-theatre-dark/60">Account Verified</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-bloom" />
                  <span className="text-xs font-black uppercase tracking-widest text-theatre-dark/60">Stage Presence Ready</span>
                </div>
              </div>

              <button
                disabled={loading}
                onClick={handleSubmit}
                className="w-full btn-premium bg-theatre-dark text-white py-6 rounded-[2rem] flex items-center justify-center gap-3 shadow-2xl transition-all font-black uppercase tracking-widest group"
              >
                {loading ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : (
                  <>
                    Enter Theatre <Check className="w-5 h-5 group-hover:scale-125 transition-transform" />
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
