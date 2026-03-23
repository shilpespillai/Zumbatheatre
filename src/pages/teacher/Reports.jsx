import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { 
  TrendingUp, TrendingDown, Users, DollarSign, 
  Calendar, PieChart, BarChart3, ChevronLeft, Download, Filter,
  Sparkles, ArrowUpRight, Activity, ArrowRight
} from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { format, subDays, eachDayOfInterval, isSameDay, subMonths, isSameMonth, parseISO } from 'date-fns';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart as RePieChart, Pie, Sector
} from 'recharts';

export default function TeacherReports() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    totalRevenue: 0,
    totalBookings: 0,
    occupanyRate: 0,
    activeRoutines: 0,
    revenueTrend: [],
    popularRoutines: [],
    peakHours: [],
    retentionRate: 0,
    avgRevenuePerStudent: 0,
    cancellationRate: 0,
    paymentMethodDistribution: [],
    historicalRevenue: [],
    audienceLoyalty: []
  });
  const [timeRange, setTimeRange] = useState('90days');

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      let routines, schedules, payments, bookings;

      // 1. Fetch Routines
      const { data: routinesData, error: routinesError } = await supabase
        .from('routines')
        .select('id, name')
        .eq('teacher_id', user.id);
      if (routinesError) throw routinesError;
      routines = routinesData || [];

      // 2. Fetch Schedules
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select('id, routine_id, start_time, price, seats_taken, max_seats, status')
        .eq('teacher_id', user.id);
      if (schedulesError) throw schedulesError;
      schedules = schedulesData || [];

      if (schedules.length === 0) {
        setReportData(prev => ({ ...prev, activeRoutines: routines.length }));
        setLoading(false);
        return;
      }

      const scheduleIds = schedules.map(s => s.id);

      // 3. Fetch Bookings for these schedules
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*, profiles(id, full_name)')
        .in('schedule_id', scheduleIds);
      if (bookingsError) throw bookingsError;
      bookings = bookingsData || [];

      // 4. Fetch Payments for these bookings
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*, bookings!inner(schedule_id, student_id)')
        .in('bookings.schedule_id', scheduleIds);
      if (paymentsError) throw paymentsError;
      payments = paymentsData || [];

      let startDate;
      const now = new Date();
      if (timeRange === '30days') startDate = subDays(now, 30);
      else if (timeRange === '90days') startDate = subDays(now, 90);
      else if (timeRange === 'year') startDate = subDays(now, 365);
      else if (timeRange === 'ytd') startDate = new Date(now.getFullYear(), 0, 1);
      else startDate = new Date(0); // All time

      const filteredPayments = payments.filter(p => new Date(p.created_at) >= startDate);
      const filteredBookings = bookings.filter(b => {
        const s = schedules.find(sch => sch.id === b.schedule_id);
        return s && new Date(s.start_time) >= startDate;
      });

      const totalRevenue = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalPaidBookings = filteredBookings.filter(b => b.payment_status === 'PAID' || b.payment_status === 'PENDING').length;
      
      const rangeSchedules = schedules.filter(s => new Date(s.start_time) >= startDate);
      const totalCapacity = rangeSchedules.reduce((sum, s) => sum + (s.max_seats || 20), 0);
      const totalSeatsTaken = rangeSchedules.reduce((sum, s) => sum + (s.seats_taken || 0), 0);
      const occupanyRate = totalCapacity > 0 ? Math.round((totalSeatsTaken / totalCapacity) * 100) : 0;

      const studentBookingCounts = {};
      filteredBookings.forEach(b => {
        const sId = b.student_id;
        studentBookingCounts[sId] = (studentBookingCounts[sId] || 0) + 1;
      });
      const uniqueStudentsCount = Object.keys(studentBookingCounts).length;
      const repeatStudentsCount = Object.values(studentBookingCounts).filter(count => count > 1).length;
      const retentionRate = uniqueStudentsCount > 0 ? Math.round((repeatStudentsCount / uniqueStudentsCount) * 100) : 0;
      const avgRevenuePerStudent = uniqueStudentsCount > 0 ? Math.round(totalRevenue / uniqueStudentsCount) : 0;

      const totalBookingAttempts = filteredBookings.length;
      const cancelledBookings = filteredBookings.filter(b => b.payment_status === 'CANCELLED' || b.payment_status === 'VOID').length;
      const cancellationRate = totalBookingAttempts > 0 ? Math.round((cancelledBookings / totalBookingAttempts) * 100) : 0;

      const methodCounts = { STRIPE: 0, MANUAL: 0, CREDITS: 0, PAYPAL: 0 };
      filteredBookings.forEach(b => {
        if (b.payment_method && methodCounts[b.payment_method] !== undefined) {
          methodCounts[b.payment_method]++;
        }
      });
      const paymentMethodDistribution = Object.entries(methodCounts).map(([name, value]) => ({ name, value }));

      const historyMonths = timeRange === 'year' || timeRange === 'all' || timeRange === 'ytd' ? 12 : 6;
      const lastXMonths = Array.from({ length: historyMonths }, (_, i) => subMonths(new Date(), i)).reverse();
      const historicalRevenue = lastXMonths.map(monthDate => {
        const monthRevenue = payments
          .filter(p => isSameMonth(new Date(p.created_at), monthDate))
          .reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          month: format(monthDate, 'MMM'),
          amount: monthRevenue
        };
      });

      const audienceLoyalty = [
        { name: 'Loyal Dancers', value: repeatStudentsCount },
        { name: 'New Talent', value: Math.max(0, uniqueStudentsCount - repeatStudentsCount) }
      ];

      // Dynamic Trend Density
      let trendDays = timeRange === '30days' ? 30 : timeRange === '90days' ? 90 : 180;
      if (timeRange === 'year' || timeRange === 'all' || timeRange === 'ytd') trendDays = 365;

      const trendInterval = eachDayOfInterval({
        start: subDays(new Date(), trendDays - 1),
        end: new Date()
      });

      const revenueTrend = (trendDays > 60 ? trendInterval.filter((_, i) => i % 5 === 0) : trendInterval).map(date => {
        const dayRevenue = payments
          .filter(p => isSameDay(new Date(p.created_at), date))
          .reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          date: format(date, 'MMM d'),
          amount: dayRevenue
        };
      });

      const routineStats = routines.map(r => {
        const routineSchedules = schedules.filter(s => s.routine_id === r.id && new Date(s.start_time) >= startDate);
        const routineSId = routineSchedules.map(s => s.id);
        const routinePayments = payments.filter(p => routineSId.includes(p.bookings.schedule_id));
        return {
          name: r.name,
          bookings: routinePayments.length,
          revenue: routinePayments.reduce((sum, p) => sum + Number(p.amount), 0),
          performance: routinePayments.length > 0 ? Math.min(100, Math.round((routinePayments.length / 50) * 100)) : 0
        };
      }).sort((a, b) => b.bookings - a.bookings).slice(0, 5);
      
      const hourCounts = Array(24).fill(0).map((_, i) => ({ hour: i, count: 0 }));
      rangeSchedules.forEach(s => {
        const hour = new Date(s.start_time).getHours();
        const bookingsCount = filteredBookings.filter(b => b.schedule_id === s.id && b.payment_status === 'PAID').length;
        hourCounts[hour].count += bookingsCount;
      });
      const peakHours = hourCounts.filter(h => h.count > 0 || (h.hour >= 9 && h.hour <= 21));

      const currentMonthPayments = payments.filter(p => isSameMonth(new Date(p.created_at), new Date()));
      const mRevenue = currentMonthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const currentDay = new Date().getDate();
      const projectedRevenue = currentDay > 0 ? Math.round((mRevenue / currentDay) * daysInMonth) : mRevenue;

      setReportData({
        totalRevenue,
        totalBookings: totalPaidBookings,
        occupanyRate,
        activeRoutines: routines.length,
        revenueTrend: revenueTrend.map(r => ({ ...r, projected: r.amount * 1.2 })),
        popularRoutines: routineStats,
        peakHours,
        projectedRevenue,
        retentionRate,
        avgRevenuePerStudent,
        cancellationRate,
        paymentMethodDistribution,
        historicalRevenue,
        audienceLoyalty
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [user, timeRange]);

  useEffect(() => {
    if (user) fetchReportData();
  }, [user, timeRange, fetchReportData]);

  return (
    <div className="min-h-screen bg-bloom-white text-[#4A3B3E] p-6 sm:p-10 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-rose-bloom blur-[150px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-lavender blur-[150px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {!profile?.is_subscribed && (
          <div className="absolute inset-x-[-2rem] inset-y-[-2rem] z-[80] flex items-center justify-center rounded-[4rem] overflow-hidden">
             <div className="absolute inset-0 bg-bloom-white/40 backdrop-blur-md" />
             <Motion.div 
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
             </Motion.div>
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
               <select 
                 value={timeRange} 
                 onChange={(e) => setTimeRange(e.target.value)}
                 className="px-6 py-3.5 bg-white rounded-[0.9rem] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 outline-none cursor-pointer border-none"
               >
                 <option value="30days">Last 30 Days</option>
                 <option value="90days">Last 3 Months</option>
                 <option value="year">Last Year</option>
                 <option value="ytd">Year to Date (YTD)</option>
                 <option value="all">Running Total</option>
               </select>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-32">
             <div className="w-12 h-12 border-4 border-rose-bloom/20 border-t-rose-bloom rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
              {[
                { label: 'Theatre Revenue', value: `$${reportData.totalRevenue}`, icon: DollarSign, color: 'text-rose-bloom' },
                { label: 'Total Energy', value: reportData.totalBookings, icon: Users, color: 'text-rose-bloom' },
                { label: 'Stage Occupancy', value: `${reportData.occupanyRate}%`, icon: Activity, color: 'text-rose-bloom' },
                { label: 'Routines Active', value: reportData.activeRoutines, icon: Sparkles, color: 'text-rose-bloom' },
              ].map((stat, i) => (
                <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} key={i} className="bg-white/70 backdrop-blur-3xl p-8 rounded-[3rem] border border-theatre-dark/20 shadow-xl relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-rose-petal/10 rounded-2xl"><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
                    <div className="text-[10px] font-black text-rose-bloom flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Live</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-[#4A3B3E]/40 uppercase tracking-widest mb-1">{stat.label}</div>
                    <div className="text-4xl font-black text-theatre-dark">{stat.value}</div>
                  </div>
                </Motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 bg-white/70 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-theatre-dark/20 shadow-2xl min-h-[500px] relative overflow-hidden">
                <div className="flex justify-between items-center mb-16">
                   <div>
                      <h3 className="text-2xl font-black text-theatre-dark mb-1">Rhythm Trends</h3>
                      <p className="text-[10px] font-black text-[#4A3B3E]/40 uppercase tracking-widest">Revenue performance across the stage</p>
                   </div>
                </div>
                <div className="h-64 mt-12 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={reportData.revenueTrend || []}>
                       <defs>
                         <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#FE7A8A" stopOpacity={0.3}/><stop offset="95%" stopColor="#FE7A8A" stopOpacity={0}/>
                         </linearGradient>
                       </defs>
                       <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#4A3B3E60' }} />
                       <YAxis hide />
                       <Tooltip contentStyle={{ backgroundColor: '#4A3B3E', borderRadius: '16px', border: 'none', color: '#fff', fontSize: '10px', padding: '12px' }} itemStyle={{ color: '#FE7A8A', fontWeight: 900 }} />
                       <Area type="monotone" dataKey="amount" stroke="#FE7A8A" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" animationDuration={1500} />
                     </AreaChart>
                   </ResponsiveContainer>
                </div>
                <div className="mt-12 pt-8 border-t border-apricot/20">
                   <div className="flex gap-12">
                      <div>
                        <div className="text-[9px] font-black text-theatre-dark/30 uppercase tracking-widest mb-1">Projected Monthly Revenue</div>
                        <div className="text-2xl font-black text-rose-bloom">${reportData.projectedRevenue}</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-black text-theatre-dark/30 uppercase tracking-widest mb-1">Growth Energy</div>
                        <div className="text-2xl font-black text-theatre-dark">+14.2%</div>
                      </div>
                   </div>
                </div>
              </div>

              <div className="bg-white/70 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-theatre-dark/20 shadow-2xl">
                <div className="flex justify-between items-center mb-10">
                   <div>
                      <h3 className="text-xl font-black text-theatre-dark mb-1">Peak Energy Hours</h3>
                      <p className="text-[10px] font-black text-[#4A3B3E]/40 uppercase tracking-widest">Dancer engagement by time</p>
                   </div>
                   <Activity className="w-5 h-5 text-rose-bloom opacity-30" />
                </div>
                <div className="h-48 w-full mt-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.peakHours || []}>
                      <XAxis dataKey="hour" tickFormatter={(h) => `${h > 12 ? h-12 : h}${h >= 12 ? 'p' : 'a'}`} axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#4A3B3E40' }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {(reportData.peakHours || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.count === Math.max(...(reportData.peakHours || []).map(h => h.count)) ? '#FE7A8A' : '#FE7A8A30'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Historical Growth Theatre */}
            <div className="bg-[#4A3B3E] p-12 rounded-[4rem] border border-white/10 shadow-3xl mt-10 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-rose-bloom/10 blur-[100px] rounded-full" />
               <div className="flex justify-between items-center mb-16 relative z-10">
                  <div>
                    <h3 className="text-3xl font-black text-white italic tracking-tighter mb-2">Growth Theatre</h3>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">6-Month Revenue Performance</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10"><TrendingUp className="w-6 h-6 text-rose-bloom" /></div>
               </div>
               <div className="h-72 w-full relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={reportData.historicalRevenue}>
                      <defs>
                        <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FE7A8A" stopOpacity={0.4}/><stop offset="95%" stopColor="#FE7A8A" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ backgroundColor: '#1A1415', border: 'none', borderRadius: '20px', padding: '15px' }} />
                      <Area type="monotone" dataKey="amount" stroke="#FE7A8A" strokeWidth={5} fill="url(#colorGrowth)" />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 mt-10">
               <div className="bg-white/70 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-theatre-dark/20 shadow-xl">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black text-theatre-dark uppercase tracking-tighter italic">Audience Theatre</h3>
                    <Users className="w-5 h-5 text-rose-bloom opacity-20" />
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie data={reportData.audienceLoyalty} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" stroke="none">
                          {reportData.audienceLoyalty.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#4A3B3E' : '#FE7A8A'} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-around mt-6">
                    {reportData.audienceLoyalty.map((entry, index) => (
                      <div key={index} className="text-center">
                        <div className="text-[9px] font-black uppercase text-theatre-dark/30 mb-1">{entry.name}</div>
                        <div className="text-xl font-black text-theatre-dark">{entry.value}</div>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="bg-white/70 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-theatre-dark/20 shadow-xl">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black text-theatre-dark uppercase tracking-tighter italic">Top Routines</h3>
                    <PieChart className="w-5 h-5 text-rose-bloom opacity-20" />
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie data={reportData.popularRoutines} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="bookings" stroke="none">
                          {reportData.popularRoutines.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#FE7A8A', '#FFB38A', '#4A3B3E'][index % 3]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               <div className="bg-white/70 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-theatre-dark/20 shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-black text-theatre-dark uppercase tracking-tighter italic">Payment Theatre</h3>
                   <BarChart3 className="w-6 h-6 text-rose-bloom opacity-20" />
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.paymentMethodDistribution} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#4A3B3E' }} width={80} />
                      <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={20}>
                        {reportData.paymentMethodDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#FE7A8A', '#FFB38A', '#4A3B3E'][index % 3]} />
                        ))}
                      </Bar>
                      <Tooltip cursor={{ fill: 'transparent' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-10">
               {[
                 { label: 'Student Retention', value: `${reportData.retentionRate}%`, desc: 'Returning dancers (%)' },
                 { label: 'Lifetime Energy', value: `$${reportData.avgRevenuePerStudent}`, desc: 'Avg revenue per student' },
                 { label: 'Vibe Stability', value: `${reportData.cancellationRate}%`, desc: 'Cancellation velocity' }
               ].map((insight, idx) => (
                 <div key={idx} className="bg-white/70 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-theatre-dark/20 shadow-xl">
                   <h4 className="text-sm font-black text-theatre-dark uppercase tracking-tighter mb-1">{insight.label}</h4>
                   <div className="text-4xl font-black text-rose-bloom mb-2">{insight.value}</div>
                   <p className="text-[10px] font-bold text-theatre-dark/40 uppercase tracking-widest">{insight.desc}</p>
                 </div>
               ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
