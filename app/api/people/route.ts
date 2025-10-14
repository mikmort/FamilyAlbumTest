import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { Person } from '@/lib/types';

// GET /api/people - Get all people or search by name
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
      WHERE neType = 'N'
    `;

    const params: Record<string, any> = {};

    if (search) {
      queryText += ` AND neName LIKE @search`;
      params.search = `%${search}%`;
    }

    queryText += ` ORDER BY neName`;

    const people = await query<Person>(queryText, params);
    return NextResponse.json(people);
  } catch (error) {
    console.error('Error fetching people:', error);
    return NextResponse.json(
      { error: 'Failed to fetch people' },
      { status: 500 }
    );
  }
}

// POST /api/people - Create a new person
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, relationship } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const queryText = `
      INSERT INTO dbo.NameEvent (neName, neRelation, neType, neDateLastModified, neCount)
      OUTPUT INSERTED.ID, INSERTED.neName, INSERTED.neRelation, INSERTED.neDateLastModified, INSERTED.neCount
      VALUES (@name, @relationship, 'N', GETDATE(), 0)
    `;

    const result = await query<Person>(queryText, {
      name,
      relationship: relationship || '',
    });

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json(
      { error: 'Failed to create person' },
      { status: 500 }
    );
  }
}
