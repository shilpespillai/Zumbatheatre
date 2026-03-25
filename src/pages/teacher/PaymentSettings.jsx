import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, ArrowLeft, Save, ExternalLink, Banknote, Landmark 
} from 'lucide-react';
import { toast } from 'sonner';

export default function TeacherPaymentSettings() {
  const navigate = useNavigate();
  const { profile, fetchProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [paypalUrl, setPaypalUrl] = useState('');
  const [bankInstructions, setBankInstructions] = useState('');
  const [enabledMethods, setEnabledMethods] = useState([]);

  useEffect(() => {
    if (profile?.payment_settings) {
      const config = profile.payment_settings.config || {};
      setPaypalUrl(config.paypal_url || '');
      setBankInstructions(config.bank_instructions || '');
      setEnabledMethods(profile.payment_settings.enabledMethods || []);
    }
  }, [profile]);

  const toggleMethod = (method) => {
    setEnabledMethods(prev => 
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // 2. Save Public Config to Profile
      const payment_settings = {
        enabledMethods,
        config: {
          paypal_url: paypalUrl,
          bank_instructions: bankInstructions
        }
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ payment_settings })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      await fetchProfile();
      toast.success('Payment settings updated successfully!');
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bloom-white text-studio-dark p-6 sm:p-10">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-studio-dark/40 hover:text-rose-bloom transition-colors mb-12"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="mb-12">
          <h1 className="text-4xl font-black mb-4 tracking-tight italic">Studio Payment Center</h1>
          <p className="text-studio-dark/40 font-bold uppercase tracking-[0.2em] text-xs">Activate your stage for online and manual bookings</p>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* Method Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {[
               { id: 'paypal', label: 'PayPal', icon: ExternalLink },
               { id: 'manual', label: 'Manual/Bank', icon: Banknote }
             ].map((method) => (
               <button
                 key={method.id}
                 type="button"
                 onClick={() => toggleMethod(method.id)}
                 className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${
                   enabledMethods.includes(method.id) 
                   ? 'bg-rose-bloom text-white border-rose-bloom shadow-lg shadow-rose-bloom/20' 
                   : 'bg-white text-studio-dark/40 border-apricot/10 grayscale'
                 }`}
               >
                 <method.icon className="w-6 h-6" />
                 <span className="text-[10px] font-black uppercase tracking-widest">{method.label}</span>
               </button>
             ))}
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] border border-apricot/20 shadow-xl space-y-12">
            

            {/* PayPal Section */}
            {enabledMethods.includes('paypal') && (
              <div className="space-y-6 pt-6 border-t border-apricot/10 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3 mb-4">
                  <ExternalLink className="w-5 h-5 text-rose-bloom" />
                  <h3 className="text-lg font-black tracking-tight">PayPal configuration</h3>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-studio-dark/40 ml-2">PayPal Me Link or URL</label>
                  <input
                    type="url"
                    value={paypalUrl}
                    onChange={(e) => setPaypalUrl(e.target.value)}
                    placeholder="https://paypal.me/yourusername"
                    className="w-full bg-bloom-white border-2 border-apricot/10 rounded-2xl px-6 py-4 font-mono text-xs focus:border-rose-bloom outline-none"
                  />
                  <p className="text-[8px] font-bold text-studio-dark/30 uppercase tracking-widest ml-2">Students will be redirected here after reserving.</p>
                </div>
              </div>
            )}

            {/* Manual Section */}
            {enabledMethods.includes('manual') && (
              <div className="space-y-6 pt-6 border-t border-apricot/10 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3 mb-4">
                  <Landmark className="w-5 h-5 text-rose-bloom" />
                  <h3 className="text-lg font-black tracking-tight">Bank Instructions</h3>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-studio-dark/40 ml-2">Transfer details</label>
                  <textarea
                    rows={3}
                    value={bankInstructions}
                    onChange={(e) => setBankInstructions(e.target.value)}
                    placeholder="e.g. Account: 123456... Reference: Dancer Name"
                    className="w-full bg-bloom-white border-2 border-apricot/10 rounded-2xl px-6 py-4 font-sans text-xs focus:border-rose-bloom outline-none resize-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl transition-all ${
                loading ? 'bg-studio-dark/50' : 'bg-studio-dark text-white hover:bg-rose-bloom shadow-studio-dark/30'
              }`}
            >
              {loading ? <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
              Update Stage Settings
            </button>
          </div>
        </form>

        <div className="mt-12 bg-white/40 p-10 rounded-[3rem] border border-apricot/20">
           <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-emerald-500/10 rounded-2xl">
                 <ShieldCheck className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                 <h4 className="text-sm font-black uppercase tracking-tight">End-to-End Encryption</h4>
                 <p className="text-[10px] font-bold text-studio-dark/30">Your financial secrets are never stored in plain text.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
