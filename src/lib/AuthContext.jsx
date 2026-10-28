import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { db } from '@/api/dataClient';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const authCheckInFlight = useRef(false);

  const checkUserAuth = useCallback(async () => {
    if (authCheckInFlight.current) return;
    authCheckInFlight.current = true;
    setIsLoadingAuth(true);

    try {
      const currentUser = await db.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);

      // An expired/invalid session is treated as signed out. Do not show a
      // blocking auth error: public pages (reports, forms) must still load.
      if (error.status === 401 || error.status === 403) {
        setAuthError(null);
      } else {
        setAuthError({
          type: 'unknown',
          message: error.message || 'Failed to load user',
        });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
      authCheckInFlight.current = false;
    }
  }, []);

  const checkAppState = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (data.session?.user) {
        await checkUserAuth();
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: 'unknown',
        message: error.message || 'Failed to load session',
      });
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [checkUserAuth]);

  useEffect(() => {
    checkAppState();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }

      if (
        event === 'SIGNED_IN' ||
        event === 'INITIAL_SESSION' ||
        event === 'USER_UPDATED' ||
        event === 'PASSWORD_RECOVERY'
      ) {
        void checkUserAuth();
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [checkAppState, checkUserAuth]);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    await db.auth.logout(shouldRedirect);
  };

  const navigateToLogin = () => {
    db.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authError,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
