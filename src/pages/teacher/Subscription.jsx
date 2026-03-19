import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, ArrowLeft, CreditCard, CheckCircle2, 
  Sparkles, Zap, Trophy, Heart
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { getStripe, createCheckoutSession } from '../../api/stripeService';
import { getSystemConfig } from '../../api/systemConfig';

export default function TeacherSubscription() {
  const { profile, isDevBypass, fetchProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState(49);

  useEffect(() => {
    fetchPrice();
  }, []);

  const fetchPrice = async () => {
    const config = await getSystemConfig();
    if (config?.subscription_price) {
      setPrice(config.subscription_price);
    }
  };

  const plan = {
    name: 'Master Stage Pro',
    price: price,
    features: [
      'Unlimited Student Bookings',
      'Choose your own Payment System',
      'Advanced Analytics & Reports',
      'Custom Routine Templates',
      'Priority Stage Support'
    ]
  };

  const handleSubscribe = async () => {
    setLoading(true);
    toast.loading('Preparing your secure stage activation...');

    try {
      if (isDevBypass) {
        // Simulate owner payment
        await createCheckoutSession([{ id: 'platform_sub' }], { isMock: true });
        
        const mockProfile = JSON.parse(localStorage.getItem('zumba_mock_profile') || '{}');
        mockProfile.is_subscribed = true;
        localStorage.setItem('zumba_mock_profile', JSON.stringify(mockProfile));
        
        const savedProfiles = JSON.parse(localStorage.getItem('zumba_mock_profiles') || '{}');
        if (savedProfiles[profile.id]) {
          savedProfiles[profile.id].is_subscribed = true;
          localStorage.setItem('zumba_mock_profiles', JSON.stringify(savedProfiles));
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
        toast.success('Stage Activated! Welcome to Pro.');
        await fetchProfile();
        navigate('/teacher/dashboard');
        return;
      }

      // Real Implementation
      const stripe = await getStripe(); // Uses Owner's Public Key from ENV
      const session = await createCheckoutSession([{ name: plan.name, price: plan.price }], { isSubscription: true });
      await stripe.redirectToCheckout({ sessionId: session.id });

    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('Failed to initiate subscription.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bloom-white text-theatre-dark p-6 sm:p-10">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-theatre-dark/40 hover:text-rose-bloom transition-colors mb-12"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Workspace
        </button>

        <div className="text-center mb-16">
          <div className="inline-block p-4 bg-rose-bloom/10 rounded-3xl mb-6">
            <Sparkles className="w-8 h-8 text-rose-bloom" />
          </div>
          <h1 className="text-5xl font-black mb-4 tracking-tight italic">Activate Your Stage</h1>
          <p className="text-theatre-dark/40 font-bold uppercase tracking-[0.2em] text-xs">Unlock your full potential as a Zumba Theatre® Instructor</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <h2 className="text-2xl font-black tracking-tight mb-8">What's included in Pro?</h2>
            {plan.features.map((feature, i) => (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                key={i} 
                className="flex items-start gap-4"
              >
                <div className="p-1 bg-emerald-500/10 rounded-full mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="font-bold text-theatre-dark/70 text-sm">{feature}</span>
              </motion.div>
            ))}
            
            <div className="pt-8 flex gap-6">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-white rounded-2xl border border-apricot/20 flex items-center justify-center shadow-sm">
                  <Zap className="w-5 h-5 text-rose-bloom" />
                </div>
                <span className="text-[8px] font-black uppercase text-theatre-dark/30">Fast Payouts</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-white rounded-2xl border border-apricot/20 flex items-center justify-center shadow-sm">
                  <Trophy className="w-5 h-5 text-rose-bloom" />
                </div>
                <span className="text-[8px] font-black uppercase text-theatre-dark/30">Pro Status</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-white rounded-2xl border border-apricot/20 flex items-center justify-center shadow-sm">
                  <Heart className="w-5 h-5 text-rose-bloom" />
                </div>
                <span className="text-[8px] font-black uppercase text-theatre-dark/30">Unlimited Classes</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3.5rem] border border-apricot/40 shadow-2xl shadow-rose-bloom/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <CreditCard className="w-32 h-32" />
            </div>

            <div className="mb-10">
              <span className="px-4 py-1.5 bg-rose-bloom/10 text-rose-bloom rounded-full text-[10px] font-black uppercase tracking-widest leading-none">Best Value</span>
              <h3 className="text-3xl font-black mt-4">{plan.name}</h3>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-5xl font-black text-theatre-dark tracking-tighter">${plan.price}</span>
                <span className="text-sm font-bold text-theatre-dark/40">/ month</span>
              </div>
            </div>

            <div className="space-y-6 pt-10 border-t border-apricot/20">
              <button
                onClick={handleSubscribe}
                disabled={loading || profile?.is_subscribed}
                className={`w-full py-6 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl transition-all ${
                  profile?.is_subscribed 
                  ? 'bg-emerald-500 text-white cursor-default' 
                  : 'bg-theatre-dark text-white hover:bg-rose-bloom shadow-theatre-dark/20'
                }`}
              >
                {loading ? <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : 
                 profile?.is_subscribed ? <CheckCircle2 className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                {profile?.is_subscribed ? 'Active Subscription' : 'Activate Pro Stage'}
              </button>
              <p className="text-center text-[10px] font-bold text-theatre-dark/30 uppercase tracking-widest">Secure Stripe Checkout</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
