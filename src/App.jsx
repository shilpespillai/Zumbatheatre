import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Ticket, Menu, X, Play, Zap, Star, ShieldCheck, Instagram, Twitter, Facebook, User, Mail, Lock, ArrowRight, LogOut, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import Auth from './pages/Auth';
import TeacherDashboard from './pages/teacher/Dashboard';
import Routines from './pages/teacher/Routines';
import TeacherCalendar from './pages/teacher/Calendar';
import TeacherReports from './pages/teacher/Reports';
import TeacherSubscription from './pages/teacher/Subscription';
import StudentDashboard from './pages/student/Dashboard';
import StudentBrowse from './pages/student/Browse';
import StudentBooking from './pages/student/Booking';
import MyBookings from './pages/student/MyBookings';
import AdminDashboard from './pages/admin/Dashboard';
import AdminAuth from './pages/admin/Auth';
import Settings from './pages/Settings';
import Onboarding from './pages/Onboarding';
import HowItWorks from './pages/HowItWorks';
import Contact from './pages/Contact';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, profile, signOut } = useAuth();
  
  // Also check for guest session
  const guestSession = JSON.parse(localStorage.getItem('zumba_guest_session') || 'null');
  const isGuest = !!guestSession;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className="fixed w-full z-50 p-6 font-sans transition-all duration-300">
      <div className={`w-full flex justify-between items-center transition-all duration-500 ${
        scrolled 
          ? 'bg-zumba-dark/80 backdrop-blur-2xl border border-white/10 px-12 py-4 rounded-[2.5rem] shadow-2xl' 
          : 'bg-transparent border-transparent px-12 py-4 rounded-[2.5rem]'
      }`}>
        <a href="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="w-10 h-10 bg-zumba-pink rounded-xl flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform duration-300">
            <Play className="w-6 h-6 text-white fill-current" />
          </div>
          <span className="text-2xl font-black tracking-tighter text-white">ZUMBA<span className="text-zumba-lime text-lg">THEATRE</span></span>
        </a>

        <div className="hidden md:flex items-center gap-10">
          {(user || isGuest) && (
            <div className="flex items-center gap-4">
              <a 
                href={user && profile?.role?.toUpperCase() === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard'}
                className="btn-premium bg-zumba-lime text-black flex items-center gap-2 hover:bg-zumba-lime/80"
              >
                {user && profile?.role?.toUpperCase() === 'TEACHER' ? 'Instructor Portal' : 'My Stage'}
              </a>
              <button 
                onClick={() => {
                  if (isGuest) {
                    localStorage.removeItem('zumba_guest_session');
                    window.location.href = '/';
                  } else {
                    signOut();
                  }
                }}
                className="p-4 bg-white/5 border border-white/10 text-white hover:bg-zumba-pink transition-all rounded-2xl group"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          )}
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
            className="md:hidden mt-4 bg-zumba-dark/90 backdrop-blur-2xl border border-white/10 p-8 rounded-[2rem] flex flex-col gap-6"
          >
            {(user || isGuest) && (
              <button 
                onClick={() => {
                  if (isGuest) {
                    localStorage.removeItem('zumba_guest_session');
                    window.location.href = '/';
                  } else {
                    signOut();
                  }
                }} 
                className="btn-premium bg-white/10 text-white w-full text-center"
              >
                Sign Out
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Home = () => {
  const { user, profile } = useAuth();
  const guestSession = JSON.parse(localStorage.getItem('zumba_guest_session') || 'null');
  const isGuest = !!guestSession;

  return (
    <div className="min-h-screen bg-zumba-dark text-white">
      <Navbar />
      <section className="relative min-h-screen flex items-stretch overflow-hidden w-full p-0">
        {/* Background Orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-zumba-pink/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-zumba-lime/10 rounded-full blur-[100px] animate-pulse delay-1000" />

        <div className="w-full h-full flex flex-col lg:flex-row items-stretch">
          {/* Content Side */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="w-full lg:w-1/2 flex flex-col justify-center px-[8vw] relative z-20 py-32"
          >
            <div className="w-full">
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-8 text-white w-fit">
                <Zap className="w-4 h-4 text-zumba-lime" />
                <span className="text-xs font-bold uppercase tracking-widest text-zumba-lime">The 2026 World Tour is Here</span>
              </div>
              <h1 className="text-7xl sm:text-8xl xl:text-[12rem] font-black mb-10 leading-[0.8] tracking-tighter text-white">
                DITCH THE <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-zumba-pink via-zumba-lime to-zumba-cyan cursor-default hover:opacity-80 transition-opacity">WORKOUT.</span>
              </h1>
              <p className="text-2xl sm:text-4xl text-white/60 font-medium mb-16 leading-tight max-w-4xl">
                Experience the rhythmic energy of Zumba. The ultimate dance-fitness platform for instructors to lead and students to thrive.
              </p>
              <div className="flex flex-wrap items-center gap-10">
                <a href="/auth" className="btn-premium bg-zumba-lime text-black flex items-center gap-5 hover:bg-zumba-lime/80 shadow-2xl shadow-zumba-lime/20 py-10 px-16 text-3xl font-black">
                  Theatre Entrance <ArrowRight className="w-10 h-10" />
                </a>
                <a href="/contact" className="text-lg font-black uppercase tracking-[0.5em] text-white/20 hover:text-zumba-pink transition-colors">
                  Contact Support
                </a>
              </div>
            </div>
          </motion.div>

          {/* Truly Edge-to-Edge Image Side */}
          <motion.div 
            initial={{ opacity: 0, x: 100 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="w-full lg:w-1/2 relative hidden lg:block min-h-screen"
          >
            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="absolute inset-y-0 left-0 w-64 bg-gradient-to-r from-zumba-dark to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-zumba-dark to-transparent" />
            </div>
            <div className="h-full w-full overflow-hidden relative group">
              <img 
                src="/hero-dancer.png" 
                alt="Zumba Dancer" 
                className="w-full h-full object-cover object-center grayscale brightness-90 contrast-125 group-hover:scale-105 transition-transform duration-[4000ms] ease-out" 
              />
              <div className="absolute inset-0 bg-zumba-pink/5 mix-blend-overlay group-hover:opacity-0 transition-opacity duration-1500" />
              {/* Decorative Spotlight Glow */}
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-white/5 blur-[120px] rounded-full" />
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="py-20 px-6 border-t border-white/5 bg-[#0A0A0A] text-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex items-center gap-2">
            <Play className="w-8 h-8 text-zumba-lime fill-current" />
            <span className="text-xl font-black tracking-tighter">ZUMBA THEATRE</span>
          </div>
          <div className="flex flex-wrap items-center gap-10">
            <a href="/how-it-works" className="text-sm font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">How it Works</a>
            <a href="/contact" className="text-sm font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">Contact</a>
            <div className="flex gap-10">
              <Instagram className="text-white/40 hover:text-zumba-pink cursor-pointer" />
              <Twitter className="text-white/40 hover:text-zumba-cyan cursor-pointer" />
              <Facebook className="text-white/40 hover:text-zumba-lime cursor-pointer" />
            </div>
          </div>
          <p className="text-xs font-bold text-white/20 tracking-[0.2em]">© 2026 ZUMBA THEATRE WORLDWIDE</p>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/admin/auth" element={<AdminAuth />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/onboarding" element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        } />
        
        {/* Protected Teacher Routes */}
        <Route path="/teacher/dashboard" element={
          <ProtectedRoute allowedRoles={['TEACHER']}>
            <TeacherDashboard />
          </ProtectedRoute>
        } />
        <Route path="/teacher/routines" element={
          <ProtectedRoute allowedRoles={['TEACHER']}>
            <Routines />
          </ProtectedRoute>
        } />
        <Route path="/teacher/calendar" element={<Navigate to="/teacher/dashboard" replace />} />
        <Route path="/teacher/reports" element={
          <ProtectedRoute allowedRoles={['TEACHER']}>
            <TeacherReports />
          </ProtectedRoute>
        } />
        <Route path="/teacher/settings" element={
          <ProtectedRoute allowedRoles={['TEACHER']}>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="/teacher/subscription" element={
          <ProtectedRoute allowedRoles={['TEACHER']}>
            <TeacherSubscription />
          </ProtectedRoute>
        } />

        {/* Protected Student Routes */}
        <Route path="/student/dashboard" element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <StudentDashboard />
          </ProtectedRoute>
        } />
        <Route path="/student/browse" element={<Navigate to="/student/dashboard" replace />} />
        <Route path="/student/book/:teacherId" element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <StudentBooking />
          </ProtectedRoute>
        } />
        <Route path="/student/bookings" element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <MyBookings />
          </ProtectedRoute>
        } />
        <Route path="/student/settings" element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <Settings />
          </ProtectedRoute>
        } />

        {/* Protected Admin Routes */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
