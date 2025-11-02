# Authentication Setup - Quick Reference

## ✅ What's Been Done

1. **Updated `staticwebapp.config.json`**
   - Configured Microsoft Account (Azure AD) authentication
   - Configured Google Account authentication
   - Added custom login page route
   - Updated 401 redirect to login page

2. **Created `public/login.html`**
   - Beautiful, modern login page
   - Microsoft and Google sign-in buttons
   - Auto-detects if already authenticated

3. **Created Documentation**
   - Complete setup guide in `docs/AUTHENTICATION_SETUP.md`

## 🚀 Next Steps (Required for Google)

### 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project → Enable Google+ API → Create OAuth credentials
3. Add redirect URI: `https://YOUR-APP-URL.azurestaticapps.net/.auth/login/google/callback`
4. Copy Client ID and Client Secret

### 2. Add to Azure Portal

1. Open [Azure Portal](https://portal.azure.com)
2. Go to your Static Web App
3. **Configuration** → **Application Settings** → **Add**
4. Add two settings:
   - `GOOGLE_CLIENT_ID` = (your Client ID)
   - `GOOGLE_CLIENT_SECRET` = (your Client Secret)
5. Click **Save**

### 3. Deploy & Test

```bash
git add .
git commit -m "Enable Microsoft and Google authentication"
git push
```

Visit your app URL - it will redirect to the new login page!

## 📝 Important Notes

- **Microsoft Account**: Works immediately - no extra setup needed! Uses common endpoint.
- **Google Account**: Requires OAuth credentials from Google Cloud Console
- **Local Development**: Auth doesn't work locally - deploy to Azure to test
- **Session Length**: 8 hours, then users need to re-authenticate

## 🔒 Security

- Client secrets are stored securely in Azure Portal
- Never commit secrets to the repository
- All API routes and pages require authentication (except login page)

## 🎯 Your Static Web App URL

Find it in Azure Portal under your Static Web App → **Overview** → **URL**

Format: `https://YOUR-APP-NAME.azurestaticapps.net`
