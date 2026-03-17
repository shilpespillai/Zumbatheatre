import React, { useState } from 'react';
import { Ticket, Menu, X, Play, Zap, Star, ShieldCheck, Instagram, Twitter, Facebook } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed w-full z-50 px-6 py-6">
      <div className="max-w-7xl mx-auto flex justify-between items-center glass px-8 py-4 rounded-[2rem]">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="w-10 h-10 bg-zumba-pink rounded-xl flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform duration-300">
            <Play className="w-6 h-6 text-white fill-current" />
          </div>
          <span className="text-2xl font-black tracking-tighter">ZUMBA<span className="text-zumba-lime text-lg">THEATRE</span></span>
        </div>

        <div className="hidden md:flex items-center gap-10">
          {['Productions', 'Academy', 'Schedule', 'Contact'].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-bold uppercase tracking-widest text-white/70 hover:text-white transition-colors">{item}</a>
          ))}
          <button className="btn-premium bg-zumba-pink text-white flex items-center gap-2 hover:bg-zumba-pink/80 group">
            <Ticket className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            Book Tickets
          </button>
        </div>

        <button className="md:hidden text-zumba-lime" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden mt-4 glass p-8 rounded-[2rem] flex flex-col gap-6"
          >
            {['Productions', 'Academy', 'Schedule', 'Contact'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-lg font-black uppercase tracking-widest text-white/70" onClick={() => setIsOpen(false)}>{item}</a>
            ))}
            <button className="btn-premium bg-zumba-pink text-white w-full">Book Tickets</button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-24 pb-20 px-6 overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-zumba-pink/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-zumba-lime/10 rounded-full blur-[100px] animate-pulse delay-1000" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-6">
            <Zap className="w-4 h-4 text-zumba-lime" />
            <span className="text-xs font-bold uppercase tracking-widest text-zumba-lime">The 2026 World Tour is Here</span>
          </div>
          <h1 className="text-7xl sm:text-8xl lg:text-9xl font-black mb-8 leading-[0.9] tracking-tighter">
            FEEL THE <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-zumba-pink via-zumba-lime to-zumba-cyan cursor-default hover:opacity-80 transition-opacity">ENERGY.</span>
          </h1>
          <p className="text-xl text-white/60 font-medium max-w-lg mb-12 leading-relaxed">
            Experience the world's most immersive theatre-dance hybrid. A fusion of cinematic storytelling and high-intensity motion.
          </p>
          <div className="flex flex-col sm:flex-row gap-6">
            <button className="btn-premium bg-white text-black hover:bg-slate-200 shadow-[0_0_30px_rgba(255,255,255,0.2)]">Explore Shows</button>
            <button className="btn-premium border border-white/20 text-white hover:bg-white/5">Watch Trailer</button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="relative"
        >
          <div className="aspect-square rounded-[3rem] overflow-hidden border-4 border-white/10 group">
             <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent z-10" />
             <img 
              src="https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=2069&auto=format&fit=crop" 
              alt="Theatre Performance" 
              className="w-full h-full object-cover grayscale brightness-75 group-hover:scale-110 transition-transform duration-700"
             />
             <div className="absolute bottom-10 left-10 z-20">
               <div className="flex items-center gap-4">
                 <div className="flex -space-x-3">
                   {[1,2,3].map(i => (
                     <div key={i} className="w-10 h-10 rounded-full border-2 border-zumba-dark bg-slate-800" />
                   ))}
                 </div>
                 <div className="text-sm font-bold">
                    <span className="text-zumba-lime">500k+</span> Tickets Sold
                 </div>
               </div>
             </div>
          </div>
          
          {/* Floating Card */}
          <div className="absolute -top-10 -right-10 glass p-6 rounded-3xl theatre-reveal hidden sm:block">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-zumba-cyan/20 rounded-xl flex items-center justify-center">
                 <Star className="text-zumba-cyan fill-current" />
               </div>
               <div>
                  <div className="text-xs font-bold text-white/50 uppercase tracking-widest">Next Show</div>
                  <div className="text-lg font-black">Summer Gala</div>
               </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default function App() {
  return (
    <div className="min-h-screen selection:bg-zumba-lime selection:text-black">
      <Navbar />
      <main>
        <Hero />
        
        {/* Features Section */}
        <section className="py-24 px-6 bg-white/5 border-y border-white/5">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { icon: ShieldCheck, title: "Official Certification", desc: "World-class instructors certified across 5 continents." },
              { icon: Zap, title: "Infinite Energy", desc: "Unique choreography designed to push your athletic boundaries." },
              { icon: Star, title: "Premium Venues", desc: "Performances hosted in the world's most prestigious theaters." }
            ].map((feature, i) => (
              <div key={i} className="group p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 hover:border-zumba-lime/30 transition-all duration-500">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                  <feature.icon className="w-8 h-8 text-zumba-lime" />
                </div>
                <h3 className="text-2xl font-black mb-4">{feature.title}</h3>
                <p className="text-white/50 font-medium leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zumba-lime rounded-lg flex items-center justify-center rotate-12">
              <Play className="w-4 h-4 text-black fill-current" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase">ZUMBA THEATRE</span>
          </div>

          <div className="flex gap-10">
             <a href="#" className="p-3 bg-white/5 rounded-full hover:text-zumba-pink transition-colors"><Instagram /></a>
             <a href="#" className="p-3 bg-white/5 rounded-full hover:text-zumba-cyan transition-colors"><Twitter /></a>
             <a href="#" className="p-3 bg-white/5 rounded-full hover:text-zumba-lime transition-colors"><Facebook /></a>
          </div>

          <p className="text-sm font-bold text-white/30 uppercase tracking-[0.2em]">© 2026 ZUMBA THEATRE WORLDWIDE</p>
        </div>
      </footer>
    </div>
  );
}
