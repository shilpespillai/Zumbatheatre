import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Allow Guest Students
  const guestSession = JSON.parse(localStorage.getItem('studio_guest_session') || 'null');
  const isGuest = !!guestSession;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-studio-pink/20 border-t-studio-pink rounded-full animate-spin" />
      </div>
    );
  }

  // 1. If not logged in and not a guest, redirect to auth
  if (!user && !isGuest && !loading) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 2. Handle Onboarding - if user exists but has no profile role yet
  if (user && !profile?.role && !loading && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // 3. Handle Role Protection for Authenticated Users (Real Users take priority)
  if (user && profile?.role && allowedRoles.length > 0) {
    const userRole = profile.role.toUpperCase();
    const isAllowed = allowedRoles.map(r => r.toUpperCase()).includes(userRole);
    
    if (!isAllowed) {
      const redirectPath = userRole === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard';
      if (location.pathname !== redirectPath) {
        return <Navigate to={redirectPath} replace />;
      }
    }
    return children;
  }

  // 4. Handle Role Protection for Guests (Only if no real user)
  if (isGuest && !user && allowedRoles.length > 0 && !allowedRoles.includes('STUDENT')) {
    return <Navigate to="/student/dashboard" replace />;
  }

  return children;
};
