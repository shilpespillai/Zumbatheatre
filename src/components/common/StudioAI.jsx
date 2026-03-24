import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Send, X, MessageSquare, Activity, 
  TrendingUp, BarChart3, PieChart, Users, Maximize2, Minimize2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../api/supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart as RePieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';

const StudioAI = ({ studioMetrics, userRole }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      text: `Welcome to the Stage, ${userRole}! I'm your Stage Manager. Ask me anything about your studio's performance.`, 
      sender: 'ai' 
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim() || isLoading) return;

    const userMessage = { id: Date.now(), text: query, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('studio-insights', {
        body: { 
          prompt: query, 
          studioMetrics, 
          userRole 
        }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        text: data.text, 
        sender: 'ai',
        hasChart: data.hasChart,
        chartData: data.chartData,
        chartType: data.chartType
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        text: "I hit a snag behind the scenes. Could you try that again?", 
        sender: 'ai' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderChart = (msg) => {
    if (!msg.hasChart || !msg.chartData) return null;

    return (
      <div className="h-48 w-full mt-4 bg-white/50 rounded-2xl p-4 border border-white/40">
        <ResponsiveContainer width="100%" height="100%">
          {msg.chartType === 'area' ? (
            <AreaChart data={msg.chartData}>
              <XAxis dataKey="name" hide />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#FE7A8A" fill="#FE7A8A40" strokeWidth={3} />
            </AreaChart>
          ) : msg.chartType === 'pie' ? (
            <RePieChart>
              <Pie data={msg.chartData} innerRadius={30} outerRadius={50} dataKey="value">
                {msg.chartData.map((_, i) => <Cell key={i} fill={['#FE7A8A', '#4A3B3E', '#FFB38A'][i % 3]} />)}
              </Pie>
              <Tooltip />
            </RePieChart>
          ) : (
            <BarChart data={msg.chartData}>
              <XAxis dataKey="name" hide />
              <Tooltip />
              <Bar dataKey="value" fill="#FE7A8A" radius={[5, 5, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="fixed bottom-8 right-8 z-[1001]">
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 45 }}
            onClick={() => setIsOpen(true)}
            className="w-16 h-16 bg-studio-dark text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-rose-bloom transition-all group overflow-hidden relative"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-rose-bloom/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             <Sparkles className="w-7 h-7 relative z-10" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="absolute bottom-0 right-0 w-[400px] h-[600px] bg-white/80 backdrop-blur-3xl rounded-[3rem] border border-studio-dark/20 shadow-3xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-8 border-b border-studio-dark/5 flex justify-between items-center bg-studio-dark text-white">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-rose-bloom" />
                 </div>
                 <div>
                    <h4 className="text-sm font-black italic">Stage Manager</h4>
                    <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Insights Engine</p>
                 </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Body */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth"
            >
              {messages.map(msg => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-[2rem] p-6 text-sm font-medium ${
                    msg.sender === 'user' 
                      ? 'bg-studio-dark text-white rounded-tr-none' 
                      : 'bg-rose-petal/5 text-studio-dark border border-studio-dark/10 rounded-tl-none'
                  }`}>
                    {msg.text}
                    {renderChart(msg)}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                   <div className="bg-rose-petal/5 rounded-[2rem] p-6 rounded-tl-none border border-studio-dark/10">
                      <div className="flex gap-1">
                        <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-rose-bloom rounded-full" />
                        <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-rose-bloom rounded-full" />
                        <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-rose-bloom rounded-full" />
                      </div>
                   </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-8 bg-white/50 border-t border-studio-dark/5">
               <div className="relative">
                  <input 
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask about your performance..."
                    className="w-full pl-6 pr-14 py-4 bg-white rounded-2xl border border-studio-dark/15 focus:border-rose-bloom outline-none text-sm transition-all shadow-sm"
                  />
                  <button 
                    onClick={handleSend}
                    disabled={isLoading}
                    className="absolute right-2 top-2 p-2.5 bg-studio-dark text-white rounded-xl hover:bg-rose-bloom transition-all disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudioAI;
