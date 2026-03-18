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
    <nav className="fixed w-full z-50 px-6 py-4 lg:py-6 font-sans transition-all duration-300">
      <div className={`max-w-7xl mx-auto flex justify-between items-center transition-all duration-500 ${
        scrolled 
          ? 'bg-zumba-dark/80 backdrop-blur-2xl border border-white/10 px-8 py-4 rounded-[2rem] shadow-2xl' 
          : 'bg-transparent border-transparent px-8 py-4 rounded-[2rem]'
      }`}>
        <a href="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="w-10 h-10 bg-zumba-pink rounded-xl flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform duration-300">
            <Play className="w-6 h-6 text-white fill-current" />
          </div>
          <span className="text-2xl font-black tracking-tighter text-white">ZUMBA<span className="text-zumba-lime text-lg">THEATRE</span></span>
        </a>

        <div className="hidden md:flex items-center gap-10">
          {['How it Works', 'Contact'].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`} className="text-sm font-bold uppercase tracking-widest text-white/70 hover:text-white transition-colors">{item}</a>
          ))}
          
          {(user || isGuest) ? (
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
          ) : (
            <a href="/auth" className="btn-premium bg-zumba-pink text-white flex items-center gap-2 hover:bg-zumba-pink/80 group text-sm">
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Theatre Entrance
            </a>
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
            {['How it Works', 'Contact'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`} className="text-lg font-black uppercase tracking-widest text-white/70" onClick={() => setIsOpen(false)}>{item}</a>
            ))}
            {(user || isGuest) ? (
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
            ) : (
              <a href="/auth" className="btn-premium bg-zumba-pink text-white w-full text-center">Theatre Entrance</a>
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
      <section className="relative min-h-screen flex items-center justify-center pt-24 pb-20 px-6 overflow-hidden">
        {/* Background Orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-zumba-pink/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-zumba-lime/10 rounded-full blur-[100px] animate-pulse delay-1000" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }}>
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-6 text-white">
              <Zap className="w-4 h-4 text-zumba-lime" />
              <span className="text-xs font-bold uppercase tracking-widest text-zumba-lime">The 2026 World Tour is Here</span>
            </div>
            <h1 className="text-7xl sm:text-8xl lg:text-9xl font-black mb-8 leading-[0.9] tracking-tighter text-white">
              DITCH THE <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-zumba-pink via-zumba-lime to-zumba-cyan cursor-default hover:opacity-80 transition-opacity">WORKOUT.</span>
            </h1>
            <p className="text-xl text-white/60 font-medium max-w-lg mb-12 leading-relaxed">
              Experience the rhythmic energy of Zumba. The ultimate dance-fitness platform for instructors to lead and students to thrive.
            </p>

          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="relative">
            <div className="aspect-square rounded-[3rem] overflow-hidden border-4 border-white/10 group">
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent z-10" />
              <img src="https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=2069&auto=format&fit=crop" alt="Theatre" className="w-full h-full object-cover grayscale brightness-75 group-hover:scale-110 transition-transform duration-700" />
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
          <div className="flex gap-10">
            <Instagram className="text-white/40 hover:text-zumba-pink cursor-pointer" />
            <Twitter className="text-white/40 hover:text-zumba-cyan cursor-pointer" />
            <Facebook className="text-white/40 hover:text-zumba-lime cursor-pointer" />
          </div>
          <p className="text-sm font-bold text-white/30 tracking-[0.2em]">© 2026 ZUMBA THEATRE WORLDWIDE</p>
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
