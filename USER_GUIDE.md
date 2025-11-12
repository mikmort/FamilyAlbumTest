# Family Album User Guide

## Overview

Family Album is a web application for managing and sharing family photos and videos. You can view media, organize it by people and events, and upload new content.

## Getting Started

### Signing In

1. Visit the Family Album website
2. Click **Login** in the top right
3. Sign in with your Microsoft or Google account
4. Wait for admin approval if this is your first visit

### User Roles

- **Read**: View photos and videos only
- **Full**: View, upload, and edit media
- **Admin**: Full access plus user management

---

## Main Features

### 1. Viewing Media

#### Browse by Selection
1. Click **Select** in the navigation menu
2. Choose filters:
   - **People**: Select one or more family members
   - **Events**: Choose a specific event
   - **Untagged**: Show media without people tags
   - **Exclusive**: Show only media matching all selected filters
3. Click **View Gallery** to see results

#### Gallery View
- Thumbnails display in a grid
- Video thumbnails show duration (e.g., "5:01")
- **Left-click** a thumbnail to open detail view
- **Right-click** a thumbnail to open in fullscreen mode

#### Detail View
- View full-size photo or play video
- See tagged people and event
- Navigate between media using **Previous** and **Next** buttons
- **Edit Mode** (Full/Admin users):
  - Add/remove people tags
  - Set event
  - Change date/time
  - Add description
  - Delete media

### 2. New Media

The **New Media** button shows media added since your last visit.

1. Click **New Media** in the navigation
2. Badge shows count of new items
3. View thumbnails and click to open
4. Click **Mark All as Viewed** to clear the count

### 3. Uploading Media (Full/Admin only)

#### Single Upload
1. Click **Upload** in the navigation
2. Click **Choose Files** or drag files into the drop zone
3. Select photos (.jpg, .jpeg, .png) or videos (.mp4, .mov, .avi, .mpg)
4. Files upload automatically
5. Tag people and add event in the upload form
6. Click **Complete Upload**

#### Tips
- Videos are automatically converted to .mp4 if needed
- Maximum file size: 500MB
- Supported formats:
  - Photos: JPG, JPEG, PNG
  - Videos: MP4, MOV, AVI, MPG, MPEG

### 4. Managing People (Full/Admin only)

1. Click **Manage People** in the navigation
2. **Add New Person**:
   - Enter first and last name
   - Optionally add relationship (e.g., "Father", "Sister")
   - Click **Add Person**
3. **Edit Person**:
   - Click **Edit** next to their name
   - Update information
   - Click **Save**
4. **Delete Person**:
   - Click **Delete** next to their name
   - Confirm deletion

### 5. Managing Events (Full/Admin only)

1. Click **Manage Events** in the navigation
2. **Add New Event**:
   - Enter event name
   - Click **Add Event**
3. **Edit Event**:
   - Click **Edit** next to event name
   - Update name
   - Click **Save**
4. **Delete Event**:
   - Click **Delete** next to event name
   - Confirm deletion

### 6. Processing New Files (Full/Admin only)

If files were uploaded directly to storage (bypassing the web app):

1. Click **Process New Files** in the navigation
2. Review list of unindexed files
3. For each file:
   - Tag people
   - Set event
   - Set date/time
   - Click **Add to Album**
4. Files become visible in the main gallery

### 7. Settings (Admin only)

Manage user access and permissions:

1. Click **Settings** in the navigation
2. **Pending Requests**: Approve or reject new users
3. **Active Users**: 
   - Change user roles
   - Deactivate users
4. **Add User Manually**: Create accounts for specific email addresses

---

## Tips & Tricks

### Keyboard Shortcuts in Detail View
- **Arrow Keys**: Navigate between photos/videos
- **Escape**: Close detail view
- **Space**: Pause/play video

### Video Playback
- Videos support seeking (drag the progress bar)
- Large videos (>50MB) stream directly for better performance
- Converted videos maintain original quality

### Search Tips
- Use **Exclusive** filter to find photos of specific people together
- Select multiple people to find group photos
- Use **Untagged** to find photos that need people tags

### Best Practices
- Tag people in photos to make them searchable
- Assign events to organize by occasion
- Add descriptions to document important moments
- Use descriptive event names (e.g., "Smith Family Reunion 2025")

---

## Troubleshooting

### Video Won't Play
- Wait for conversion to complete (for .avi, .mov, .mpg files)
- Check your browser supports HTML5 video
- Try refreshing the page

### Can't Upload Files
- Check file size (must be under 500MB)
- Verify file format is supported
- Ensure you have Full or Admin role

### Media Not Showing
- Check your filters in Select view
- Try clearing all filters and viewing all media
- Refresh the page

### Access Denied
- Contact an admin to activate your account
- Verify you're signed in with the correct account
- Check your user role is appropriate for the action

---

## Getting Help

For issues or questions:
1. Check this guide first
2. Contact your Family Album administrator
3. Report bugs or feature requests to the site admin

---

## Privacy & Security

- All media is stored securely in Azure cloud storage
- Access is controlled by user roles
- Videos and photos are only accessible to authenticated users
- SAS tokens expire after 1 hour for security

---

**Version 1.0** | Last Updated: November 8, 2025
