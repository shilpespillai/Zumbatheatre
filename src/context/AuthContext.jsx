import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const isDevBypass = import.meta.env.VITE_DEV_BYPASS === 'true';

  useEffect(() => {
    // 1. Production Safety Check
    if (isDevBypass && import.meta.env.PROD) {
      console.warn('CRITICAL: VITE_DEV_BYPASS is enabled in a production build. This is a security risk.');
    }

    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // REAL SESSION TAKES PRIORITY
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
        return;
      }

      // 2. Mock session ONLY if no real session exists
      if (isDevBypass) {
        const mockUser = localStorage.getItem('zumba_mock_user');
        const mockProfile = localStorage.getItem('zumba_mock_profile');
        if (mockUser && mockProfile) {
          setUser(JSON.parse(mockUser));
          setProfile(JSON.parse(mockProfile));
          setLoading(false);
          return;
        }
      }

      setLoading(false);
    };

    getInitialSession();

    // FAILSAFE: If loading is still true after 5 seconds, force it to false
    // This prevents "spinners of death" in case of network hangs
    const failsafe = setTimeout(() => {
      setLoading(false);
    }, 5000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
      clearTimeout(failsafe);
    };
  }, []);

  const fetchProfile = async (userId) => {
    const id = userId || user?.id;
    if (!id) return;
    
    // If we're already loading, don't set refreshing to true
    // but if we're already initialized, this is a background refresh
    const isBackground = !loading;
    
    try {
      if (isDevBypass && !userId) { // Only check mock if not explicitly fetching a real user ID
        const mockProfile = localStorage.getItem('zumba_mock_profile');
        if (mockProfile) {
          const parsed = JSON.parse(mockProfile);
          if (parsed.id === id) {
            setProfile(parsed);
            if (!isBackground) setLoading(false);
            return;
          }
        }
      }

      console.log(`[AuthContext] Fetching profile for ${id}...`);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // Don't clear profile on background refresh error unless it's a 404
        if (error.code === 'PGRST116') {
          setProfile(null);
        }
      } else {
        console.log('[AuthContext] Profile fetched successfully.');
        setProfile(data);
      }
    } catch (err) {
      console.error('Profile fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const signInMock = (email, role, fullName) => {
    // Use a stable ID based on email to persist data across logins in bypass mode
    const stableId = 'mock-id-' + btoa(email.toLowerCase()).replace(/=/g, '');
    const mockUser = { id: stableId, email };
    
    // Check if we already have a profile for this stable ID
    const savedProfiles = JSON.parse(localStorage.getItem('zumba_mock_profiles') || '{}');
    let mockProfile = savedProfiles[stableId];

    if (!mockProfile) {
      mockProfile = { 
        id: stableId, 
        email, 
        role, 
        full_name: fullName,
        payment_settings: {
          method: 'manual', // default
          config: {
            bank_instructions: 'Please pay at the studio before the session.'
          }
        },
        is_subscribed: false
      };
    } else {
      // Allow name updates during login/entrance
      mockProfile.full_name = fullName || mockProfile.full_name;
    }
    
    savedProfiles[stableId] = mockProfile;
    localStorage.setItem('zumba_mock_profiles', JSON.stringify(savedProfiles));
    
    setUser(mockUser);
    setProfile(mockProfile);
    localStorage.setItem('zumba_mock_user', JSON.stringify(mockUser));
    localStorage.setItem('zumba_mock_profile', JSON.stringify(mockProfile));
    setLoading(false);
  };

  const clearMockSession = () => {
    localStorage.removeItem('zumba_mock_user');
    localStorage.removeItem('zumba_mock_profile');
    localStorage.removeItem('zumba_guest_session');
    setUser(null);
    setProfile(null);
  };

  const signOut = async () => {
    if (isDevBypass) {
      clearMockSession();
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = '/';
  };

  const value = {
    user,
    profile,
    loading,
    signOut,
    signInMock,
    clearMockSession,
    fetchProfile,
    isDevBypass,
    isTeacher: profile?.role?.toUpperCase() === 'TEACHER',
    isStudent: profile?.role?.toUpperCase() === 'STUDENT',
    isAdmin: profile?.role?.toUpperCase() === 'ADMIN'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
