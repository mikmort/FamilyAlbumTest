// Authentication helper for Static Web Apps

export interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
}

/**
 * Get the current authenticated user from Static Web Apps
 * Returns null if user is not authenticated
 */
export async function getCurrentUser(): Promise<ClientPrincipal | null> {
  try {
    const response = await fetch('/.auth/me');
    const data = await response.json();
    
    if (data.clientPrincipal) {
      return data.clientPrincipal;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Check if the current user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Get the login URL
 */
export function getLoginUrl(redirectUrl?: string): string {
  const redirect = redirectUrl || window.location.pathname;
  return `/login.html?redirect=${encodeURIComponent(redirect)}`;
}

/**
 * Clear all session storage and browser cache for auth session
 * This ensures old user data doesn't persist across logins
 */
function clearSessionData(): void {
  // Clear browser storage
  try {
    sessionStorage.clear();
    localStorage.removeItem('familyAlbumUser');
    localStorage.removeItem('familyAlbumAuthToken');
    // Note: Keep familyAlbumLastManualMicrosoftEmail as user may want to retry
  } catch (e) {
    console.warn('Could not clear session storage:', e);
  }
}

/**
 * Get the logout URL
 * Logs out from SWA and returns to cleanup page for final session clearing
 */
export function getLogoutUrl(): string {
  // Redirect to logout cleanup page which will clear all storage before redirecting to login
  const cleanupPath = `/logout-cleanup.html?redirect=${encodeURIComponent('/login.html?fresh=1&loggedOut=1&t=' + Date.now())}`;
  return `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(cleanupPath)}`;
}

/**
 * Get the URL to sign in as a different user.
 * Logs out of SWA and returns to cleanup page for final session clearing
 */
export function getSwitchAccountUrl(): string {
  // Redirect to logout cleanup page which will clear all storage before redirecting to login
  const cleanupPath = `/logout-cleanup.html?redirect=${encodeURIComponent('/login.html?fresh=1&switch=1&t=' + Date.now())}`;
  return `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(cleanupPath)}`;
}

/**
 * Redirect to login page
 */
export function redirectToLogin(redirectUrl?: string): void {
  clearSessionData();
  window.location.href = getLoginUrl(redirectUrl);
}

/**
 * Redirect to logout
 */
export function logout(): void {
  clearSessionData();
  window.location.href = getLogoutUrl();
}

/**
 * Check if user can perform write operations
 * (Write operations require authentication)
 */
export async function canWrite(): Promise<boolean> {
  return await isAuthenticated();
}

/**
 * Higher-order function to protect API routes
 * Use this in your API routes that require authentication
 */
export async function withAuth<T>(
  handler: () => Promise<T>
): Promise<T> {
  const authenticated = await isAuthenticated();
  
  if (!authenticated) {
    throw new Error('Authentication required');
  }
  
  return handler();
}
