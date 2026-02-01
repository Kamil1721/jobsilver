// Email service exports
export { sendEmail, EMAIL_CONFIG, type EmailResult } from './client'
export { sendWelcomeEmail } from './templates/welcome'
export { sendJobMatchesEmail } from './templates/job-matches'
export { sendQuotaWarningEmail } from './templates/quota-warning'
export {
  notifyNewMatches,
  notifyQuotaWarning,
  notifyWelcome,
} from './triggers'
