import { NextResponse } from 'next/server';

/**
 * Fallback API route for /api/new-media
 * Returns count of new/unindexed media files
 * When Azure Functions is not available, returns empty data
 */
export async function GET() {
  // Try to forward to Azure Functions API if it's available
  try {
    const apiUrl = 'http://localhost:7071/api/new-media';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    // API not available, return mock data
  }
  
  // Return empty data when API is not available
  return NextResponse.json({ count: 0 });
}
