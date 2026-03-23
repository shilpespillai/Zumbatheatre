import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSystemConfig, updateSystemConfig } from '../../api/systemConfig';
import { 
  ShieldCheck, ArrowLeft, Save, DollarSign, 
  Settings as SettingsIcon, Zap, TrendingUp, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState({ subscription_price: 49 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await getSystemConfig();
      if (data) setConfig(data);
    } catch (error) {
      toast.error('Failed to load system configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading('Updating system configuration...');

    try {
      await updateSystemConfig(config);
      toast.success('Configuration updated successfully!', { id: toastId });
    } catch (error) {
      toast.error('Failed to update configuration', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bloom-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-rose-bloom/20 border-t-rose-bloom rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bloom-white text-studio-dark p-6 sm:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-[2rem] bg-studio-dark flex items-center justify-center rotate-6 shadow-xl shadow-studio-dark/20">
              <ShieldCheck className="text-white w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-studio-dark tracking-tight">Stage Control Center</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-studio-dark/40 mt-1">Global System Administration</p>
            </div>
          </div>
          <button onClick={signOut} className="p-4 bg-white rounded-2xl border border-studio-dark/10 hover:bg-rose-petal/5 transition-all shadow-sm">
            <ArrowLeft className="w-5 h-5 text-rose-bloom" />
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white/80 p-10 rounded-[3.5rem] border border-apricot/40 shadow-2xl shadow-rose-bloom/5">
              <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-rose-bloom/10 rounded-2xl">
                  <DollarSign className="w-6 h-6 text-rose-bloom" />
                </div>
                <div>
                  <h3 className="text-2xl font-black">Monetization Settings</h3>
                  <p className="text-xs font-bold text-studio-dark/40 uppercase tracking-widest mt-1">Manage Platform Fees</p>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center ml-2">
                    <label className="text-xs font-black uppercase tracking-widest text-studio-dark/40">Monthly Pro Subscription</label>
                    <span className="text-[10px] font-black text-rose-bloom uppercase tracking-widest">USD ($)</span>
                  </div>
                  <div className="relative group">
                    <Zap className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-bloom/40 group-focus-within:text-rose-bloom transition-colors" />
                    <input 
                      type="number" 
                      value={config.subscription_price}
                      onChange={(e) => setConfig({ ...config, subscription_price: parseFloat(e.target.value) })}
                      className="w-full bg-bloom-white border border-apricot/40 rounded-2xl py-6 pl-14 pr-6 focus:outline-none focus:border-rose-bloom transition-all font-black text-2xl text-studio-dark"
                      placeholder="49.00"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-studio-dark/30 ml-2 italic">
                    This price will be reflected on all Teacher Activation pages immediately.
                  </p>
                </div>

                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full btn-premium bg-studio-dark text-white py-6 rounded-[2rem] flex items-center justify-center gap-3 shadow-xl hover:bg-rose-bloom transition-all"
                >
                  {saving ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Changes
                </button>
              </form>
            </section>

            <div className="p-10 bg-rose-petal/5 rounded-[3rem] border border-rose-petal/10">
               <h3 className="text-xl font-black mb-6">System Health</h3>
               <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-apricot/20">
                     <TrendingUp className="w-6 h-6 text-rose-bloom mb-4" />
                     <div className="text-[8px] font-black uppercase text-studio-dark/30 mb-1">Total Revenue</div>
                     <div className="text-2xl font-black">$24,490</div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-apricot/20">
                     <Users className="w-6 h-6 text-rose-bloom mb-4" />
                     <div className="text-[8px] font-black uppercase text-studio-dark/30 mb-1">Active Teachers</div>
                     <div className="text-2xl font-black">124</div>
                  </div>
               </div>
            </div>
          </div>

          <aside className="space-y-8">
            <div className="p-10 bg-gradient-to-br from-studio-dark to-[#2A2426] rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-rose-bloom/20 blur-[60px] rounded-full" />
               <h3 className="text-xl font-black mb-6 relative z-10 italic">Platform Tip</h3>
               <p className="text-sm font-medium text-white/60 leading-relaxed relative z-10">
                 Setting a competitive price encourages more instructors to join. Most successful platforms in our niche price between $39 and $59.
               </p>
               <div className="mt-8 flex items-center gap-3 relative z-10">
                  <SettingsIcon className="w-5 h-5 text-rose-bloom" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">v2.0.4 Enterprise</span>
               </div>
            </div>

            <div className="p-10 bg-white rounded-[3rem] border border-apricot/40 shadow-sm">
               <h4 className="text-xs font-black uppercase tracking-widest text-rose-bloom mb-6">Quick Actions</h4>
               <div className="space-y-4">
                  <button className="w-full py-4 px-6 bg-bloom-white rounded-xl text-[10px] font-black uppercase tracking-widest text-studio-dark text-left hover:bg-apricot/10 transition-colors border border-apricot/20">Review New Teachers</button>
                  <button className="w-full py-4 px-6 bg-bloom-white rounded-xl text-[10px] font-black uppercase tracking-widest text-studio-dark text-left hover:bg-apricot/10 transition-colors border border-apricot/20">Audit Payment Logs</button>
               </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
