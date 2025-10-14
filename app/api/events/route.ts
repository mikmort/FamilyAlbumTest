import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { Event } from '@/lib/types';

// GET /api/events - Get all events or search by name
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');

    let queryText = `
      SELECT 
        ID,
        neName,
        neRelation,
        neDateLastModified,
        neCount
      FROM dbo.NameEvent
      WHERE neType = 'E'
    `;

    const params: Record<string, any> = {};

    if (search) {
      queryText += ` AND neName LIKE @search`;
      params.search = `%${search}%`;
    }

    queryText += ` ORDER BY neName`;

    const events = await query<Event>(queryText, params);
    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// POST /api/events - Create a new event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, details } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const queryText = `
      INSERT INTO dbo.NameEvent (neName, neRelation, neType, neDateLastModified, neCount)
      OUTPUT INSERTED.ID, INSERTED.neName, INSERTED.neRelation, INSERTED.neDateLastModified, INSERTED.neCount
      VALUES (@name, @details, 'E', GETDATE(), 0)
    `;

    const result = await query<Event>(queryText, {
      name,
      details: details || '',
    });

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
