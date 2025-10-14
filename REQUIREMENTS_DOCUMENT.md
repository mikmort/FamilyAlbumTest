# Family Album Application - Functional Requirements Document

**Version:** 1.0  
**Date:** October 14, 2025  
**Purpose:** Define functional requirements for a new TypeScript web-based family photo/video management application

---

## 1. Executive Summary

The Family Album application is a comprehensive digital media management system designed to organize, catalog, and browse family photos and videos. The application emphasizes person tagging, event association, metadata management, and efficient browsing of large media collections.

### Core Value Proposition
- Centralized management of family photos and videos
- Rich metadata including people tagging and event association
- Efficient browsing through thumbnail galleries
- Detailed media viewing with full metadata display
- Backup and restore capabilities for data preservation

---

## 2. User Personas

### Primary User
**Family Historian/Archivist**
- Manages large collection of family photos/videos (1000s of items)
- Wants to tag people in photos across generations
- Needs to organize media by events (weddings, reunions, holidays)
- Values long-term data preservation
- May have limited technical expertise

---

## 3. Core Functional Requirements

### 3.1 Media Management

#### 3.1.1 Media Types Support
**REQ-MEDIA-001:** The system shall support the following image formats:
- JPEG/JPG (primary format)
- PNG
- Other common image formats

**REQ-MEDIA-002:** The system shall support the following video formats:
- MP4
- MKV
- AVI
- MOV
- WMV
- FLV

**REQ-MEDIA-003:** The system shall automatically detect disguised PNG files saved as JPG and convert them to proper JPEG format.

**REQ-MEDIA-004:** The system shall automatically fix image orientation based on EXIF orientation tags when images are imported.

#### 3.1.2 File Import and Indexing
**REQ-IMPORT-001:** The system shall scan a designated directory (and subdirectories) for unindexed media files.

**REQ-IMPORT-002:** The system shall identify files that are not yet in the database.

**REQ-IMPORT-003:** The system shall generate thumbnails for all imported media:
- Image thumbnails from the actual image
- Video thumbnails extracted from a specific timestamp (configurable)

**REQ-IMPORT-004:** The system shall store the following metadata for each media item:
- Filename
- Directory path (relative to root)
- File dimensions (width x height)
- Media type (image/video)
- For videos: duration/playtime
- Date added to database
- Last modified date
- Month and year (from EXIF or file dates)
- Thumbnail (binary data)

**REQ-IMPORT-005:** The system shall use a two-stage import process:
- Stage 1: Files are added to an "unindexed" staging area
- Stage 2: Users review and add metadata before moving to main database

**REQ-IMPORT-006:** The system shall extract month and year from EXIF data when available, falling back to:
1. EXIF DateTaken
2. File Last Modified Date
3. File Creation Date

#### 3.1.3 File Organization
**REQ-ORG-001:** The system shall maintain a default directory for all media files (configurable).

**REQ-ORG-002:** The system shall support subdirectories within the main media directory.

**REQ-ORG-003:** The system shall store directory information relative to the root media directory.

---

### 3.2 People Management

#### 3.2.1 Person Records
**REQ-PEOPLE-001:** The system shall maintain a database of people with the following attributes:
- Unique ID
- Full Name
- Relationship to family (freeform text description)
- Last modified date
- Count of associated photos/videos

**REQ-PEOPLE-002:** Users shall be able to add new people through:
- Dedicated "Name Manager" interface
- Inline during photo tagging workflow

**REQ-PEOPLE-003:** Users shall be able to edit existing person records:
- Modify name
- Update relationship description

**REQ-PEOPLE-004:** Users shall be able to delete person records.

**REQ-PEOPLE-005:** The system shall display a count of photos/videos associated with each person.

**REQ-PEOPLE-006:** The system shall provide search functionality for finding people by name.

#### 3.2.2 Photo-Person Association
**REQ-ASSOC-001:** Users shall be able to tag multiple people in a single photo/video.

**REQ-ASSOC-002:** Users shall be able to specify the position/order of people in the media item.

**REQ-ASSOC-003:** The system shall maintain a many-to-many relationship between people and media items.

**REQ-ASSOC-004:** Users shall be able to add people to a photo/video after initial import.

**REQ-ASSOC-005:** Users shall be able to remove people from a photo/video.

**REQ-ASSOC-006:** When viewing a photo, the system shall display:
- All tagged people's full names
- Their relationship to the family
- Position in the tagging order

---

### 3.3 Event Management

#### 3.3.1 Event Records
**REQ-EVENT-001:** The system shall maintain a database of events with the following attributes:
- Unique ID
- Event Name
- Event Details/Description (freeform text)
- Last modified date
- Count of associated photos/videos

**REQ-EVENT-002:** Users shall be able to create new events through:
- Dedicated "Event Manager" interface
- Inline during photo tagging workflow

**REQ-EVENT-003:** Users shall be able to edit existing event records:
- Modify event name
- Update event details

**REQ-EVENT-004:** Users shall be able to delete event records.

**REQ-EVENT-005:** The system shall display a count of photos/videos associated with each event.

**REQ-EVENT-006:** The system shall provide search functionality for finding events by name.

#### 3.3.2 Photo-Event Association
**REQ-EVENT-ASSOC-001:** Each photo/video shall be associated with zero or one event.

**REQ-EVENT-ASSOC-002:** Users shall be able to assign or change the event for a photo/video.

**REQ-EVENT-ASSOC-003:** When viewing a photo, the system shall display the associated event name and details if present.

**REQ-EVENT-COPY-001:** The system shall provide functionality to copy all files associated with an event to a separate location.

---

### 3.4 Metadata Management

#### 3.4.1 Core Metadata
**REQ-META-001:** Each media item shall have the following editable metadata:
- Description (freeform text)
- Month (1-12)
- Year (4-digit)
- Associated event
- Tagged people (list with relationships)

**REQ-META-002:** Users shall be able to edit all metadata fields through a detail view.

**REQ-META-003:** Changes to metadata shall be saved to both the database and embedded in the file (when supported).

#### 3.4.2 Embedded Metadata (EXIF/XMP)
**REQ-EMBED-001:** The system shall read embedded metadata from media files using EXIF/XMP standards.

**REQ-EMBED-002:** The system shall write custom metadata to media files in JSON format using XMP-dc:Description field.

**REQ-EMBED-003:** The embedded JSON metadata shall include:
- Event name and details
- Month and year
- Description
- People list with names and relationships

**REQ-EMBED-004:** The system shall read embedded JSON metadata when displaying a file to pre-populate fields.

**REQ-EMBED-005:** The system shall handle both images and videos for metadata reading/writing.

---

### 3.5 Browsing and Navigation

#### 3.5.1 Start Screen
**REQ-NAV-001:** Upon launching, users shall see a "Select People" screen.

**REQ-NAV-002:** Users shall be able to select up to 5 people to browse.

**REQ-NAV-003:** The system shall provide a dropdown list of all people, sortable by name.

**REQ-NAV-004:** Users shall be able to view photos with no people tagged through a special "No People" filter.

**REQ-NAV-005:** Users shall be able to clear their selection and choose different people.

#### 3.5.2 Thumbnail Gallery View
**REQ-THUMB-001:** After selecting people/event, the system shall display a thumbnail gallery of matching media.

**REQ-THUMB-002:** Thumbnails shall be displayed in a flow/grid layout that adapts to screen size.

**REQ-THUMB-003:** Users shall be able to sort the gallery by:
- Oldest to newest (by year, then month)
- Newest to oldest (by year, then month)

**REQ-THUMB-004:** The thumbnail view shall show:
- Thumbnail image
- Basic indicators (video vs image)

**REQ-THUMB-005:** Users shall be able to click/tap a thumbnail to view full details.

**REQ-THUMB-006:** The gallery shall support smooth scrolling for large collections.

**REQ-THUMB-007:** The system shall display a loading indicator while thumbnails are being loaded.

#### 3.5.3 Filtering Logic
**REQ-FILTER-001:** When multiple people are selected, the system shall show media items that include ANY of the selected people (OR logic).

**REQ-FILTER-002:** Users shall optionally enable "exclusive" filtering to show only items that include ALL selected people (AND logic).

**REQ-FILTER-003:** When an event is selected, the system shall show all media associated with that event.

**REQ-FILTER-004:** The system shall support filtering by:
- People (up to 5 simultaneously)
- Events (single selection)
- No people tagged (special filter)

---

### 3.6 Detail View

#### 3.6.1 Photo Detail View
**REQ-DETAIL-001:** Clicking a thumbnail shall open a full-screen detail view.

**REQ-DETAIL-002:** For images, the detail view shall display:
- Full-size image (zoomed to fit screen)
- Filename
- Dimensions (width x height in pixels)
- Month and year
- Description (editable text box)
- Event name and details (if assigned)
- List of tagged people with their relationships

**REQ-DETAIL-003:** For videos, the detail view shall display:
- Video player with play/pause/restart controls
- Filename
- Dimensions
- Duration
- Month and year
- Description (editable text box)
- Event name and details (if assigned)
- List of tagged people with their relationships

**REQ-DETAIL-004:** The detail view shall provide a split-screen layout:
- Left panel: Media display
- Right panel: Metadata and controls

#### 3.6.2 Editing in Detail View
**REQ-EDIT-001:** Users shall be able to add people to the current media item from the detail view.

**REQ-EDIT-002:** Users shall be able to remove people from the current media item.

**REQ-EDIT-003:** Users shall be able to specify the position/order when adding a person.

**REQ-EDIT-004:** Users shall be able to edit:
- Description
- Month
- Year
- Event association

**REQ-EDIT-005:** Changes shall be saved to the database.

**REQ-EDIT-006:** Users shall be able to embed/update metadata in the file itself.

**REQ-EDIT-007:** Users shall be able to create new people inline without leaving the detail view.

**REQ-EDIT-008:** When adding a new person, users shall provide:
- Full name
- Relationship to family

---

### 3.7 New Photo/Video Processing

#### 3.7.1 Unindexed File Review
**REQ-PROCESS-001:** The system shall provide a dedicated interface for processing unindexed files.

**REQ-PROCESS-002:** Files shall be processed one at a time in a review workflow.

**REQ-PROCESS-003:** For each unindexed file, the system shall display:
- Image preview or video player
- Filename
- Dimensions
- Auto-detected month and year (editable)
- Fields to add: description, event, people

**REQ-PROCESS-004:** Users shall be able to:
- Add metadata
- Tag people
- Associate with event
- Save and move to next file
- Delete the file
- Skip to next/previous file

**REQ-PROCESS-005:** The system shall automatically extract and pre-fill metadata from embedded EXIF/JSON when available.

**REQ-PROCESS-006:** Upon saving, the file shall be moved from "unindexed" status to the main database.

**REQ-PROCESS-007:** The system shall notify users when all files have been processed.

**REQ-PROCESS-008:** Users shall be able to fix image orientation if needed.

---

### 3.8 Search Functionality

#### 3.8.1 People Search
**REQ-SEARCH-001:** Users shall be able to search for people by name (partial match).

**REQ-SEARCH-002:** Search results shall display:
- Full name
- Relationship
- Number of associated media items

**REQ-SEARCH-003:** Users shall be able to select a person from search results to view/edit their details.

#### 3.8.2 Event Search
**REQ-SEARCH-004:** Users shall be able to search for events by name (partial match).

**REQ-SEARCH-005:** Search results shall display:
- Event name
- Event details
- Number of associated media items

**REQ-SEARCH-006:** Users shall be able to select an event from search results to view/edit its details.

---

### 3.9 Data Management

#### 3.9.1 Database Backup
**REQ-BACKUP-001:** Users shall be able to manually trigger a database backup.

**REQ-BACKUP-002:** The system shall prompt for backup on exit if new photos were added that day.

**REQ-BACKUP-003:** Backups shall be saved with a filename including the date (e.g., FamAlbumMMDDYYYY.bak).

**REQ-BACKUP-004:** Users shall be able to configure a backup directory location (persisted in settings).

**REQ-BACKUP-005:** The backup process shall create a complete copy of the database.

#### 3.9.2 Database Restore
**REQ-RESTORE-001:** Users shall be able to restore the database from a backup file.

**REQ-RESTORE-002:** The system shall prompt users to select a backup file from the configured backup directory.

**REQ-RESTORE-003:** Restore shall overwrite the current database (with confirmation).

**REQ-RESTORE-004:** The system shall notify users upon successful backup or restore.

#### 3.9.3 Configuration Management
**REQ-CONFIG-001:** The system shall persist the following settings:
- Default media directory location
- Backup directory location

**REQ-CONFIG-002:** On first launch, users shall be prompted to select:
- Default media directory
- Backup directory

**REQ-CONFIG-003:** Users shall be able to change these settings through the application menu.

---

### 3.10 Navigation and Menu System

#### 3.10.1 Global Menu
**REQ-MENU-001:** The application shall provide a persistent menu bar with the following options:

**Select People** submenu:
- Sort Old to New
- Sort New to Old
- Clear Selected People

**Select Event** submenu:
- Browse events
- Clear Selected Events

**Database** submenu:
- Backup Database
- Restore Database

**Management** submenu:
- Name Manager (add/edit/delete people)
- Event Manager (add/edit/delete events)
- Process New Files (review unindexed media)

**Exit:**
- Close application (with backup prompt if needed)

#### 3.10.2 Context-Specific Actions
**REQ-MENU-002:** Each screen shall have context-appropriate buttons for:
- Save/Update
- Delete
- Cancel
- Add New
- Copy Files
- Next/Previous (for sequential workflows)

---

### 3.11 Thumbnail Management

#### 3.11.1 Thumbnail Generation
**REQ-THUMB-GEN-001:** For images, thumbnails shall be generated by scaling the original image.

**REQ-THUMB-GEN-002:** For videos, thumbnails shall be extracted using FFmpeg at a specific timestamp (default: 2 seconds).

**REQ-THUMB-GEN-003:** Thumbnails shall be stored as binary data in the database.

**REQ-THUMB-GEN-004:** Thumbnail dimensions shall be configurable (default: proportional scaling).

#### 3.11.2 Thumbnail Updates
**REQ-THUMB-UPDATE-001:** Users shall be able to manually regenerate a thumbnail for an existing media item.

**REQ-THUMB-UPDATE-002:** For videos, users shall be able to specify which timestamp to use for the thumbnail.

---

### 3.12 Video Playback

**REQ-VIDEO-001:** The system shall provide in-application video playback.

**REQ-VIDEO-002:** Video controls shall include:
- Play/Pause
- Restart
- Seek bar (if supported)
- Volume control (if supported)

**REQ-VIDEO-003:** Videos shall play within the detail view layout.

**REQ-VIDEO-004:** The system shall display video duration.

---

### 3.13 File Operations

#### 3.13.1 File Copying
**REQ-COPY-001:** Users shall be able to copy the current media file to another location.

**REQ-COPY-002:** Users shall be able to copy all files associated with an event to a selected directory.

**REQ-COPY-003:** The copy operation shall preserve original filenames.

**REQ-COPY-004:** Users shall be prompted to select a destination directory.

#### 3.13.2 File Deletion
**REQ-DELETE-001:** Users shall be able to delete a media file from the database.

**REQ-DELETE-002:** Deleting a file from the database should prompt whether to also delete the physical file.

**REQ-DELETE-003:** Deletion shall remove all associated records:
- Main media record
- Person-media associations
- Thumbnails

---

## 4. Data Model Requirements

### 4.1 Database Entities

#### 4.1.1 Pictures Table
**Entity:** Media items (photos and videos)

**Attributes:**
- PFileName (string, primary key) - Filename relative to default directory
- PFileDirectory (string) - Subdirectory path
- PDescription (string) - User description
- PHeight (integer) - Height in pixels
- PWidth (integer) - Width in pixels
- PMonth (integer) - Month (1-12)
- PYear (integer) - Year (4-digit)
- PPeopleList (string) - Comma-separated list of person IDs
- PNameCount (integer) - Count of tagged people
- PThumbnail (binary) - Thumbnail image data
- PType (integer) - Media type (1=image, 2=video)
- PTime (integer) - Video duration in seconds
- PDateEntered (datetime) - Date added to database
- PLastModifiedDate (datetime) - Last modified timestamp
- PReviewed (boolean) - Whether item has been reviewed
- PSoundFile (string, optional) - Associated audio file

#### 4.1.2 NameEvent Table
**Entity:** People and Events (combined table)

**Attributes:**
- ID (integer, primary key, auto-increment) - Unique identifier
- neName (string) - Person name or Event name
- neRelation (string) - Person relationship or Event details
- neType (char) - Type: 'N' for Name/Person, 'E' for Event
- neDateLastModified (datetime) - Last modified timestamp
- neCount (integer) - Count of associated media items

#### 4.1.3 NamePhoto Table
**Entity:** Many-to-many relationship between people/events and media

**Attributes:**
- npID (integer, foreign key to NameEvent.ID) - Person or Event ID
- npFileName (string, foreign key to Pictures.PFileName) - Media filename

**Indexes:**
- Composite key on (npID, npFileName)

#### 4.1.4 UnindexedFiles Table
**Entity:** Staging table for new, unprocessed media files

**Attributes:**
- uiFileName (string) - Full path to file
- uiDirectory (string) - Directory path
- uiThumb (binary) - Thumbnail data
- uiType (integer) - Media type (1=image, 2=video)
- uiWidth (integer) - Width in pixels
- uiHeight (integer) - Height in pixels
- uiVtime (integer) - Video duration in seconds
- uiStatus (char) - Status: 'N' for new, 'P' for processed

---

### 4.2 Data Relationships

**REQ-DATA-001:** One Picture can have many People (many-to-many via NamePhoto)

**REQ-DATA-002:** One Person can appear in many Pictures (many-to-many via NamePhoto)

**REQ-DATA-003:** One Picture can have zero or one Event (many-to-one via PPeopleList includes event ID)

**REQ-DATA-004:** One Event can be associated with many Pictures (one-to-many)

**REQ-DATA-005:** The system shall use NameEvent table for both people (neType='N') and events (neType='E')

**REQ-DATA-006:** Person IDs in PPeopleList shall be stored as comma-separated values

---

## 5. Non-Functional Requirements

### 5.1 Performance

**REQ-PERF-001:** Thumbnail gallery shall load and display within 3 seconds for collections up to 1000 items.

**REQ-PERF-002:** Detail view shall open within 1 second when clicking a thumbnail.

**REQ-PERF-003:** Search results shall appear within 1 second for typical databases (<10,000 people/events).

**REQ-PERF-004:** Database backup shall complete within 30 seconds for typical database sizes (<10GB).

**REQ-PERF-005:** The system shall support collections of at least 10,000 media items without significant performance degradation.

### 5.2 Usability

**REQ-USE-001:** The application shall be usable by non-technical family members.

**REQ-USE-002:** All primary workflows shall be completable with no more than 5 clicks.

**REQ-USE-003:** Forms shall provide clear labels and validation messages.

**REQ-USE-004:** The interface shall be responsive and work on tablets and desktop screens.

**REQ-USE-005:** Font sizes shall be readable (minimum 12pt for body text).

### 5.3 Reliability

**REQ-REL-001:** The application shall not lose user data in the event of a crash.

**REQ-REL-002:** Database operations shall use transactions to ensure data consistency.

**REQ-REL-003:** The system shall validate file integrity before processing.

**REQ-REL-004:** Failed operations shall provide clear error messages.

### 5.4 Data Integrity

**REQ-INT-001:** All database writes shall use transactions to ensure atomicity.

**REQ-INT-002:** The system shall prevent orphaned records when deleting people or events.

**REQ-INT-003:** The system shall validate that referenced files exist before displaying.

**REQ-INT-004:** The system shall handle missing or moved files gracefully.

### 5.5 Security

**REQ-SEC-001:** The application shall run locally with file system access controlled by the operating system.

**REQ-SEC-002:** Database files shall be accessible only to the user running the application.

**REQ-SEC-003:** Backup files shall maintain the same security permissions as the original database.

---

## 6. User Interface Requirements

### 6.1 Visual Design Principles

**REQ-UI-001:** Use a clean, uncluttered layout with clear visual hierarchy.

**REQ-UI-002:** Use consistent colors:
- Primary action buttons: Light blue background, dark blue text
- Danger/delete actions: Appropriate warning colors

**REQ-UI-003:** Use legible fonts (Arial or similar sans-serif, 12pt minimum).

**REQ-UI-004:** Provide ample white space between UI elements.

**REQ-UI-005:** Use centered headers for screen titles.

### 6.2 Layout Patterns

**REQ-LAYOUT-001:** Use split-panel layouts where appropriate:
- Left panel: Lists, thumbnails, or forms
- Right panel: Details or additional controls

**REQ-LAYOUT-002:** Use full-screen (maximized) windows for primary views.

**REQ-LAYOUT-003:** Use modal dialogs for:
- Confirmations (delete, overwrite)
- File/folder selection
- Inline person/event creation

**REQ-LAYOUT-004:** Maintain persistent menu bar at top of all screens.

### 6.3 Forms

**REQ-FORM-001:** Input fields shall have clear labels positioned above or to the left.

**REQ-FORM-002:** Multi-line text areas shall be used for long-form content (descriptions, relationships).

**REQ-FORM-003:** Dropdown/select controls shall be used for choosing from existing people/events.

**REQ-FORM-004:** Buttons shall be large enough for easy clicking (minimum 40px height).

**REQ-FORM-005:** Primary action buttons shall be visually distinct from secondary actions.

---

## 7. Technical Constraints (Informational)

The following are characteristics of the current implementation that should inform, but not strictly constrain, the new web application:

### 7.1 Current Implementation Details

**INFO-001:** Current system uses SQLite database (FamilyAlbum.db)

**INFO-002:** Current system stores thumbnails as BLOBs in database

**INFO-003:** Current system uses ExifTool for metadata reading/writing

**INFO-004:** Current system uses FFmpeg for video thumbnail extraction and metadata

**INFO-005:** Current system stores configuration in Windows Registry

**INFO-006:** Current system uses LibVLC for video playback

**INFO-007:** Current system uses transactions for multi-step database operations

---

## 8. Future Enhancements (Out of Scope for V1)

The following features are mentioned for future consideration but are NOT required for the initial implementation:

**FUTURE-001:** Cloud storage integration

**FUTURE-002:** Mobile applications (iOS/Android)

**FUTURE-003:** Facial recognition for automatic person tagging

**FUTURE-004:** Collaborative editing (multi-user)

**FUTURE-005:** Photo editing capabilities (crop, rotate, adjust)

**FUTURE-006:** Slideshow functionality

**FUTURE-007:** Sharing capabilities (export albums, social media)

**FUTURE-008:** Advanced search (date ranges, combination filters)

**FUTURE-009:** Duplicate detection

**FUTURE-010:** GPS/location tagging

**FUTURE-011:** Comments/annotations on photos

**FUTURE-012:** Timeline view

---

## 9. Success Criteria

The implementation shall be considered successful when:

1. **Complete Workflow Coverage:** All primary workflows can be completed end-to-end:
   - Import new photos/videos
   - Tag people in media
   - Associate media with events
   - Browse by people or events
   - Search for people and events
   - Backup and restore database

2. **Data Migration:** Existing data can be migrated from the current SQLite database to the new system.

3. **Feature Parity:** All core features from the current application are available in the new web application.

4. **Usability Validation:** Non-technical users can complete common tasks without assistance.

5. **Performance Targets:** All performance requirements are met under typical usage conditions.

6. **Data Integrity:** No data loss occurs during normal operations or error conditions.

---

## 10. Key User Workflows

### 10.1 Import and Tag New Photos

1. User places new photos in the default directory
2. User selects "Process New Files" from menu
3. System scans directory and identifies unindexed files
4. System displays first unindexed photo with auto-detected metadata
5. User reviews/edits metadata (description, month, year)
6. User adds people by selecting from dropdown and clicking "Add"
7. User optionally associates with an event
8. User clicks "Save" to move to database and advance to next photo
9. Repeat steps 4-8 until all photos are processed
10. System displays "All Images Processed" message

### 10.2 Browse Photos by Person

1. User launches application (sees "Select People" screen)
2. User selects one or more people from dropdown (up to 5)
3. User chooses sort order (Old to New or New to Old)
4. User clicks "Continue"
5. System displays thumbnail gallery of all photos containing any selected person
6. User clicks a thumbnail to view full details
7. System displays photo with all metadata and tagged people
8. User can edit metadata, add/remove people, then close to return to gallery

### 10.3 Manage Events

1. User selects "Event Manager" from menu
2. User searches for an event or selects from dropdown
3. System displays event details (name, description, count)
4. User edits event name or details
5. User clicks "Save" to persist changes
6. User optionally clicks "Copy Event Files" to export all associated media
7. System prompts for destination folder
8. System copies all files associated with the event

### 10.4 Backup Database

1. User selects "Backup Database" from menu (or is prompted on exit)
2. System generates backup filename with current date
3. System copies database to configured backup location
4. System displays success message

---

## 11. Glossary

**Media Item:** A photo or video file managed by the system

**Person:** An individual who can be tagged in media items

**Event:** A named occasion or gathering associated with media items

**Thumbnail:** A small preview image representing a media item

**Unindexed File:** A media file that exists in the directory but hasn't been added to the database

**Default Directory:** The root folder where all media files are stored

**Metadata:** Information about a media item (description, date, people, etc.)

**EXIF:** Exchangeable Image File Format - standard for embedding metadata in image files

**XMP:** Extensible Metadata Platform - standard for embedding metadata in various file types

---

## 12. Acceptance Criteria Summary

For each requirement above, acceptance is determined by:

1. **Functional Requirements (REQ-*):** Feature is implemented and works as described
2. **Data Requirements (REQ-DATA-*):** Database structure supports the requirement
3. **Performance Requirements (REQ-PERF-*):** Measured performance meets or exceeds stated metrics
4. **Usability Requirements (REQ-USE-*):** User testing confirms usability goals
5. **Reliability Requirements (REQ-REL-*):** Testing confirms reliable operation
6. **Integrity Requirements (REQ-INT-*):** Data remains consistent under all conditions
7. **Security Requirements (REQ-SEC-*):** Security testing confirms proper access control

---

## Document Control

**Revision History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Oct 14, 2025 | AI Analysis | Initial requirements document created from source code analysis |

**Approval:**

This document should be reviewed and approved by project stakeholders before development of the new TypeScript web application begins.

---

## Appendix A: Current Database Schema

### Pictures Table
```
PFileName (TEXT, PRIMARY KEY)
PFileDirectory (TEXT)
PDescription (TEXT)
PHeight (INTEGER)
PWidth (INTEGER)
PMonth (INTEGER)
PYear (INTEGER)
PPeopleList (TEXT) - comma-separated person IDs
PNameCount (INTEGER)
PThumbnail (BLOB)
PType (INTEGER) - 1=image, 2=video
PTime (INTEGER) - video duration
PDateEntered (DATETIME)
PLastModifiedDate (DATETIME)
PReviewed (BOOLEAN)
PSoundFile (TEXT)
```

### NameEvent Table
```
ID (INTEGER, PRIMARY KEY, AUTOINCREMENT)
neName (TEXT)
neRelation (TEXT)
neType (CHAR) - 'N' for person, 'E' for event
neDateLastModified (DATETIME)
neCount (INTEGER)
```

### NamePhoto Table
```
npID (INTEGER, FK to NameEvent.ID)
npFileName (TEXT, FK to Pictures.PFileName)
```

### UnindexedFiles Table
```
uiFileName (TEXT)
uiDirectory (TEXT)
uiThumb (BLOB)
uiType (INTEGER)
uiWidth (INTEGER)
uiHeight (INTEGER)
uiVtime (INTEGER)
uiStatus (CHAR) - 'N' for new
```

---

## Appendix B: File Format Specifications

### Embedded JSON Metadata Structure
```json
{
  "EventName": "string",
  "EventDetails": "string",
  "imMonth": 0,
  "imYear": 0,
  "Description": "string",
  "People": [
    {
      "Name": "string",
      "Relationship": "string"
    }
  ]
}
```

This JSON is stored in the XMP-dc:Description field of image and video files using ExifTool.

---

**END OF REQUIREMENTS DOCUMENT**
