/**
 * Session Management Configuration
 * 
 * Configure session timeout and monitoring behavior
 */

export const SESSION_CONFIG = {
  /**
   * Inactivity timeout in milliseconds
   * User session will expire after this period of no activity
   * Default: 30 minutes
   */
  INACTIVITY_TIMEOUT: 30 * 60 * 1000,

  /**
   * Session check interval in milliseconds
   * How often to check if session should expire
   * Default: 60 seconds
   */
  CHECK_INTERVAL: 60 * 1000,

  /**
   * Warning threshold in milliseconds
   * Show warning when this much time remains before expiry
   * Default: 5 minutes
   */
  WARNING_THRESHOLD: 5 * 60 * 1000,

  /**
   * Activity throttle in milliseconds
   * Minimum time between activity recordings to avoid excessive updates
   * Default: 5 seconds
   */
  ACTIVITY_THROTTLE: 5 * 1000,

  /**
   * Activity events to monitor
   * User interactions that count as "activity"
   */
  ACTIVITY_EVENTS: ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'mousemove'] as const,
};

/**
 * Helper function to format timeout duration for display
 */
export const formatTimeout = (milliseconds: number): string => {
  const minutes = Math.floor(milliseconds / 60000);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 
    ? `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`
    : `${hours} hour${hours !== 1 ? 's' : ''}`;
};

/**
 * Get the configured inactivity timeout duration as a readable string
 */
export const getInactivityTimeoutLabel = (): string => {
  return formatTimeout(SESSION_CONFIG.INACTIVITY_TIMEOUT);
};
