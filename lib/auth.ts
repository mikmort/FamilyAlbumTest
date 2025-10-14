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
  return `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(redirect)}`;
}

/**
 * Get the logout URL
 */
export function getLogoutUrl(): string {
  return '/.auth/logout';
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
