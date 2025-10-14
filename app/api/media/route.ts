import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { MediaItem, PersonWithRelation } from '@/lib/types';

// GET /api/media - Get media items with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const peopleIds = searchParams.get('peopleIds');
    const eventId = searchParams.get('eventId');
    const noPeople = searchParams.get('noPeople') === 'true';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const exclusiveFilter = searchParams.get('exclusiveFilter') === 'true';

    let queryText = `SELECT DISTINCT p.* FROM dbo.Pictures p`;
    let whereConditions: string[] = [];
    const params: Record<string, any> = {};

    if (noPeople) {
      // Get media with no people tagged
      whereConditions.push(`(p.PNameCount = 0 OR NOT EXISTS (
        SELECT 1 FROM dbo.NamePhoto np 
        INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
        WHERE np.npFileName = p.PFileName AND ne.neType = 'N'
      ))`);
    } else if (peopleIds) {
      const ids = peopleIds.split(',').map((id) => parseInt(id));
      
      if (exclusiveFilter) {
        // AND logic - media must have ALL selected people
        queryText += ` WHERE `;
        ids.forEach((id, index) => {
          if (index > 0) queryText += ` AND `;
          queryText += `EXISTS (
            SELECT 1 FROM dbo.NamePhoto np
            WHERE np.npFileName = p.PFileName AND np.npID = ${id}
          )`;
        });
      } else {
        // OR logic - media must have ANY of the selected people
        queryText += ` INNER JOIN dbo.NamePhoto np ON p.PFileName = np.npFileName`;
        whereConditions.push(`np.npID IN (${ids.join(',')})`);
      }
    } else if (eventId) {
      queryText += ` INNER JOIN dbo.NamePhoto np ON p.PFileName = np.npFileName`;
      whereConditions.push(`np.npID = ${parseInt(eventId)}`);
    }

    if (whereConditions.length > 0) {
      queryText += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    queryText += ` ORDER BY p.PYear ${sortOrder === 'asc' ? 'ASC' : 'DESC'}, 
                   p.PMonth ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;

    const media = await query<MediaItem>(queryText, params);
    return NextResponse.json(media);
  } catch (error) {
    console.error('Error fetching media:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    );
  }
}
