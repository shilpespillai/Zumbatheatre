import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Allow Guest Students
  const guestSession = JSON.parse(localStorage.getItem('zumba_guest_session') || 'null');
  const isGuest = !!guestSession;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zumba-pink/20 border-t-zumba-pink rounded-full animate-spin" />
      </div>
    );
  }

  // If not logged in and not a guest, redirect to auth
  if (!user && !isGuest) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Handle Role Protection for Guests
  if (isGuest && allowedRoles.length > 0 && !allowedRoles.includes('STUDENT')) {
    return <Navigate to="/student/dashboard" replace />;
  }

  // Handle Role Protection for Authenticated Users
  if (user && !profile && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (user && allowedRoles.length > 0 && !allowedRoles.map(r => r.toUpperCase()).includes(profile?.role?.toUpperCase())) {
    const redirectPath = profile?.role?.toUpperCase() === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};
