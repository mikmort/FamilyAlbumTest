import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { Event } from '@/lib/types';

// GET /api/events/[id] - Get a specific event
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    const queryText = `
      SELECT 
        ID,
        neName,
        neRelation,
        neDateLastModified,
        neCount
      FROM dbo.NameEvent
      WHERE ID = @id AND neType = 'E'
    `;

    const result = await query<Event>(queryText, { id });

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

// PUT /api/events/[id] - Update an event
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const body = await request.json();
    const { name, details } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const queryText = `
      UPDATE dbo.NameEvent
      SET neName = @name, neRelation = @details
      WHERE ID = @id AND neType = 'E'
    `;

    await execute(queryText, { id, name, details: details || '' });

    // Fetch updated event
    const result = await query<Event>(
      `SELECT ID, neName, neRelation, neDateLastModified, neCount 
       FROM dbo.NameEvent WHERE ID = @id`,
      { id }
    );

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[id] - Delete an event
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    // Delete will cascade to NamePhoto table due to foreign key
    const queryText = `DELETE FROM dbo.NameEvent WHERE ID = @id AND neType = 'E'`;

    await execute(queryText, { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}
