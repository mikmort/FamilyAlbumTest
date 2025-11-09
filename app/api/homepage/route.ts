import { NextResponse } from 'next/server';

/**
 * Fallback API route for /api/homepage
 * Returns homepage statistics and featured content
 * When Azure Functions is not available, returns mock data
 */
export async function GET() {
  // Try to forward to Azure Functions API if it's available
  try {
    const apiUrl = 'http://localhost:7071/api/homepage';
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
  
  // Return mock data when API is not available
  return NextResponse.json({
    onThisDay: [],
    recentUploads: [],
    totalPhotos: 0,
    totalPeople: 0,
    totalEvents: 0,
    featuredPerson: null,
    featuredEvent: null,
    randomSuggestion: null
  });
}
