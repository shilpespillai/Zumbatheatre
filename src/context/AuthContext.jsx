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
        // [PHASE 34] PRE-HYDRATION: Check for cached stage before database responds
        const cachedStage = JSON.parse(localStorage.getItem('active_stage_context') || 'null');
        if (cachedStage && !profile) {
          console.log('[AuthContext] Pre-hydrating from local storage:', cachedStage.stage_code);
          setProfile({
            ...cachedStage,
            is_cached: true,
            is_draft: true
          });
        }

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
      console.log(`[AuthContext] Auth Event: ${event}`);
      const currentUser = session?.user ?? null;
      
      // Update user state immediately
      setUser(currentUser);

      if (currentUser) {
        // Only fetch if it's a NEW session or the ID changed
        // USER_UPDATED events happen during metadata syncs; we don't want to reset profile to null then
        // Re-fetch on sign-in, session initialization, or if IDs change
        // Added USER_UPDATED: If metadata changes (like linked_teacher_id), we want to pull the fresh profile
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED' || !profile || profile.id !== currentUser.id) {
          await fetchProfile(currentUser.id, currentUser);
        }
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

  const [lastFetchedId, setLastFetchedId] = useState(null);

  const fetchProfile = async (userId, currentUserObj = null) => {
    const id = userId || user?.id;
    const activeUser = currentUserObj || user;
    if (!id) return;
    
    // Deduplication: Only skip if it's an automatic background refresh AND we already have a stable ID
    // If userId is explicitly passed, or if we don't have a profile yet, we MUST fetch.
    // [PHASE 33] Enhanced Guard: Never skip if we are in a "Draft" or "Loading" state
    if (id === lastFetchedId && !userId && profile && !profile.is_draft && !currentUserObj?.force) {
      console.log(`[AuthContext] Skipping redundant background fetch for ${id}`);
      return;
    }

    try {
      console.log(`[AuthContext] Fetching profile for ${id}...`);
      setLastFetchedId(id);

      // PRE-EMPTIVE DRAFT: Use metadata immediately to unblock the UI during cold starts
      if (activeUser?.user_metadata?.role && !profile) {
        console.log('[AuthContext] Setting pre-emptive draft from metadata');
        setProfile({ 
          id, 
          role: activeUser.user_metadata.role, 
          full_name: activeUser.user_metadata.full_name || 'User',
          stage_code: activeUser.user_metadata.stage_code || null,
          linked_teacher_id: activeUser.user_metadata.linked_teacher_id || null,
          is_draft: true
        });
        setLoading(false); // Unblock UI early
      }
      
      // Increased timeout to 12s to give Supabase room to cold-start without cutting off the DB fetch too soon
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AuthContext Fetch Timeout')), 12001));
      const fetchPromise = supabase.from('profiles').select('*').eq('id', id).single();
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (error) {
        console.warn(`[AuthContext] Fetch attempt failed for ${id}:`, error.message);
        
        // [PHASE 33] Exponential Backoff: Retry twice before falling back to draft
        const retryCount = currentUserObj?.retry || 0;
        if (retryCount < 2) {
          const delay = retryCount === 0 ? 2000 : 5000;
          console.log(`[AuthContext] Retrying in ${delay}ms... (Attempt ${retryCount + 1})`);
          setTimeout(() => fetchProfile(id, { ...currentUserObj, retry: retryCount + 1 }), delay);
          return;
        }

        // CRITICAL PROTECTION: Never overwrite a Stable Profile with a Draft Profile
        if (!profile || profile.is_draft) {
          console.log('[AuthContext] Falling back to metadata failsafe (Identity only).');
          const activeUser = currentUserObj || user;
          if (activeUser?.user_metadata) {
            setProfile({ 
              id, 
              role: activeUser.user_metadata.role, 
              full_name: activeUser.user_metadata.full_name || 'User',
              stage_code: activeUser.user_metadata.stage_code || null,
              linked_teacher_id: activeUser.user_metadata.linked_teacher_id || null,
              is_draft: true
            });
          }
        }
      } else if (data) {
        console.log('[AuthContext] Profile fetched (Stable).');
        setProfile({ ...data, is_draft: false });
      }
    } catch (err) {
      console.error('[AuthContext] Fatal fetch error:', err);
    } finally {
      // Only release loading if we have SOMETHING or we've exhausted retries
      if (profile || (currentUserObj?.retry >= 2)) {
        setLoading(false);
      }
    }
  };

  const signOut = async () => {
    try {
      console.log('[AuthContext] Initiating optimistic sign out...');
      // 1. Optimistically clear local state and persistence tokens immediately
      setUser(null);
      setProfile(null);
      setLastFetchedId(null);
      localStorage.removeItem('studio_guest_session');
      localStorage.removeItem('pending_teacher_code');
      localStorage.removeItem('active_stage_context'); // Phase 34 Cache Clear
      localStorage.removeItem('supabase.auth.token');

      // 2. Fire network signout in the background (DO NOT AWAIT - prevents 15s lag)
      supabase.auth.signOut()
        .then(() => console.log('[AuthContext] Network sign out completed in background.'))
        .catch(err => console.warn('[AuthContext] Background signOut error:', err));
      
      // 3. Force instant redirect to provide immediate feedback (with loggedout flag to prevent loops)
      window.location.href = '/auth?role=teacher&loggedout=true';
    } catch (err) {
      console.error('[AuthContext] SignOut error:', err);
      // Fallback: Force clear and redirect even on critical error
      setUser(null);
      setProfile(null);
      window.location.href = '/auth';
    }
  };

  const forceRefreshProfile = async () => {
    if (user?.id) {
      setLastFetchedId(null); // Clear cache to force a real DB hit
      await fetchProfile(user.id, { force: true });
    }
  };

  const persistStageLocally = (stageData) => {
    if (stageData) {
      localStorage.setItem('active_stage_context', JSON.stringify({
        linked_teacher_id: stageData.teacher_id || stageData.linked_teacher_id,
        full_name: stageData.full_name,
        stage_code: stageData.stage_code
      }));
    } else {
      localStorage.removeItem('active_stage_context');
    }
  };

  const value = {
    user,
    profile,
    loading,
    signOut,
    fetchProfile,
    forceRefreshProfile,
    persistStageLocally,
    isTeacher: (profile?.role || user?.user_metadata?.role)?.toUpperCase() === 'TEACHER',
    isStudent: (profile?.role || user?.user_metadata?.role)?.toUpperCase() === 'STUDENT',
    isAdmin: (profile?.role || user?.user_metadata?.role)?.toUpperCase() === 'ADMIN'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
