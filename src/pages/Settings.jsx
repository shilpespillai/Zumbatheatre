import React, { useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
  User, Mail, Shield, Save, Camera, 
  ChevronLeft, LogOut, Bell, Lock, Phone, Package
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function Settings() {
  const { user, profile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    bio: '',
    avatar_url: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || ''
      });
    }
  }, [profile]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          bio: formData.bio,
          avatar_url: formData.avatar_url
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bloom-white text-theatre-dark p-6 sm:p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-16">
           <div className="flex items-center gap-4">
              <button
                onClick={() => window.history.back()}
                className="p-2 bg-bloom-white border border-apricot/20 rounded-lg hover:bg-apricot/5 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-black mb-1">Account & Identity</h1>
                <p className="text-white/40 font-medium tracking-tight uppercase text-xs">Manage your theatrical presence</p>
              </div>
           </div>
           <button
            onClick={signOut}
            className="px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-red-500 hover:text-white transition-all"
           >
             <LogOut className="w-4 h-4" /> Sign Out
           </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
           {/* Sidebar Navigation */}
           <div className="space-y-2">
              {[
                { label: 'Profile Settings', icon: User, active: true },
                { label: 'Security & Privacy', icon: Shield, active: false },
                { label: 'Notifications', icon: Bell, active: false },
                { label: 'Account Verification', icon: Lock, active: false },
              ].map((item, i) => (
                <button
                  key={i}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
                    item.active ? 'bg-bloom-white border border-apricot/30 text-theatre-dark shadow-sm' : 'text-theatre-dark/30 hover:text-theatre-dark/60'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
           </div>

           {/* Form Area */}
           <div className="lg:col-span-2 space-y-8">
              <form onSubmit={handleUpdateProfile} className="glass p-10 rounded-[3rem] space-y-10">
                 {/* Avatar Upload Placeholder */}
                 <div className="flex items-center gap-8">
                    <div className="relative group">
                       <div className="w-24 h-24 rounded-[2rem] bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                          {formData.avatar_url ? (
                            <img src={formData.avatar_url} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-8 h-8 text-white/10" />
                          )}
                       </div>
                       <button className="absolute -bottom-2 -right-2 p-2 bg-zumba-lime rounded-lg text-black hover:scale-110 transition-transform">
                          <Camera className="w-4 h-4" />
                       </button>
                    </div>
                    <div>
                       <h4 className="font-black text-lg mb-1">Your Avatar</h4>
                       <p className="text-xs text-white/40 font-medium tracking-tight">JPG, PNG or GIF. Max 2MB.</p>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-theatre-dark/30 ml-1">Full Name</label>
                       <div className="relative group">
                          <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-theatre-dark/10 group-focus-within:text-rose-bloom transition-colors" />
                          <input
                            type="text"
                            required
                            value={formData.full_name}
                            onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                            className="w-full bg-white/40 border border-apricot/20 rounded-2xl py-5 pl-16 pr-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-sm text-theatre-dark"
                            placeholder="Display name"
                          />
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-theatre-dark/30 ml-1">Phone Number</label>
                       <div className="relative group">
                          <Package className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-theatre-dark/10 group-focus-within:text-rose-bloom transition-colors" />
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            className="w-full bg-white/40 border border-apricot/20 rounded-2xl py-5 pl-16 pr-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-sm text-theatre-dark"
                            placeholder="+1 (555) 000-0000"
                          />
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-theatre-dark/30 ml-1">About Me (Details for Students)</label>
                       <textarea
                        rows={4}
                        value={formData.bio}
                        onChange={(e) => setFormData({...formData, bio: e.target.value})}
                        className="w-full bg-white/40 border border-apricot/20 rounded-[2rem] py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-sm text-theatre-dark resize-none"
                        placeholder="Tell students about your experience, style, and energy..."
                       />
                    </div>

                     <div className="space-y-2 opacity-50 pointer-events-none">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[#4A3B3E]/30 ml-1">Email Address</label>
                        <div className="relative">
                           <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4A3B3E]/10" />
                           <input
                             type="email"
                             disabled
                             value={user?.email || ''}
                             className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-16 pr-6 font-bold text-sm"
                           />
                        </div>
                        <p className="text-[10px] text-[#4A3B3E]/20 ml-1">* Email changes are restricted for your role.</p>
                     </div>

                     {profile?.role?.toUpperCase() === 'TEACHER' && (
                       <div className="pt-10 border-t border-apricot/20">
                         <div className="bg-rose-bloom/5 p-10 rounded-[3rem] border border-rose-bloom/20 relative overflow-hidden">
                           <div className="absolute top-0 right-0 p-8 opacity-10">
                              <Shield className="w-20 h-20 text-rose-bloom" />
                           </div>
                           <h4 className="text-xl font-black text-theatre-dark mb-2">Stage Access</h4>
                           <p className="text-[10px] font-bold text-rose-bloom uppercase tracking-widest mb-8">Share this code with your students to link them to your stage.</p>
                           
                           <div 
                             onClick={() => {
                               navigator.clipboard.writeText(profile.invite_code);
                               toast.success('Stage Code copied to clipboard!');
                             }}
                             className="bg-white border-2 border-rose-bloom/30 border-dashed rounded-3xl p-8 flex items-center justify-between cursor-pointer hover:border-rose-bloom transition-all group"
                           >
                             <div className="space-y-1">
                               <span className="text-[10px] font-black text-rose-bloom/40 uppercase tracking-widest">Public Stage Code</span>
                               <div className="text-3xl font-black text-rose-bloom font-mono tracking-widest">{profile.invite_code || 'GEN-XXXX'}</div>
                             </div>
                             <div className="p-4 bg-rose-bloom/10 rounded-2xl group-hover:bg-rose-bloom group-hover:text-white transition-all text-rose-bloom">
                                <Save className="w-6 h-6" />
                             </div>
                           </div>
                         </div>
                       </div>
                     )}
                  </div>
                 <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full btn-premium bg-gradient-to-r from-zumba-pink to-purple-600 text-white font-black py-6 rounded-[2rem] hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-purple-900/30 disabled:opacity-50"
                 >
                   {loading ? <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                   Save Profile Changes
                 </button>
              </form>
           </div>
        </div>
      </div>
    </div>
  );
}
