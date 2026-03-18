import React from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, MessageCircle, MapPin, 
  ArrowLeft, Send, ShieldCheck, 
  Sparkles, Play, Globe
} from 'lucide-react';

export default function Contact() {
  const email = "aihealthtec@gmail.com";

  return (
    <div className="min-h-screen bg-zumba-dark text-white font-sans overflow-hidden">
      {/* Background Orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-zumba-pink/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-zumba-lime/10 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 lg:py-20">
        <motion.a 
          href="/" 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zumba-lime hover:text-white transition-colors mb-16 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl backdrop-blur-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Theatre
        </motion.a>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="inline-flex items-center gap-2 bg-zumba-pink/10 border border-zumba-pink/20 px-4 py-2 rounded-full mb-8">
              <Sparkles className="w-4 h-4 text-zumba-pink" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zumba-pink text-white">Direct Connect</span>
            </div>
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black mb-8 leading-[0.9] tracking-tighter">
              GET IN <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-zumba-pink via-zumba-lime to-zumba-cyan">TOUCH.</span>
            </h1>
            <p className="text-xl text-white/50 font-medium max-w-lg mb-12 leading-relaxed">
              Have questions about your stage, routines, or premium features? Our team is directly reachable for professional inquiries and support.
            </p>

            <div className="space-y-8">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shrink-0">
                  <Mail className="w-7 h-7 text-zumba-lime" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white/30 mb-2">Email Support</h4>
                  <a href={`mailto:${email}`} className="text-2xl font-black text-white hover:text-zumba-pink transition-colors break-all">
                    {email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shrink-0">
                  <Globe className="w-7 h-7 text-zumba-cyan" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white/30 mb-2">Global Presence</h4>
                  <p className="text-xl font-bold text-white/70">Remote-First · Global Reach</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 backdrop-blur-3xl p-12 lg:p-16 rounded-[4rem] border border-white/10 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Send className="w-32 h-32 text-zumba-lime rotate-12" />
            </div>

            <div className="relative z-10">
              <div className="w-20 h-20 bg-zumba-lime rounded-3xl flex items-center justify-center mb-10 rotate-12">
                <ShieldCheck className="w-10 h-10 text-black" />
              </div>
              
              <h2 className="text-3xl font-black text-white mb-6 uppercase tracking-tighter">Manual Contact Only</h2>
              <p className="text-lg text-white/50 font-medium leading-relaxed mb-10">
                To ensure maximum privacy and security for our instructors and students, we have removed all automated contact forms. 
              </p>
              
              <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem]">
                <p className="text-white/70 font-bold leading-relaxed italic">
                  "Please copy the email address provided and send your inquiry directly from your personal or professional email account. We typically respond within 24 hours."
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <footer className="mt-20 py-12 border-t border-white/5 text-center">
        <p className="text-white/20 font-bold uppercase tracking-[0.3em] text-[10px]">© 2026 ZUMBA THEATRE WORLDWIDE</p>
      </footer>
    </div>
  );
}
