import React, { useState } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  isSameMonth, isSameDay, addDays, parseISO, startOfDay, eachDayOfInterval,
  addWeeks, subWeeks, startOfWeek as startOfSelectedWeek, endOfWeek as endOfSelectedWeek
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CalendarContainer({ events, onDateClick, onEventClick, onAddClick, role = 'student' }) {
  const [view, setView] = useState('month'); // month, week, day
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));

  const handlePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const renderHeader = () => (
    <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
      <div className="flex items-center gap-4">
        <div className="bg-rose-bloom/10 p-3 rounded-2xl">
          <CalendarIcon className="w-6 h-6 text-rose-bloom" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-studio-dark">
            {view === 'month' ? format(currentDate, 'MMMM yyyy') : 
             view === 'week' ? `Week of ${format(startOfSelectedWeek(currentDate), 'MMM d')}` :
             format(currentDate, 'EEEE, MMM d')}
          </h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-theatre-dark/80">
            {role === 'teacher' ? 'Your Schedule' : 'Available Classes'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white/50 p-1.5 rounded-2xl border border-theatre-dark/20">
        <div className="flex gap-1 mr-4">
          {['month', 'week', 'day'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                view === v ? 'bg-rose-bloom text-white shadow-lg shadow-rose-bloom/20' : 'text-theatre-dark/60 hover:bg-apricot/10'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center bg-bloom-white rounded-xl shadow-sm border border-apricot/40">
          <button onClick={handlePrev} className="p-2 hover:text-rose-bloom transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          <div className="w-px h-4 bg-apricot/20" />
          <button onClick={() => setCurrentDate(new Date())} className="px-3 text-[10px] font-black uppercase tracking-widest text-theatre-dark/60 hover:text-rose-bloom transition-colors">Today</button>
          <div className="w-px h-4 bg-apricot/20" />
          <button onClick={handleNext} className="p-2 hover:text-rose-bloom transition-colors"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="grid grid-cols-7 gap-px bg-apricot/20 rounded-[2rem] overflow-hidden border border-apricot/40 shadow-xl shadow-rose-bloom/5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="bg-bloom-white/80 p-4 text-center text-[10px] font-black uppercase tracking-widest text-theatre-dark border-b border-apricot/30">{d}</div>
        ))}
        {days.map(day => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isPast = startOfDay(day) < startOfDay(new Date());
          const dayEvents = events.filter(e => isSameDay(parseISO(e.start_time || e.date), day));

          return (
            <div
              key={day.toString()}
              onClick={() => {
                setSelectedDate(day);
                if (onDateClick) onDateClick(day);
              }}
              className={`min-h-[120px] p-4 bg-bloom-white/80 transition-all cursor-pointer relative group ${
                !isCurrentMonth ? 'bg-bloom-white/50 opacity-30' : 'hover:bg-bloom-white'
              } ${isSelected ? 'ring-2 ring-inset ring-rose-bloom/50 bg-apricot/5' : ''} ${
                isPast ? 'opacity-50 grayscale hover:opacity-100' : ''
              }`}
            >
              <span className={`text-sm font-black ${isSameDay(day, new Date()) ? 'text-rose-bloom' : 'text-theatre-dark/60'}`}>
                {format(day, 'd')}
              </span>
              <div className="mt-2 space-y-1">
                {dayEvents.slice(0, 3).map((event, idx) => (
                  <div 
                    key={idx}
                    className="text-[9px] font-bold bg-lavender/40 text-rose-bloom p-1 rounded-lg truncate border border-rose-petal/10"
                  >
                    {event.start_time ? format(parseISO(event.start_time), 'HH:mm') : '00:00'} {event.name || event.routines?.name}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] font-bold text-rose-bloom pl-1">+{dayEvents.length - 3} more</div>
                )}
              </div>
              {role === 'teacher' && isCurrentMonth && !isPast && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onAddClick(day); }}
                  className="absolute bottom-3 right-3 p-1.5 bg-rose-bloom text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-lg shadow-rose-bloom/20"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfSelectedWeek(currentDate);
    const weekEnd = endOfSelectedWeek(currentDate);
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="grid grid-cols-7 gap-4">
        {days.map(day => {
          const dayEvents = events.filter(e => isSameDay(parseISO(e.start_time), day));
          const isPast = startOfDay(day) < startOfDay(new Date());
          const isSelected = isSameDay(day, selectedDate);

          return (
            <div key={day.toString()} className={`space-y-4 ${isPast ? 'opacity-50 grayscale hover:opacity-100' : ''}`}>
              <div 
                onClick={() => {
                  setSelectedDate(day);
                  if (onDateClick) onDateClick(day);
                }}
                className={`p-4 rounded-[1.5rem] text-center border transition-all cursor-pointer ${
                  isSameDay(day, new Date()) ? 'bg-rose-bloom text-white border-rose-bloom shadow-lg shadow-rose-bloom/20' : 
                  isSelected ? 'bg-apricot/20 border-rose-bloom/30 text-rose-bloom' : 
                  'bg-bloom-white border-apricot/30'
                }`}
              >
                <div className={`text-[10px] font-black uppercase tracking-widest ${isSameDay(day, new Date()) ? 'text-white/60' : 'text-theatre-dark/80'}`}>
                  {format(day, 'EEE')}
                </div>
                <div className="text-xl font-black">{format(day, 'd')}</div>
              </div>
              
              <div className="space-y-3 min-h-[400px]">
                {dayEvents.map((event, idx) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={idx}
                    onClick={() => onEventClick(event)}
                    className="p-4 glass rounded-2xl cursor-pointer hover:border-rose-bloom/30 transition-all border border-theatre-dark/15"
                  >
                    <div className="text-[10px] font-black text-rose-bloom mb-1">{event.start_time ? format(parseISO(event.start_time), 'hh:mm a') : '00:00 AM'}</div>
                    <div className="text-xs font-black text-studio-dark truncate">{event.name || event.routines?.name}</div>
                    <div className="flex items-center gap-1 mt-2 text-[9px] font-bold text-studio-dark/30">
                      <MapPin className="w-2.5 h-2.5" /> {event.location || 'Main Studio'}
                    </div>
                  </motion.div>
                ))}
                {dayEvents.length === 0 && (
                  <div className="h-20 border-2 border-dashed border-theatre-dark/15 rounded-2xl" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = events.filter(e => isSameDay(parseISO(e.start_time), currentDate));
    
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-8 bg-white/70 rounded-[2.5rem] border border-theatre-dark/20">
            <h3 className="text-xl font-black text-studio-dark mb-8 flex items-center gap-3">
              <Clock className="w-5 h-5 text-rose-bloom" />
              Timeline
            </h3>
            <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-rose-petal/10">
              {dayEvents.length === 0 ? (
                <div className="py-20 text-center text-studio-dark/20 font-bold uppercase tracking-widest text-xs">
                  Nothing scheduled for this day
                </div>
              ) : (
                dayEvents.sort((a, b) => a.start_time.localeCompare(b.start_time)).map((event, idx) => (
                  <div key={idx} className="relative pl-10">
                    <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-white border-4 border-rose-bloom shadow-md z-10" />
                    <div className="p-6 bg-white rounded-3xl border border-theatre-dark/15 shadow-sm hover:shadow-md transition-all group cursor-pointer" onClick={() => onEventClick(event)}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-xs font-black text-rose-bloom uppercase tracking-widest">{event.start_time ? format(parseISO(event.start_time), 'hh:mm a') : '00:00 AM'}</span>
                          <h4 className="text-xl font-black text-studio-dark group-hover:text-rose-bloom transition-colors mt-1">{event.name || event.routines?.name}</h4>
                        </div>
                        <div className="text-lg font-black text-rose-bloom">${event.price}</div>
                      </div>
                      <div className="flex gap-6">
                        <div className="flex items-center gap-2 text-xs font-bold text-studio-dark/40">
                          <MapPin className="w-4 h-4" /> {event.location}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-studio-dark/40">
                          <Clock className="w-4 h-4" /> {event.routines?.duration_minutes}m
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
           <div className="p-8 bg-gradient-to-br from-rose-bloom to-rose-petal rounded-[2.5rem] text-white shadow-xl shadow-rose-bloom/20">
              <h3 className="text-xl font-black mb-4">Daily Insights</h3>
              <p className="text-sm font-medium opacity-80 leading-relaxed mb-8">
                {role === 'teacher' 
                  ? "Your energy levels are highest in the evenings. Consider adding a 'Power Move' routine at 7 PM."
                  : "3 of your favorite instructors have sessions today. Booking now secures your front-row spot!"}
              </p>
              <div className="flex items-center gap-4">
                 <div className="flex -space-x-3">
                    {[1,2,3,4].map(i => <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-peach" />)}
                 </div>
                 <span className="text-xs font-bold">+12 others attending</span>
              </div>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-reveal">
      {renderHeader()}
      <AnimatePresence mode="wait">
        <motion.div
          key={view + currentDate.toString()}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.3 }}
        >
          {view === 'month' && renderMonthView()}
          {view === 'week' && renderWeekView()}
          {view === 'day' && renderDayView()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
