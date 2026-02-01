"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertCircle,
  Bug,
  FileQuestion,
  Lightbulb,
  HelpCircle,
  Loader2,
} from "lucide-react"
import type { ReportType } from "@/lib/supabase/types"

interface ReportTypeOption {
  value: ReportType
  label: string
  description: string
  icon: React.ReactNode
}

const REPORT_TYPES: ReportTypeOption[] = [
  {
    value: "incorrect_questions",
    label: "Incorrect Questions",
    description: "The application questions are wrong or missing",
    icon: <FileQuestion className="w-4 h-4" />,
  },
  {
    value: "incorrect_description",
    label: "Incorrect Description",
    description: "The job description doesn't match the actual posting",
    icon: <AlertCircle className="w-4 h-4" />,
  },
  {
    value: "bug",
    label: "Bug Report",
    description: "Something isn't working as expected",
    icon: <Bug className="w-4 h-4" />,
  },
  {
    value: "suggestion",
    label: "Suggestion",
    description: "Feature request or improvement idea",
    icon: <Lightbulb className="w-4 h-4" />,
  },
  {
    value: "other",
    label: "Other",
    description: "Anything else you'd like to report",
    icon: <HelpCircle className="w-4 h-4" />,
  },
]

interface JobContext {
  id: string
  title: string
  company: string | null
}

interface ReportProblemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobContext?: JobContext | null
}

export function ReportProblemDialog({
  open,
  onOpenChange,
  jobContext,
}: ReportProblemDialogProps) {
  const [reportType, setReportType] = React.useState<ReportType | "">("")
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { toast } = useToast()

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setReportType("")
      setTitle("")
      setDescription("")
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!reportType) {
      toast({
        title: "Error",
        description: "Please select a report type",
        variant: "destructive",
      })
      return
    }

    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title",
        variant: "destructive",
      })
      return
    }

    if (!description.trim()) {
      toast({
        title: "Error",
        description: "Please enter a description",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_type: reportType,
          title: title.trim(),
          description: description.trim(),
          job_id: jobContext?.id || null,
          job_title: jobContext?.title || null,
          job_company: jobContext?.company || null,
          page_url: typeof window !== "undefined" ? window.location.href : null,
          browser_info: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit report")
      }

      toast({
        title: "Report Submitted",
        description: "Thank you for your feedback. We'll look into it.",
      })

      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit report",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedType = REPORT_TYPES.find((t) => t.value === reportType)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Report a Problem</DialogTitle>
            <DialogDescription>
              Help us improve by reporting issues or sharing suggestions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Job context display */}
            {jobContext && (
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1">Reporting about:</p>
                <p className="text-sm font-medium">{jobContext.title}</p>
                {jobContext.company && (
                  <p className="text-xs text-muted-foreground">{jobContext.company}</p>
                )}
              </div>
            )}

            {/* Report type selector */}
            <div className="space-y-2">
              <Label htmlFor="report-type">Report Type</Label>
              <Select
                value={reportType}
                onValueChange={(value) => setReportType(value as ReportType)}
              >
                <SelectTrigger id="report-type">
                  <SelectValue placeholder="Select a type..." />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        {type.icon}
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType && (
                <p className="text-xs text-muted-foreground">{selectedType.description}</p>
              )}
            </div>

            {/* Title input */}
            <div className="space-y-2">
              <Label htmlFor="report-title">
                Title <span className="text-muted-foreground">({title.length}/200)</span>
              </Label>
              <Input
                id="report-title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 200))}
                placeholder="Brief summary of the issue"
                maxLength={200}
              />
            </div>

            {/* Description textarea */}
            <div className="space-y-2">
              <Label htmlFor="report-description">
                Description <span className="text-muted-foreground">({description.length}/2000)</span>
              </Label>
              <Textarea
                id="report-description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                placeholder="Please provide as much detail as possible..."
                rows={5}
                maxLength={2000}
              />
            </div>

            {/* Info note */}
            <p className="text-xs text-muted-foreground">
              Your current page URL and browser information will be automatically included to help us debug issues.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
