import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabaseClient';
import { 
  User, Mail, Phone, Lock, Eye, EyeOff, Save, 
  Settings as SettingsIcon, Camera, Bell, Shield, 
  CreditCard, Landmark, ExternalLink, Banknote,
  CheckCircle2, Sparkles, Package, Heart, Clock, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function UserSettings() {
  const { profile, fetchProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [isGuest, setIsGuest] = useState(false);
  
  useEffect(() => {
    const guestSess = localStorage.getItem('zumba_guest_session');
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
      stripe_public_key: '',
      paypal_url: '',
      bank_instructions: ''
    },
    loyalty_settings: {
      enabled: true,
      required_sessions: 10,
      reward_type: 'FREE_SESSION'
    }
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || ''
      });
      if (profile.payment_settings) {
        setPaymentSettings(profile.payment_settings);
      } else if (profile.role === 'TEACHER') {
        const defaultSettings = {
          method: 'manual',
          enabledMethods: ['manual'],
          config: {
            stripe_public_key: '',
            paypal_url: '',
            bank_instructions: ''
          },
          loyalty_settings: {
            enabled: true,
            required_sessions: 10,
            reward_type: 'FREE_SESSION'
          }
        };
        setPaymentSettings(defaultSettings);
      }
    }
  }, [profile]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updates = {
        ...formData,
        payment_settings: profile.role === 'TEACHER' ? paymentSettings : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) throw error;
      await fetchProfile();
      toast.success('Settings updated successfully!');
    } catch (err) {
      console.error('[Settings] Update error:', err);
      toast.error('Failed to update settings');
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
    ...(profile?.role?.toUpperCase() === 'TEACHER' ? [
      { id: 'finance', label: 'Stage Finance', icon: Landmark },
      { id: 'loyalty', label: 'Loyalty & Rewards', icon: Sparkles }
    ] : []),
    ...(!isGuest ? [{ id: 'security', label: 'Security & Privacy', icon: Shield }] : []),
  ];

  return (
    <div className="min-h-screen bg-bloom-white text-theatre-dark p-6 sm:p-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-16">
          <h1 className="text-4xl font-black text-theatre-dark tracking-tighter italic">Settings Center</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-bloom mt-1">Personal & Stage Configuration</p>
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
                     : 'text-theatre-dark/30 hover:text-theatre-dark/60'
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
                                    <User className="w-8 h-8 text-theatre-dark/10" />
                                  )}
                               </div>
                               <button type="button" className="absolute -bottom-2 -right-2 p-2 bg-rose-bloom rounded-lg text-white hover:scale-110 transition-transform">
                                  <Camera className="w-4 h-4" />
                               </button>
                            </div>
                            <div>
                               <h4 className="font-black text-lg mb-1">Your Avatar</h4>
                               <p className="text-xs text-theatre-dark/40 font-medium tracking-tight">JPG, PNG or GIF. Max 2MB.</p>
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
                                    className="w-full bg-white/40 border border-apricot/20 rounded-2xl py-5 pl-16 pr-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-sm text-theatre-dark shadow-sm"
                                    placeholder="Display name"
                                  />
                               </div>
                            </div>

                            <div className="space-y-2">
                               <label className="text-[10px] font-black uppercase tracking-widest text-theatre-dark/30 ml-1">Phone Number</label>
                               <div className="relative group">
                                  <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-theatre-dark/10 group-focus-within:text-rose-bloom transition-colors" />
                                  <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                    className="w-full bg-white/40 border border-apricot/20 rounded-2xl py-5 pl-16 pr-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-sm text-theatre-dark shadow-sm"
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
                                className="w-full bg-white/40 border border-apricot/20 rounded-[2rem] py-5 px-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-sm text-theatre-dark resize-none shadow-sm"
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
                            <h3 className="text-xl font-black text-theatre-dark mb-2">Payout Method</h3>
                            <p className="text-[10px] font-bold text-rose-bloom uppercase tracking-widest mb-8">How do you want to collect payments from students?</p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                               {[
                                 { id: 'stripe', label: 'Stripe', icon: CreditCard },
                                 { id: 'paypal', label: 'PayPal', icon: ExternalLink },
                                 { id: 'manual', label: 'Bank/Manual', icon: Banknote },
                               ].map((m) => {
                                 const isEnabled = paymentSettings.enabledMethods?.includes(m.id);
                                 return (
                                   <button
                                     key={m.id}
                                     type="button"
                                     onClick={() => {
                                       const current = paymentSettings.enabledMethods || [paymentSettings.method];
                                       const next = isEnabled 
                                         ? current.filter(id => id !== m.id)
                                         : [...current, m.id];
                                       setPaymentSettings({
                                         ...paymentSettings, 
                                         enabledMethods: next,
                                         method: next[0] || 'manual' 
                                       });
                                     }}
                                     className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden ${
                                       isEnabled 
                                       ? 'bg-white border-rose-bloom text-rose-bloom shadow-lg shadow-rose-bloom/10' 
                                       : 'bg-white/50 border-apricot/20 text-theatre-dark/40 hover:border-apricot/40'
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
                            {paymentSettings.enabledMethods?.includes('stripe') && (
                              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                <div className="p-6 bg-rose-bloom/5 border border-rose-bloom/10 rounded-2xl flex items-start gap-4">
                                  <Shield className="w-6 h-6 text-rose-bloom shrink-0 mt-1" />
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-black uppercase tracking-widest text-theatre-dark">Hardened Security</h4>
                                    <p className="text-[10px] font-bold text-theatre-dark/40 leading-relaxed uppercase tracking-tight">
                                      To protect your financial data, Stripe Secret Keys are now managed through our encrypted Edge Activation system. 
                                    </p>
                                    <Link 
                                      to="/teacher/payments"
                                      className="inline-flex items-center gap-2 text-xs font-black text-rose-bloom hover:gap-3 transition-all uppercase tracking-widest pt-2"
                                    >
                                      Configure Secure Payouts <ExternalLink className="w-4 h-4" />
                                    </Link>
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                   <label className="text-[10px] font-black uppercase tracking-widest text-theatre-dark/30 ml-1">Stripe Public Key (Required for Checkout)</label>
                                   <input
                                     type="text"
                                     value={paymentSettings.config.stripe_public_key}
                                     onChange={(e) => setPaymentSettings({
                                       ...paymentSettings, 
                                       config: { ...paymentSettings.config, stripe_public_key: e.target.value }
                                     })}
                                     className="w-full bg-white border border-apricot/20 rounded-xl py-4 px-6 font-mono text-sm"
                                     placeholder="pk_test_..."
                                   />
                                </div>
                              </motion.div>
                            )}

                            {paymentSettings.enabledMethods?.includes('paypal') && (
                              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-theatre-dark/30 ml-1">PayPal.me Link or Email</label>
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

                            {paymentSettings.enabledMethods?.includes('manual') && (
                              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-theatre-dark/30 ml-1">Payment Instructions (Bank Details)</label>
                                 <textarea
                                   rows={4}
                                   value={paymentSettings.config.bank_instructions}
                                   onChange={(e) => setPaymentSettings({
                                     ...paymentSettings, 
                                     config: { ...paymentSettings.config, bank_instructions: e.target.value }
                                   })}
                                   className="w-full bg-white border border-apricot/20 rounded-2xl py-4 px-6 text-sm resize-none"
                                   placeholder="Ex: Bank Transfer to Account XXX-XXXX. Please use your name as reference."
                                 />
                              </motion.div>
                            )}
                         </div>

                         <div className="pt-6 border-t border-apricot/20">
                            <div className="p-6 bg-theatre-dark rounded-3xl text-white flex items-center justify-between">
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
                          <div className="p-10 bg-gradient-to-br from-theatre-dark to-rose-bloom rounded-[3rem] text-white relative overflow-hidden group shadow-2xl">
                             <Sparkles className="absolute -right-4 -top-4 w-32 h-32 text-white/10 group-hover:rotate-12 transition-transform" />
                             <div className="relative z-10">
                                <h3 className="text-3xl font-black mb-2 italic">Loyalty Program</h3>
                                <p className="text-sm font-medium text-white/70 mb-8 max-w-md">Reward your most dedicated dancers with automated free sessions and digital accolades.</p>
                                
                                <div className="flex items-center gap-4 p-4 bg-white/10 rounded-2xl border border-white/20">
                                   <div className={`w-12 h-6 rounded-full p-1 transition-all cursor-pointer ${paymentSettings.loyalty_settings?.enabled ? 'bg-apricot' : 'bg-white/20'}`}
                                        onClick={() => setPaymentSettings({...paymentSettings, loyalty_settings: { ...paymentSettings.loyalty_settings, enabled: !paymentSettings.loyalty_settings?.enabled }})}>
                                      <div className={`w-4 h-4 bg-white rounded-full transition-all ${paymentSettings.loyalty_settings?.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                   </div>
                                   <span className="text-xs font-black uppercase tracking-widest">{paymentSettings.loyalty_settings?.enabled ? 'Program Active' : 'Program Paused'}</span>
                                </div>
                             </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-theatre-dark/30 ml-2">Sessions for Reward</label>
                                <div className="relative group">
                                   <Package className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-theatre-dark/10 group-focus-within:text-rose-bloom transition-colors" />
                                   <input 
                                     type="number" 
                                     value={paymentSettings.loyalty_settings?.required_sessions || 10}
                                     onChange={(e) => setPaymentSettings({...paymentSettings, loyalty_settings: { ...paymentSettings.loyalty_settings, required_sessions: parseInt(e.target.value) }})}
                                     className="w-full bg-white/40 border border-apricot/20 rounded-2xl py-5 pl-16 pr-6 focus:outline-none focus:border-rose-bloom transition-all font-bold text-theatre-dark"
                                   />
                                </div>
                                <p className="text-[10px] text-theatre-dark/40 font-bold ml-2">Example: If set to 10, the 11th session is free.</p>
                             </div>

                             <div className="space-y-4 opacity-40 cursor-not-allowed">
                                <label className="text-[10px] font-black uppercase tracking-widest text-theatre-dark/30 ml-2">Reward Type</label>
                                <div className="p-5 bg-white border border-apricot/20 rounded-2xl flex items-center justify-between">
                                   <span className="text-sm font-bold">Free Session</span>
                                   <CheckCircle2 className="w-4 h-4 text-rose-bloom" />
                                 </div>
                                 <p className="text-[10px] text-theatre-dark/40 font-bold ml-2">More reward types coming soon.</p>
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
                                     <div className="text-[8px] font-bold text-theatre-dark/30 uppercase">{badge.desc}</div>
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
                                <p className="text-xs font-bold text-theatre-dark/40 uppercase tracking-widest">Permanent account actions</p>
                             </div>

                             <div className="p-8 bg-white border border-red-500/10 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div className="space-y-1">
                                   <h4 className="font-black text-red-500">Delete My Stage</h4>
                                   <p className="text-[10px] font-bold text-theatre-dark/30 uppercase max-w-sm">
                                      {profile?.deletion_scheduled_at 
                                        ? `Your stage is scheduled for closure on ${new Date(profile.deletion_scheduled_at).toLocaleDateString()}.`
                                        : 'This will permanently purge your routines, schedules, and profile. Students with active bookings will be notified.'}
                                   </p>
                                </div>
                                {profile?.deletion_scheduled_at ? (
                                  <button 
                                    type="button"
                                    onClick={cancelDeletion}
                                    className="px-8 py-4 bg-theatre-dark text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-lg shadow-theatre-dark/20"
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
    </div>
  );
}
