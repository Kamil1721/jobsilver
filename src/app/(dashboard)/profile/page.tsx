"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  User,
  Mail,
  MapPin,
  FileText,
  Upload,
  Save,
  Loader2,
  CheckCircle2,
  Settings,
  ArrowRight,
  Briefcase,
  Bell,
  CreditCard,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Sparkles,
} from "lucide-react"
import { FeatureGate } from "@/components/ui/feature-gate"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PhoneInput } from "@/components/ui/phone-input"
import type { Profile, JobFilters, ScreeningAnswers, NotificationPreferences } from "@/lib/supabase/types"
import { SubscriptionManagement } from "@/components/profile/SubscriptionManagement"
import { CVGeneratorDialog } from "@/components/cv"

// Loading fallback for Suspense
function ProfileLoading() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <ProfilePageContent />
    </Suspense>
  )
}

function ProfilePageContent() {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get("tab")
  const validTabs = ["profile", "cv", "preferences", "subscription"]
  const defaultTab = validTabs.includes(tabFromUrl || "") ? tabFromUrl! : "profile"

  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [dragActive, setDragActive] = React.useState(false)
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  // Email notification states
  const [notificationPrefs, setNotificationPrefs] = React.useState<NotificationPreferences>({
    job_matches: false,
  })
  const [isTogglingNotification, setIsTogglingNotification] = React.useState(false)
  // Delete account states
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = React.useState("")
  const [isDeleting, setIsDeleting] = React.useState(false)
  // CV viewer states
  const [cvViewUrl, setCvViewUrl] = React.useState<string | null>(null)
  const [isLoadingCv, setIsLoadingCv] = React.useState(false)
  // CV generator dialog state
  const [showCvGenerator, setShowCvGenerator] = React.useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  // Form state
  const [formData, setFormData] = React.useState({
    first_name: "",
    surname: "",
    email: "",
    phone: "",
    location: "",
  })

  // Fetch profile on mount
  React.useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (error && error.code !== "PGRST116") {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load profile",
        })
      }

      if (data) {
        setProfile(data)
        // Split full_name into first_name and surname
        const nameParts = (data.full_name || "").trim().split(/\s+/)
        const firstName = nameParts[0] || ""
        const surname = nameParts.slice(1).join(" ") || ""
        setFormData({
          first_name: firstName,
          surname: surname,
          email: data.email || user.email || "",
          phone: data.phone || "",
          location: data.location || "",
        })
        // Load notification preferences
        const prefs = (data.notification_preferences as NotificationPreferences) || {}
        setNotificationPrefs({
          job_matches: prefs.job_matches ?? false,
        })
      } else {
        setFormData((prev) => ({ ...prev, email: user.email || "" }))
      }
      setIsLoading(false)
    }

    fetchProfile()
  }, [supabase, toast])

  // Save profile
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Combine first_name and surname into full_name for database
      const full_name = `${formData.first_name} ${formData.surname}`.trim()

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name,
        email: formData.email,
        phone: formData.phone,
        location: formData.location,
        updated_at: new Date().toISOString(),
      })

      if (error) throw error

      toast({
        title: "Profile saved",
        description: "Your changes have been saved successfully",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save profile",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    // Accept PDF, DOC, DOCX, and TXT files
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    const validExtensions = ['.pdf', '.doc', '.docx', '.txt']
    const fileExt = '.' + (file.name.split('.').pop()?.toLowerCase() || '')

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a PDF, DOC, DOCX, or TXT file",
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Maximum file size is 10MB",
      })
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/cv/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("Upload failed")

      const data = await response.json()
      setUploadedFileName(file.name)
      setProfile((prev) => prev
        ? { ...prev, cv_url: data.cv_url, cv_parsed_data: data.parsed_data }
        : { id: '', cv_url: data.cv_url, cv_parsed_data: data.parsed_data } as Profile
      )

      // Refresh the preview URL for the new file
      setCvViewUrl(null)
      setTimeout(() => fetchCvUrl(), 500)

      toast({
        title: "CV uploaded",
        description: "Your CV has been processed successfully",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Failed to upload CV",
      })
    } finally {
      setIsUploading(false)
    }
  }

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  // Handle notification preference toggle
  const handleNotificationToggle = async (key: keyof NotificationPreferences, enabled: boolean) => {
    setIsTogglingNotification(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const updatedPrefs = { ...notificationPrefs, [key]: enabled }

      // Determine if any notification is enabled
      const anyEnabled = Object.values(updatedPrefs).some(Boolean)

      const { error } = await supabase
        .from("profiles")
        .update({
          notification_preferences: updatedPrefs,
          email_notifications: anyEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (error) throw error

      setNotificationPrefs(updatedPrefs)
      setProfile((prev) => prev ? {
        ...prev,
        notification_preferences: updatedPrefs,
        email_notifications: anyEnabled,
      } : prev)

      toast({
        title: enabled ? "Notifications Enabled" : "Notifications Disabled",
        description: key === 'job_matches'
          ? enabled ? "You'll receive new job match notifications" : "Job match notifications disabled"
          : enabled ? "You'll receive application update notifications" : "Application update notifications disabled",
      })
    } catch (error) {
      console.error('[Profile] Notification toggle error:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update notification settings",
      })
    } finally {
      setIsTogglingNotification(false)
    }
  }

  // Fetch CV signed URL for viewing
  const fetchCvUrl = React.useCallback(async () => {
    if (!profile?.cv_url) return

    setIsLoadingCv(true)
    try {
      const response = await fetch("/api/cv/view")
      if (response.ok) {
        const data = await response.json()
        setCvViewUrl(data.url)
      }
    } catch (error) {
      console.error("Failed to fetch CV URL:", error)
    } finally {
      setIsLoadingCv(false)
    }
  }, [profile?.cv_url])

  // Fetch CV URL when profile loads with a CV
  React.useEffect(() => {
    if (profile?.cv_url && !cvViewUrl) {
      fetchCvUrl()
    }
  }, [profile?.cv_url, cvViewUrl, fetchCvUrl])

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmation.toLowerCase() !== "confirm") {
      toast({
        variant: "destructive",
        title: "Invalid confirmation",
        description: "Please type 'confirm' to delete your account",
      })
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: "confirm" }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete account")
      }

      // Sign out and redirect to home page
      await supabase.auth.signOut()
      window.location.href = "/"
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete account",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-600 dark:text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-zinc-50 dark:bg-[#0a0a0b]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Profile Settings</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your personal information and job preferences
          </p>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="cv" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">CV</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <Briefcase className="w-4 h-4" />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Subscription</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your personal details and contact information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                      <Input
                        id="first_name"
                        placeholder="John"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="surname">Surname</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                      <Input
                        id="surname"
                        placeholder="Doe"
                        value={formData.surname}
                        onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                      <Input
                        id="location"
                        placeholder="City, Country"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <PhoneInput
                      id="phone"
                      value={formData.phone}
                      onChange={(value) => setFormData({ ...formData, phone: value })}
                      placeholder="123 456 789"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:border dark:border-white/10"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CV Upload Tab */}
          <TabsContent value="cv">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>CV / Resume</CardTitle>
                    <CardDescription>
                      Upload your CV or generate a professional one from your information
                    </CardDescription>
                  </div>
                  <FeatureGate
                    feature="cv_generator"
                    mode="button"
                    buttonLabel="Generate CV"
                    buttonVariant="outline"
                    buttonClassName="gap-2"
                  >
                    <Button
                      variant="outline"
                      onClick={() => setShowCvGenerator(true)}
                      className="gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate CV
                    </Button>
                  </FeatureGate>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload area */}
                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200",
                    dragActive
                      ? "border-zinc-400 bg-zinc-100 dark:border-white/[0.12] dark:bg-white/[0.03]"
                      : "border-zinc-300 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/[0.12]",
                    isUploading && "pointer-events-none opacity-60"
                  )}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileUpload(e.target.files[0])
                      }
                    }}
                  />

                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-zinc-600 dark:text-zinc-400 animate-spin" />
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Uploading and parsing your CV...</p>
                    </div>
                  ) : profile?.cv_url ? (
                    <div className="flex flex-col items-center gap-4 w-full">
                      <div className="flex items-center justify-between w-full gap-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-900 dark:text-white truncate" title={uploadedFileName || profile.cv_url.split('/').pop()?.replace(/^\d+-/, '') || 'CV Document'}>
                              {uploadedFileName || profile.cv_url.split('/').pop()?.replace(/^\d+-/, '') || 'CV Document'}
                            </p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                              Ready for job matching
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {cvViewUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(cvViewUrl, '_blank')}
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Open
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Replace
                          </Button>
                        </div>
                      </div>

                      {/* CV Preview - only for PDF files */}
                      {profile.cv_url?.toLowerCase().endsWith('.pdf') ? (
                        isLoadingCv ? (
                          <div className="w-full h-[350px] flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                          </div>
                        ) : cvViewUrl ? (
                          <div className="w-full rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                            <iframe
                              src={`${cvViewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                              className="w-full h-[350px] bg-white"
                              title="CV Preview"
                            />
                          </div>
                        ) : null
                      ) : (
                        <div className="w-full py-8 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                          <FileText className="w-12 h-12 text-zinc-400 mb-3" />
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Preview not available for this file type
                          </p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                            Click &quot;Open&quot; to view the document
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center">
                        <Upload className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">Upload your CV</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                          Drag and drop your file here, or click to browse
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2"
                      >
                        Select File
                      </Button>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">PDF, DOC, DOCX, or TXT files, max 10MB</p>
                    </div>
                  )}
                </div>

                {/* Parsed data preview */}
                {profile?.cv_parsed_data && (
                  <div className="p-4 bg-zinc-50 dark:bg-white/[0.02] rounded-xl border border-zinc-200 dark:border-white/[0.06] space-y-3">
                    <h4 className="font-medium flex items-center gap-2 text-zinc-900 dark:text-white">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Extracted Information
                    </h4>
                    {(profile.cv_parsed_data as { skills?: string[] }).skills && (
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Skills Detected</p>
                        <div className="flex flex-wrap gap-1.5">
                          {((profile.cv_parsed_data as { skills?: string[] }).skills || []).slice(0, 10).map((skill) => (
                            <Badge key={skill} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {((profile.cv_parsed_data as { skills?: string[] }).skills || []).length > 10 && (
                            <Badge variant="outline" className="text-xs">
                              +{(profile.cv_parsed_data as { skills?: string[] }).skills!.length - 10} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {(profile.cv_parsed_data as { summary?: string }).summary && (
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Summary</p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          {(profile.cv_parsed_data as { summary?: string }).summary}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Job Preferences Tab */}
          <TabsContent value="preferences">
            <div className="space-y-6">
              {/* Email Notifications Card */}
              <FeatureGate feature="email_alerts" mode="overlay">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-blue-500" />
                      Email Notifications
                    </CardTitle>
                    <CardDescription>
                      Get notified about new job matches and application updates
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-white/[0.02] rounded-xl border border-zinc-200 dark:border-white/[0.06]">
                      <div className="space-y-1">
                        <p className="font-medium text-zinc-900 dark:text-white">New Job Matches</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Receive daily digest of jobs matching your criteria
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.job_matches || false}
                        onCheckedChange={(checked) => handleNotificationToggle('job_matches', checked)}
                        disabled={isTogglingNotification}
                      />
                    </div>
                  </CardContent>
                </Card>
              </FeatureGate>

              {/* Job Preferences Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Job Preferences</CardTitle>
                  <CardDescription>
                    Configure your job search criteria and screening answers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary of current preferences */}
                  {profile?.job_filters ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-zinc-50 dark:bg-white/[0.02] rounded-xl border border-zinc-200 dark:border-white/[0.06]">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span className="font-medium text-zinc-900 dark:text-white">Preferences Configured</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(profile.job_filters as JobFilters).job_titles?.slice(0, 3).map((title) => (
                            <Badge key={title} variant="secondary">{title}</Badge>
                          ))}
                          {((profile.job_filters as JobFilters).job_titles?.length || 0) > 3 && (
                            <Badge variant="outline">+{(profile.job_filters as JobFilters).job_titles.length - 3} more</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Settings className="w-5 h-5 text-amber-600" />
                        <span className="font-medium text-amber-800 dark:text-amber-200">Not Configured</span>
                      </div>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Set up your job preferences to get personalized job matches
                      </p>
                    </div>
                  )}

                  {/* Configure button */}
                  <Link href={profile?.job_filters ? "/setup?edit=true" : "/setup"}>
                    <Button
                      className="w-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:border dark:border-white/10"
                      size="lg"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      {profile?.job_filters ? "Edit Job Preferences" : "Configure Job Preferences"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>

                  <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                    Configure your job search filters, screening questions, and application preferences.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription">
            <SubscriptionManagement userId={profile?.id || ""} />
          </TabsContent>
        </Tabs>
      </div>

      {/* CV Generator Dialog */}
      <CVGeneratorDialog
        open={showCvGenerator}
        onOpenChange={setShowCvGenerator}
        onCVGenerated={(cvUrl, signedUrl) => {
          setProfile(prev => prev ? { ...prev, cv_url: cvUrl } : prev)
          setCvViewUrl(signedUrl || null)
        }}
      />

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This action is <span className="font-semibold text-red-600 dark:text-red-400">permanent and irreversible</span>.
                All your data will be permanently deleted, including:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 text-zinc-600 dark:text-zinc-400">
                <li>Your profile information</li>
                <li>All saved jobs and application history</li>
                <li>Your CV and uploaded documents</li>
                <li>AI learning data and preferences</li>
                <li>Subscription and billing information</li>
              </ul>
              <div className="pt-2">
                <p className="text-sm font-medium text-zinc-900 dark:text-white mb-2">
                  Type <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">confirm</span> to delete your account:
                </p>
                <Input
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Type 'confirm' here"
                  className="font-mono"
                  disabled={isDeleting}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setDeleteConfirmation("")
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmation.toLowerCase() !== "confirm"}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
