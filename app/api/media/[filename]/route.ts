import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { MediaItem, PersonWithRelation } from '@/lib/types';

// GET /api/media/[filename] - Get a specific media item with tagged people
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = decodeURIComponent(params.filename);

    // Get media item
    const mediaQuery = `
      SELECT * FROM dbo.Pictures WHERE PFileName = @filename
    `;
    const mediaResult = await query<MediaItem>(mediaQuery, { filename });

    if (mediaResult.length === 0) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      );
    }

    const media = mediaResult[0];

    // Get tagged people
    const peopleQuery = `
      SELECT 
        ne.ID,
        ne.neName as Name,
        ne.neRelation as Relationship,
        np.npPosition as Position
      FROM dbo.NameEvent ne
      INNER JOIN dbo.NamePhoto np ON ne.ID = np.npID
      WHERE ne.neType = 'N' AND np.npFileName = @filename
      ORDER BY np.npPosition
    `;
    const people = await query<PersonWithRelation>(peopleQuery, { filename });

    // Get associated event
    const eventQuery = `
      SELECT 
        ne.ID,
        ne.neName as Name,
        ne.neRelation as Details
      FROM dbo.NameEvent ne
      INNER JOIN dbo.NamePhoto np ON ne.ID = np.npID
      WHERE ne.neType = 'E' AND np.npFileName = @filename
    `;
    const eventResult = await query(eventQuery, { filename });
    const event = eventResult.length > 0 ? eventResult[0] : null;

    return NextResponse.json({
      media,
      people,
      event,
    });
  } catch (error) {
    console.error('Error fetching media item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media item' },
      { status: 500 }
    );
  }
}

// PUT /api/media/[filename] - Update a media item
export async function PUT(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = decodeURIComponent(params.filename);
    const body = await request.json();
    const { description, month, year, peopleIds, eventId } = body;

    // Update media item
    const updateQuery = `
      UPDATE dbo.Pictures
      SET PDescription = @description,
          PMonth = @month,
          PYear = @year,
          PNameCount = @nameCount
      WHERE PFileName = @filename
    `;

    await execute(updateQuery, {
      filename,
      description: description || '',
      month: month || null,
      year: year || null,
      nameCount: peopleIds ? peopleIds.length : 0,
    });

    // Delete existing person-photo associations
    await execute(
      `DELETE FROM dbo.NamePhoto WHERE npFileName = @filename AND npID IN (
        SELECT ID FROM dbo.NameEvent WHERE neType = 'N'
      )`,
      { filename }
    );

    // Add new person associations
    if (peopleIds && peopleIds.length > 0) {
      for (let i = 0; i < peopleIds.length; i++) {
        await execute(
          `INSERT INTO dbo.NamePhoto (npID, npFileName, npPosition) 
           VALUES (@id, @filename, @position)`,
          { id: peopleIds[i], filename, position: i }
        );
      }
    }

    // Update event association
    await execute(
      `DELETE FROM dbo.NamePhoto WHERE npFileName = @filename AND npID IN (
        SELECT ID FROM dbo.NameEvent WHERE neType = 'E'
      )`,
      { filename }
    );

    if (eventId) {
      await execute(
        `INSERT INTO dbo.NamePhoto (npID, npFileName, npPosition) 
         VALUES (@id, @filename, 0)`,
        { id: eventId, filename }
      );
    }

    // Update counts
    await execute('EXEC dbo.UpdateNameEventCounts', {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating media item:', error);
    return NextResponse.json(
      { error: 'Failed to update media item' },
      { status: 500 }
    );
  }
}

// DELETE /api/media/[filename] - Delete a media item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = decodeURIComponent(params.filename);

    // Delete will cascade to NamePhoto table
    await execute(
      `DELETE FROM dbo.Pictures WHERE PFileName = @filename`,
      { filename }
    );

    // Update counts
    await execute('EXEC dbo.UpdateNameEventCounts', {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting media item:', error);
    return NextResponse.json(
      { error: 'Failed to delete media item' },
      { status: 500 }
    );
  }
}
