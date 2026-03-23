import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (error) {
        console.error('[AuthContext] Session fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // FAILSAFE: If loading is still true after 15 seconds, force it to false
    const failsafe = setTimeout(() => {
      setLoading(false);
      console.warn('[AuthContext] 15-second failsafe triggered! Supabase might be cold-booting or offline.');
    }, 15000);

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
    
    try {
      console.log(`[AuthContext] Fetching profile for ${id}...`);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('[AuthContext] Error fetching profile:', error);
        if (error.code === 'PGRST116') {
          setProfile(null);
        }
      } else {
        console.log('[AuthContext] Profile fetched successfully.');
        setProfile(data);
      }
    } catch (err) {
      console.error('[AuthContext] Profile fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
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
    fetchProfile,
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
