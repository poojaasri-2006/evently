import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from './LoadingState';

export const ProtectedRoute = ({ allowedRole }) => {
  const { user, loading, authError, retrySession } = useAuth();

  if (loading) {
    return <LoadingState />;
  }

  if (authError) return <div style={{ padding: '2rem', textAlign: 'center' }}><p role="alert">{authError}</p><button onClick={retrySession}>Try Again</button></div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
