# Supabase Email Templates

These email templates match the Job Silver theme and should be applied in your Supabase Dashboard.

## How to Apply

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Email Templates**
4. For each template type, copy the HTML content from the corresponding file and paste it into the **Message** field

## Template Files

| File | Supabase Template Type |
|------|------------------------|
| `confirm-signup.html` | **Confirm signup** |
| `reset-password.html` | **Reset password** |
| `magic-link.html` | **Magic Link** |
| `change-email.html` | **Change Email Address** |
| `invite-user.html` | **Invite user** |

## Subject Lines

Update the subject lines in Supabase to match:

| Template | Subject |
|----------|---------|
| Confirm signup | `Verify your Job Silver account` |
| Reset password | `Reset your Job Silver password` |
| Magic Link | `Your Job Silver sign-in link` |
| Change Email | `Confirm your new email address` |
| Invite user | `You've been invited to Job Silver` |

## Template Variables

These templates use Supabase's built-in template variables:

- `{{ .ConfirmationURL }}` - The full confirmation/action URL
- `{{ .Token }}` - The raw token (if needed)
- `{{ .SiteURL }}` - Your site's base URL
- `{{ .Email }}` - The user's email address

## Features

- Dark metallic theme matching Job Silver's brand
- Responsive design for mobile and desktop
- Fallback link text if button doesn't work
- MSO (Microsoft Outlook) compatibility
- Preheader text for email previews

## Testing

After applying templates, test each flow:
1. Sign up with a new email
2. Request a password reset
3. Change email address (from profile)
