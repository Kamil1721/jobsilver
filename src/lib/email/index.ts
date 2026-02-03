// Email service exports
export { sendEmail, EMAIL_CONFIG, type EmailResult } from './client'
export { sendWelcomeEmail } from './templates/welcome'
export { sendJobMatchesEmail } from './templates/job-matches'
export {
  notifyNewMatches,
  notifyWelcome,
} from './triggers'
