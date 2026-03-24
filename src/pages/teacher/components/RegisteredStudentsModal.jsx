import React from 'react';
import { Users, X, Plus, ArrowRight } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';

export default function RegisteredStudentsModal({ session, onClose, onMarkAsPaid }) {
  if (!session) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
      <Motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-studio-dark/40 backdrop-blur-md" 
      />
      <Motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.9, y: 20 }} 
        className="bg-bloom-white w-full max-w-2xl rounded-[3rem] relative z-20 overflow-hidden shadow-2xl border border-apricot/50 flex flex-col max-h-[90vh]"
      >
        <div className="p-10 border-b border-apricot/20 shrink-0">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-bloom/10 rounded-2xl">
                <Users className="w-6 h-6 text-rose-bloom" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-studio-dark">Registered Students</h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-studio-dark/40 mt-1">
                  {session.routines?.name} • {session.start_time ? format(parseISO(session.start_time), 'MMM d, h:mm a') : '...'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-apricot/10 rounded-xl transition-colors text-studio-dark/30"><X/></button>
          </div>

          <div className="grid grid-cols-3 gap-4">
             <div className="bg-bloom-white p-4 rounded-2xl border border-apricot/30 text-center">
                <div className="text-[8px] font-black uppercase text-studio-dark/30 mb-1">Total Booked</div>
                <div className="text-xl font-black text-studio-dark">{session.bookings?.length || 0}</div>
             </div>
             <div className="bg-bloom-white p-4 rounded-2xl border border-apricot/30 text-center">
                <div className="text-[8px] font-black uppercase text-studio-dark/30 mb-1">Remaining</div>
                <div className="text-xl font-black text-rose-bloom">{(session.max_seats || 0) - (session.bookings?.length || 0)}</div>
             </div>
             <div className="bg-bloom-white p-4 rounded-2xl border border-apricot/30 text-center">
                <div className="text-[8px] font-black uppercase text-studio-dark/30 mb-1">Capacity</div>
                <div className="text-xl font-black text-studio-dark/40">{session.max_seats}</div>
             </div>
          </div>
        </div>

        <div className="overflow-y-auto p-10 custom-scrollbar flex-1">
          {(session.bookings?.length || 0) > 0 ? (
            <div className="space-y-4">
              {session.bookings.map((booking, i) => (
                <Motion.div 
                  key={booking.id || i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-4 bg-white rounded-2xl border border-apricot/20 hover:border-rose-bloom/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-petal/10 border border-rose-petal/20 overflow-hidden flex items-center justify-center">
                      {booking.student?.avatar_url ? (
                        <img src={booking.student.avatar_url} className="w-full h-full object-cover" alt={booking.student.full_name} />
                      ) : (
                        <div className="text-lg font-black text-rose-bloom uppercase">{booking.student?.full_name?.charAt(0)}</div>
                      )}
                    </div>
                    <div>
                      <div className="font-black text-studio-dark">{booking.student?.full_name || 'Guest Artist'}</div>
                      <div className="text-[10px] font-bold text-studio-dark/30 uppercase tracking-widest">
                        {booking.student?.email || 'Anonymous Student'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                       booking.payment_status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-bloom/10 text-rose-bloom border-rose-bloom/20'
                     }`}>
                       {booking.payment_status === 'PAID' ? (booking.payment_method === 'CREDITS' ? 'Paid (Credits)' : 'Paid') : booking.payment_status}
                     </div>
                     {booking.payment_status === 'PENDING' && (
                       <button 
                         onClick={() => onMarkAsPaid(booking.id)}
                         className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl transition-all flex items-center gap-2 group/btn"
                         title="Confirm Cash Payment"
                       >
                          <span className="text-[8px] font-black uppercase tracking-widest hidden group-hover/btn:block">Mark Paid</span>
                          <Plus className="w-4 h-4" />
                       </button>
                     )}
                     <button className="p-2 opacity-0 group-hover:opacity-100 transition-all text-studio-dark/20 hover:text-studio-dark">
                        <ArrowRight className="w-4 h-4" />
                     </button>
                  </div>
                </Motion.div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-apricot/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-studio-dark/10" />
              </div>
              <p className="text-sm font-black text-studio-dark/20 uppercase tracking-[0.2em]">No students registered yet</p>
            </div>
          )}
        </div>

        <div className="p-10 border-t border-apricot/20 bg-apricot/5 shrink-0">
           <button className="w-full py-5 bg-white border border-apricot/30 rounded-2xl text-[10px] font-black uppercase tracking-widest text-studio-dark hover:bg-white/80 transition-all flex items-center justify-center gap-2">
              Export Attendance List
           </button>
        </div>
      </Motion.div>
    </div>
  );
}
