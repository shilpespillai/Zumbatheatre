import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabaseClient';
import { 
  Mail, Lock, User, ArrowRight, 
  Chrome, Sparkles, Heart, ShieldCheck 
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function Auth() {
  const { signInMock, isDevBypass, fetchProfile, user, profile } = useAuth();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const initialRole = searchParams.get('role') || 'student';
  const initialEmail = searchParams.get('email') || '';
  const initialCode = searchParams.get('code') || '';

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: initialEmail,
    password: '',
    fullName: '',
    stageCode: initialCode
  });
  const [role, setRole] = useState(initialRole); // 'student' or 'teacher'

  // Redirect if already logged in
  useEffect(() => {
    if (user && profile) {
      const targetPath = profile.role?.toUpperCase() === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard';
      navigate(targetPath);
    }
  }, [user, profile, navigate]);

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/onboarding'
        }
      });
      if (error) throw error;
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isDevBypass) {
      if (role === 'student' && formData.stageCode) {
        localStorage.setItem('pending_teacher_code', formData.stageCode);
      }
      if (isLogin) {
        signInMock(formData.email, role, formData.fullName || formData.email.split('@')[0]);
        const targetPath = role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
        navigate(targetPath);
      } else {
        signInMock(formData.email, role, formData.fullName || formData.email.split('@')[0]);
        navigate('/onboarding');
      }
      setLoading(false);
      return;
    }

    try {
      if (role === 'student' && formData.stageCode) {
        localStorage.setItem('pending_teacher_code', formData.stageCode);
      }

      if (isLogin) {
        if (role === 'student') {
          // Passwordless entrance for students
          const { error } = await supabase.auth.signInWithOtp({ 
            email: formData.email,
            options: { emailRedirectTo: window.location.origin + '/onboarding' } 
          });
          if (error) throw error;
          toast.success('Magic link sent! Check your email to enter the stage.');
        } else {
          // Standard login for teachers
          const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
          if (error) throw error;
          toast.success('Welcome back, Instructor!');
          navigate('/teacher/dashboard');
        }
      } else {
        // Register logic for both
        const { data, error } = await supabase.auth.signUp({ 
          email: formData.email, 
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              role: role
            },
            emailRedirectTo: window.location.origin + '/onboarding'
          }
        });
        
        if (error) throw error;
        
        if (data.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({ 
              id: data.user.id, 
              full_name: formData.fullName, 
              role: role 
            });
          
          if (profileError) console.error('Profile creation error:', profileError);
        }
        
        toast.success('Stage door is open! Check your email to confirm.');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bloom-white flex items-center justify-center p-6 sm:p-10 font-sans overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-rose-bloom blur-[150px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-lavender blur-[150px] rounded-full" />
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-20 items-center relative z-10">
        <div className="hidden lg:block space-y-12">
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-20 h-20 bg-gradient-to-br from-rose-bloom to-rose-petal rounded-[2rem] flex items-center justify-center rotate-12 shadow-2xl shadow-rose-bloom/30"
            >
              <Sparkles className="text-white w-10 h-10" />
            </motion.div>
            <h1 className="text-6xl font-black text-theatre-dark leading-[1.1]">The Stage is <br/><span className="text-rose-bloom">Waiting.</span></h1>
            <p className="text-xl text-[#4A3B3E]/60 max-w-md font-medium leading-relaxed">
              Step into the world's most elegant platform for Zumba creators and enthusiasts.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-8">
            <div className="bg-white/40 p-8 rounded-[2.5rem] border border-rose-petal/20">
               <ShieldCheck className="w-8 h-8 text-rose-bloom mb-4" />
               <div className="font-black text-theatre-dark uppercase tracking-widest text-[10px]">Pure Security</div>
            </div>
            <div className="bg-white/40 p-8 rounded-[2.5rem] border border-rose-petal/20">
               <Heart className="w-8 h-8 text-rose-bloom mb-4" />
               <div className="font-black text-theatre-dark uppercase tracking-widest text-[10px]">Pure Energy</div>
            </div>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-bloom-white/80 backdrop-blur-3xl p-10 sm:p-16 rounded-[4rem] border border-apricot/20 shadow-2xl shadow-rose-bloom/5"
        >
          <div className="mb-12">
            <h2 className="text-4xl font-black text-theatre-dark mb-3">
              {role === 'teacher' ? (isLogin ? 'Instructor Login.' : 'Instructor Join.') : 'Student Entrance.'}
            </h2>
            <p className="font-bold text-rose-bloom/40 uppercase tracking-widest text-xs">
              {role === 'teacher' ? 'Access your stage command center' : 'Step onto your private stage'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-8">
            {!isLogin && (
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#4A3B3E]/40 ml-2">Full Name</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    className="w-full bg-bloom-white/50 border border-apricot/20 rounded-2xl py-5 px-6 pl-14 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark"
                    placeholder="Your Full Name"
                    required
                  />
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-bloom/40" />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#4A3B3E]/40 ml-2">Email Address</label>
              <div className="relative">
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-bloom-white border border-rose-petal/20 rounded-2xl py-5 px-6 pl-14 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark"
                  placeholder="name@example.com"
                  required
                />
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-bloom/40" />
              </div>
            </div>

            {(role === 'teacher' || !isLogin) && (
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#4A3B3E]/40 ml-2">Secure Password</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-bloom-white border border-rose-petal/20 rounded-2xl py-5 px-6 pl-14 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark"
                    placeholder="••••••••"
                    required
                  />
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-bloom/40" />
                </div>
              </div>
            )}

            {role === 'student' && isLogin && (
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-rose-bloom ml-2 font-black">Stage Code</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={formData.stageCode}
                    onChange={(e) => setFormData({...formData, stageCode: e.target.value})}
                    className="w-full bg-rose-bloom/5 border border-rose-bloom/20 rounded-2xl py-5 px-6 pl-14 focus:outline-none focus:border-rose-bloom transition-all font-mono font-black text-rose-bloom tracking-widest uppercase"
                    placeholder="ZUMBA-XXXX"
                    required
                  />
                  <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-bloom/40" />
                </div>
                <p className="text-[9px] text-rose-bloom/40 ml-2 italic">You'll be automatically linked to this instructor.</p>
              </div>
            )}

            {!isLogin && (
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#4A3B3E]/40 ml-2">Tell us who you are</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border ${
                      role === 'student' ? 'bg-rose-bloom text-white border-rose-bloom shadow-lg shadow-rose-bloom/20' : 'bg-white text-theatre-dark/40 border-rose-petal/10 hover:bg-rose-petal/5'
                    }`}
                  >
                    Dancer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border ${
                      role === 'teacher' ? 'bg-theatre-dark text-white border-theatre-dark shadow-lg' : 'bg-white text-theatre-dark/40 border-rose-petal/10 hover:bg-rose-petal/5'
                    }`}
                  >
                    Instructor
                  </button>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full btn-premium bg-gradient-to-r from-rose-bloom to-rose-petal text-white py-6 rounded-[2rem] flex items-center justify-center gap-3 shadow-2xl shadow-rose-bloom/30 group disabled:opacity-50"
            >
              {loading ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : (
                <>
                  {isLogin ? 'Enter Theatre' : 'Join Theatre'}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="my-10 flex items-center gap-4">
            <div className="h-px flex-1 bg-rose-petal/20" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#4A3B3E]/20">Modern Access</span>
            <div className="h-px flex-1 bg-rose-petal/20" />
          </div>

          {role === 'teacher' && (
            <div className="grid grid-cols-1">
              <button 
                onClick={handleGoogleLogin}
                className="flex items-center justify-center gap-3 py-5 bg-white rounded-2xl border border-rose-petal/10 hover:bg-rose-petal/5 transition-all text-xs font-bold text-theatre-dark/60 shadow-sm"
              >
                <Chrome className="w-5 h-5 text-[#4285F4]" /> Continue with Google
              </button>
            </div>
          )}

          {role === 'teacher' && (
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="w-full text-center mt-12 text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3B3E]/40 hover:text-rose-bloom transition-colors"
            >
              {isLogin ? "Need an Instructor Entrance? Step inside" : "Already leading? Sign back in"}
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
