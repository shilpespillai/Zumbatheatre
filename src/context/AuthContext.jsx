import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../api/supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // STABILITY REFS: Track absolute latest state to avoid closure staleness and infinite loops
  const userRef = useRef(null);
  const profileRef = useRef(null);
  const isFetchingRef = useRef(false);

  const updateProfileState = (newProfile) => {
    const resolvedProfile = typeof newProfile === 'function' ? newProfile(profileRef.current) : newProfile;
    profileRef.current = resolvedProfile;
    setProfile(resolvedProfile);
  };

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        // [PHASE 34] PRE-HYDRATION: Check for cached stage before database responds
        const cachedStage = JSON.parse(localStorage.getItem('active_stage_context') || 'null');
        if (cachedStage && !profile) {
          console.log('[AuthContext] Pre-hydrating from local storage:', cachedStage.stage_code);
          setProfile({
            ...cachedStage,
            is_subscribed: cachedStage.is_subscribed || false,
            is_cached: true,
            is_draft: true
          });
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          
          // [PHASE 37] FULL IDENTITY HYDRATION: Ensure the cached/draft profile has the student ID instantly
          if (cachedStage) {
             setProfile({
               ...cachedStage,
               id: session.user.id,
               role: session.user.user_metadata?.role || 'STUDENT',
               is_subscribed: session.user.user_metadata?.is_subscribed || cachedStage.is_subscribed || false,
               is_cached: true,
               is_draft: true
             });
          }
          
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
      const currentProfile = profileRef.current;
      
      // STABILITY: Only update user state if the ID changed or it went from null to non-null
      if (currentUser?.id !== userRef.current?.id) {
        console.log(`[AuthContext] Auth Event: ${event} (New User/Session detected)`);
        userRef.current = currentUser;
        setUser(currentUser);
      } else {
        console.log(`[AuthContext] Auth Event: ${event} (Ignored redundant user update)`);
      }

      if (currentUser) {
        const isNewUser = !currentProfile || currentProfile.id !== currentUser.id;
        const isSessionStart = event === 'SIGNED_IN' || event === 'INITIAL_SESSION';

        // [PHASE 44] STABILITY GUARD: Only reset to draft for a completely NEW user or cold-start.
        // For existing users, session re-init/sign-in (re-focus) should NOT downgrade Stable to Draft.
        const shouldResetToDraft = isNewUser || (isSessionStart && (!currentProfile || currentProfile.is_draft));

        if (shouldResetToDraft) {
          if (currentUser.user_metadata?.role) {
            console.log('[AuthContext] Resetting/Initializing draft profile from metadata');
            updateProfileState({
              id: currentUser.id,
              role: currentUser.user_metadata.role || 'STUDENT',
              full_name: currentUser.user_metadata.full_name || 'User',
              is_subscribed: currentUser.user_metadata.is_subscribed || (currentProfile?.is_subscribed ?? false),
              is_draft: true
            });
            setLoading(false);
          }
          await fetchProfile(currentUser.id, currentUser);
        } else {
          // It's a re-focus or token refresh for the same stable user; just sync and maybe fetch in background
          console.log('[AuthContext] Session refreshed for stable user. Syncing metadata...');
          updateProfileState(prev => ({
            ...(prev || {}),
            linked_teacher_id: currentUser.user_metadata.linked_teacher_id || prev?.linked_teacher_id,
            is_subscribed: currentUser.user_metadata.is_subscribed || prev?.is_subscribed || false
          }));
          
          if (isSessionStart || event === 'TOKEN_REFRESHED') {
            await fetchProfile(currentUser.id, currentUser);
          }
        }
      } else {
        updateProfileState(null);
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
    const id = userId || userRef.current?.id;
    const activeUser = currentUserObj || userRef.current;
    const currentProfile = profileRef.current;
    if (!id) return;
    
    // HARD DEDUPLICATION: Prevent multiple concurrent fetches for the same ID
    if (isFetchingRef.current && !currentUserObj?.force) {
      console.log(`[AuthContext] Fetch already in progress for ${id}, skipping.`);
      return;
    }

    if (id === lastFetchedId && !userId && currentProfile && !currentProfile.is_draft && !currentUserObj?.force) {
      console.log(`[AuthContext] Skipping redundant background fetch for ${id}`);
      return;
    }

    try {
      isFetchingRef.current = true;
      console.log(`[AuthContext] Fetching profile for ${id}...`);
      setLastFetchedId(id);

      // PRE-EMPTIVE DRAFT: Use metadata immediately to unblock the UI during cold starts
      if (activeUser?.user_metadata?.role && (!currentProfile || currentProfile.is_draft)) {
        console.log('[AuthContext] Setting/Updating pre-emptive draft from metadata');
        updateProfileState({ 
          id, 
          role: activeUser.user_metadata.role, 
          full_name: activeUser.user_metadata.full_name || 'User',
          stage_code: activeUser.user_metadata.stage_code || null,
          linked_teacher_id: activeUser.user_metadata.linked_teacher_id || null,
          is_subscribed: activeUser.user_metadata.is_subscribed || (currentProfile?.is_subscribed ?? false),
          is_draft: true
        });
        setLoading(false);
      }
      
      // Increased timeout to 45s to handle ultra-slow boots or throttled connections
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AuthContext Fetch Timeout (45s)')), 45001));
      const fetchPromise = supabase.from('profiles').select('*').eq('id', id).single();
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (error) {
        console.warn(`[AuthContext] Fetch attempt failed for ${id}:`, error.message);
        
        const retryCount = currentUserObj?.retry || 0;
        if (retryCount < 2) {
          const delay = retryCount === 0 ? 3000 : 7000;
          console.log(`[AuthContext] Retrying in ${delay}ms... (Attempt ${retryCount + 1})`);
          setTimeout(() => fetchProfile(id, { ...currentUserObj, retry: retryCount + 1 }), delay);
          return;
        }

        // CRITICAL PROTECTION: Never overwrite a Stable Profile with a Draft Profile
        const latestProfile = profileRef.current;
        if (!latestProfile || latestProfile.is_draft) {
          console.log('[AuthContext] Falling back to metadata failsafe (Identity only).');
          const finalUser = currentUserObj || user;
          if (finalUser?.user_metadata) {
            updateProfileState({ 
              id, 
              role: finalUser.user_metadata.role, 
              full_name: finalUser.user_metadata.full_name || 'User',
              stage_code: finalUser.user_metadata.stage_code || null,
              linked_teacher_id: finalUser.user_metadata.linked_teacher_id || null,
              is_subscribed: finalUser.user_metadata.is_subscribed || false,
              is_draft: true
            });
          }
        }
      } else if (data) {
        console.log('[AuthContext] Profile fetched (Stable).');
        updateProfileState({ ...data, is_draft: false });
      }
    } catch (err) {
      console.error('[AuthContext] Fatal fetch error:', err);
    } finally {
      isFetchingRef.current = false;
      if (profileRef.current || (currentUserObj?.retry >= 2)) {
        setLoading(false);
      }
    }
  };

  const signOut = async () => {
    try {
      console.log('[AuthContext] Initiating optimistic sign out...');
      // 1. Optimistically clear local state and persistence tokens immediately
      setUser(null);
      updateProfileState(null);
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
        stage_code: stageData.stage_code,
        is_subscribed: stageData.is_subscribed
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
