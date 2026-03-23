import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabaseClient';
import { 
  Mail, Lock, User, ArrowRight, 
  Chrome, Sparkles, Heart, ShieldCheck, LogOut
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Turnstile } from '@marsidev/react-turnstile';
import Honeypot from '../components/Honeypot';
import { v4 as uuidv4 } from 'uuid';

export default function Auth() {
  const { user, profile } = useAuth();
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
    stageCode: initialCode,
    website: '' // Honeypot trap
  });
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking'); // checking, ok, blocked

  useEffect(() => {
    // Check connection health to Supabase
    const checkConnection = async () => {
      try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000));
        await Promise.race([supabase.from('profiles').select('id').limit(1), timeout]);
        setConnectionStatus('ok');
      } catch {
        console.warn('[Auth] Connection seems blocked or slow.');
        setConnectionStatus('blocked');
        setShowTroubleshooter(true);
      }
    };
    checkConnection();
  }, []);

  const [role, setRole] = useState(initialRole); // 'student' or 'teacher'
  const [turnstileToken, setTurnstileToken] = useState(null);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'; // Standard test key

  // Redirect if already logged in (Teachers/Admins)
  useEffect(() => {
    // ONLY redirect if connection is OK and we have a definitive profile/role state
    if (user && !loading && connectionStatus === 'ok') {
      if (profile) {
        const uRole = profile.role?.toUpperCase();
        if (uRole === 'ADMIN') navigate('/admin/dashboard');
        else if (uRole === 'TEACHER') navigate('/teacher/dashboard');
      } else {
        // Authenticated user with no profile record -> move to onboarding
        console.log('[Auth] User logged in but no profile found, redirecting to onboarding...');
        navigate('/onboarding');
      }
    }
  }, [user, profile, loading, navigate, connectionStatus]);

  const handleGuestEntrance = async () => {
    if (!formData.fullName || !formData.stageCode) {
      toast.error('Please provide your name and the stage code.');
      return;
    }
    
    setLoading(true);
    
    // Valid UUID format for guest ID to satisfy Supabase/Postgres constraints
    const uuidV4 = '00000000-0000-4000-8000-' + btoa(formData.fullName.toLowerCase().trim() + formData.stageCode.toUpperCase().trim()).replace(/[^a-f0-9]/g, '').slice(0, 12).padEnd(12, '0');
    const stableId = uuidV4;
    
    const guestProfile = {
      id: stableId,
      full_name: formData.fullName,
      role: 'STUDENT',
      stage_code: formData.stageCode.toUpperCase().trim(),
      visited_stages: []
    };
    
    try {
      // Check if this guest already exists (Account Already Exists Check)
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', stableId)
        .maybeSingle();

      if (fetchError) console.warn('[Auth] Checking existing guest failed:', fetchError);
      
      if (existingProfile) {
        toast.info(`Welcome back, ${formData.fullName}! Entering the stage...`);
      } else {
        // 1. Permanently record guest in Supabase (Zero Mock-Data Policy)
        const { error: upsertError } = await supabase.from('profiles').upsert(guestProfile);
        if (upsertError) {
          console.warn('[Auth] Guest upsert to DB failed, falling back to local only:', upsertError);
          // We still let them in if it's a minor error, but the primary goal is DB storage
        }
        toast.success(`Welcome to the stage, ${formData.fullName}!`);
      }
      
      // 2. Keep minimal session in local storage for the frontend to know they are a guest
      localStorage.setItem('zumba_guest_session', JSON.stringify({ ...guestProfile, is_guest: true }));
      localStorage.setItem('pending_teacher_code', guestProfile.stage_code);
      
      navigate('/student/dashboard');
    } catch (err) {
      console.error('[Auth] Guest entrance failed:', err);
      toast.error('Could not enter the stage. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();

    // 1. Honeypot check: If the hidden 'website' field is filled, it's a bot.
    if (formData.website) {
      console.warn('Bot detected via Honeypot trap.');
      toast.error('Security verification failed.');
      return;
    }

    // 2. Turnstile check
    if (!turnstileToken) {
      toast.error('Please complete the security challenge.');
      return;
    }
    
    if (role === 'student') {
      handleGuestEntrance();
      return;
    }

    setLoading(true);


    try {
      if (isLogin) {
        // Standard login for teachers
        const { error } = await supabase.auth.signInWithPassword({ 
          email: formData.email, 
          password: formData.password 
        });
        if (error) throw error;
        toast.success('Welcome back, Instructor!');
        navigate('/teacher/dashboard');
      } else {
        // Register logic for teachers
        const { data, error } = await supabase.auth.signUp({ 
          email: formData.email, 
          password: formData.password,
          options: {
            data: { full_name: formData.fullName, role: 'TEACHER' },
            emailRedirectTo: window.location.origin + '/onboarding'
          }
        });
        
        if (error) throw error;

        // If identities is an empty array, it means the user already exists
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          toast.error('An account with this email already exists. Please log in instead.');
          setIsLogin(true); // Switch to login tab for convenience
          setLoading(false);
          return;
        }
        
        if (data.user) {
          await supabase.from('profiles').upsert({ 
            id: data.user.id, 
            full_name: formData.fullName, 
            role: 'TEACHER' 
          });
        }
        
        toast.success('Instructor account created! Check your email to confirm.');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bloom-white flex items-center justify-center p-6 sm:p-10 font-sans overflow-hidden relative">
      {/* Floating Home Button */}
      <a 
        href="/" 
        className="fixed top-8 left-8 z-50 p-4 bg-white/80 backdrop-blur-md rounded-2xl border border-apricot/20 text-rose-bloom hover:bg-rose-bloom hover:text-white transition-all shadow-xl shadow-rose-bloom/5 group flex items-center gap-2"
        title="Back to Home"
      >
        <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-widest pr-2">Home</span>
      </a>
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-rose-bloom blur-[150px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-lavender blur-[150px] rounded-full" />
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-20 items-center relative z-10">
        <div className="hidden lg:block space-y-12">
          <div className="space-y-6">
           {showTroubleshooter && (
          <Motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between gap-4 w-full"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900">Connection Blocked?</h3>
                <p className="text-xs text-rose-700">Your browser's "Tracking Protection" might be blocking our database.</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => alert('To fix this:\n1. Click the Lock/Shield icon in your address bar.\n2. Turn OFF "Tracking Prevention" for this site.\n3. Refresh the page.')}
              className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-colors"
            >
              How to Fix
            </button>
          </Motion.div>
        )}

        <Motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-20 h-20 bg-gradient-to-br from-rose-bloom to-rose-petal rounded-[2rem] flex items-center justify-center rotate-12 shadow-2xl shadow-rose-bloom/30"
            >
              <Sparkles className="text-white w-10 h-10" />
            </Motion.div>
            <h1 className="text-6xl font-black text-theatre-dark leading-[1.1]">The Stage is <br/><span className="text-rose-bloom">Waiting.</span></h1>
            <p className="text-xl text-[#4A3B3E]/60 max-w-md font-medium leading-relaxed">
              Step into the world's most elegant platform for dance creators and enthusiasts.
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

        <Motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-bloom-white/80 backdrop-blur-3xl p-10 sm:p-16 rounded-[4rem] border border-apricot/20 shadow-2xl shadow-rose-bloom/5"
        >
          {/* Role Tab Switcher */}
          <div className="flex p-1.5 bg-rose-bloom/5 rounded-[1.5rem] border border-rose-bloom/10 mb-10">
            <button
              onClick={() => setRole('student')}
              className={`flex-1 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                role === 'student' 
                ? 'bg-rose-bloom text-white shadow-lg shadow-rose-bloom/20' 
                : 'text-rose-bloom/40 hover:text-rose-bloom'
              }`}
            >
              Student
            </button>
            <button
              onClick={() => setRole('teacher')}
              className={`flex-1 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                role === 'teacher' 
                ? 'bg-rose-bloom text-white shadow-lg shadow-rose-bloom/20' 
                : 'text-rose-bloom/40 hover:text-rose-bloom'
              }`}
            >
              Teacher
            </button>
          </div>

          <div className="mb-10">
            {profile || localStorage.getItem('zumba_guest_session') ? (
              <div className="p-6 bg-rose-bloom/5 border border-rose-bloom/10 rounded-[2rem] mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-theatre-dark leading-tight">Welcome back!</h3>
                  <p className="text-[10px] font-bold text-rose-bloom/60 uppercase tracking-widest mt-1">
                    {profile?.full_name || JSON.parse(localStorage.getItem('zumba_guest_session')).full_name} is signed in
                  </p>
                </div>
                <button 
                  onClick={() => {
                    supabase.auth.signOut();
                    window.location.reload();
                  }}
                  className="p-3 bg-white border border-rose-bloom/20 rounded-xl text-rose-bloom hover:bg-rose-bloom hover:text-white transition-all shadow-sm"
                  title="Sign Out to switch account"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : null}
            <h2 className="text-4xl font-black text-theatre-dark mb-3">
              {role === 'teacher' ? (isLogin ? 'Theatre Entrance.' : 'Theatre Join.') : 'Theatre Entrance.'}
            </h2>
            <p className="font-bold text-rose-bloom/40 uppercase tracking-widest text-xs">
              {role === 'teacher' ? 'Access your stage command center' : 'Step onto your private stage'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-8">
            {/* Full Name - Required for Guest Student and Instructor Sign Up */}
            {(role === 'student' || (role === 'teacher' && !isLogin)) && (
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

            {/* Email & Password - Only for Teachers */}
            {role === 'teacher' && (
              <>
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
              </>
            )}

            {/* Stage Code - Only for Students */}
            {role === 'student' && (
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-rose-bloom ml-2 font-black">Stage Code</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={formData.stageCode}
                    onChange={(e) => setFormData({...formData, stageCode: e.target.value})}
                    className="w-full bg-rose-bloom/5 border border-rose-bloom/20 rounded-2xl py-5 px-6 pl-14 focus:outline-none focus:border-rose-bloom transition-all font-mono font-black text-rose-bloom tracking-widest uppercase"
                    placeholder="STUDIO-XXXX"
                    required
                  />
                  <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-bloom/40" />
                </div>
                <p className="text-[9px] text-rose-bloom/40 ml-2 italic">You'll be automatically linked to this instructor.</p>
              </div>
            )}

            {/* Bot Protection Layer */}
            <div className="space-y-4">
              <Honeypot 
                value={formData.website} 
                onChange={(e) => setFormData({...formData, website: e.target.value})} 
              />
              
              <div className="flex justify-center transform scale-90 sm:scale-100">
                <Turnstile 
                  siteKey={turnstileSiteKey} 
                  onSuccess={(token) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading || !turnstileToken}
              className="w-full btn-premium bg-gradient-to-r from-rose-bloom to-rose-petal text-white py-6 rounded-[2rem] flex items-center justify-center gap-3 shadow-2xl shadow-rose-bloom/30 group disabled:opacity-50"
            >
              {loading ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : (
                <>
                  {role === 'student' ? 'Enter Theatre' : (isLogin ? 'Enter Theatre' : 'Join Theatre')}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-12 text-center space-y-4 flex flex-col items-center">
            {role === 'teacher' && (
              <button 
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3B3E]/40 hover:text-rose-bloom transition-colors"
              >
                {isLogin ? "Need a Theatre Entrance? Step inside" : "Already leading? Sign back in"}
              </button>
            )}

            <a 
              href="/"
              className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-bloom/40 hover:text-rose-bloom transition-colors pt-4 border-t border-apricot/10 w-32"
            >
              ← Back to Theatre
            </a>
          </div>
        </Motion.div>
      </div>
    </div>
  );
}
