# SendGrid Setup - Quick Start Guide

## ✅ Step 1: Package Installed
The SendGrid package is now installed and pushed to GitHub. Azure will automatically deploy it.

## 📧 Step 2: Create SendGrid Account

1. **Go to SendGrid:** https://sendgrid.com/
2. **Sign up for free account** (no credit card required for free tier)
3. **Verify your email address**
4. **Complete the "Get Started" checklist** (SendGrid requires this)

## 🔑 Step 3: Create API Key

1. In SendGrid dashboard, go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Name it: `FamilyAlbum-Production`
4. Choose **Full Access** (or at least Mail Send access)
5. Click **Create & View**
6. **⚠️ COPY THE KEY NOW** - you won't see it again!
   - It will look like: `SG.xxxxxxxxxxxxxxxxxxxx.yyyyyyyyyyyyyyyyyyyyyy`

## ✉️ Step 4: Verify Sender Identity

**Important:** SendGrid requires you to verify the email address you'll send from.

### Option A: Single Sender Verification (Easiest for personal use)

1. Go to **Settings** → **Sender Authentication** → **Single Sender Verification**
2. Click **Create New Sender**
3. Fill in the form:
   - **From Name:** Family Album
   - **From Email Address:** Use YOUR real email (e.g., mikmort@gmail.com)
   - **Reply To:** Same as From Email
   - **Company Address:** Can use your home address
4. Click **Create**
5. **Check your email** and click the verification link
6. Once verified, you can send from this address

### Option B: Domain Authentication (For custom domain)

Only if you own a domain and want to send from `noreply@yourdomain.com`:
1. Go to **Settings** → **Sender Authentication** → **Domain Authentication**
2. Follow the DNS configuration steps

**Recommendation:** Use Option A (Single Sender) for simplicity.

## ⚙️ Step 5: Configure Azure Static Web App

1. **Go to Azure Portal:** https://portal.azure.com
2. **Find your Static Web App** (search for "FamilyAlbumTest" or your app name)
3. Click **Configuration** in the left menu
4. Click **Application settings**
5. **Add these three settings:**

   | Name | Value |
   |------|-------|
   | `SENDGRID_API_KEY` | `SG.xxxx...` (the key from Step 3) |
   | `EMAIL_FROM_ADDRESS` | Your verified email from Step 4 |
   | `SITE_URL` | Your app URL (e.g., `https://your-app.azurestaticapps.net`) |

6. **Click Save** at the top
7. **Wait for redeployment** (~1 minute)

### Example Configuration:
```
SENDGRID_API_KEY=SG.abc123xyz789...
EMAIL_FROM_ADDRESS=mikmort@gmail.com
SITE_URL=https://purple-forest-12345.azurestaticapps.net
```

## 🧪 Step 6: Test Email Notifications

1. **Clear your browser cookies** or use incognito mode
2. **Sign in to your app** with a NEW email address (different from admins)
3. **Check the admin email inbox** - you should receive an email with approval buttons
4. **Click an approval button** (Full Access, Read Only, or Deny)
5. **Verify the user status** changes in Admin Settings

### If No Email Arrives:

1. **Check Azure Function Logs:**
   - Azure Portal → Your Static Web App → Functions
   - Find `notify-admins` function
   - Check logs for errors

2. **Check SendGrid Activity Feed:**
   - SendGrid Dashboard → Activity
   - Look for sent/delivered/bounced emails

3. **Check Spam Folder** - first emails might go to spam

## 📊 SendGrid Free Tier Limits

- **100 emails per day** (3,000 per month)
- **More than enough for family use** (even with 50 users, you'd only use 50 emails)
- No credit card required
- No expiration

## 🔒 Security Best Practices

✅ **Do:**
- Keep your API key secret (never commit to git)
- Use environment variables in Azure
- Use a verified sender address
- Monitor SendGrid activity feed

❌ **Don't:**
- Share your API key
- Commit API key to repository
- Use an unverified email address

## 🎯 Expected Behavior After Setup

**When a new user requests access:**
1. ✅ User signs in (Microsoft/Google OAuth)
2. ✅ System creates "Pending" user record
3. ✅ Generates secure approval tokens
4. ✅ **Sends email to all admins via SendGrid**
5. ✅ Admins receive email with 3 action buttons
6. ✅ Admin clicks button → User approved/denied
7. ✅ User can access the app (or is denied)

**Email will contain:**
- User's name and email
- Three action buttons: Full Access, Read Only, Deny
- Links expire in 7 days
- Beautiful HTML template with your app branding

## 📝 Verification Checklist

- [ ] SendGrid account created and verified
- [ ] API key created and saved
- [ ] Sender email verified in SendGrid
- [ ] Azure environment variables configured
- [ ] Azure app redeployed (automatic after config change)
- [ ] Test email sent and received
- [ ] Approval buttons work correctly
- [ ] User status updates properly

## 🆘 Troubleshooting

### "Email not sent" in logs
- Check that all 3 environment variables are set in Azure
- Verify Azure app redeployed after config change
- Check API key is valid in SendGrid dashboard

### Emails not arriving
- Check spam folder
- Verify sender email in SendGrid (Settings → Sender Authentication)
- Check SendGrid Activity feed for delivery status
- Try with a different email provider (Gmail, Outlook, etc.)

### "403 Forbidden" from SendGrid
- API key might be invalid or expired
- API key might not have Mail Send permission
- Sender email not verified

### How to view approval links without email
- Azure Portal → Functions → `notify-admins` → Invocations
- Approval URLs are logged to console
- Copy and share URLs manually

## 📞 Support

- **SendGrid Docs:** https://docs.sendgrid.com/
- **SendGrid Support:** https://sendgrid.com/support
- **Your Email Setup Doc:** `docs/EMAIL_SETUP.md`
- **Status Report:** `EMAIL_SETUP_STATUS.md`

---

**Setup Time:** ~15 minutes  
**Next Step:** Test the email notification with a new user sign-in!
