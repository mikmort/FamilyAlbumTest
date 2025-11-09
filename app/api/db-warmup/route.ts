import { NextResponse } from 'next/server';

/**
 * Fallback API route for /api/db-warmup
 * This is a no-op endpoint that helps warm up the database
 * When Azure Functions is not available, this just returns success
 */
export async function GET() {
  // Try to forward to Azure Functions API if it's available
  try {
    const apiUrl = 'http://localhost:7071/api/db-warmup';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);
    
    await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    
    clearTimeout(timeout);
  } catch (error) {
    // Ignore errors - this is just a warmup hint
  }
  
  // Always return success for warmup
  return NextResponse.json({ status: 'ok' });
}
