import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabaseClient';
import { 
  User, Mail, Phone, Lock, Eye, EyeOff, Save, 
  Settings as SettingsIcon, Camera, Bell, Shield, 
  CreditCard, Landmark, ExternalLink, Banknote,
  CheckCircle2, Sparkles, Package, Heart, Clock, Activity,
  ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

export default function UserSettings() {
  const { profile, fetchProfile, signOut, isTeacher, isStudent } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [isGuest, setIsGuest] = useState(false);
  const [lastSyncedProfile, setLastSyncedProfile] = useState(null);
  
  useEffect(() => {
    const guestSess = localStorage.getItem('studio_guest_session');
    if (guestSess) setIsGuest(true);
  }, []);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    bio: '',
    avatar_url: ''
  });

  const [paymentSettings, setPaymentSettings] = useState({
    method: 'manual',
    enabledMethods: ['manual'],
    config: {
      paypal_url: '',
      bank_instructions: ''
    }
  });

  const [loyaltySettings, setLoyaltySettings] = useState({
    enabled: true,
    required_sessions: 10,
    reward_type: 'FREE_SESSION'
  });

  useEffect(() => {
    if (profile && JSON.stringify(profile) !== JSON.stringify(lastSyncedProfile)) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || ''
      });
      if (profile.payment_settings) {
        setPaymentSettings(profile.payment_settings);
      }
      
      if (profile.loyalty_settings) {
        setLoyaltySettings(profile.loyalty_settings);
      } else if (isTeacher) {
        setLoyaltySettings({
          enabled: true,
          required_sessions: 10,
          reward_type: 'FREE_SESSION'
        });
      }
      setLastSyncedProfile(profile);
    }
  }, [profile, isTeacher, lastSyncedProfile]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profile?.id) {
      toast.error('Session expired. Please log in again.');
      return;
    }
    
    setLoading(true);
    try {
      // Capture current role and id locally to avoid race conditions with profile state
      const currentRole = profile.role?.toUpperCase();
      const currentId = profile.id;
      const currentStageCode = profile.stage_code;

      const updates = {
        full_name: formData.full_name,
        avatar_url: formData.avatar_url,
        phone: formData.phone,
        bio: formData.bio,
        updated_at: new Date().toISOString()
      };

      if (currentRole === 'TEACHER') {
        updates.payment_settings = paymentSettings;
        updates.loyalty_settings = loyaltySettings;
      }

      console.log('[Settings] Saving updates for:', currentId);

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentId);

      if (error) {
        console.error('[Settings] DB update failed:', error);
        if (error.code === '42703') throw new Error('Database schema out of sync. Please apply migrations.');
        throw error;
      }

      // 2. Sync to Auth Metadata (Include role and stage_code to prevent identity loss)
      const { error: metaError } = await supabase.auth.updateUser({
        data: {
          full_name: formData.full_name,
          phone: formData.phone,
          bio: formData.bio,
          role: currentRole,
          stage_code: currentStageCode,
          avatar_url: formData.avatar_url
        }
      });

      if (metaError) console.warn('[Settings] Metadata sync warning:', metaError);
      
      await fetchProfile(currentId);
      toast.success('Settings synchronized successfully!');
    } catch (err) {
      console.error('[Settings] Update error:', err);
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (isGuest) {
      toast.error('Guest accounts cannot be deleted here.');
      return;
    }

    setLoading(true);
    try {
      // 1. Safety Check: Active Sessions
      const { data: activeSessions, error: sessError } = await supabase
        .from('schedules')
        .select('id')
        .eq('teacher_id', profile.id)
        .eq('status', 'SCHEDULED')
        .gt('start_time', new Date().toISOString());

      if (sessError) throw sessError;
      if (activeSessions?.length > 0) {
        throw new Error(`You have ${activeSessions.length} active sessions scheduled. Please cancel them first to protect your students.`);
      }

      // 2. Safety Check: Active Bookings (Optional but good)
      // If we use RLS and standard cascades, this might be handled, 
      // but let's be explicit for the user experience.

      // 3. Schedule Deletion (48h Cooling off)
      const deletionDate = new Date();
      deletionDate.setHours(deletionDate.getHours() + 48);

      const { error: deleteError } = await supabase
        .from('profiles')
        .update({ deletion_scheduled_at: deletionDate.toISOString() })
        .eq('id', profile.id);

      if (deleteError) throw deleteError;

      // 4. Notify Students (Optional but highly recommended)
      await supabase.functions.invoke('notify-account-closure', {
        body: { teacherId: profile.id, closureDate: deletionDate.toISOString() }
      });

      toast.success('Account deletion scheduled. Your stage will close in 48 hours.');
      await fetchProfile();
    } catch (err) {
      toast.error(err.message || 'Failed to schedule deletion');
    } finally {
      setLoading(false);
    }
  };

  const cancelDeletion = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ deletion_scheduled_at: null })
        .eq('id', profile.id);
      if (error) throw error;
      toast.success('Account deletion cancelled. Welcome back!');
      await fetchProfile();
    } catch (err) {
      toast.error('Failed to cancel deletion');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile Settings', icon: User },
    ...(isTeacher ? [
      { id: 'finance', label: 'Stage Finance', icon: Landmark },
      { id: 'loyalty', label: 'Loyalty & Rewards', icon: Sparkles }
    ] : []),
    ...(!isGuest ? [{ id: 'security', label: 'Security & Privacy', icon: Shield }] : []),
  ];

  if (!profile && !isGuest) {
    return (
      <div className="min-h-screen bg-bloom-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-rose-bloom/20 border-t-rose-bloom rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-studio-dark/40">Syncing with Stage...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-bloom-white text-studio-dark p-6 sm:p-10"
    >
      <div className="max-w-6xl mx-auto">
        <header className="mb-16 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <Link 
              to={profile?.role === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard'}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-bloom mb-4 hover:translate-x-[-4px] transition-transform"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Stage
            </Link>
            <h1 className="text-4xl font-black text-studio-dark tracking-tighter italic">Settings Center</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-bloom mt-1">Personal & Stage Configuration</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Sidebar Navigation */}
            <div className="space-y-2">
               {tabs.map((item) => (
                 <button
                   key={item.id}
                   onClick={() => setActiveTab(item.id)}
                   className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${
                     activeTab === item.id 
                     ? 'bg-white text-rose-bloom shadow-lg shadow-rose-bloom/5 border border-apricot/20' 
                     : 'text-studio-dark/30 hover:text-studio-dark/60'
                   }`}
                 >
                   <item.icon className="w-5 h-5" />
                   <span className="text-sm">{item.label}</span>
                 </button>
               ))}
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3">
               <form onSubmit={handleUpdateProfile} className="glass p-10 rounded-[3rem] space-y-10 border border-white/50">
                  
                  <AnimatePresence mode="wait">
                     {activeTab === 'profile' && (
                       <motion.div 
                         key="profile"
                         initial={{ opacity: 0, x: 20 }}
                         animate={{ opacity: 1, x: 0 }}
                         exit={{ opacity: 0, x: -20 }}
                         className="space-y-10"
                       >
                         <div className="flex items-center gap-8">
                            <div className="relative group">
                               <div className="w-24 h-24 rounded-[2.5rem] bg-white border border-apricot/20 overflow-hidden flex items-center justify-center">
                                  {formData.avatar_url ? (
                                    <img src={formData.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
                                  ) : (
                                    <User className="w-8 h-8 text-studio-dark/10" />
                                  )}
                               </div>
                               <button type="button" className="absolute -bottom-2 -right-2 p-2 bg-rose-bloom rounded-lg text-white hover:scale-110 transition-transform">
                                  <Camera className="w-4 h-4" />
                               </button>
                            </div>
                            <div>
                               <h4 className="font-black text-lg mb-1">Your Avatar</h4>
                               <p className="text-xs text-studio-dark/40 font-medium tracking-tight">JPG, PNG or GIF. Max 2MB.</p>
                            </div>
                         </div>

                         <div className="space-y-6">
                            <div className="space-y-2">
                               <label className="text-[10px] font-black uppercase tracking-widest text-studio-dark/30 ml-1">Full Name</label>
                               <div className="relative group">
                                  <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-studio-dark/10 group-focus-within:text-rose-bloom transition-colors" />
                                  <input
                                    type="text"
                                    required
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                                    className="w-full bg-white/40 border border-apricot/20 rounded-2xl py-5 pl-16 pr-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-sm text-studio-dark shadow-sm"
                                    placeholder="Display name"
                                  />
                               </div>
                            </div>

                            <div className="space-y-2">
                               <label className="text-[10px] font-black uppercase tracking-widest text-studio-dark/30 ml-1">Phone Number</label>
                               <div className="relative group">
                                  <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-studio-dark/10 group-focus-within:text-rose-bloom transition-colors" />
                                  <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                    className="w-full bg-white/40 border border-apricot/20 rounded-2xl py-5 pl-16 pr-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-sm text-studio-dark shadow-sm"
                                    placeholder="+1 (555) 000-0000"
                                  />
                               </div>
                            </div>

                            <div className="space-y-2">
                               <label className="text-[10px] font-black uppercase tracking-widest text-studio-dark/30 ml-1">About Me (Details for Students)</label>
                               <textarea
                                rows={4}
                                value={formData.bio}
                                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                                className="w-full bg-white/40 border border-apricot/20 rounded-[2rem] py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-sm text-studio-dark resize-none shadow-sm"
                                placeholder="Tell students about your experience, style, and energy..."
                               />
                            </div>
                         </div>
                       </motion.div>
                     )}

                     {activeTab === 'finance' && (
                       <motion.div 
                         key="finance"
                         initial={{ opacity: 0, x: 20 }}
                         animate={{ opacity: 1, x: 0 }}
                         exit={{ opacity: 0, x: -20 }}
                         className="space-y-8"
                       >
                         <div className="p-8 bg-rose-bloom/5 border border-rose-bloom/20 rounded-[2.5rem] relative overflow-hidden">
                            <Landmark className="absolute -right-4 -top-4 w-24 h-24 text-rose-bloom opacity-5" />
                            <h3 className="text-xl font-black text-studio-dark mb-2">Payout Method</h3>
                            <p className="text-[10px] font-bold text-rose-bloom uppercase tracking-widest mb-8">How do you want to collect payments from students?</p>
                            
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                               {[
                                 { id: 'paypal', label: 'PayPal', icon: ExternalLink },
                                 { id: 'cash', label: 'Cash / In-Person', icon: Banknote },
                                 { id: 'bank', label: 'Bank Transfer', icon: Landmark },
                               ].map((m) => {
                                 const isEnabled = paymentSettings.enabledMethods?.includes(m.id);
                                 return (
                                   <button
                                     key={m.id}
                                     type="button"
                                     onClick={() => {
                                       const current = paymentSettings.enabledMethods || [];
                                       const next = isEnabled 
                                         ? current.filter(id => id !== m.id)
                                         : [...current, m.id];
                                       setPaymentSettings({
                                         ...paymentSettings, 
                                         enabledMethods: next
                                       });
                                     }}
                                     className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden ${
                                       isEnabled 
                                       ? 'bg-white border-rose-bloom text-rose-bloom shadow-lg shadow-rose-bloom/10' 
                                       : 'bg-white/50 border-apricot/20 text-studio-dark/40 hover:border-apricot/40'
                                     }`}
                                   >
                                     {isEnabled && (
                                       <div className="absolute top-2 right-2">
                                         <CheckCircle2 className="w-3 h-3 text-rose-bloom" />
                                       </div>
                                     )}
                                     <m.icon className="w-6 h-6" />
                                     <span className="text-xs font-black uppercase tracking-widest">{m.label}</span>
                                     <div className="text-[8px] font-bold uppercase opacity-60">
                                       {isEnabled ? 'Enabled' : 'Disabled'}
                                     </div>
                                   </button>
                                 );
                               })}
                            </div>
                         </div>

                         <div className="space-y-6">
                            {paymentSettings.enabledMethods?.includes('paypal') && (
                              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-studio-dark/30 ml-1">PayPal.me Link or Email</label>
                                 <input
                                   type="text"
                                   value={paymentSettings.config.paypal_url}
                                   onChange={(e) => setPaymentSettings({
                                     ...paymentSettings, 
                                     config: { ...paymentSettings.config, paypal_url: e.target.value }
                                   })}
                                   className="w-full bg-white border border-apricot/20 rounded-xl py-4 px-6 text-sm"
                                   placeholder="https://paypal.me/yourname"
                                 />
                              </motion.div>
                            )}

                            {paymentSettings.enabledMethods?.includes('bank') && (
                              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-6 border-t border-apricot/10">
                                  <div className="flex items-center gap-2 mb-2">
                                     <Landmark className="w-4 h-4 text-rose-bloom" />
                                     <h4 className="text-[10px] font-black uppercase tracking-widest text-studio-dark/60">Bank Transfer Details</h4>
                                  </div>
                                  <textarea
                                    rows={4}
                                    value={paymentSettings.config.bank_instructions}
                                    onChange={(e) => setPaymentSettings({
                                      ...paymentSettings, 
                                      config: { ...paymentSettings.config, bank_instructions: e.target.value }
                                    })}
                                    className="w-full bg-white border border-apricot/20 rounded-2xl py-4 px-6 text-sm resize-none focus:border-rose-bloom focus:outline-none transition-colors"
                                    placeholder="Ex: Bank Transfer to Account XXX-XXXX. Please use your name as reference."
                                  />
                               </motion.div>
                             )}
                         </div>

                         <div className="pt-6 border-t border-apricot/20">
                            <div className="p-6 bg-studio-dark rounded-3xl text-white flex items-center justify-between">
                               <div>
                                  <h4 className="text-sm font-black uppercase tracking-widest mb-1">Platform Subscription</h4>
                                  <p className="text-[10px] opacity-60">Status: {profile?.is_subscribed ? 'Active' : 'Inactive'}</p>
                               </div>
                                {!profile?.is_subscribed && (
                                  <Link to="/teacher/subscription" className="px-5 py-2 bg-rose-bloom rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform">Activate Stage</Link>
                                )}
                            </div>
                         </div>
                       </motion.div>
                     )}

                     {activeTab === 'loyalty' && (
                       <motion.div 
                         key="loyalty"
                         initial={{ opacity: 0, x: 20 }}
                         animate={{ opacity: 1, x: 0 }}
                         exit={{ opacity: 0, x: -20 }}
                         className="space-y-10"
                       >
                          <div className="p-10 bg-gradient-to-br from-studio-dark to-rose-bloom rounded-[3rem] text-white relative overflow-hidden group shadow-2xl">
                             <Sparkles className="absolute -right-4 -top-4 w-32 h-32 text-white/10 group-hover:rotate-12 transition-transform" />
                             <div className="relative z-10">
                                <h3 className="text-3xl font-black mb-2 italic">Loyalty Program</h3>
                                <p className="text-sm font-medium text-white/70 mb-8 max-w-md">Reward your most dedicated dancers with automated free sessions and digital accolades.</p>
                                
                                <div className="flex items-center gap-4 p-4 bg-white/10 rounded-2xl border border-white/20">
                                   <div className={`w-12 h-6 rounded-full p-1 transition-all cursor-pointer ${loyaltySettings?.enabled ? 'bg-apricot' : 'bg-white/20'}`}
                                        onClick={() => setLoyaltySettings({ ...loyaltySettings, enabled: !loyaltySettings?.enabled })}>
                                      <div className={`w-4 h-4 bg-white rounded-full transition-all ${loyaltySettings?.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                   </div>
                                   <span className="text-xs font-black uppercase tracking-widest">{loyaltySettings?.enabled ? 'Program Active' : 'Program Paused'}</span>
                                </div>
                             </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-studio-dark/30 ml-2">Sessions for Reward</label>
                                <div className="relative group">
                                   <Package className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-studio-dark/10 group-focus-within:text-rose-bloom transition-colors" />
                                   <input 
                                     type="number" 
                                     value={loyaltySettings?.required_sessions || 10}
                                     onChange={(e) => setLoyaltySettings({ ...loyaltySettings, required_sessions: parseInt(e.target.value) })}
                                     className="w-full bg-white/40 border border-apricot/20 rounded-2xl py-5 pl-16 pr-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-studio-dark"
                                   />
                                </div>
                                <p className="text-[10px] text-studio-dark/40 font-bold ml-2">Example: If set to 10, the 11th session is free.</p>
                             </div>

                             <div className="space-y-4 opacity-40 cursor-not-allowed">
                                <label className="text-[10px] font-black uppercase tracking-widest text-studio-dark/30 ml-2">Reward Type</label>
                                <div className="p-5 bg-white border border-apricot/20 rounded-2xl flex items-center justify-between">
                                   <span className="text-sm font-bold">Free Session</span>
                                   <CheckCircle2 className="w-4 h-4 text-rose-bloom" />
                                 </div>
                                 <p className="text-[10px] text-studio-dark/40 font-bold ml-2">More reward types coming soon.</p>
                             </div>
                          </div>

                          <div className="pt-10 border-t border-apricot/20">
                             <h4 className="text-sm font-black uppercase tracking-widest mb-6">Achievement Badges (Automated)</h4>
                             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {[
                                  { name: 'Lead Dancer', desc: '10 sessions', icon: Heart },
                                  { name: 'Genre Explorer', desc: '3+ routines', icon: Sparkles },
                                  { name: 'Morning Star', desc: '6AM classes', icon: Clock },
                                  { name: 'Stage Regular', desc: '3 weeks active', icon: Activity }
                                ].map((badge, i) => (
                                  <div key={i} className="p-6 bg-white border border-apricot/20 rounded-[2rem] text-center group hover:border-rose-bloom transition-all">
                                     <badge.icon className="w-6 h-6 text-rose-bloom mx-auto mb-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                                     <div className="text-[10px] font-black uppercase mb-1 tracking-tight">{badge.name}</div>
                                     <div className="text-[8px] font-bold text-studio-dark/30 uppercase">{badge.desc}</div>
                                  </div>
                                ))}
                             </div>
                          </div>
                       </motion.div>
                     )}

                     {activeTab === 'security' && (
                       <motion.div 
                         key="security"
                         initial={{ opacity: 0, x: 20 }}
                         animate={{ opacity: 1, x: 0 }}
                         exit={{ opacity: 0, x: -20 }}
                         className="space-y-10"
                       >
                          <div className="p-10 bg-red-500/5 border border-red-500/20 rounded-[3rem] space-y-8">
                             <div>
                                <h3 className="text-2xl font-black text-red-500 mb-2">Danger Zone</h3>
                                <p className="text-xs font-bold text-studio-dark/40 uppercase tracking-widest">Permanent account actions</p>
                             </div>

                             <div className="p-8 bg-white border border-red-500/10 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div className="space-y-1">
                                   <h4 className="font-black text-red-500">Delete My Stage</h4>
                                   <p className="text-[10px] font-bold text-studio-dark/30 uppercase max-w-sm">
                                      {profile?.deletion_scheduled_at 
                                        ? `Your stage is scheduled for closure on ${new Date(profile.deletion_scheduled_at).toLocaleDateString()}.`
                                        : 'This will permanently purge your routines, schedules, and profile. Students with active bookings will be notified.'}
                                   </p>
                                </div>
                                {profile?.deletion_scheduled_at ? (
                                  <button 
                                    type="button"
                                    onClick={cancelDeletion}
                                    className="px-8 py-4 bg-studio-dark text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-lg shadow-studio-dark/20"
                                  >
                                    Cancel Deletion
                                  </button>
                                ) : (
                                  <button 
                                    type="button"
                                    onClick={handleDeleteAccount}
                                    className="px-8 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                                  >
                                    Delete Account
                                  </button>
                                )}
                             </div>
                          </div>
                       </motion.div>
                     )}
                  </AnimatePresence>

                  <button 
                   type="submit" 
                   disabled={loading}
                   className="w-full btn-premium bg-gradient-to-r from-rose-bloom to-[#FFB38A] text-white font-black py-6 rounded-[2rem] hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl shadow-rose-bloom/20 disabled:opacity-50 mt-10"
                  >
                    {loading ? <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Settings
                  </button>
               </form>
            </div>
        </div>
      </div>
    </motion.div>
  );
}
