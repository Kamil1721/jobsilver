import { EMAIL_CONFIG } from './client'

/**
 * Base HTML email template with responsive design
 * Uses JobSilver metallic theme - silver/zinc colors matching the app
 */
export function baseTemplate({
  title,
  preheader,
  content,
  showUnsubscribe = true,
}: {
  title: string
  preheader: string
  content: string
  showUnsubscribe?: boolean
}): string {
  const { appName, appUrl, unsubscribeUrl } = EMAIL_CONFIG

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
    }

    /* Base styles - JobSilver metallic theme */
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      height: 100% !important;
      background-color: #18181b;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    /* Container */
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #0a0a0b;
    }

    /* Header - Metallic gradient */
    .email-header {
      background: linear-gradient(135deg, #3f3f46 0%, #52525b 50%, #3f3f46 100%);
      padding: 32px 24px;
      text-align: center;
      position: relative;
    }
    .email-header::after {
      content: '';
      position: absolute;
      top: 0;
      left: 25%;
      width: 50%;
      height: 1px;
      background: linear-gradient(to right, transparent, rgba(255,255,255,0.3), transparent);
    }
    .email-header h1 {
      color: #fafafa;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    /* Content */
    .email-content {
      padding: 32px 24px;
      color: #fafafa;
      line-height: 1.6;
      background-color: #111113;
    }
    .email-content h2 {
      color: #fafafa;
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 16px 0;
      letter-spacing: -0.01em;
    }
    .email-content p {
      margin: 0 0 16px 0;
      color: #a1a1aa;
    }
    .email-content strong {
      color: #fafafa;
    }

    /* Button - Metallic style */
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(to bottom, #3f3f46, #27272a);
      border: 1px solid #52525b;
      color: #fafafa !important;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 600;
      font-size: 14px;
      margin: 8px 0;
    }
    .button:hover {
      opacity: 0.9;
    }

    /* Card - Dark elevated style */
    .card {
      background-color: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 16px;
      margin: 16px 0;
    }
    .card-title {
      font-weight: 600;
      color: #fafafa;
      margin-bottom: 12px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* List */
    .list-item {
      padding: 12px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .list-item:last-child {
      border-bottom: none;
    }

    /* Badge - Match site's match score colors */
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.02em;
    }
    .badge-success {
      background-color: rgba(16, 185, 129, 0.1);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.2);
    }
    .badge-warning {
      background-color: rgba(245, 158, 11, 0.1);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.2);
    }
    .badge-info {
      background-color: rgba(113, 113, 122, 0.1);
      color: #a1a1aa;
      border: 1px solid rgba(113, 113, 122, 0.2);
    }

    /* Footer */
    .email-footer {
      padding: 24px;
      text-align: center;
      background-color: #0a0a0b;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
    }
    .email-footer p {
      margin: 0 0 8px 0;
      color: #71717a;
      font-size: 12px;
    }
    .email-footer a {
      color: #a1a1aa;
      text-decoration: none;
    }
    .email-footer a:hover {
      color: #fafafa;
    }

    /* Tip box */
    .tip-box {
      background-color: rgba(113, 113, 122, 0.1);
      border: 1px solid rgba(113, 113, 122, 0.2);
      border-radius: 8px;
      padding: 16px;
      margin-top: 24px;
    }
    .tip-box p {
      margin: 0;
      color: #a1a1aa;
      font-size: 14px;
    }
    .tip-box strong {
      color: #d4d4d8;
    }

    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
      }
      .email-header, .email-content, .email-footer {
        padding: 24px 16px;
      }
    }
  </style>
</head>
<body>
  <!-- Preheader text (hidden) -->
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${preheader}
  </div>

  <!-- Email body -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding: 24px 16px; background-color: #18181b;">
        <table class="email-container" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" align="center" style="border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3);">
          <!-- Header -->
          <tr>
            <td class="email-header">
              <h1>${appName}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="email-content">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer">
              <p>
                <a href="${appUrl}">${appName}</a>
              </p>
              ${showUnsubscribe ? `
              <p>
                <a href="${unsubscribeUrl}">Manage notification preferences</a>
              </p>
              ` : ''}
              <p style="margin-top: 16px; color: #52525b;">
                &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
