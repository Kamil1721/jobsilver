/**
 * Job Titles by Industry
 *
 * Curated list of job titles organized by industry category.
 * Used in the setup wizard to guide users to select relevant job titles
 * instead of free-text input (prevents garbage like "asdasd").
 *
 * Each industry has ~10-15 common job titles.
 */

export const JOB_TITLES_BY_INDUSTRY: Record<string, string[]> = {
  // Healthcare & Medical
  "Healthcare": [
    "Registered Nurse",
    "Medical Assistant",
    "Healthcare Administrator",
    "Pharmacist",
    "Physical Therapist",
    "Medical Coder",
    "Nurse Practitioner",
    "Medical Technologist",
    "Health Information Technician",
    "Clinical Research Coordinator",
    "Patient Care Coordinator",
    "Home Health Aide",
  ],

  // Technology
  "Technology": [
    "Software Engineer",
    "Frontend Developer",
    "Backend Developer",
    "Full Stack Developer",
    "DevOps Engineer",
    "Cloud Engineer",
    "IT Support Specialist",
    "Systems Administrator",
    "Network Engineer",
    "QA Engineer",
    "Technical Support",
    "IT Manager",
    "Security Engineer",
    "Site Reliability Engineer",
  ],

  "Software": [
    "Software Engineer",
    "Software Developer",
    "Mobile Developer",
    "iOS Developer",
    "Android Developer",
    "Web Developer",
    "Full Stack Developer",
    "Frontend Developer",
    "Backend Developer",
    "Application Developer",
    "Software Architect",
    "Game Developer",
  ],

  "Data & Analytics": [
    "Data Analyst",
    "Data Scientist",
    "Data Engineer",
    "Business Intelligence Analyst",
    "Machine Learning Engineer",
    "Analytics Manager",
    "Database Administrator",
    "Data Architect",
    "AI Engineer",
    "Research Scientist",
    "Quantitative Analyst",
    "Statistician",
  ],

  "Engineering": [
    "Mechanical Engineer",
    "Electrical Engineer",
    "Civil Engineer",
    "Chemical Engineer",
    "Industrial Engineer",
    "Structural Engineer",
    "Project Engineer",
    "Manufacturing Engineer",
    "Quality Engineer",
    "Process Engineer",
    "Design Engineer",
    "Systems Engineer",
  ],

  // Business & Sales
  "Sales": [
    "Sales Representative",
    "Account Executive",
    "Sales Manager",
    "Business Development Representative",
    "Account Manager",
    "Sales Associate",
    "Inside Sales Representative",
    "Regional Sales Manager",
    "Sales Director",
    "Customer Success Manager",
    "Territory Manager",
    "Sales Operations Manager",
  ],

  "Marketing": [
    "Marketing Manager",
    "Digital Marketing Specialist",
    "Content Writer",
    "Social Media Manager",
    "SEO Specialist",
    "Marketing Coordinator",
    "Brand Manager",
    "Product Marketing Manager",
    "Content Marketing Manager",
    "Marketing Analyst",
    "Email Marketing Specialist",
    "Growth Marketing Manager",
    "Communications Specialist",
  ],

  "Finance & Accounting": [
    "Accountant",
    "Financial Analyst",
    "Bookkeeper",
    "Controller",
    "Tax Specialist",
    "Accounts Payable Specialist",
    "Finance Manager",
    "Auditor",
    "Payroll Specialist",
    "Credit Analyst",
    "Investment Analyst",
    "Treasury Analyst",
    "Accounts Receivable Specialist",
  ],

  "Consulting": [
    "Management Consultant",
    "Strategy Consultant",
    "Business Analyst",
    "IT Consultant",
    "Operations Consultant",
    "Change Management Consultant",
    "Financial Consultant",
    "HR Consultant",
    "Marketing Consultant",
    "Technology Consultant",
    "Implementation Consultant",
    "Solutions Consultant",
  ],

  "Human Resources": [
    "HR Manager",
    "Recruiter",
    "HR Coordinator",
    "Talent Acquisition Specialist",
    "HR Business Partner",
    "Compensation Analyst",
    "HR Generalist",
    "Benefits Specialist",
    "Training Coordinator",
    "HR Administrator",
    "People Operations Manager",
    "Employee Relations Specialist",
  ],

  "Administrative": [
    "Administrative Assistant",
    "Executive Assistant",
    "Office Manager",
    "Receptionist",
    "Data Entry Clerk",
    "Virtual Assistant",
    "Office Administrator",
    "Administrative Coordinator",
    "Personal Assistant",
    "Secretary",
    "Front Desk Coordinator",
    "Operations Assistant",
  ],

  // Customer Facing
  "Customer Service & Support": [
    "Customer Service Representative",
    "Support Specialist",
    "Call Center Agent",
    "Customer Success Manager",
    "Help Desk Technician",
    "Technical Support Specialist",
    "Client Services Manager",
    "Customer Experience Manager",
    "Support Team Lead",
    "Customer Care Specialist",
    "Account Support Specialist",
  ],

  "Retail": [
    "Retail Sales Associate",
    "Store Manager",
    "Cashier",
    "Merchandiser",
    "Inventory Specialist",
    "Retail Manager",
    "Visual Merchandiser",
    "Department Manager",
    "Assistant Store Manager",
    "Loss Prevention Specialist",
    "Stock Associate",
    "Buyer",
  ],

  "Hospitality": [
    "Hotel Manager",
    "Front Desk Agent",
    "Concierge",
    "Event Coordinator",
    "Restaurant Manager",
    "Housekeeping Manager",
    "Guest Services Representative",
    "Banquet Manager",
    "Hospitality Manager",
    "Night Auditor",
    "Reservations Agent",
  ],

  "Food & Beverage": [
    "Chef",
    "Cook",
    "Restaurant Manager",
    "Server",
    "Bartender",
    "Kitchen Manager",
    "Food Service Manager",
    "Barista",
    "Sous Chef",
    "Catering Manager",
    "Food Preparation Worker",
    "Pastry Chef",
  ],

  // Trade & Industry
  "Construction": [
    "Construction Manager",
    "Project Manager",
    "Site Supervisor",
    "Estimator",
    "Carpenter",
    "Electrician",
    "Plumber",
    "Construction Worker",
    "Foreman",
    "Safety Manager",
    "Quantity Surveyor",
    "Building Inspector",
  ],

  "Manufacturing": [
    "Production Manager",
    "Manufacturing Engineer",
    "Quality Control Inspector",
    "Machine Operator",
    "Production Supervisor",
    "Assembly Technician",
    "Production Planner",
    "Plant Manager",
    "Maintenance Technician",
    "CNC Operator",
    "Production Worker",
    "Quality Assurance Manager",
  ],

  "Trades": [
    "Electrician",
    "Plumber",
    "HVAC Technician",
    "Carpenter",
    "Welder",
    "Mechanic",
    "Auto Technician",
    "Maintenance Technician",
    "Equipment Operator",
    "Pipefitter",
    "Sheet Metal Worker",
    "Industrial Maintenance Technician",
  ],

  "Logistics": [
    "Logistics Manager",
    "Supply Chain Manager",
    "Warehouse Manager",
    "Inventory Manager",
    "Shipping Coordinator",
    "Purchasing Manager",
    "Logistics Coordinator",
    "Supply Chain Analyst",
    "Procurement Specialist",
    "Distribution Manager",
    "Inventory Analyst",
    "Operations Manager",
  ],

  "Transportation": [
    "Truck Driver",
    "Delivery Driver",
    "Fleet Manager",
    "Dispatcher",
    "Transportation Manager",
    "Logistics Driver",
    "Bus Driver",
    "Pilot",
    "Train Conductor",
    "Transportation Coordinator",
    "Freight Broker",
    "CDL Driver",
  ],

  // Professional & Public
  "Education": [
    "Teacher",
    "Professor",
    "Academic Advisor",
    "School Administrator",
    "Instructional Designer",
    "Tutor",
    "Education Coordinator",
    "Curriculum Developer",
    "Teaching Assistant",
    "Principal",
    "Special Education Teacher",
    "ESL Teacher",
    "Corporate Trainer",
  ],

  "Legal": [
    "Attorney",
    "Paralegal",
    "Legal Assistant",
    "Compliance Officer",
    "Contract Manager",
    "Legal Secretary",
    "Corporate Counsel",
    "Legal Analyst",
    "Litigation Support",
    "Regulatory Affairs Specialist",
    "Legal Coordinator",
  ],

  "Government & Public Sector": [
    "Government Administrator",
    "Policy Analyst",
    "Public Affairs Specialist",
    "Program Manager",
    "Budget Analyst",
    "City Planner",
    "Grants Manager",
    "Public Relations Specialist",
    "Administrative Officer",
    "Compliance Analyst",
    "Government Contractor",
  ],

  "Science & Research": [
    "Research Scientist",
    "Laboratory Technician",
    "Research Associate",
    "Scientist",
    "Lab Manager",
    "Research Analyst",
    "Clinical Research Associate",
    "Biologist",
    "Chemist",
    "Research Coordinator",
    "Quality Control Scientist",
  ],

  "Social Services": [
    "Social Worker",
    "Case Manager",
    "Counselor",
    "Community Outreach Coordinator",
    "Mental Health Counselor",
    "Family Services Worker",
    "Program Coordinator",
    "Youth Worker",
    "Substance Abuse Counselor",
    "Child Welfare Specialist",
    "Nonprofit Program Manager",
  ],

  // Creative & Media
  "Creative & Media": [
    "Graphic Designer",
    "Video Editor",
    "Content Creator",
    "Copywriter",
    "Creative Director",
    "Multimedia Designer",
    "Motion Graphics Designer",
    "Art Director",
    "Production Coordinator",
    "Media Planner",
    "Broadcast Engineer",
    "Photographer",
  ],

  "Art & Design": [
    "Graphic Designer",
    "UI Designer",
    "UX Designer",
    "Product Designer",
    "Web Designer",
    "Interior Designer",
    "Industrial Designer",
    "Illustrator",
    "Visual Designer",
    "Brand Designer",
    "3D Designer",
    "User Experience Researcher",
  ],

  // Other
  "Sports & Recreation": [
    "Personal Trainer",
    "Fitness Instructor",
    "Sports Coach",
    "Recreation Coordinator",
    "Athletic Director",
    "Gym Manager",
    "Sports Marketing Manager",
    "Event Coordinator",
    "Wellness Coordinator",
    "Physical Education Teacher",
  ],

  "Security & Safety": [
    "Security Officer",
    "Security Manager",
    "Loss Prevention Specialist",
    "Safety Manager",
    "Security Analyst",
    "Cybersecurity Analyst",
    "Information Security Analyst",
    "Safety Coordinator",
    "Risk Manager",
    "Compliance Specialist",
    "Security Consultant",
  ],

  "Environmental & Sustainability": [
    "Environmental Scientist",
    "Sustainability Manager",
    "Environmental Engineer",
    "Environmental Consultant",
    "EHS Specialist",
    "Sustainability Analyst",
    "Environmental Compliance Specialist",
    "Conservation Scientist",
    "Renewable Energy Specialist",
    "Climate Analyst",
  ],

  "Energy": [
    "Energy Engineer",
    "Project Manager",
    "Operations Manager",
    "Field Technician",
    "Solar Installer",
    "Wind Turbine Technician",
    "Energy Analyst",
    "Petroleum Engineer",
    "Power Plant Operator",
    "Utilities Manager",
    "Energy Consultant",
  ],

  "Agriculture": [
    "Farm Manager",
    "Agricultural Specialist",
    "Agronomist",
    "Farm Worker",
    "Horticulturist",
    "Agricultural Engineer",
    "Livestock Manager",
    "Agricultural Sales Representative",
    "Food Scientist",
    "Crop Consultant",
  ],

  "Management & Leadership": [
    "General Manager",
    "Operations Manager",
    "Program Manager",
    "Project Manager",
    "Department Manager",
    "Director of Operations",
    "VP of Operations",
    "Chief Operating Officer",
    "Team Lead",
    "Division Manager",
    "Managing Director",
    "Regional Manager",
  ],
}

/**
 * Get all industries available for selection
 */
export function getIndustries(): string[] {
  return Object.keys(JOB_TITLES_BY_INDUSTRY)
}

/**
 * Get job titles for a specific industry
 */
export function getJobTitlesForIndustry(industry: string): string[] {
  return JOB_TITLES_BY_INDUSTRY[industry] || []
}

/**
 * Search job titles across all industries
 */
export function searchJobTitles(query: string): { industry: string; title: string }[] {
  const lowerQuery = query.toLowerCase()
  const results: { industry: string; title: string }[] = []

  for (const [industry, titles] of Object.entries(JOB_TITLES_BY_INDUSTRY)) {
    for (const title of titles) {
      if (title.toLowerCase().includes(lowerQuery)) {
        results.push({ industry, title })
      }
    }
  }

  return results
}

/**
 * Validate that a job title exists in the curated lists
 */
export function isValidJobTitle(title: string): boolean {
  const lowerTitle = title.toLowerCase()
  for (const titles of Object.values(JOB_TITLES_BY_INDUSTRY)) {
    if (titles.some(t => t.toLowerCase() === lowerTitle)) {
      return true
    }
  }
  return false
}

/**
 * Industry display info for the UI
 */
export const INDUSTRY_CATEGORIES = {
  "Healthcare": { label: "Healthcare", category: "Healthcare" },
  "Technology": { label: "Technology", category: "Tech" },
  "Software": { label: "Software", category: "Tech" },
  "Data & Analytics": { label: "Data & Analytics", category: "Tech" },
  "Engineering": { label: "Engineering", category: "Tech" },
  "Sales": { label: "Sales", category: "Business" },
  "Marketing": { label: "Marketing", category: "Business" },
  "Finance & Accounting": { label: "Finance & Accounting", category: "Business" },
  "Consulting": { label: "Consulting", category: "Business" },
  "Human Resources": { label: "Human Resources", category: "Business" },
  "Administrative": { label: "Administrative", category: "Business" },
  "Customer Service & Support": { label: "Customer Service", category: "Service" },
  "Retail": { label: "Retail", category: "Service" },
  "Hospitality": { label: "Hospitality", category: "Service" },
  "Food & Beverage": { label: "Food & Beverage", category: "Service" },
  "Construction": { label: "Construction", category: "Trades" },
  "Manufacturing": { label: "Manufacturing", category: "Trades" },
  "Trades": { label: "Skilled Trades", category: "Trades" },
  "Logistics": { label: "Logistics", category: "Trades" },
  "Transportation": { label: "Transportation", category: "Trades" },
  "Education": { label: "Education", category: "Professional" },
  "Legal": { label: "Legal", category: "Professional" },
  "Government & Public Sector": { label: "Government", category: "Professional" },
  "Science & Research": { label: "Science & Research", category: "Professional" },
  "Social Services": { label: "Social Services", category: "Professional" },
  "Creative & Media": { label: "Creative & Media", category: "Creative" },
  "Art & Design": { label: "Art & Design", category: "Creative" },
  "Sports & Recreation": { label: "Sports & Recreation", category: "Other" },
  "Security & Safety": { label: "Security & Safety", category: "Other" },
  "Environmental & Sustainability": { label: "Environmental", category: "Other" },
  "Energy": { label: "Energy", category: "Other" },
  "Agriculture": { label: "Agriculture", category: "Other" },
  "Management & Leadership": { label: "Management", category: "Other" },
} as const
