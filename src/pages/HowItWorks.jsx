import React from 'react';
import { motion as Motion } from 'framer-motion';
import { 
  UserPlus, Calendar, CreditCard, Play, 
  MapPin, Sparkles, Zap, ShieldCheck, 
  ArrowRight, CheckCircle2, Star,
  TrendingUp, Users, Presentation
} from 'lucide-react';

const StepCard = ({ icon: IconComponent, title, description, color, delay }) => (
  <Motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.6 }}
    className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 relative group hover:border-white/20 transition-all"
  >
    <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
      <IconComponent className="w-8 h-8 text-white" />
    </div>
    <h3 className="text-2xl font-black text-white mb-4">{title}</h3>
    <p className="text-white/60 font-medium leading-relaxed">{description}</p>
  </Motion.div>
);

export default function HowItWorks() {
  const teacherSteps = [
    {
      icon: UserPlus,
      title: "Launch Your Stage",
      description: "Create your professional instructor account and set up your unique profile.",
      color: "bg-studio-pink",
      delay: 0.1
    },
    {
      icon: Presentation,
      title: "Design Rhythms",
      description: "Build your library of routines with durations, intensity levels, and descriptions.",
      color: "bg-studio-lime",
      delay: 0.2
    },
    {
      icon: Calendar,
      title: "Schedule Energy",
      description: "Post your sessions on the calendar. Manage bookings and see who's joining the party.",
      color: "bg-studio-cyan",
      delay: 0.3
    },
    {
      icon: TrendingUp,
      title: "Track Growth",
      description: "Upgrade to Premium for advanced analytics, revenue tracking, and student insights.",
      color: "bg-purple-500",
      delay: 0.4
    }
  ];

  const studentSteps = [
    {
      icon: Zap,
      title: "Instant Entrance",
      description: "No accounts needed. Just enter your instructor's Stage Code and dive right in.",
      color: "bg-studio-pink",
      delay: 0.1
    },
    {
      icon: Calendar,
      title: "Browse Calendar",
      description: "See exactly when your favorite instructor is leading their next high-energy session.",
      color: "bg-studio-lime",
      delay: 0.2
    },
    {
      icon: CreditCard,
      title: "Quick Booking",
      description: "Secure your spot in seconds. Pay directly or follow your instructor's payment guide.",
      color: "bg-studio-cyan",
      delay: 0.3
    },
    {
      icon: Play,
      title: "Start Dancing",
      description: "Access all the session details and get ready to burn calories and have fun!",
      color: "bg-orange-500",
      delay: 0.4
    }
  ];

  return (
    <div className="min-h-screen bg-studio-dark text-white font-sans overflow-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#FF007A33_0%,transparent_50%)]" />
        <div className="absolute top-1/2 right-0 w-[800px] h-[800px] bg-studio-lime/10 blur-[150px] rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-studio-cyan/10 blur-[120px] rounded-full -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative z-10">
        {/* Navigation Shorthand */}
        <nav className="p-8 max-w-7xl mx-auto flex justify-between items-center">
            <a href="/" className="flex items-center gap-2 group">
                <div className="w-10 h-10 bg-studio-pink rounded-xl flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
                    <Play className="w-6 h-6 text-white fill-current" />
                </div>
                <span className="text-xl font-black tracking-tighter">STUDIO<span className="text-studio-lime">THEATRE</span></span>
            </a>
            <a href="/auth" className="btn-premium bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all">Start Now</a>
        </nav>

        {/* Hero Section */}
        <section className="pt-20 pb-32 px-6 text-center max-w-4xl mx-auto">
          <Motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-8"
          >
            <Sparkles className="w-4 h-4 text-studio-lime" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-studio-lime">Platform Guide 2026</span>
          </Motion.div>
          <Motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-7xl sm:text-8xl font-black mb-8 leading-[0.9] tracking-tighter"
          >
            THE STAGE <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-studio-pink via-studio-lime to-studio-cyan">MECHANISM.</span>
          </Motion.h1>
          <Motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-white/50 font-medium max-w-2xl mx-auto leading-relaxed"
          >
            Whether you're leading the workout or burning the calories, we've designed everything to be seamless, energetic, and fun.
          </Motion.p>
        </section>

        {/* Instructor Path */}
        <section className="py-24 px-6 max-w-7xl mx-auto">
           <div className="flex flex-col lg:flex-row gap-20 items-center mb-20">
              <div className="flex-1 space-y-8">
                <div className="inline-flex items-center gap-3 bg-studio-pink/10 border border-studio-pink/20 px-6 py-2 rounded-full">
                    <Users className="w-5 h-5 text-studio-pink" />
                    <span className="text-sm font-black uppercase tracking-widest text-studio-pink">For Instructors</span>
                </div>
                <h2 className="text-5xl font-black leading-tight">Lead Your Community.<br/>Anywhere.</h2>
                <p className="text-lg text-white/60 leading-relaxed font-medium">
                  The Dance Studio platform provides you with the digital tools to grow your brand, manage your schedule, and track your revenue all in one vibrant command center.
                </p>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                {teacherSteps.map((step, i) => (
                  <StepCard key={i} {...step} />
                ))}
              </div>
           </div>
        </section>

        {/* Divider */}
        <div className="max-w-7xl mx-auto px-6">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Dancer Path */}
        <section className="py-32 px-6 max-w-7xl mx-auto">
           <div className="flex flex-col lg:flex-row-reverse gap-20 items-center">
              <div className="flex-1 space-y-8">
                <div className="inline-flex items-center gap-3 bg-studio-lime/10 border border-studio-lime/20 px-6 py-2 rounded-full">
                    <Star className="w-5 h-5 text-studio-lime" />
                    <span className="text-sm font-black uppercase tracking-widest text-studio-lime">For Dancers</span>
                </div>
                <h2 className="text-5xl font-black leading-tight">Enter the Vibe.<br/>No Friction.</h2>
                <p className="text-lg text-white/60 leading-relaxed font-medium">
                  Forgotten passwords are a thing of the past. Your Stage Code is your ticket to the party. Join instantly, book your spot, and start the fun.
                </p>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                {studentSteps.map((step, i) => (
                  <StepCard key={i} {...step} />
                ))}
              </div>
           </div>
        </section>

        {/* Call to Action */}
        <section className="py-40 px-6 text-center">
            <Motion.div 
               initial={{ opacity: 0, y: 50 }}
               whileInView={{ opacity: 1, y: 0 }}
               className="bg-gradient-to-br from-studio-pink/20 to-studio-cyan/20 backdrop-blur-3xl p-16 rounded-[4rem] border border-white/10 max-w-4xl mx-auto relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 p-8 opacity-20">
                    <Zap className="w-32 h-32 text-white rotate-12" />
                </div>
                <h3 className="text-4xl sm:text-5xl font-black mb-8 leading-tight">READY TO STEP <br/>ONTOTHE STAGE?</h3>
                <div className="flex flex-col sm:flex-row gap-6 justify-center">
                    <a href="/auth" className="btn-premium bg-white text-black text-lg py-5 px-10 rounded-2xl flex items-center gap-3 justify-center">
                        Lead as Instructor <ArrowRight className="w-5 h-5" />
                    </a>
                    <a href="/auth?role=student" className="btn-premium bg-studio-lime text-black text-lg py-5 px-10 rounded-2xl flex items-center gap-3 justify-center">
                        Join as Dancer <Star className="w-5 h-5" />
                    </a>
                </div>
            </Motion.div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-white/5 text-center">
             <p className="text-white/20 font-bold uppercase tracking-[0.3em] text-[10px]">© 2026 DANCE STUDIO WORLDWIDE</p>
        </footer>
      </div>
    </div>
  );
}
