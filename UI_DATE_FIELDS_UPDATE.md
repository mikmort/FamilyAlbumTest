# UI Updates for Event Dates and Birthdays

## Overview

Updated the People Manager and Events Manager UI components to display and edit the new Birthday and EventDate fields added to the database.

## Changes Made

### 1. Type Definitions (`lib/types.ts`)

Updated the TypeScript interfaces to include the new date fields:

```typescript
export interface Person {
  ID: number;
  neName: string;
  neRelation: string;
  neDateLastModified: Date;
  neCount: number;
  Birthday?: string | null; // NEW: ISO date string (YYYY-MM-DD)
}

export interface Event {
  ID: number;
  neName: string;
  neRelation: string;
  neDateLastModified: Date;
  neCount: number;
  EventDate?: string | null; // NEW: ISO date string (YYYY-MM-DD)
}
```

### 2. People Manager (`components/PeopleManager.tsx`)

**Form State:**
- Added `formBirthday` state variable
- Initialized/cleared in all form operations

**Create Person:**
- Added Birthday date input field
- Sends `birthday` parameter to API

**Update Person:**
- Includes `birthday` in PUT request
- Pre-populates form with existing birthday

**Display:**
- Added "Birthday" column to table
- Shows formatted date (e.g., "Jan 15, 2000") or "—" if not set
- Format: `MMM DD, YYYY` using `toLocaleDateString()`

### 3. Events Manager (`components/ManageEvents.tsx`)

**Type Definition:**
- Added `EventDate?: string | null` to `EventItem` type

**Form State:**
- Added `newEventDate` and `editEventDate` state variables
- Initialized/cleared in all form operations

**Create Event:**
- Added EventDate date input field in create form
- Sends `eventDate` parameter to API
- Positioned between name and description fields

**Update Event:**
- Added EventDate date input field in edit form
- Includes `eventDate` in PUT request
- Pre-populates form with existing event date

**Display:**
- Shows formatted EventDate instead of neDateLastModified
- Format: `MMM DD, YYYY` (e.g., "Dec 15, 2003")
- Displays "No date" if EventDate is null
- Added photo count to display (e.g., "· 25 photos")

### 4. API Endpoints

#### People API (`api/people/index.js`)

**GET /api/people:**
- Now returns `Birthday` field for all people
- Added to SELECT query

**GET /api/people/:id:**
- Now returns `Birthday` field for specific person
- Added to SELECT query

**POST /api/people:**
- Accepts `birthday` parameter in request body
- Inserts Birthday into database
- Returns Birthday in response

**PUT /api/people:**
- Accepts `birthday` parameter in request body
- Updates Birthday in database
- Returns updated Birthday in response

#### Events API (`api/events/index.js`)

**GET /api/events:**
- Now returns `EventDate` field for all events
- Added to SELECT query

**GET /api/events/:id:**
- Now returns `EventDate` field for specific event
- Added to SELECT query

**POST /api/events:**
- Accepts `eventDate` parameter in request body
- Inserts EventDate into database
- Returns EventDate in response

**PUT /api/events:**
- Accepts `eventDate` parameter in request body
- Updates EventDate in database
- Returns updated EventDate in response

## User Experience

### People Manager

**Create/Edit Form:**
```
Name: [John Smith]
Relationship: [Uncle]
Birthday: [1980-05-15]  ← New date picker
[✓ Save] [Cancel]
```

**Table Display:**
```
Name          | Relationship | Birthday      | Photos | Actions
John Smith    | Uncle        | May 15, 1980  | 45     | ✏️ 🗑️
Jane Doe      | Aunt         | —             | 32     | ✏️ 🗑️
```

### Events Manager

**Create Form:**
```
Event name: [Summer Vacation 2020]
Event date: [2020-07-15]  ← New date picker
Description: [Trip to the beach]
[Create] [Clear]
```

**Edit Form:**
```
Event name: [Summer Vacation 2020]
Event date: [2020-07-15]  ← New date picker
Description: [Trip to the beach]
[Save] [Cancel]
```

**Display:**
```
Summer Vacation 2020
Jul 15, 2020 · Trip to the beach · 42 photos
[Edit] [Delete]
```

## Date Format

All dates are stored in the database as DATE type (YYYY-MM-DD) and displayed using JavaScript's `toLocaleDateString()`:

```typescript
new Date(dateString).toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'short', 
  day: 'numeric' 
})
```

**Examples:**
- `2020-07-15` → "Jul 15, 2020"
- `1980-05-15` → "May 15, 1980"
- `null` → "—" (for people) or "No date" (for events)

## HTML5 Date Input

Both forms use HTML5 `<input type="date">` which provides:
- Native date picker UI (varies by browser)
- Automatic validation
- ISO format (YYYY-MM-DD) value
- Keyboard navigation
- Accessibility support

## API Request/Response Examples

### Create Person with Birthday

**Request:**
```json
POST /api/people
{
  "name": "John Smith",
  "relation": "Uncle",
  "birthday": "1980-05-15"
}
```

**Response:**
```json
{
  "success": true,
  "person": {
    "ID": 123,
    "neName": "John Smith",
    "neRelation": "Uncle",
    "Birthday": "1980-05-15",
    "neCount": 0
  }
}
```

### Create Event with Date

**Request:**
```json
POST /api/events
{
  "name": "Summer Vacation 2020",
  "relation": "Trip to the beach",
  "eventDate": "2020-07-15"
}
```

**Response:**
```json
{
  "success": true,
  "event": {
    "ID": 456,
    "neName": "Summer Vacation 2020",
    "neRelation": "Trip to the beach",
    "EventDate": "2020-07-15",
    "neCount": 0
  }
}
```

## Backward Compatibility

- Birthday and EventDate fields are optional (NULL allowed)
- Existing records without dates display "—" or "No date"
- API accepts NULL values for dates
- Empty string in form is converted to NULL before sending to API

## Testing

**Manual Testing Steps:**

1. **People Manager - Create:**
   - Navigate to People Manager
   - Click "Add New Person"
   - Enter name, relationship, and birthday
   - Submit form
   - Verify person appears in list with formatted birthday

2. **People Manager - Edit:**
   - Click edit icon on existing person
   - Change birthday or add if missing
   - Save changes
   - Verify updated birthday displays correctly

3. **Events Manager - Create:**
   - Navigate to Events Manager
   - Fill in event name, date, and description
   - Submit form
   - Verify event appears with formatted date

4. **Events Manager - Edit:**
   - Click edit button on existing event
   - Change event date or add if missing
   - Save changes
   - Verify updated date displays correctly

5. **Edge Cases:**
   - Leave date fields empty (should save as NULL)
   - Verify NULL dates display as "—" or "No date"
   - Check date picker UI in different browsers

## Files Modified

### Frontend (TypeScript/React)
- `lib/types.ts` - Added Birthday and EventDate fields to interfaces
- `components/PeopleManager.tsx` - Added birthday form field and display column
- `components/ManageEvents.tsx` - Added event date form field and display

### Backend (JavaScript/Node.js)
- `api/people/index.js` - Handle Birthday in GET/POST/PUT operations
- `api/events/index.js` - Handle EventDate in GET/POST/PUT operations

## Future Enhancements

1. **Validation:**
   - Add max date validation (can't be in future for birthdays)
   - Add min date validation (reasonable historical limits)
   - Validate event dates are consistent with photo dates

2. **Sorting:**
   - Add ability to sort by birthday (show upcoming birthdays)
   - Sort events chronologically by EventDate

3. **Filtering:**
   - Filter people by birth month (birthday reminders)
   - Filter events by year or date range
   - Show events without dates

4. **Display:**
   - Show age calculation for people (based on birthday)
   - Show time since event (e.g., "5 years ago")
   - Highlight upcoming birthdays

5. **Bulk Operations:**
   - Import birthdays from CSV
   - Batch update event dates from photo metadata

## Notes

- All date values are stored in UTC in the database
- Date picker uses browser's locale for display
- No time zone conversion is performed (dates are date-only, no time component)
- The inference script populated 64 birthdays and 146 event dates automatically
