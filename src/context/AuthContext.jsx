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

  const fetchProfile = async (userId, currentUserObj = null) => {
    const id = userId || user?.id;
    const activeUser = currentUserObj || user;
    if (!id) return;
    
    try {
      console.log(`[AuthContext] Fetching profile for ${id}...`);
      
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AuthContext Fetch Timeout')), 8000));
      const fetchPromise = supabase.from('profiles').select('*').eq('id', id).single();
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error) {
        console.warn('[AuthContext] Error fetching profile:', error);
        if (activeUser?.user_metadata?.role) {
          console.log('[AuthContext] Falling back to user_metadata role');
          setProfile({ id, role: activeUser.user_metadata.role, full_name: activeUser.user_metadata.full_name || 'User' });
        } else if (error.code === 'PGRST116') {
          setProfile(null);
        } else {
          setProfile(null);
        }
      } else {
        console.log('[AuthContext] Profile fetched successfully.');
        setProfile(data);
      }
    } catch (err) {
      console.error('[AuthContext] Profile fetch failed (Network/Timeout):', err);
      if (activeUser?.user_metadata?.role) {
        console.log('[AuthContext] Catch: Falling back to user_metadata role');
        setProfile({ id, role: activeUser.user_metadata.role, full_name: activeUser.user_metadata.full_name || 'User' });
      } else {
        setProfile(null);
      }
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
