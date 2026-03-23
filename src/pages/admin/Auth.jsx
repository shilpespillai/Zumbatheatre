import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabaseClient';
import { 
  Mail, Lock, ShieldCheck, ArrowRight, Sparkles 
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function AdminAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: formData.email, 
        password: formData.password 
      });
      
      if (error) throw error;
      
      // Verify role manually for extra security
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
        
      if (profileError || profile?.role?.toUpperCase() !== 'ADMIN') {
        await supabase.auth.signOut();
        throw new Error('Unauthorized. Admin access only.');
      }

      toast.success('Welcome, Administrator.');
      navigate('/admin/dashboard');
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
        className="fixed top-8 left-8 z-50 p-4 bg-white/80 backdrop-blur-md rounded-2xl border border-apricot/20 text-theatre-dark hover:bg-theatre-dark hover:text-white transition-all shadow-xl shadow-theatre-dark/5 group flex items-center gap-2"
        title="Back to Home"
      >
        <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-widest pr-2">Home</span>
      </a>
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-theatre-dark blur-[150px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-bloom-white/80 backdrop-blur-3xl p-10 sm:p-16 rounded-[4rem] border border-apricot/20 shadow-2xl shadow-theatre-dark/5"
      >
        <div className="mb-12 text-center">
          <div className="w-16 h-16 bg-theatre-dark rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <ShieldCheck className="text-white w-8 h-8" />
          </div>
          <h2 className="text-3xl font-black text-theatre-dark mb-3">Owner Vault.</h2>
          <p className="font-bold text-theatre-dark/40 uppercase tracking-widest text-[10px]">
            Platform Administration Access
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#4A3B3E]/40 ml-2">Admin Email</label>
            <div className="relative">
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full bg-bloom-white border border-rose-petal/20 rounded-2xl py-5 px-6 pl-14 focus:outline-none focus:border-theatre-dark transition-all font-bold text-theatre-dark"
                placeholder="admin@studiotheatre.com"
                required
              />
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-theatre-dark/40" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#4A3B3E]/40 ml-2">Secret Code</label>
            <div className="relative">
              <input 
                type="password" 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full bg-bloom-white border border-rose-petal/20 rounded-2xl py-5 px-6 pl-14 focus:outline-none focus:border-theatre-dark transition-all font-bold text-theatre-dark"
                placeholder="••••••••"
                required
              />
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-theatre-dark/40" />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-premium bg-theatre-dark text-white py-6 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-theatre-dark/20 group disabled:opacity-50"
          >
            {loading ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : (
              <>
                Unlock Control Center
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-12 text-center">
          <a 
            href="/"
            className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3B3E]/40 hover:text-theatre-dark transition-colors"
          >
            ← Back to Theatre
          </a>
        </div>
      </motion.div>
    </div>
  );
}
