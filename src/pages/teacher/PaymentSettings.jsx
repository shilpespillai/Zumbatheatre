import React, { useState } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, CreditCard, CheckCircle2, Save, Lock, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

export default function TeacherPaymentSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stripeKey, setStripeKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!stripeKey.startsWith('sk_')) {
      toast.error('Please enter a valid Stripe Secret Key (starts with sk_)');
      return;
    }

    setLoading(true);
    const promise = new Promise((resolve, reject) => {
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

          const response = await fetch(`${supabaseUrl}/functions/v1/save-instructor-key`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ stripeSecretKey: stripeKey })
          });

          const result = await response.json();
          if (result.error) throw new Error(result.error);
          
          resolve(result);
          setStripeKey('');
        } catch (error) {
          reject(error);
        }
      })();
    });

    toast.promise(promise, {
      loading: 'Encrypting and saving your secure key...',
      success: 'Payment stage activated! You are ready to receive payments.',
      error: (err) => `Failed to save key: ${err.message}`
    });

    try {
      await promise;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bloom-white text-studio-dark p-6 sm:p-10">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-studio-dark/40 hover:text-rose-bloom transition-colors mb-12"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="mb-12">
          <h1 className="text-4xl font-black mb-4 tracking-tight italic">Direct Payment Settings</h1>
          <p className="text-studio-dark/40 font-bold uppercase tracking-[0.2em] text-xs">Configure your own Stripe account to receive student payments directly</p>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] border border-apricot/20 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Lock className="w-24 h-24" />
          </div>

          <form onSubmit={handleSave} className="space-y-8 relative z-10">
            <div className="space-y-4">
              <label className="block text-[10px] font-black uppercase tracking-widest text-studio-dark/50 px-2">
                Stripe Secret Key (sk_...)
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={stripeKey}
                  onChange={(e) => setStripeKey(e.target.value)}
                  placeholder="sk_test_..."
                  className="w-full bg-bloom-white border-2 border-apricot/10 rounded-2xl px-6 py-4 font-mono text-sm focus:border-rose-bloom outline-none transition-all pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-studio-dark/30 hover:text-rose-bloom transition-colors"
                >
                   {showKey ? <X className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex gap-4">
              <ShieldCheck className="w-6 h-6 text-emerald-500 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-black text-emerald-900 uppercase tracking-tight">Security Guaranteed</p>
                <p className="text-[10px] font-medium text-emerald-700 leading-relaxed">
                  Your key is never stored in plain text. It is encrypted at the edge using an industry-standard AES-256 algorithm before it hits our database.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl transition-all ${
                loading ? 'bg-studio-dark/50' : 'bg-studio-dark text-white hover:bg-rose-bloom shadow-studio-dark/20'
              }`}
            >
              {loading ? <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
              Save Payment Key
            </button>
          </form>

          <p className="mt-8 text-center text-[10px] font-bold text-studio-dark/30 uppercase tracking-widest flex items-center justify-center gap-2">
            <AlertCircle className="w-3 h-3" /> Only you can update your key
          </p>
        </div>

        <div className="mt-12 p-8 bg-rose-bloom/5 rounded-[2rem] border border-rose-bloom/10">
          <h2 className="text-sm font-black uppercase tracking-widest mb-4">How it works</h2>
          <ol className="space-y-4 text-xs font-bold text-studio-dark/60">
            <li className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-rose-bloom/10 text-rose-bloom flex items-center justify-center shrink-0">1</span>
              <span>Go to your Stripe Dashboard and find your <b>Secret Key</b> (starts with <code>sk_</code>).</span>
            </li>
            <li className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-rose-bloom/10 text-rose-bloom flex items-center justify-center shrink-0">2</span>
              <span>Paste it here and click Save.</span>
            </li>
            <li className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-rose-bloom/10 text-rose-bloom flex items-center justify-center shrink-0">3</span>
              <span>Students will now pay you 100% of the booking fee directly to your account.</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
