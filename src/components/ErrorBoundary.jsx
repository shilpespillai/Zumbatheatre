import React from 'react';
import { AlertCircle, RefreshCw, Home, Sparkles } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Global ErrorBoundary] caught an error:', error, errorInfo);
  }

  handleReset = () => {
    // Clear all potential zumba-related state
    const keysToRemove = [
      'zumba_guest_session',
      'zumba_mock_user',
      'zumba_mock_profile',
      'zumba_mock_profiles',
      'zumba_mock_schedules',
      'zumba_mock_routines',
      'zumba_mock_bookings',
      'zumba_system_config'
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bloom-white flex items-center justify-center p-6 text-theatre-dark font-sans">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-rose-bloom blur-[150px] rounded-full" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-lavender blur-[150px] rounded-full" />
          </div>

          <div className="max-w-md w-full relative z-10 text-center">
            <div className="inline-block p-6 bg-rose-bloom/10 rounded-[2.5rem] mb-8 rotate-3 shadow-2xl shadow-rose-bloom/10">
              <AlertCircle className="w-12 h-12 text-rose-bloom" />
            </div>
            
            <h1 className="text-4xl font-black mb-4 tracking-tight italic">Stage Disruption.</h1>
            <p className="text-[#4A3B3E]/60 font-bold uppercase tracking-widest text-[10px] mb-12 leading-loose">
              An unexpected energy shift occurred. Don't worry, your progress is safe.
            </p>

            <div className="space-y-4">
              <button 
                onClick={() => window.location.reload()}
                className="w-full btn-premium bg-theatre-dark text-white py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-rose-bloom transition-all shadow-xl shadow-theatre-dark/20 font-black uppercase tracking-widest text-[10px]"
              >
                <RefreshCw className="w-4 h-4" /> Reset The Stage
              </button>
              
              <button 
                onClick={this.handleReset}
                className="w-full py-5 rounded-2xl border border-theatre-dark/15 text-theatre-dark/60 flex items-center justify-center gap-3 hover:bg-white transition-all font-black uppercase tracking-widest text-[10px]"
              >
                <Home className="w-4 h-4" /> Return Home
              </button>
            </div>

            <div className="mt-16 flex items-center justify-center gap-2 opacity-20">
              <Sparkles className="w-4 h-4" />
              <span className="text-[8px] font-black uppercase tracking-[0.2em]">Zumba Theatre® Protocol</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
