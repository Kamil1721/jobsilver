"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Wrench,
  X,
  Plus,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import type { ScreeningAnswers } from "@/lib/supabase/types"

interface SkillsSectionProps {
  data: ScreeningAnswers
  onUpdate: (updates: Partial<ScreeningAnswers>) => void
  jobTitles?: string[]  // From Step 1 for suggestions
}

// Common skill presets by category
const SKILL_PRESETS: Record<string, string[]> = {
  "Software Developer": [
    "JavaScript", "TypeScript", "React", "Node.js", "Python", "SQL",
    "Git", "REST APIs", "Agile", "Problem Solving",
  ],
  "Data Scientist": [
    "Python", "R", "SQL", "Machine Learning", "TensorFlow", "PyTorch",
    "Pandas", "Data Visualization", "Statistics", "Deep Learning",
  ],
  "Product Manager": [
    "Product Strategy", "Agile", "Scrum", "User Research", "Roadmapping",
    "A/B Testing", "Data Analysis", "Stakeholder Management", "Jira", "Communication",
  ],
  "Designer": [
    "Figma", "Adobe Creative Suite", "UI Design", "UX Design", "Prototyping",
    "User Research", "Wireframing", "Design Systems", "Typography", "Accessibility",
  ],
  "Marketing": [
    "Digital Marketing", "SEO", "Content Marketing", "Google Analytics", "Social Media",
    "Email Marketing", "Copywriting", "A/B Testing", "Marketing Automation", "CRM",
  ],
  "Project Manager": [
    "Project Planning", "Agile", "Scrum", "Risk Management", "Stakeholder Management",
    "Budgeting", "Jira", "MS Project", "Communication", "Team Leadership",
  ],
  "DevOps Engineer": [
    "AWS", "Docker", "Kubernetes", "CI/CD", "Linux", "Terraform",
    "Jenkins", "Ansible", "Monitoring", "Python",
  ],
  "Healthcare": [
    "Patient Care", "Medical Records", "HIPAA Compliance", "Clinical Assessment",
    "Medication Administration", "Vital Signs", "EMR/EHR", "CPR Certified", "Patient Education", "Care Planning",
  ],
  "Finance": [
    "Financial Analysis", "Excel", "Financial Modeling", "Budgeting", "Forecasting",
    "Accounting", "QuickBooks", "SAP", "Risk Management", "Compliance",
  ],
  "Sales": [
    "Sales Strategy", "CRM", "Lead Generation", "Negotiation", "Account Management",
    "Cold Calling", "Pipeline Management", "Salesforce", "Presentation Skills", "Closing",
  ],
  "Customer Service": [
    "Customer Support", "Communication", "Problem Resolution", "CRM", "Active Listening",
    "Conflict Resolution", "Phone Support", "Live Chat", "Empathy", "Product Knowledge",
  ],
  "Education": [
    "Curriculum Development", "Lesson Planning", "Classroom Management", "Student Assessment",
    "Educational Technology", "Differentiated Instruction", "Communication", "Mentoring",
  ],
  "General": [
    "Communication", "Problem Solving", "Team Collaboration", "Time Management",
    "Leadership", "Analytical Thinking", "Adaptability", "Attention to Detail",
  ],
}

export function SkillsSection({ data, onUpdate, jobTitles = [] }: SkillsSectionProps) {
  const [inputValue, setInputValue] = React.useState("")
  const [isLoadingAI, setIsLoadingAI] = React.useState(false)
  const [aiSuggestions, setAiSuggestions] = React.useState<string[]>([])
  const skills = data.skills || []
  const inputRef = React.useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Helper function to match skills from a title/position string
  const matchSkillsFromText = (text: string, matchedSkills: Set<string>) => {
    const lowerText = text.toLowerCase()

    // Tech roles
    if (lowerText.includes("developer") || lowerText.includes("engineer") || lowerText.includes("programmer") || lowerText.includes("software")) {
      SKILL_PRESETS["Software Developer"].forEach(s => matchedSkills.add(s))
    }
    if (lowerText.includes("devops") || lowerText.includes("sre") || lowerText.includes("infrastructure")) {
      SKILL_PRESETS["DevOps Engineer"].forEach(s => matchedSkills.add(s))
    }
    if (lowerText.includes("data") || lowerText.includes("analyst") || lowerText.includes("scientist")) {
      SKILL_PRESETS["Data Scientist"].forEach(s => matchedSkills.add(s))
    }
    if ((lowerText.includes("product") && lowerText.includes("manager")) || lowerText.includes("product owner")) {
      SKILL_PRESETS["Product Manager"].forEach(s => matchedSkills.add(s))
    }
    if (lowerText.includes("project") && lowerText.includes("manager")) {
      SKILL_PRESETS["Project Manager"].forEach(s => matchedSkills.add(s))
    }
    if (lowerText.includes("design") || lowerText.includes("ux") || lowerText.includes("ui")) {
      SKILL_PRESETS["Designer"].forEach(s => matchedSkills.add(s))
    }
    if (lowerText.includes("marketing") || lowerText.includes("growth") || lowerText.includes("seo") || lowerText.includes("brand")) {
      SKILL_PRESETS["Marketing"].forEach(s => matchedSkills.add(s))
    }

    // Healthcare roles
    if (lowerText.includes("nurse") || lowerText.includes("nursing") || lowerText.includes("medical") ||
        lowerText.includes("healthcare") || lowerText.includes("doctor") || lowerText.includes("physician") ||
        lowerText.includes("therapist") || lowerText.includes("clinical") || lowerText.includes("hospital") ||
        lowerText.includes("care") || lowerText.includes("nhs")) {
      SKILL_PRESETS["Healthcare"].forEach(s => matchedSkills.add(s))
    }

    // Finance roles
    if (lowerText.includes("finance") || lowerText.includes("accountant") || lowerText.includes("accounting") ||
        lowerText.includes("financial") || lowerText.includes("banker") || lowerText.includes("auditor") ||
        lowerText.includes("bookkeeper")) {
      SKILL_PRESETS["Finance"].forEach(s => matchedSkills.add(s))
    }

    // Sales & Retail roles
    if (lowerText.includes("sales") || lowerText.includes("account executive") || lowerText.includes("business development") ||
        lowerText.includes("retail") || lowerText.includes("store") || lowerText.includes("shop assistant") ||
        lowerText.includes("advisor") || lowerText.includes("consultant")) {
      SKILL_PRESETS["Sales"].forEach(s => matchedSkills.add(s))
    }

    // Customer service roles
    if (lowerText.includes("customer") || lowerText.includes("support") || lowerText.includes("service rep") ||
        lowerText.includes("call centre") || lowerText.includes("call center") || lowerText.includes("helpdesk")) {
      SKILL_PRESETS["Customer Service"].forEach(s => matchedSkills.add(s))
    }

    // Education roles
    if (lowerText.includes("teacher") || lowerText.includes("professor") || lowerText.includes("instructor") ||
        lowerText.includes("educator") || lowerText.includes("tutor") || lowerText.includes("teaching") ||
        lowerText.includes("lecturer")) {
      SKILL_PRESETS["Education"].forEach(s => matchedSkills.add(s))
    }
  }

  // Determine relevant skill presets based on job titles AND work experience
  const getRelevantPresets = (): string[] => {
    const matchedSkills = new Set<string>()

    // 1. Check job titles they're looking for (from Step 1)
    for (const title of jobTitles) {
      matchSkillsFromText(title, matchedSkills)
    }

    // 2. Check their work history positions
    const workHistory = data.work_history || []
    for (const job of workHistory) {
      if (job.position) {
        matchSkillsFromText(job.position, matchedSkills)
      }
      // Also check company name for retail/industry hints
      if (job.company) {
        const lowerCompany = job.company.toLowerCase()
        // Retail companies
        if (lowerCompany.includes("currys") || lowerCompany.includes("argos") || lowerCompany.includes("john lewis") ||
            lowerCompany.includes("tesco") || lowerCompany.includes("sainsbury") || lowerCompany.includes("asda") ||
            lowerCompany.includes("amazon") || lowerCompany.includes("apple") || lowerCompany.includes("best buy")) {
          SKILL_PRESETS["Sales"].forEach(s => matchedSkills.add(s))
          SKILL_PRESETS["Customer Service"].forEach(s => matchedSkills.add(s))
        }
      }
    }

    // If no matches, use general skills
    if (matchedSkills.size === 0) {
      SKILL_PRESETS["General"].forEach(s => matchedSkills.add(s))
    }

    // Filter out skills already added
    return Array.from(matchedSkills).filter(s => !skills.includes(s))
  }

  const suggestedSkills = getRelevantPresets()

  // AI-powered skill suggestions
  const handleAISuggest = async () => {
    setIsLoadingAI(true)
    setAiSuggestions([])
    try {
      const response = await fetch('/api/ai/suggest-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workHistory: data.work_history,
          education: data.education,
          jobTitles,
          existingSkills: skills,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to get suggestions')
      }

      setAiSuggestions(result.skills || [])
      toast({
        title: "AI suggestions ready!",
        description: `Found ${result.skills?.length || 0} skills based on your profile`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't get AI suggestions",
        description: error instanceof Error ? error.message : "Please try again",
      })
    } finally {
      setIsLoadingAI(false)
    }
  }

  const addSkill = (skill: string) => {
    const trimmedSkill = skill.trim()
    if (trimmedSkill && !skills.includes(trimmedSkill) && skills.length < 15) {
      onUpdate({ skills: [...skills, trimmedSkill] })
    }
  }

  const removeSkill = (skill: string) => {
    onUpdate({ skills: skills.filter(s => s !== skill) })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      if (inputValue.trim()) {
        addSkill(inputValue)
        setInputValue("")
      }
    } else if (e.key === "Backspace" && !inputValue && skills.length > 0) {
      removeSkill(skills[skills.length - 1])
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text")
    // Split by common delimiters
    const pastedSkills = pastedText.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)

    const newSkills = [...skills]
    for (const skill of pastedSkills) {
      if (!newSkills.includes(skill) && newSkills.length < 15) {
        newSkills.push(skill)
      }
    }
    onUpdate({ skills: newSkills })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Skills</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{skills.length}/15 skills</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAISuggest}
            disabled={isLoadingAI || skills.length >= 15}
            className="gap-1.5 h-7 text-xs"
          >
            {isLoadingAI ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Thinking...
              </>
            ) : (
              "Suggest skills"
            )}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Add your key skills and competencies (max 15)
      </p>

      {/* Skills Input */}
      <div
        className={cn(
          "min-h-[120px] p-3 rounded-xl border-2 transition-colors cursor-text",
          "border-border dark:border-zinc-700",
          "focus-within:border-[var(--coral)]"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <Badge
              key={skill}
              className="bg-secondary dark:bg-white/[0.05] text-foreground dark:text-zinc-300 pl-3 pr-1.5 py-1.5 gap-1.5"
            >
              {skill}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeSkill(skill)
                }}
                className="hover:bg-muted-foreground/20 dark:hover:bg-white/[0.1] rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {skills.length < 15 && (
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={skills.length === 0 ? "Type a skill and press Enter..." : "Add more..."}
              className="border-0 shadow-none p-0 h-7 w-auto min-w-[120px] max-w-[200px] focus-visible:ring-0"
            />
          )}
        </div>
      </div>


      {/* AI-suggested skills - shown when AI generates suggestions */}
      {aiSuggestions.length > 0 && skills.length < 15 && (
        <div className="space-y-2 rounded-xl border border-[var(--dawn-line)] bg-[var(--dawn-cream)] p-3">
          <div>
            <p className="text-xs font-medium text-[var(--coral-lo)]">
              AI-suggested skills (click to add):
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {aiSuggestions.map((skill) => (
              <button
                key={skill}
                onClick={() => {
                  addSkill(skill)
                  setAiSuggestions(prev => prev.filter(s => s !== skill))
                }}
                disabled={skills.length >= 15 || skills.includes(skill)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm border transition-colors",
                  "border-[var(--dawn-line-2)] bg-[var(--dawn-surface)]",
                  "hover:border-[var(--coral)]/40 hover:bg-[var(--coral-soft)]",
                  "text-[var(--dawn-ink-2)]",
                  (skills.length >= 15 || skills.includes(skill)) && "opacity-50 cursor-not-allowed"
                )}
              >
                <Plus className="w-3 h-3 inline mr-1" />
                {skill}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggested skills based on job titles - shown as clickable chips */}
      {suggestedSkills.length > 0 && skills.length < 15 && aiSuggestions.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Suggested skills (click to add):
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedSkills.slice(0, 10).map((skill) => (
              <button
                key={skill}
                onClick={() => addSkill(skill)}
                disabled={skills.length >= 15}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm border transition-colors",
                  "border-border dark:border-zinc-600 bg-transparent",
                  "hover:border-muted-foreground/40 hover:bg-accent dark:hover:bg-white/[0.05]",
                  skills.length >= 15 && "opacity-50 cursor-not-allowed"
                )}
              >
                <Plus className="w-3 h-3 inline mr-1" />
                {skill}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Tip: You can paste a comma-separated list of skills
      </p>
    </div>
  )
}
