import { NextResponse } from 'next/server';

/**
 * Fallback API route for /api/auth-status
 * This route is used when Azure Functions API is not available
 * It tries to forward to the Azure Functions API first, then falls back to mock data in dev mode
 */
export async function GET() {
  // Try to forward to Azure Functions API if it's available
  try {
    const apiUrl = 'http://localhost:7071/api/auth-status';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000); // 1 second timeout
    
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    // API not available, fall back to mock data if in dev mode
    console.log('[Fallback API] Azure Functions not available, using mock data');
  }
  
  // Check if we're in dev mode
  const devMode = process.env.DEV_MODE === 'true';
  
  if (!devMode) {
    return NextResponse.json(
      { 
        authenticated: false, 
        authorized: false, 
        user: null,
        error: 'API server not available and dev mode is disabled' 
      },
      { status: 503 }
    );
  }
  
  // Return mock dev user
  return NextResponse.json({
    authenticated: true,
    authorized: true,
    user: {
      email: process.env.DEV_USER_EMAIL || 'dev@example.com',
      name: process.env.DEV_USER_EMAIL || 'Dev User',
      role: process.env.DEV_USER_ROLE || 'Admin',
      status: 'Active'
    },
    pendingCount: 0,
    error: null
  });
}
