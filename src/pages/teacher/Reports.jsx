import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, Users, Activity, 
  ChevronLeft, ArrowRight, Download, Filter, Search, MoreHorizontal,
  Layout, PieChart as PieIcon, BarChart3, TrendingDown, Clock, MapPin, Sparkles,
  ArrowUpRight, CheckCircle2, DollarSign, Lock
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { format, subDays, isSameMonth, parseISO, subMonths } from 'date-fns';
import { Link } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
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
    audienceLoyalty: [],
    engagementDistribution: []
  });
  const [timeRange, setTimeRange] = useState('90days');
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeIndexEngagement, setActiveIndexEngagement] = useState(0);

  const fetchReportData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch Teacher's Routines
      const { data: routines, error: routinesError } = await supabase
        .from('routines')
        .select('id, name')
        .eq('teacher_id', user.id);
      if (routinesError) throw routinesError;

      // 2. Fetch All Schedules for Teacher
      const { data: schedules, error: schedulesError } = await supabase
        .from('schedules')
        .select('id, routine_id, start_time, price, seats_taken, max_seats, status')
        .eq('teacher_id', user.id);
      if (schedulesError) throw schedulesError;

      if (!schedules || schedules.length === 0) {
        setReportData(prev => ({ ...prev, activeRoutines: (routines || []).length }));
        setLoading(false);
        return;
      }

      const scheduleIds = schedules.map(s => s.id);

      // 3. Fetch All Bookings for these schedules
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*, profiles(id, full_name), routines(name)')
        .in('schedule_id', scheduleIds);
      if (bookingsError) throw bookingsError;

      // 4. Fetch All Payments for these bookings
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*, bookings!inner(schedule_id, student_id)')
        .in('bookings.schedule_id', scheduleIds);
      if (paymentsError) throw paymentsError;

      // Filter by Time Range
      let startDate;
      const now = new Date();
      if (timeRange === '30days') startDate = subDays(now, 30);
      else if (timeRange === '90days') startDate = subDays(now, 90);
      else if (timeRange === 'year') startDate = subDays(now, 365);
      else if (timeRange === 'ytd') startDate = new Date(now.getFullYear(), 0, 1);
      else startDate = new Date(0);

      const filteredPayments = (payments || []).filter(p => new Date(p.created_at) >= startDate);
      const filteredBookings = (bookings || []).filter(b => {
        const s = schedules.find(sch => sch.id === b.schedule_id);
        return s && new Date(s.start_time) >= startDate;
      });
      const filteredSchedules = (schedules || []).filter(s => new Date(s.start_time) >= startDate);

      // Calculations
      const totalRevenue = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalCapacity = filteredSchedules.reduce((sum, s) => sum + (s.max_seats || 20), 0);
      const totalSeatsTaken = filteredSchedules.reduce((sum, s) => sum + (s.seats_taken || 0), 0);
      const occupanyRate = totalCapacity > 0 ? Math.round((totalSeatsTaken / totalCapacity) * 100) : 0;

      // 1. Revenue Trend (Daily grouping)
      const revenueByDate = filteredPayments.reduce((acc, p) => {
        const date = format(parseISO(p.created_at), 'MMM dd');
        acc[date] = (acc[date] || 0) + Number(p.amount);
        return acc;
      }, {});
      const revenueTrend = Object.entries(revenueByDate)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => parseISO(a.date) - parseISO(b.date))
        .slice(-7);

      // 2. Popular Routines
      const routineCounts = filteredBookings.reduce((acc, b) => {
        const name = b.routines?.name || 'Unknown Routine';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});
      const popularRoutines = Object.entries(routineCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 5);

      // 3. Peak Hours
      const hourCounts = filteredSchedules.reduce((acc, s) => {
        const hour = format(parseISO(s.start_time), 'HH');
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {});
      const peakHours = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: parseInt(hour, 10), count }))
        .sort((a,b) => a.hour - b.hour);

      // 4. Engagement Distribution
      const engagement = {
        reserved: filteredBookings.filter(b => b.payment_status === 'PENDING' && b.status !== 'CANCELLED').length,
        paid: filteredBookings.filter(b => b.payment_status === 'PAID' && b.status !== 'CANCELLED').length,
        cancelled: filteredBookings.filter(b => b.status === 'CANCELLED' || b.payment_status === 'REFUNDED').length,
        attended: filteredBookings.filter(b => b.attended === true).length
      };
      const engagementDistribution = [
        { name: 'Reserved', value: engagement.reserved, color: '#FE7A8A' },
        { name: 'Paid', value: engagement.paid, color: '#4ADE80' },
        { name: 'Cancelled', value: engagement.cancelled, color: '#94A3B8' },
        { name: 'Attended', value: engagement.attended, color: '#4A3B3E' }
      ].filter(d => d.value > 0);

      // Retention & Student Stats
      const studentBookingCounts = {};
      filteredBookings.forEach(b => {
        studentBookingCounts[b.student_id] = (studentBookingCounts[b.student_id] || 0) + 1;
      });
      const uniqueStudentsCount = Object.keys(studentBookingCounts).length;
      const repeatStudentsCount = Object.values(studentBookingCounts).filter(c => c > 1).length;
      const retentionRate = uniqueStudentsCount > 0 ? Math.round((repeatStudentsCount / uniqueStudentsCount) * 100) : 0;
      const avgRevenuePerStudent = uniqueStudentsCount > 0 ? Math.round(totalRevenue / uniqueStudentsCount) : 0;

      const totalBookingAttempts = filteredBookings.length;
      const cancellationRate = totalBookingAttempts > 0 ? Math.round((engagement.cancelled / totalBookingAttempts) * 100) : 0;

      // Historical Revenue (Last 6 Months)
      const last6Months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), i)).reverse();
      const historicalRevenue = last6Months.map(monthDate => {
        const monthRevenue = (payments || [])
          .filter(p => isSameMonth(new Date(p.created_at), monthDate))
          .reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          month: format(monthDate, 'MMM'),
          amount: monthRevenue
        };
      });

      setReportData({
        totalRevenue,
        totalBookings: filteredBookings.filter(b => b.status !== 'CANCELLED').length,
        occupanyRate,
        activeRoutines: (routines || []).length,
        revenueTrend: revenueTrend.map(r => ({ ...r, projected: r.amount * 1.2 })),
        popularRoutines,
        peakHours,
        engagementDistribution,
        retentionRate,
        avgRevenuePerStudent,
        cancellationRate,
        historicalRevenue,
        audienceLoyalty: [
          { name: 'Loyal Dancers', value: repeatStudentsCount },
          { name: 'New Talent', value: Math.max(0, uniqueStudentsCount - repeatStudentsCount) }
        ],
        paymentMethodDistribution: Object.entries(
          filteredBookings.reduce((acc, b) => {
            if (b.payment_method) acc[b.payment_method] = (acc[b.payment_method] || 0) + 1;
            return acc;
          }, {})
        ).map(([name, value]) => ({ name, value }))
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [user, timeRange]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-studio-dark/95 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl">
          <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              <p className="text-xs font-black text-white">
                {entry.name === 'amount' ? `$${entry.value}` : entry.name === 'value' ? `${entry.value}` : `${entry.value} ${entry.name}`}
              </p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderActiveShape = (props) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
    return (
      <g>
        <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="text-[10px] font-black uppercase tracking-tighter">
          {payload.name}
        </text>
        <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
        <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 6} outerRadius={outerRadius + 10} fill={fill} />
      </g>
    );
  };

  if (loading && !reportData.historicalRevenue.length) {
     return <div className="min-h-screen bg-bloom-white flex items-center justify-center"><div className="w-12 h-12 border-4 border-rose-bloom/20 border-t-rose-bloom rounded-full animate-spin" /></div>;
  }

  return (
    <Motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-bloom-white text-[#4A3B3E] p-6 sm:p-10 font-sans relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto relative z-10">
        {!profile?.is_subscribed && (
          <div className="absolute inset-x-[-2rem] inset-y-[-2rem] z-[80] flex items-center justify-center rounded-[4rem] overflow-hidden">
             <div className="absolute inset-0 bg-bloom-white/80 backdrop-blur-md" />
             <Motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="relative z-10 bg-white p-12 rounded-[3.5rem] border border-apricot/40 shadow-2xl text-center max-w-sm"
             >
                <div className="w-16 h-16 bg-rose-bloom/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <TrendingUp className="w-8 h-8 text-rose-bloom" />
                </div>
                <h2 className="text-3xl font-black text-studio-dark mb-3 italic">Growth Energy Locked</h2>
                <p className="text-xs text-studio-dark/40 font-bold uppercase tracking-widest leading-loose mb-10">
                   Detailed analytics and revenue reports are reserved for our Premium Stage Instructors.
                </p>
                <Link 
                  to="/teacher/subscription"
                  className="w-full btn-premium bg-studio-dark text-white flex items-center justify-center gap-3 hover:bg-rose-bloom shadow-xl"
                >
                  Activate Premium <ArrowRight className="w-4 h-4" />
                </Link>
             </Motion.div>
          </div>
        )}

        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-16">
          <div className="flex items-center gap-6">
             <Link to="/teacher/dashboard" className="p-4 bg-white rounded-2xl border border-studio-dark/15 hover:bg-rose-petal/5 transition-all shadow-sm">
               <ChevronLeft className="w-6 h-6 text-rose-bloom" />
             </Link>
             <div>
              <h1 className="text-4xl font-black text-studio-dark mb-1">Performance Studio.</h1>
              <p className="text-rose-bloom/40 font-bold uppercase tracking-[0.2em] text-[10px]">Financials & Engagement Analytics</p>
            </div>
          </div>
          <div className="flex gap-4">
             <select 
               value={timeRange} 
               onChange={(e) => setTimeRange(e.target.value)}
               className="px-6 py-4 bg-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-studio-dark/10 outline-none cursor-pointer hover:border-rose-bloom transition-colors"
             >
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 3 Months</option>
                <option value="year">Last Year</option>
                <option value="all">All Time</option>
             </select>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {[
            { label: 'Studio Revenue', value: `$${reportData.totalRevenue}`, icon: DollarSign, color: 'text-rose-bloom' },
            { label: 'Total Energy', value: reportData.totalBookings, icon: Users, color: 'text-rose-bloom' },
            { label: 'Stage Occupancy', value: `${reportData.occupanyRate}%`, icon: Activity, color: 'text-rose-bloom' },
            { label: 'Routines Active', value: reportData.activeRoutines, icon: Sparkles, color: 'text-rose-bloom' },
          ].map((stat, i) => (
            <div key={i} className="bg-white/70 backdrop-blur-3xl p-8 rounded-[3rem] border border-studio-dark/10 shadow-xl group">
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 bg-rose-petal/10 rounded-2xl transition-transform group-hover:scale-110"><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
                <div className="text-[10px] font-black text-rose-bloom flex items-center gap-1">Live <ArrowUpRight className="w-3 h-3" /></div>
              </div>
              <div className="text-[10px] font-black text-[#4A3B3E]/40 uppercase tracking-widest mb-1">{stat.label}</div>
              <div className="text-4xl font-black text-studio-dark">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 bg-white/70 backdrop-blur-3xl p-10 rounded-[4rem] border border-studio-dark/10 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-5"><TrendingUp className="w-32 h-32 text-studio-dark" /></div>
             <h3 className="text-2xl font-black text-studio-dark mb-1">Rhythm Trends</h3>
             <p className="text-[10px] font-black text-[#4A3B3E]/40 uppercase tracking-widest mb-12">Daily revenue performance</p>
             <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={reportData.revenueTrend}>
                   <defs>
                     <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#FE7A8A" stopOpacity={0.6}/>
                       <stop offset="95%" stopColor="#FE7A8A" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#4A3B3E60' }} dy={10} />
                   <YAxis hide />
                   <Tooltip content={<CustomTooltip />} />
                   <Area type="monotone" dataKey="amount" stroke="#FE7A8A" strokeWidth={6} fill="url(#colorRevenue)" animationDuration={1500} />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-white/70 backdrop-blur-3xl p-10 rounded-[4rem] border border-studio-dark/10 shadow-2xl">
              <h3 className="text-xl font-black text-studio-dark mb-1">Peak Energy</h3>
              <p className="text-[10px] font-black text-[#4A3B3E]/40 uppercase tracking-widest mb-10">Engagement by hour</p>
              <div className="h-48 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={reportData.peakHours}>
                     <XAxis dataKey="hour" tickFormatter={(h) => `${h > 12 ? h-12 : h}${h >= 12 ? 'p' : 'a'}`} axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#4A3B3E40' }} dy={10} />
                     <Tooltip content={<CustomTooltip />} cursor={{ fill: '#FE7A8A10' }} />
                     <Bar dataKey="count" radius={[10, 10, 10, 10]} barSize={12}>
                        {reportData.peakHours.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.count === Math.max(...reportData.peakHours.map(h => h.count)) ? '#FE7A8A' : '#4A3B3E10'} />
                        ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-10">
           {/* Engagement Distribution */}
           <div className="bg-white/70 backdrop-blur-3xl p-10 rounded-[4rem] border border-studio-dark/10 shadow-2xl group">
              <div className="flex justify-between items-center mb-8">
                 <div>
                    <h3 className="text-xl font-black text-studio-dark mb-1">Engagement Lifecycle</h3>
                    <p className="text-[10px] font-black text-[#4A3B3E]/40 uppercase tracking-widest">Conversion & Retention</p>
                 </div>
                 <Activity className="w-6 h-6 text-rose-bloom opacity-20" />
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      activeIndex={activeIndexEngagement}
                      activeShape={renderActiveShape}
                      data={reportData.engagementDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      dataKey="value"
                      onMouseEnter={(_, index) => setActiveIndexEngagement(index)}
                      animationDuration={1500}
                    >
                      {reportData.engagementDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-6">
                 {reportData.engagementDistribution.map((entry, index) => (
                   <div key={index} className="text-center">
                     <div className="text-[8px] font-black uppercase tracking-widest text-[#4A3B3E]/30 mb-1">{entry.name}</div>
                     <div className="text-lg font-black text-studio-dark">{entry.value}</div>
                     <div className="w-8 h-1 mx-auto mt-1 rounded-full" style={{ backgroundColor: entry.color }} />
                   </div>
                 ))}
              </div>
           </div>

           {/* Routine Mix */}
           <div className="bg-white/70 backdrop-blur-3xl p-10 rounded-[4rem] border border-studio-dark/10 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                 <div>
                    <h3 className="text-xl font-black text-studio-dark mb-1">Routine Energy Mix</h3>
                    <p className="text-[10px] font-black text-[#4A3B3E]/40 uppercase tracking-widest">Top performing routines</p>
                 </div>
                 <Sparkles className="w-6 h-6 text-rose-bloom opacity-20" />
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      activeIndex={activeIndex}
                      activeShape={renderActiveShape}
                      data={reportData.popularRoutines}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      dataKey="value"
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                    >
                      {reportData.popularRoutines.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#FE7A8A', '#4A3B3E', '#FFB38A'][index % 3]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-10 mb-16">
          {[
            { label: 'Student Retention', value: `${reportData.retentionRate}%`, desc: 'Repeat dancers' },
            { label: 'Lifetime Energy', value: `$${reportData.avgRevenuePerStudent}`, desc: 'Avg per student' },
            { label: 'Vibe Stability', value: `${reportData.cancellationRate}%`, desc: 'Cancellations rate' },
          ].map((insight, i) => (
            <div key={i} className="bg-studio-dark p-10 rounded-[3.5rem] border border-white/10 shadow-xl group hover:scale-[1.02] transition-transform">
              <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">{insight.label}</h4>
              <div className="text-4xl font-black text-white mb-2 italic tracking-tighter">{insight.value}</div>
              <p className="text-[9px] font-bold text-rose-bloom uppercase tracking-[0.2em]">{insight.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Motion.div>
  );
}
