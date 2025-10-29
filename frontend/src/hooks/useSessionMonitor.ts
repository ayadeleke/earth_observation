import { useState, useEffect, useCallback, useRef } from 'react';
import { SESSION_CONFIG } from '../config/session.config';

interface UseSessionMonitorReturn {
  isSessionExpired: boolean;
  timeUntilExpiry: number | null;
  checkSession: () => void;
  resetExpiration: () => void;
  lastActivity: number;
}

const INACTIVITY_TIMEOUT = SESSION_CONFIG.INACTIVITY_TIMEOUT;
const ACTIVITY_THROTTLE = SESSION_CONFIG.ACTIVITY_THROTTLE;

export const useSessionMonitor = (checkInterval: number = 60000): UseSessionMonitorReturn => {
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number | null>(null);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const hasCheckedRef = useRef(false);
  const lastActivityUpdateRef = useRef<number>(Date.now());

  const getToken = useCallback(() => {
    return localStorage.getItem('access_token');
  }, []);

  const checkSession = useCallback(() => {
    const token = getToken();
    
    if (!token) {
      if (hasCheckedRef.current) {
        setIsSessionExpired(true);
      }
      setTimeUntilExpiry(null);
      return;
    }

    try {
      // Decode JWT token to check expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      const tokenExpiryTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeSinceActivity = currentTime - lastActivity;

      // Calculate time until expiry based on inactivity
      const inactivityExpiryTime = lastActivity + INACTIVITY_TIMEOUT;
      const timeUntilInactivityExpiry = inactivityExpiryTime - currentTime;
      const timeUntilTokenExpiry = tokenExpiryTime - currentTime;

      // Use the shorter of the two expiry times
      const effectiveTimeLeft = Math.min(timeUntilInactivityExpiry, timeUntilTokenExpiry);

      setTimeUntilExpiry(effectiveTimeLeft > 0 ? effectiveTimeLeft : 0);

      // Check if session should expire due to inactivity or token expiration
      if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
        console.warn('Session expired due to inactivity');
        setIsSessionExpired(true);
        // Clear tokens
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      } else if (timeUntilTokenExpiry <= 0) {
        console.warn('Session expired due to token expiration');
        setIsSessionExpired(true);
        // Clear expired token
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      } else if (effectiveTimeLeft <= 5 * 60 * 1000) {
        // Session expires in less than 5 minutes - log warning
        const reason = timeUntilInactivityExpiry < timeUntilTokenExpiry ? 'inactivity' : 'token expiration';
        console.warn(`Session will expire soon (${reason}):`, Math.floor(effectiveTimeLeft / 1000), 'seconds remaining');
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setIsSessionExpired(true);
    }

    hasCheckedRef.current = true;
  }, [getToken, lastActivity]);

  const recordActivity = useCallback(() => {
    const now = Date.now();
    
    // Throttle activity updates to avoid too frequent state changes
    if (now - lastActivityUpdateRef.current >= ACTIVITY_THROTTLE) {
      setLastActivity(now);
      lastActivityUpdateRef.current = now;
      
      // Store activity timestamp in localStorage for persistence across page reloads
      localStorage.setItem('last_activity', now.toString());
      
      console.log('User activity recorded');
    }
  }, []);

  const resetExpiration = useCallback(() => {
    setIsSessionExpired(false);
    recordActivity();
    checkSession();
  }, [checkSession, recordActivity]);

  useEffect(() => {
    // Initialize last activity from localStorage if available
    const storedActivity = localStorage.getItem('last_activity');
    if (storedActivity) {
      const storedTime = parseInt(storedActivity, 10);
      const now = Date.now();
      
      // Only use stored activity if it's recent (within inactivity timeout)
      if (now - storedTime < INACTIVITY_TIMEOUT) {
        setLastActivity(storedTime);
        lastActivityUpdateRef.current = storedTime;
      } else {
        // Stored activity is too old, start fresh
        localStorage.setItem('last_activity', now.toString());
      }
    } else {
      // No stored activity, initialize
      localStorage.setItem('last_activity', Date.now().toString());
    }

    // Check session immediately
    checkSession();

    // Set up periodic checking
    const interval = setInterval(checkSession, checkInterval);

    // Handle user activity events
    const handleActivity = () => {
      recordActivity();
      checkSession();
    };

    // Monitor various user activity events
    const events = SESSION_CONFIG.ACTIVITY_EVENTS;
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Also check when window gains focus
    window.addEventListener('focus', handleActivity);

    return () => {
      clearInterval(interval);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener('focus', handleActivity);
    };
  }, [checkInterval, checkSession, recordActivity]);

  return { isSessionExpired, timeUntilExpiry, checkSession, resetExpiration, lastActivity };
};
