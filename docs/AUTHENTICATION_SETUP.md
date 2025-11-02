# Authentication Setup Guide

## Overview
Your Azure Static Web App now supports authentication with:
- ✅ Microsoft Account (Azure AD)
- ✅ Google Account

## Configuration Files Updated

### 1. `staticwebapp.config.json`
- Added Google identity provider configuration
- Updated Azure AD configuration
- Created `/login.html` route for anonymous access
- Changed 401 redirect to custom login page

### 2. `public/login.html`
- New custom login page with provider selection
- Clean, modern UI with Microsoft and Google sign-in buttons
- Auto-redirects if already authenticated

## Azure Portal Configuration Required

### Microsoft Account (Azure AD) Setup

The Azure AD provider is already configured to use the common endpoint, which allows any Microsoft Account (personal or work/school) to sign in. **No additional configuration needed** unless you want to restrict to specific tenants.

If you want to restrict to specific accounts:
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Static Web App
3. Go to **Configuration** → **Application Settings**
4. Add (optional):
   - `AZURE_AD_CLIENT_ID` - Your Azure AD app client ID
   - `AZURE_AD_CLIENT_SECRET` - Your Azure AD app client secret

### Google Account Setup

**Required** - You need to set up Google OAuth credentials:

1. **Create Google OAuth Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google+ API
   - Go to **Credentials** → **Create Credentials** → **OAuth client ID**
   - Choose **Web application**
   - Add authorized redirect URIs:
     ```
     https://<your-static-web-app>.azurestaticapps.net/.auth/login/google/callback
     ```
   - Copy the **Client ID** and **Client Secret**

2. **Configure in Azure:**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to your Static Web App
   - Go to **Configuration** → **Application Settings**
   - Add these settings:
     - Name: `GOOGLE_CLIENT_ID`, Value: `<your-google-client-id>`
     - Name: `GOOGLE_CLIENT_SECRET`, Value: `<your-google-client-secret>`
   - Click **Save**

## Testing Authentication

### Local Testing
Azure Static Web Apps authentication doesn't work in local development mode. You'll need to deploy to test.

### After Deployment

1. **Test Microsoft Sign-In:**
   - Visit: `https://<your-app>.azurestaticapps.net/login.html`
   - Click "Sign in with Microsoft"
   - Sign in with any Microsoft account
   - Should redirect to home page

2. **Test Google Sign-In:**
   - Visit: `https://<your-app>.azurestaticapps.net/login.html`
   - Click "Sign in with Google"
   - Sign in with any Google account
   - Should redirect to home page

3. **Test Protected Routes:**
   - Try accessing: `https://<your-app>.azurestaticapps.net/`
   - Should redirect to `/login.html` if not authenticated
   - After signing in, should access the app

## User Information

After authentication, user information is available at:
```javascript
fetch('/.auth/me')
  .then(response => response.json())
  .then(data => {
    console.log('User:', data.clientPrincipal);
    // data.clientPrincipal contains:
    // - userId
    // - userRoles
    // - claims (name, email, etc.)
    // - identityProvider (aad, google, etc.)
  });
```

## Sign Out

Users can sign out by visiting:
```
https://<your-app>.azurestaticapps.net/.auth/logout
```

You should add a sign-out button in your UI that links to this URL.

## Current Configuration

### Enabled Providers:
- **Azure Active Directory (Microsoft)**: Uses common endpoint (allows any Microsoft account)
- **Google**: Requires client credentials to be configured

### Protected Routes:
- `/api/*` - All API routes require authentication
- `/*` - All pages require authentication (except login page)

### Public Routes:
- `/login.html` - Login page
- `/.auth/*` - All authentication endpoints

## Deployment

1. Commit the changes:
   ```bash
   git add public/staticwebapp.config.json public/login.html
   git commit -m "Enable Microsoft and Google authentication"
   git push
   ```

2. Azure Static Web Apps will automatically deploy

3. Configure Google credentials in Azure Portal (see above)

4. Test authentication flows

## Troubleshooting

### Issue: "Redirect URI mismatch" error with Google
**Solution:** Ensure the redirect URI in Google Cloud Console exactly matches:
```
https://<your-static-web-app-url>.azurestaticapps.net/.auth/login/google/callback
```

### Issue: Google sign-in button doesn't work
**Solution:** 
1. Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in Azure Portal
2. Restart your Static Web App after adding settings
3. Verify Google OAuth consent screen is configured

### Issue: Microsoft sign-in doesn't work
**Solution:** The common endpoint should work for all Microsoft accounts. If issues persist, check Azure AD configuration.

### Issue: Login page loads but buttons don't redirect
**Solution:** Check browser console for errors. Ensure the Static Web App has been redeployed with the new configuration.

## Security Considerations

1. **Client Secrets**: Never commit client secrets to your repository. Always use Azure Portal Application Settings.

2. **Authorized Domains**: Configure authorized domains in Google Cloud Console to prevent unauthorized use of your OAuth credentials.

3. **User Roles**: Consider implementing custom roles in Azure Static Web Apps if you need fine-grained access control.

4. **Token Lifetime**: Azure Static Web Apps sessions last 8 hours by default. Users will need to re-authenticate after that.

## Next Steps

- [ ] Configure Google OAuth credentials in Google Cloud Console
- [ ] Add Google credentials to Azure Portal Application Settings
- [ ] Deploy the changes
- [ ] Test both authentication providers
- [ ] Add a logout button to your application UI
- [ ] Consider adding user profile display (name, email)
- [ ] (Optional) Implement role-based access control
