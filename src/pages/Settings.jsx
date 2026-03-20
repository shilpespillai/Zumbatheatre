import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
  User, Mail, Shield, Save, Camera, 
  ChevronLeft, LogOut, Bell, Lock, Phone, Package,
  CreditCard, ExternalLink, Banknote, Landmark, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function Settings() {
  const { user, profile: authProfile, signOut: authSignOut, isDevBypass, fetchProfile } = useAuth();
  const [guestProfile, setGuestProfile] = useState(() => {
    return JSON.parse(localStorage.getItem('zumba_guest_session') || 'null');
  });

  const profile = authProfile || guestProfile;
  const isGuest = !!guestProfile && !authProfile;

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    bio: '',
    avatar_url: ''
  });

  const [paymentSettings, setPaymentSettings] = useState({
    method: 'manual', // Default primary
    enabledMethods: ['manual'], // Multi-selection
    config: {
      stripe_public_key: '',
      stripe_secret_key: '',
      paypal_url: '',
      bank_instructions: ''
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
        setPaymentSettings({
          ...profile.payment_settings,
          enabledMethods: profile.payment_settings.enabledMethods || [profile.payment_settings.method || 'manual']
        });
      }
    }
  }, [profile]);

  const signOut = () => {
    if (isGuest) {
      localStorage.removeItem('zumba_guest_session');
      window.location.href = '/';
    } else {
      authSignOut();
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isGuest) {
        const updated = { 
          ...guestProfile, 
          full_name: formData.full_name,
          phone: formData.phone,
          bio: formData.bio,
          avatar_url: formData.avatar_url
        };
        localStorage.setItem('zumba_guest_session', JSON.stringify(updated));
        setGuestProfile(updated);
        toast.success('Guest Profile updated!');
      } else if (isDevBypass) {
        const mockProfile = JSON.parse(localStorage.getItem('zumba_mock_profile') || '{}');
        const updated = { 
          ...mockProfile, 
          ...formData, 
          payment_settings: paymentSettings 
        };
        localStorage.setItem('zumba_mock_profile', JSON.stringify(updated));
        
        const savedProfiles = JSON.parse(localStorage.getItem('zumba_mock_profiles') || '{}');
        savedProfiles[user.id] = updated;
        localStorage.setItem('zumba_mock_profiles', JSON.stringify(savedProfiles));
        
        await fetchProfile();
        toast.success('Mock Profile updated successfully!');
      } else {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            phone: formData.phone,
            bio: formData.bio,
            avatar_url: formData.avatar_url,
            payment_settings: paymentSettings
          })
          .eq('id', user.id);

        if (error) throw error;
        toast.success('Profile updated successfully!');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile Settings', icon: User },
    ...(profile?.role?.toUpperCase() === 'TEACHER' ? [{ id: 'finance', label: 'Stage Finance', icon: Landmark }] : []),
    ...(!isGuest ? [{ id: 'security', label: 'Security & Privacy', icon: Shield }] : []),
  ];

  return (
    <div className="min-h-screen bg-bloom-white text-theatre-dark p-6 sm:p-10 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-16">
           <div className="flex items-center gap-4">
              <button
                onClick={() => window.history.back()}
                className="p-2 bg-white border border-apricot/20 rounded-lg hover:bg-apricot/5 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-black mb-1">Settings</h1>
                <p className="text-theatre-dark/40 font-medium tracking-tight uppercase text-[10px]">Manage your theatrical presence</p>
              </div>
           </div>
           <button
            onClick={signOut}
            className="px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-red-500 hover:text-white transition-all"
           >
             <LogOut className="w-4 h-4" /> Sign Out
           </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
           {/* Sidebar Navigation */}
           <div className="space-y-2 lg:col-span-1">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
                    activeTab === item.id 
                    ? 'bg-white border border-apricot/30 text-rose-bloom shadow-lg shadow-rose-bloom/5' 
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
                                   <img src={formData.avatar_url} className="w-full h-full object-cover" />
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
                                        // Keep 'method' as the primary fallback
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
