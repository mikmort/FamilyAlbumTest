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
 * Get the logout URL
 * Logs out from SWA and returns to login page.
 */
export function getLogoutUrl(): string {
  const loginPath = `/login.html?fresh=1&loggedOut=1&t=${Date.now()}`;
  return `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(loginPath)}`;
}

/**
 * Get the URL to sign in as a different user.
 * Logs out of SWA and returns to login page with switch hint.
 */
export function getSwitchAccountUrl(): string {
  const loginPath = `/login.html?fresh=1&switch=1&t=${Date.now()}`;
  return `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(loginPath)}`;
}

/**
 * Redirect to login page
 */
export function redirectToLogin(redirectUrl?: string): void {
  window.location.href = getLoginUrl(redirectUrl);
}

/**
 * Redirect to logout
 */
export function logout(): void {
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
