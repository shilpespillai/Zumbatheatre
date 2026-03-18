import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { 
  TrendingUp, TrendingDown, Users, DollarSign, 
  Calendar, PieChart, BarChart3, ChevronLeft, Download, Filter,
  Sparkles, ArrowUpRight, Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, isSameDay } from 'date-fns';

export default function TeacherReports() {
  const { user, profile, isDevBypass } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    totalRevenue: 0,
    totalBookings: 0,
    occupanyRate: 0,
    activeRoutines: 0,
    revenueTrend: [],
    popularRoutines: []
  });

  useEffect(() => {
    if (user) fetchReportData();
  }, [user]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      let routines, schedules, payments, bookings;

      if (isDevBypass) {
        routines = JSON.parse(localStorage.getItem('zumba_mock_routines') || '[]')
          .filter(r => String(r.teacher_id).trim() === String(user.id).trim());
        
        schedules = JSON.parse(localStorage.getItem('zumba_mock_schedules') || '[]')
          .filter(s => String(s.teacher_id).trim() === String(user.id).trim());
        
        bookings = JSON.parse(localStorage.getItem('zumba_mock_bookings') || '[]');
        
        const scheduleIds = schedules.map(s => s.id);
        const filteredBookings = bookings.filter(b => scheduleIds.includes(b.schedule_id));
        
        // In mock mode, we might not have a separate payments table, so we infer from PAID bookings
        payments = filteredBookings
          .filter(b => b.payment_status === 'PAID')
          .map(b => ({
            id: 'mock-p' + b.id,
            amount: b.amount || 15,
            created_at: b.created_at || new Date().toISOString(),
            bookings: { schedule_id: b.schedule_id, student_id: b.student_id }
          }));
      } else {
        // 1. Fetch all routines by this teacher
        const { data: routinesData } = await supabase
          .from('routines')
          .select('id, name')
          .eq('teacher_id', user.id);
        routines = routinesData || [];

        // 2. Fetch all schedules by this teacher
        const { data: schedulesData } = await supabase
          .from('schedules')
          .select('id, routine_id, start_time, price, seats_taken, max_seats')
          .eq('teacher_id', user.id);
        schedules = schedulesData || [];

        // 3. Fetch all payments via bookings
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('*, bookings!inner(schedule_id, student_id)')
          .in('bookings.schedule_id', schedules.map(s => s.id));
        payments = paymentsData || [];
      }

      // Calculate Metrics
      const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalBookings = payments.length;
      
      const totalCapacity = schedules.reduce((sum, s) => sum + (s.max_seats || 20), 0);
      const totalSeatsTaken = schedules.reduce((sum, s) => sum + (s.seats_taken || 0), 0);
      const occupanyRate = totalCapacity > 0 ? Math.round((totalSeatsTaken / totalCapacity) * 100) : 0;

      // Group Revenue by Date (last 14 days)
      const last14Days = eachDayOfInterval({
        start: subDays(new Date(), 13),
        end: new Date()
      });

      const revenueTrend = last14Days.map(date => {
        const dayRevenue = payments
          .filter(p => isSameDay(new Date(p.created_at), date))
          .reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          date: format(date, 'MMM d'),
          amount: dayRevenue
        };
      });

      // Popular Routines
      const routineStats = routines.map(r => {
        const routineSchedules = schedules.filter(s => s.routine_id === r.id);
        const scheduleIds = routineSchedules.map(s => s.id);
        const routinePayments = payments.filter(p => scheduleIds.includes(p.bookings.schedule_id));
        const routineRevenue = routinePayments.reduce((sum, p) => sum + Number(p.amount), 0);
        
        return {
          name: r.name,
          bookings: routinePayments.length,
          revenue: routineRevenue,
          performance: routinePayments.length > 0 ? Math.min(100, Math.round((routinePayments.length / 50) * 100)) : 0
        };
      }).sort((a, b) => b.bookings - a.bookings).slice(0, 5);

      setReportData({
        totalRevenue,
        totalBookings,
        occupanyRate,
        activeRoutines: routines.length,
        revenueTrend,
        popularRoutines: routineStats
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartMax = useMemo(() => {
    const max = Math.max(...reportData.revenueTrend.map(d => d.amount), 10);
    return Math.ceil(max / 10) * 10;
  }, [reportData.revenueTrend]);

  return (
    <div className="min-h-screen bg-bloom-white text-[#4A3B3E] p-6 sm:p-10 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-rose-bloom blur-[150px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-lavender blur-[150px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {!profile?.is_subscribed && (
          <div className="absolute inset-x-[-2rem] inset-y-[-2rem] z-[80] flex items-center justify-center rounded-[4rem] overflow-hidden">
             <div className="absolute inset-0 bg-bloom-white/40 backdrop-blur-md" />
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="relative z-10 bg-white p-12 rounded-[3.5rem] border border-apricot/40 shadow-2xl text-center max-w-sm"
             >
                <div className="w-16 h-16 bg-rose-bloom/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <TrendingUp className="w-8 h-8 text-rose-bloom" />
                </div>
                <h2 className="text-3xl font-black text-theatre-dark mb-3 italic">Growth Energy Locked</h2>
                <p className="text-xs text-theatre-dark/40 font-bold uppercase tracking-widest leading-loose mb-10">
                  Detailed analytics and revenue reports are reserved for our Premium Stage Instructors.
                </p>
                <a 
                  href="/teacher/subscription"
                  className="w-full btn-premium bg-theatre-dark text-white flex items-center justify-center gap-3 hover:bg-rose-bloom shadow-xl shadow-theatre-dark/20"
                >
                  Activate Premium <ArrowRight className="w-4 h-4" />
                </a>
                <p className="mt-6 text-[10px] font-black text-rose-bloom/40 uppercase tracking-[0.2em] italic">Only $10 / Month</p>
             </motion.div>
          </div>
        )}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-16">
          <div className="flex items-center gap-6">
             <a href="/teacher/dashboard" className="p-4 bg-white rounded-2xl border border-theatre-dark/15 hover:bg-rose-petal/5 transition-all shadow-sm">
               <ChevronLeft className="w-6 h-6 text-rose-bloom" />
             </a>
             <div>
              <h1 className="text-4xl font-black text-theatre-dark mb-1">Performance Theatre.</h1>
              <p className="text-rose-bloom/40 font-bold tracking-tight uppercase tracking-[0.2em] text-[10px]">Financials & Engagement Analytics</p>
            </div>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none px-6 py-4 bg-white rounded-2xl border border-theatre-dark/15 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-rose-petal/5 transition-all shadow-sm">
              <Download className="w-4 h-4 text-rose-bloom" /> Export Data
            </button>
            <div className="bg-gradient-to-r from-rose-bloom to-rose-petal p-0.5 rounded-2xl shadow-lg shadow-rose-bloom/20">
               <button className="px-6 py-3.5 bg-white rounded-[0.9rem] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3">
                 <Filter className="w-4 h-4 text-rose-bloom" /> Last 14 Days
               </button>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-32">
             <div className="w-12 h-12 border-4 border-rose-bloom/20 border-t-rose-bloom rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
              {[
                { label: 'Theatre Revenue', value: `$${reportData.totalRevenue}`, icon: DollarSign, color: 'text-rose-bloom' },
                { label: 'Total Energy', value: reportData.totalBookings, icon: Users, color: 'text-rose-bloom' },
                { label: 'Stage Occupancy', value: `${reportData.occupanyRate}%`, icon: Activity, color: 'text-rose-bloom' },
                { label: 'Routines Active', value: reportData.activeRoutines, icon: Sparkles, color: 'text-rose-bloom' },
              ].map((stat, i) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="bg-white/70 backdrop-blur-3xl p-8 rounded-[3rem] border border-theatre-dark/20 shadow-xl shadow-rose-bloom/5 relative overflow-hidden group"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-rose-petal/10 rounded-2xl">
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <div className="text-[10px] font-black text-rose-bloom flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3" /> Live
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-[#4A3B3E]/40 uppercase tracking-widest mb-1">{stat.label}</div>
                    <div className="text-4xl font-black text-theatre-dark">{stat.value}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Main Chart Card */}
              <div className="lg:col-span-2 bg-white/70 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-theatre-dark/20 shadow-2xl shadow-rose-bloom/5 min-h-[500px] relative overflow-hidden">
                <div className="flex justify-between items-center mb-16">
                   <div>
                      <h3 className="text-2xl font-black text-theatre-dark mb-1">Rhythm Trends</h3>
                      <p className="text-[10px] font-black text-[#4A3B3E]/40 uppercase tracking-widest">Revenue performance across the stage</p>
                   </div>
                   <div className="flex gap-2">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-rose-bloom">
                        <div className="w-2 h-2 rounded-full bg-rose-bloom" /> Revenue
                      </div>
                   </div>
                </div>
                
                {/* Custom SVG Chart */}
                <div className="h-64 flex items-end justify-between gap-1 mt-12 px-2 relative">
                   {/* Grid Lines */}
                   <div className="absolute inset-x-0 bottom-0 h-full flex flex-col justify-between pointer-events-none opacity-5">
                      {[1,2,3,4].map(i => <div key={i} className="border-t border-theatre-dark w-full" />)}
                   </div>

                   {reportData.revenueTrend.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${(d.amount / chartMax) * 100}%` }}
                          transition={{ delay: 0.3 + (i * 0.05), duration: 0.8 }}
                          className="w-full max-w-[20px] bg-gradient-to-t from-rose-bloom to-rose-petal rounded-t-full relative"
                        >
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-theatre-dark text-white text-[9px] font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl">
                            ${d.amount}
                          </div>
                        </motion.div>
                        <div className="text-[8px] font-black text-theatre-dark/20 uppercase mt-4 absolute -bottom-8">
                          {d.date}
                        </div>
                      </div>
                   ))}
                </div>
              </div>

              {/* Routine Performance */}
              <div className="bg-white/70 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-theatre-dark/20 shadow-2xl shadow-rose-bloom/5">
                <div className="flex justify-between items-center mb-12">
                  <h3 className="text-2xl font-black text-theatre-dark">Top Routines</h3>
                  <div className="p-3 bg-rose-petal/10 rounded-xl">
                    <PieChart className="w-5 h-5 text-rose-bloom" />
                  </div>
                </div>

                <div className="space-y-8">
                  {reportData.popularRoutines.length === 0 ? (
                    <div className="py-20 text-center opacity-20">
                      <Activity className="w-12 h-12 mx-auto mb-4" />
                      <p className="font-bold text-sm uppercase tracking-widest">No routines recorded</p>
                    </div>
                  ) : reportData.popularRoutines.map((routine, i) => (
                    <div key={i} className="space-y-4">
                       <div className="flex justify-between items-end">
                          <div>
                            <span className="text-sm font-black text-theatre-dark block mb-1">{routine.name}</span>
                            <span className="text-[10px] font-bold text-[#4A3B3E]/40 uppercase tracking-widest">{routine.bookings} DANCERS</span>
                          </div>
                          <span className="font-black text-rose-bloom text-sm">${routine.revenue}</span>
                       </div>
                       <div className="h-2 bg-rose-petal/10 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${routine.performance}%` }}
                            transition={{ delay: 0.5 + (i * 0.1), duration: 1 }}
                            className="h-full bg-gradient-to-r from-rose-bloom to-rose-petal"
                          />
                       </div>
                    </div>
                  ))}
                </div>

                <div className="mt-16 p-8 bg-gradient-to-br from-rose-bloom/5 to-rose-petal/5 rounded-[2.5rem] border border-theatre-dark/15">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-rose-bloom text-white rounded-xl flex items-center justify-center">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#4A3B3E]/60">Stage Strategy</div>
                    </div>
                    <p className="text-xs font-bold text-[#4A3B3E]/50 leading-relaxed uppercase tracking-widest">
                      {reportData.occupanyRate > 70 
                        ? "Peak occupancy reached. Consider elite scheduling." 
                        : "Focus on routine naming and visuals to boost energy."}
                    </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
