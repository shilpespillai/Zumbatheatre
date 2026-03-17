import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const isDevBypass = import.meta.env.VITE_DEV_BYPASS === 'true';

  useEffect(() => {
    // Check for mock user first if bypass is enabled
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
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    };

    getInitialSession();

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
    };
  }, []);

  const fetchProfile = async (userId) => {
    const id = userId || user?.id;
    if (!id) return;
    
    try {
      if (isDevBypass) {
        const mockProfile = localStorage.getItem('zumba_mock_profile');
        if (mockProfile) {
          const parsed = JSON.parse(mockProfile);
          if (parsed.id === id) {
            setProfile(parsed);
            setLoading(false);
            return;
          }
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
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
      mockProfile = { id: stableId, email, role, full_name: fullName };
      savedProfiles[stableId] = mockProfile;
      localStorage.setItem('zumba_mock_profiles', JSON.stringify(savedProfiles));
    }
    
    setUser(mockUser);
    setProfile(mockProfile);
    localStorage.setItem('zumba_mock_user', JSON.stringify(mockUser));
    localStorage.setItem('zumba_mock_profile', JSON.stringify(mockProfile));
    setLoading(false);
  };

  const signOut = async () => {
    if (isDevBypass) {
      localStorage.removeItem('zumba_mock_user');
      localStorage.removeItem('zumba_mock_profile');
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
    fetchProfile,
    isDevBypass,
    isTeacher: profile?.role?.toUpperCase() === 'TEACHER',
    isStudent: profile?.role?.toUpperCase() === 'STUDENT'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
