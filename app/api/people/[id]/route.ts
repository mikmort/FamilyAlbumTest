import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { Person } from '@/lib/types';

// GET /api/people/[id] - Get a specific person
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
      WHERE ID = @id AND neType = 'N'
    `;

    const result = await query<Person>(queryText, { id });

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error fetching person:', error);
    return NextResponse.json(
      { error: 'Failed to fetch person' },
      { status: 500 }
    );
  }
}

// PUT /api/people/[id] - Update a person
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const body = await request.json();
    const { name, relationship } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const queryText = `
      UPDATE dbo.NameEvent
      SET neName = @name, neRelation = @relationship
      WHERE ID = @id AND neType = 'N'
    `;

    await execute(queryText, { id, name, relationship: relationship || '' });

    // Fetch updated person
    const result = await query<Person>(
      `SELECT ID, neName, neRelation, neDateLastModified, neCount 
       FROM dbo.NameEvent WHERE ID = @id`,
      { id }
    );

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating person:', error);
    return NextResponse.json(
      { error: 'Failed to update person' },
      { status: 500 }
    );
  }
}

// DELETE /api/people/[id] - Delete a person
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    // Delete will cascade to NamePhoto table due to foreign key
    const queryText = `DELETE FROM dbo.NameEvent WHERE ID = @id AND neType = 'N'`;

    await execute(queryText, { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting person:', error);
    return NextResponse.json(
      { error: 'Failed to delete person' },
      { status: 500 }
    );
  }
}
