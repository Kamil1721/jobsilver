"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Users,
  Activity,
  ExternalLink,
  Search,
  RefreshCw,
  Shield,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Flag,
  Bug,
  FileQuestion,
  Lightbulb,
  HelpCircle,
  AlertCircle,
  FlaskConical,
  Link2,
  Copy,
  UserMinus,
  Ticket,
  Megaphone,
  ClipboardList,
  Plus,
  Edit,
  Power,
  Clock,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type { SubscriptionPlan, ReportType, ReportStatus, AdminAnnouncement, AnnouncementType, AdminAuditLog } from "@/lib/supabase/types"

// Admin access is now determined by is_admin flag in database
// which is set based on ADMIN_EMAILS environment variable

interface User {
  id: string
  email: string | null
  full_name: string | null
  subscription_plan: SubscriptionPlan
  subscription_started_at: string | null
  is_admin: boolean
  is_tester: boolean
  created_at: string
  updated_at: string
  job_count: number
}

interface UserReport {
  id: string
  user_id: string
  report_type: ReportType
  title: string
  description: string
  job_id: string | null
  job_title: string | null
  job_company: string | null
  page_url: string | null
  browser_info: string | null
  status: ReportStatus
  admin_notes: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  profiles?: {
    email: string | null
    full_name: string | null
    subscription_plan: SubscriptionPlan | null
    created_at: string | null
    cv_url: string | null
    screening_answers: Record<string, unknown> | null
  }
  // Enriched debug data
  job_details?: {
    application_url: string | null
    platform_detected: string | null
    job_status: string | null
    job_created_at: string | null
  }
  user_report_count?: number
  job_report_count?: number
}

interface ReportStats {
  byStatus: Record<string, number>
  byType: Record<string, number>
}

// Tester system interfaces
type TesterInviteStatus = 'active' | 'used' | 'revoked' | 'expired'

interface TesterInvite {
  id: string
  code: string
  created_at: string
  expires_at: string | null
  status: TesterInviteStatus
  used_by: string | null
  used_at: string | null
  created_by: string
  // Joined data
  used_by_profile?: {
    email: string | null
    full_name: string | null
  }
}

interface Tester {
  id: string
  email: string | null
  full_name: string | null
  is_tester: boolean
  tester_since: string | null
  invite_code_used: string | null
  created_at: string
  subscription_plan: SubscriptionPlan
}

interface TesterStats {
  total_testers: number
  active_invites: number
  used_invites: number
  expired_invites: number
}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null)
  const [users, setUsers] = React.useState<User[]>([])
  const [usersTotal, setUsersTotal] = React.useState(0)
  const [userStats, setUserStats] = React.useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [planFilter, setPlanFilter] = React.useState<string>("all")
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null)
  const [userToDelete, setUserToDelete] = React.useState<User | null>(null)
  // Reports state
  const [reports, setReports] = React.useState<UserReport[]>([])
  const [reportsTotal, setReportsTotal] = React.useState(0)
  const [reportStats, setReportStats] = React.useState<ReportStats>({ byStatus: {}, byType: {} })
  const [reportStatusFilter, setReportStatusFilter] = React.useState<string>("all")
  const [reportTypeFilter, setReportTypeFilter] = React.useState<string>("all")
  const [selectedReport, setSelectedReport] = React.useState<UserReport | null>(null)
  const [editingNotes, setEditingNotes] = React.useState("")
  // Tester management state
  const [testers, setTesters] = React.useState<Tester[]>([])
  const [testerInvites, setTesterInvites] = React.useState<TesterInvite[]>([])
  const [testerStats, setTesterStats] = React.useState<TesterStats>({
    total_testers: 0,
    active_invites: 0,
    used_invites: 0,
    expired_invites: 0
  })
  const [isGeneratingInvite, setIsGeneratingInvite] = React.useState(false)
  const [testerToRemove, setTesterToRemove] = React.useState<Tester | null>(null)
  const [inviteToRevoke, setInviteToRevoke] = React.useState<TesterInvite | null>(null)
  const [copiedInviteId, setCopiedInviteId] = React.useState<string | null>(null)
  // Announcements state
  const [announcements, setAnnouncements] = React.useState<AdminAnnouncement[]>([])
  const [selectedAnnouncement, setSelectedAnnouncement] = React.useState<AdminAnnouncement | null>(null)
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = React.useState(false)
  const [announcementForm, setAnnouncementForm] = React.useState({
    message: '',
    type: 'info' as AnnouncementType,
    priority: 0,
    target_plans: null as string[] | null,
    is_active: true,
  })
  // Activity log state
  const [auditLogs, setAuditLogs] = React.useState<AdminAuditLog[]>([])
  const [auditLogsLoading, setAuditLogsLoading] = React.useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  // Check admin access
  React.useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      // Check is_admin flag from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single()

      if (!profile?.is_admin) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        })
        router.push("/dashboard")
        return
      }

      setIsAdmin(true)
    }
    checkAdmin()
  }, [supabase, router, toast])

  // Fetch all data when admin is confirmed
  React.useEffect(() => {
    if (isAdmin) {
      fetchUsers()
      fetchReports()
      fetchTesters()
      fetchAnnouncements()
      fetchAuditLogs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only fetch once when isAdmin becomes true
  }, [isAdmin])

  const fetchUsers = async (overridePlan?: string) => {
    try {
      const plan = overridePlan !== undefined ? overridePlan : planFilter
      const res = await fetch(`/api/admin/users?limit=100&search=${encodeURIComponent(searchTerm)}&plan=${plan === "all" ? "" : plan}`)
      if (!res.ok) throw new Error("Failed to fetch users")
      const data = await res.json()
      setUsers(data.users || [])
      setUsersTotal(data.total || 0)
      setUserStats(data.stats || {})
    } catch (error) {
      console.error("Error fetching users:", error)
      toast({ title: "Error", description: "Failed to fetch users", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchReports = async (overrideStatus?: string, overrideType?: string) => {
    try {
      const status = overrideStatus !== undefined ? overrideStatus : reportStatusFilter
      const type = overrideType !== undefined ? overrideType : reportTypeFilter
      const params = new URLSearchParams()
      params.set("limit", "100")
      if (status !== "all") params.set("status", status)
      if (type !== "all") params.set("type", type)

      const res = await fetch(`/api/admin/reports?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch reports")
      const data = await res.json()
      setReports(data.reports || [])
      setReportsTotal(data.total || 0)
      setReportStats(data.stats || { byStatus: {}, byType: {} })
    } catch (error) {
      console.error("Error fetching reports:", error)
    }
  }

  // Tester management functions
  const fetchTesters = async () => {
    try {
      const res = await fetch("/api/admin/testers")
      if (!res.ok) throw new Error("Failed to fetch testers")
      const data = await res.json()

      // Transform testers data
      const transformedTesters: Tester[] = (data.testers || []).map((t: {
        id: string
        email: string | null
        full_name: string | null
        is_tester: boolean
        tester_invite_code: string | null
        created_at: string
        subscription_plan?: SubscriptionPlan
      }) => ({
        id: t.id,
        email: t.email,
        full_name: t.full_name,
        is_tester: t.is_tester,
        tester_since: t.created_at, // Using created_at as approximation
        invite_code_used: t.tester_invite_code,
        created_at: t.created_at,
        subscription_plan: t.subscription_plan || 'free',
      }))
      setTesters(transformedTesters)

      // Transform invites data - API returns different field names
      const transformedInvites: TesterInvite[] = (data.invites || []).map((inv: {
        id: string
        invite_code: string
        created_at: string
        expires_at: string | null
        is_active: boolean
        used_by: string | null
        used_at: string | null
        created_by: string
        user?: { email: string | null; full_name: string | null }
      }) => {
        // Compute status from is_active, used_by, and expires_at
        let status: TesterInviteStatus = 'active'
        if (inv.used_by) {
          status = 'used'
        } else if (!inv.is_active) {
          status = 'revoked'
        } else if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
          status = 'expired'
        }

        return {
          id: inv.id,
          code: inv.invite_code, // Map invite_code -> code
          created_at: inv.created_at,
          expires_at: inv.expires_at,
          status,
          used_by: inv.used_by,
          used_at: inv.used_at,
          created_by: inv.created_by,
          used_by_profile: inv.user, // Map user -> used_by_profile
        }
      })
      setTesterInvites(transformedInvites)

      setTesterStats(data.stats || {
        total_testers: 0,
        active_invites: 0,
        used_invites: 0,
        expired_invites: 0
      })
    } catch (error) {
      console.error("Error fetching testers:", error)
    }
  }

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch("/api/admin/announcements")
      if (!res.ok) throw new Error("Failed to fetch announcements")
      const data = await res.json()
      setAnnouncements(data.announcements || [])
    } catch (error) {
      console.error("Error fetching announcements:", error)
    }
  }

  const fetchAuditLogs = async () => {
    setAuditLogsLoading(true)
    try {
      // For now, fetch from the database directly through supabase client
      // A proper API endpoint would be better for pagination
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        // P0 FIX: Gracefully handle missing table (migration not run)
        const errorMessage = error.message || ''
        const errorCode = (error as { code?: string }).code
        if (errorCode === '42P01' || errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
          console.warn('[Audit Logs] Table admin_audit_logs does not exist. Run migration 20260205_admin_improvements.sql')
          setAuditLogs([])
          return
        }
        throw error
      }
      setAuditLogs(data || [])
    } catch (error) {
      console.error("Error fetching audit logs:", error)
    } finally {
      setAuditLogsLoading(false)
    }
  }

  const generateInviteCode = async () => {
    setIsGeneratingInvite(true)
    try {
      const res = await fetch("/api/admin/testers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_invite" }),
      })
      if (!res.ok) throw new Error("Failed to generate invite")
      const data = await res.json()
      toast({
        title: "Invite Generated",
        description: "New tester invite code has been created",
      })
      fetchTesters()
      // Auto-copy the new invite link
      if (data.invite?.code) {
        const inviteUrl = `${window.location.origin}/tester?code=${data.invite.code}`
        navigator.clipboard.writeText(inviteUrl)
        setCopiedInviteId(data.invite.id)
        setTimeout(() => setCopiedInviteId(null), 2000)
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate invite code", variant: "destructive" })
    } finally {
      setIsGeneratingInvite(false)
    }
  }

  const revokeInvite = async () => {
    if (!inviteToRevoke) return
    try {
      const res = await fetch("/api/admin/testers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_invite", invite_id: inviteToRevoke.id }),
      })
      if (!res.ok) throw new Error("Failed to revoke invite")
      toast({ title: "Success", description: "Invite code revoked" })
      fetchTesters()
      setInviteToRevoke(null)
    } catch (error) {
      toast({ title: "Error", description: "Failed to revoke invite", variant: "destructive" })
    }
  }

  const removeTesterStatus = async () => {
    if (!testerToRemove) return
    try {
      const res = await fetch("/api/admin/testers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_tester", user_id: testerToRemove.id }),
      })
      if (!res.ok) throw new Error("Failed to remove tester status")
      toast({ title: "Success", description: "Tester status removed, user demoted to free plan" })
      fetchTesters()
      setTesterToRemove(null)
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove tester status", variant: "destructive" })
    }
  }

  const copyInviteLink = (invite: TesterInvite) => {
    const inviteUrl = `${window.location.origin}/tester?code=${invite.code}`
    navigator.clipboard.writeText(inviteUrl)
    setCopiedInviteId(invite.id)
    toast({ title: "Copied", description: "Invite link copied to clipboard" })
    setTimeout(() => setCopiedInviteId(null), 2000)
  }

  // Announcement management functions
  const createAnnouncement = async () => {
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(announcementForm),
      })
      if (!res.ok) throw new Error("Failed to create announcement")
      toast({ title: "Success", description: "Announcement created" })
      fetchAnnouncements()
      setIsCreatingAnnouncement(false)
      setAnnouncementForm({ message: '', type: 'info', priority: 0, target_plans: null, is_active: true })
    } catch (error) {
      toast({ title: "Error", description: "Failed to create announcement", variant: "destructive" })
    }
  }

  const updateAnnouncement = async (id: string, updates: Partial<AdminAnnouncement>) => {
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      })
      if (!res.ok) throw new Error("Failed to update announcement")
      toast({ title: "Success", description: "Announcement updated" })
      fetchAnnouncements()
      setSelectedAnnouncement(null)
    } catch (error) {
      toast({ title: "Error", description: "Failed to update announcement", variant: "destructive" })
    }
  }

  const deleteAnnouncement = async (id: string) => {
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error("Failed to delete announcement")
      toast({ title: "Success", description: "Announcement deleted" })
      fetchAnnouncements()
      setSelectedAnnouncement(null)
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete announcement", variant: "destructive" })
    }
  }

  const getAnnouncementTypeBadgeColor = (type: AnnouncementType) => {
    switch (type) {
      case "info": return "bg-blue-500/20 text-blue-400"
      case "warning": return "bg-amber-500/20 text-amber-400"
      case "promo": return "bg-purple-500/20 text-purple-400"
      case "maintenance": return "bg-red-500/20 text-red-400"
      default: return "bg-gray-500/20 text-gray-400"
    }
  }

  const formatAuditAction = (action: string) => {
    return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }

  const getInviteStatusBadgeColor = (status: TesterInviteStatus) => {
    switch (status) {
      case "active": return "bg-emerald-500/20 text-emerald-400"
      case "used": return "bg-blue-500/20 text-blue-400"
      case "revoked": return "bg-red-500/20 text-red-400"
      case "expired": return "bg-gray-500/20 text-gray-400"
      default: return "bg-gray-500/20 text-gray-400"
    }
  }

  const updateReportStatus = async (reportId: string, status: ReportStatus, notes?: string) => {
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_id: reportId,
          status,
          admin_notes: notes !== undefined ? notes : selectedReport?.admin_notes
        }),
      })
      if (!res.ok) throw new Error("Failed to update report")
      toast({ title: "Success", description: "Report updated" })
      fetchReports()
      setSelectedReport(null)
    } catch (error) {
      toast({ title: "Error", description: "Failed to update report", variant: "destructive" })
    }
  }

  const deleteReport = async (reportId: string) => {
    try {
      const res = await fetch("/api/admin/reports", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_ids: [reportId] }),
      })
      if (!res.ok) throw new Error("Failed to delete report")
      toast({ title: "Success", description: "Report deleted" })
      fetchReports()
      setSelectedReport(null)
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete report", variant: "destructive" })
    }
  }

  // SECURITY: updateUserPlan removed - subscription changes ONLY via Stripe webhooks

  const toggleTesterStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, is_tester: !currentStatus }),
      })
      if (!res.ok) throw new Error("Failed to update tester status")
      toast({
        title: "Success",
        description: currentStatus ? "Tester status removed" : "Tester status granted"
      })
      fetchUsers()
      fetchTesters()
      setSelectedUser(null)
    } catch (error) {
      toast({ title: "Error", description: "Failed to update tester status", variant: "destructive" })
    }
  }

  const deleteUser = async () => {
    if (!userToDelete) return
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userToDelete.id }),
      })
      if (!res.ok) throw new Error("Failed to delete user")
      toast({ title: "Success", description: "User deleted successfully" })
      fetchUsers()
      setUserToDelete(null)
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" })
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      // Current 3-tier model plans
      case "ultra": return "bg-amber-500/20 text-amber-400"
      case "pro": return "bg-violet-500/20 text-violet-400"
      // Legacy plans (for backwards compatibility display)
      case "mega": return "bg-purple-500/20 text-purple-400"
      case "basic": return "bg-green-500/20 text-green-400"
      case "starter": return "bg-emerald-500/20 text-emerald-400"
      default: return "bg-gray-500/20 text-gray-400" // free
    }
  }

  // Get effective plan display - testers and admins show as "ultra" since they have Ultra-level access
  const getEffectivePlanDisplay = (plan: string | null, isTester?: boolean, isAdmin?: boolean) => {
    if (isAdmin || isTester) return "ultra"
    return plan || "free"
  }

  const getReportTypeBadgeColor = (type: string) => {
    switch (type) {
      case "incorrect_questions": return "bg-orange-500/20 text-orange-400"
      case "incorrect_description": return "bg-yellow-500/20 text-yellow-400"
      case "bug": return "bg-red-500/20 text-red-400"
      case "suggestion": return "bg-zinc-500/20 text-zinc-300"
      default: return "bg-gray-500/20 text-gray-400"
    }
  }

  const getReportStatusBadgeColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-500/20 text-blue-400"
      case "in_progress": return "bg-yellow-500/20 text-yellow-400"
      case "resolved": return "bg-green-500/20 text-green-400"
      case "wont_fix": return "bg-gray-500/20 text-gray-400"
      case "duplicate": return "bg-purple-500/20 text-purple-400"
      default: return "bg-gray-500/20 text-gray-400"
    }
  }

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case "incorrect_questions": return <FileQuestion className="w-4 h-4" />
      case "incorrect_description": return <AlertCircle className="w-4 h-4" />
      case "bug": return <Bug className="w-4 h-4" />
      case "suggestion": return <Lightbulb className="w-4 h-4" />
      default: return <HelpCircle className="w-4 h-4" />
    }
  }

  const formatReportType = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }

  const formatReportStatus = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto px-4 py-8 max-w-7xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="w-8 h-8 text-zinc-400" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage users, review reports, and monitor API usage
          </p>
        </div>
        <Button onClick={() => { fetchUsers(); fetchReports(); fetchTesters(); fetchAnnouncements(); fetchAuditLogs() }} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh All
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card/50 border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-3xl font-bold">{usersTotal}</p>
              </div>
              <Users className="w-10 h-10 text-zinc-600/70 dark:text-zinc-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Testers</p>
                <p className="text-3xl font-bold">{testerStats.total_testers}</p>
              </div>
              <FlaskConical className="w-10 h-10 text-teal-600/70 dark:text-teal-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Reports</p>
                <p className="text-3xl font-bold">{reportStats.byStatus?.open || 0}</p>
              </div>
              <Flag className="w-10 h-10 text-amber-600/70 dark:text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Invites</p>
                <p className="text-3xl font-bold">{testerStats.active_invites}</p>
              </div>
              <Ticket className="w-10 h-10 text-emerald-600/70 dark:text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Users ({usersTotal})
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <Flag className="w-4 h-4" />
            Reports ({reportsTotal})
          </TabsTrigger>
          <TabsTrigger value="testers" className="gap-2">
            <FlaskConical className="w-4 h-4" />
            Testers ({testerStats.total_testers})
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2">
            <Megaphone className="w-4 h-4" />
            Announcements ({announcements.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Registered Users</CardTitle>
                  <CardDescription>All users and their subscription plans</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchUsers()}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); fetchUsers(v) }}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="ultra">Ultra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Plan Stats - 3-tier model only */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {['free', 'pro', 'ultra'].map((plan) => (
                  <Badge key={plan} variant="outline" className={getPlanBadgeColor(plan)}>
                    {plan}: {userStats[plan] || 0}
                  </Badge>
                ))}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Jobs</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {isLoading ? "Loading users..." : "No users found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.full_name || "No name"}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge className={getPlanBadgeColor(getEffectivePlanDisplay(user.subscription_plan, user.is_tester, user.is_admin))}>
                              {getEffectivePlanDisplay(user.subscription_plan, user.is_tester, user.is_admin)}
                            </Badge>
                            {user.is_tester && (
                              <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">
                                <FlaskConical className="w-3 h-3 mr-1" />
                                Tester
                              </Badge>
                            )}
                            {user.is_admin && (
                              <Badge className="bg-red-500/20 text-red-400">Admin</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{user.job_count}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(user.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setSelectedUser(user)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            {!user.is_admin && (
                              <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setUserToDelete(user)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Reports</CardTitle>
                  <CardDescription>Problems, suggestions, and feedback from users</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={reportStatusFilter} onValueChange={(v) => { setReportStatusFilter(v); fetchReports(v, undefined) }}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
                      <SelectItem value="duplicate">Duplicate</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={reportTypeFilter} onValueChange={(v) => { setReportTypeFilter(v); fetchReports(undefined, v) }}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="incorrect_questions">Incorrect Questions</SelectItem>
                      <SelectItem value="incorrect_description">Incorrect Description</SelectItem>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="suggestion">Suggestion</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Stats badges */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <span className="text-sm text-muted-foreground mr-2">By Status:</span>
                {Object.entries(reportStats.byStatus).map(([status, count]) => (
                  <Badge key={status} variant="outline" className={getReportStatusBadgeColor(status)}>
                    {formatReportStatus(status)}: {count}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 mb-4 flex-wrap">
                <span className="text-sm text-muted-foreground mr-2">By Type:</span>
                {Object.entries(reportStats.byType).map(([type, count]) => (
                  <Badge key={type} variant="outline" className={getReportTypeBadgeColor(type)}>
                    {formatReportType(type)}: {count}
                  </Badge>
                ))}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No reports found
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{report.profiles?.full_name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{report.profiles?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getReportTypeBadgeColor(report.report_type)}>
                            <span className="flex items-center gap-1">
                              {getReportTypeIcon(report.report_type)}
                              {formatReportType(report.report_type)}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <p className="font-medium truncate">{report.title}</p>
                            {report.job_title && (
                              <p className="text-xs text-muted-foreground truncate">
                                Job: {report.job_title} @ {report.job_company}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getReportStatusBadgeColor(report.status)}>
                            {formatReportStatus(report.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(report.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedReport(report)
                                setEditingNotes(report.admin_notes || "")
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {report.page_url && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={report.page_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Testers Tab */}
        <TabsContent value="testers" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/50 border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Testers</p>
                    <p className="text-2xl font-bold">{testerStats.total_testers}</p>
                  </div>
                  <FlaskConical className="w-8 h-8 text-teal-600/70 dark:text-teal-500/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Invites</p>
                    <p className="text-2xl font-bold">{testerStats.active_invites}</p>
                  </div>
                  <Ticket className="w-8 h-8 text-emerald-600/70 dark:text-emerald-500/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Used Invites</p>
                    <p className="text-2xl font-bold">{testerStats.used_invites}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-blue-600/70 dark:text-blue-500/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Expired/Revoked</p>
                    <p className="text-2xl font-bold">{testerStats.expired_invites}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-zinc-600/70 dark:text-zinc-500/50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tester Page Link */}
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-teal-500" />
                    Tester Signup Link
                  </CardTitle>
                  <CardDescription>Share this link to grant tester access automatically</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <code className="flex-1 px-3 py-2 bg-background rounded text-sm font-mono truncate">
                  {typeof window !== 'undefined' ? `${window.location.origin}/tester` : '/tester'}
                </code>
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = `${window.location.origin}/tester`
                    navigator.clipboard.writeText(url)
                    toast({ title: "Copied", description: "Tester page link copied to clipboard" })
                  }}
                  className="gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Anyone who signs up or logs in through this page will automatically receive tester status with Pro-level access.
                You can also grant tester status manually by editing a user in the Users tab.
              </p>
            </CardContent>
          </Card>

          {/* Invite Codes Section */}
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-emerald-500" />
                    Invite Codes
                  </CardTitle>
                  <CardDescription>Generate invite codes to share with test users</CardDescription>
                </div>
                <Button
                  onClick={generateInviteCode}
                  disabled={isGeneratingInvite}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {isGeneratingInvite ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ticket className="w-4 h-4" />
                  )}
                  Generate Invite Code
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Used By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testerInvites.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No invite codes yet. Click &quot;Generate Invite Code&quot; to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    testerInvites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>
                          <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                            {invite.code}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge className={getInviteStatusBadgeColor(invite.status)}>
                            {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(invite.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          {invite.used_by_profile ? (
                            <span className="text-sm">{invite.used_by_profile.email}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className={copiedInviteId === invite.id ? "text-green-400" : ""}
                              onClick={() => copyInviteLink(invite)}
                            >
                              {copiedInviteId === invite.id ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                            {invite.status === "active" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => setInviteToRevoke(invite)}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Testers List Section */}
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-500" />
                  Active Testers
                </CardTitle>
                <CardDescription>Users with tester status receive Ultra-level access (35 jobs/day, unlimited AI)</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Actual Plan</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Tester Since</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No testers yet. Share the tester page link or grant tester status manually.
                      </TableCell>
                    </TableRow>
                  ) : (
                    testers.map((tester) => (
                      <TableRow key={tester.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{tester.full_name || "No name"}</p>
                            <p className="text-sm text-muted-foreground">{tester.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={getPlanBadgeColor("ultra")}>
                              ultra
                            </Badge>
                            <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">
                              <FlaskConical className="w-3 h-3 mr-1" />
                              Tester
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {tester.invite_code_used === 'TESTER_PAGE' ? 'Tester Page' :
                             tester.invite_code_used === 'ADMIN_GRANTED' ? 'Admin' :
                             tester.invite_code_used ? 'Invite Code' : 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tester.tester_since ? formatDate(tester.tester_since) : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 gap-1"
                            onClick={() => setTesterToRemove(tester)}
                          >
                            <UserMinus className="w-4 h-4" />
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Announcements Tab */}
        <TabsContent value="announcements" className="space-y-6">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-purple-500" />
                    Banner Announcements
                  </CardTitle>
                  <CardDescription>Manage scrolling announcements shown in the dashboard header</CardDescription>
                </div>
                <Button
                  onClick={() => setIsCreatingAnnouncement(true)}
                  className="gap-2 bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4" />
                  Create Announcement
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Message</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No announcements yet. Click &quot;Create Announcement&quot; to add one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    announcements.map((ann) => (
                      <TableRow key={ann.id}>
                        <TableCell>
                          <p className="max-w-xs truncate">{ann.message}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className={getAnnouncementTypeBadgeColor(ann.type)}>
                            {ann.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{ann.priority}</TableCell>
                        <TableCell>
                          {ann.target_plans ? (
                            <span className="text-xs">{ann.target_plans.join(', ')}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">All plans</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ann.is_active ? "default" : "secondary"}>
                            {ann.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedAnnouncement(ann)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateAnnouncement(ann.id, { is_active: !ann.is_active })}
                            >
                              <Power className={`w-4 h-4 ${ann.is_active ? 'text-green-400' : 'text-red-400'}`} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400"
                              onClick={() => deleteAnnouncement(ann.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Preview Card */}
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="text-sm">Preview</CardTitle>
              <CardDescription>How announcements appear in the dashboard header</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <span className="inline-block whitespace-nowrap animate-marquee motion-reduce:animate-none">
                    {announcements.find(a => a.is_active)?.message || "Your announcement message will scroll here..."}
                  </span>
                </div>
                <button className="shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-zinc-500" />
                    Activity Log
                  </CardTitle>
                  <CardDescription>Audit trail of all admin actions</CardDescription>
                </div>
                <Button
                  onClick={fetchAuditLogs}
                  variant="outline"
                  className="gap-2"
                  disabled={auditLogsLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${auditLogsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {auditLogsLoading ? "Loading..." : "No activity recorded yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(log.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{log.admin_email}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {formatAuditAction(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.target_type && (
                            <span className="text-xs">
                              {log.target_type}: {log.target_id?.substring(0, 8)}...
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.details && (
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {JSON.stringify(log.details).substring(0, 50)}...
                            </code>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Edit Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              {selectedUser?.full_name || "No name"} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current Plan Display (read-only) */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Subscription Plan</p>
                <p className="text-xs text-muted-foreground">
                  Plan changes only via Stripe billing
                </p>
              </div>
              <Badge className={getPlanBadgeColor(getEffectivePlanDisplay(selectedUser?.subscription_plan || null, selectedUser?.is_tester, selectedUser?.is_admin))}>
                {getEffectivePlanDisplay(selectedUser?.subscription_plan || null, selectedUser?.is_tester, selectedUser?.is_admin)}
              </Badge>
            </div>

            {/* Tester Status Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-teal-500" />
                  Tester Status
                </p>
                <p className="text-xs text-muted-foreground">
                  Testers get Ultra-level access (35 jobs/day, unlimited AI)
                </p>
              </div>
              <Button
                size="sm"
                variant={selectedUser?.is_tester ? "destructive" : "default"}
                className={selectedUser?.is_tester ? "" : "bg-teal-600 hover:bg-teal-700"}
                onClick={() => selectedUser && toggleTesterStatus(selectedUser.id, selectedUser.is_tester)}
              >
                {selectedUser?.is_tester ? (
                  <>
                    <UserMinus className="w-4 h-4 mr-1" />
                    Remove
                  </>
                ) : (
                  <>
                    <FlaskConical className="w-4 h-4 mr-1" />
                    Grant
                  </>
                )}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>User ID: {selectedUser?.id}</p>
              <p>Jobs: {selectedUser?.job_count}</p>
              <p>Joined: {selectedUser?.created_at && formatDate(selectedUser.created_at)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {userToDelete?.email}? This will permanently delete all their data including jobs, applications, and profile. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser} className="bg-red-500 hover:bg-red-600">
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              {selectedReport && getReportTypeIcon(selectedReport.report_type)}
              <span className="truncate">{selectedReport?.title}</span>
              <Badge className={`ml-auto ${getReportStatusBadgeColor(selectedReport?.status || "")}`}>
                {selectedReport && formatReportStatus(selectedReport.status)}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Two column layout for debug info */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left column - User & Report Info */}
            <div className="space-y-3">
              {/* User Section */}
              <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
                <div className="font-medium text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" /> User Context
                  {(selectedReport?.user_report_count || 0) > 0 && (
                    <Badge variant="outline" className="ml-auto text-[10px] h-4">
                      {selectedReport?.user_report_count} other reports
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  <div><span className="text-muted-foreground">Name:</span> {selectedReport?.profiles?.full_name || "?"}</div>
                  <div><span className="text-muted-foreground">Plan:</span> <Badge variant="outline" className="text-[10px] h-4">{selectedReport?.profiles?.subscription_plan || "free"}</Badge></div>
                  <div className="col-span-2 truncate"><span className="text-muted-foreground">Email:</span> {selectedReport?.profiles?.email || "?"}</div>
                  <div><span className="text-muted-foreground">Has CV:</span> {selectedReport?.profiles?.cv_url ? "Yes" : "No"}</div>
                  <div><span className="text-muted-foreground">Has Screening:</span> {selectedReport?.profiles?.screening_answers ? "Yes" : "No"}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Account:</span> {selectedReport?.profiles?.created_at ? formatDate(selectedReport.profiles.created_at) : "?"}</div>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground truncate">ID: {selectedReport?.user_id}</div>
              </div>

              {/* Report Metadata */}
              <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
                <div className="font-medium text-muted-foreground flex items-center gap-1">
                  <Flag className="w-3 h-3" /> Report Info
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  <div><span className="text-muted-foreground">Type:</span> <Badge className={`text-[10px] h-4 ${getReportTypeBadgeColor(selectedReport?.report_type || "")}`}>{selectedReport && formatReportType(selectedReport.report_type)}</Badge></div>
                  <div><span className="text-muted-foreground">Created:</span> {selectedReport?.created_at && formatDate(selectedReport.created_at)}</div>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground truncate">ID: {selectedReport?.id}</div>
              </div>

              {/* Description */}
              <div>
                <span className="text-xs text-muted-foreground">Description</span>
                <div className="mt-1 p-2 bg-muted rounded text-xs whitespace-pre-wrap max-h-20 overflow-y-auto">
                  {selectedReport?.description}
                </div>
              </div>
            </div>

            {/* Right column - Job & Technical Info */}
            <div className="space-y-3">
              {/* Job Section */}
              {selectedReport?.job_id ? (
                <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
                  <div className="font-medium text-muted-foreground flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Job Context
                    {(selectedReport?.job_report_count || 0) > 0 && (
                      <Badge variant="destructive" className="ml-auto text-[10px] h-4">
                        {selectedReport?.job_report_count} other reports!
                      </Badge>
                    )}
                    <a
                      href={`/jobs/${selectedReport.job_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-zinc-300 hover:underline flex items-center gap-0.5"
                    >
                      <ExternalLink className="w-3 h-3" /> View
                    </a>
                  </div>
                  <div className="font-medium truncate">{selectedReport.job_title || "?"} @ {selectedReport.job_company || "?"}</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    <div><span className="text-muted-foreground">Platform:</span> {selectedReport.job_details?.platform_detected || "Unknown"}</div>
                    <div><span className="text-muted-foreground">Status:</span> {selectedReport.job_details?.job_status || "?"}</div>
                  </div>
                  {selectedReport.job_details?.application_url && (
                    <div className="truncate">
                      <span className="text-muted-foreground">Apply URL:</span>{" "}
                      <a href={selectedReport.job_details.application_url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:underline">
                        {selectedReport.job_details.application_url}
                      </a>
                    </div>
                  )}
                  <div className="font-mono text-[10px] text-muted-foreground truncate">ID: {selectedReport.job_id}</div>
                </div>
              ) : (
                <div className="p-2 bg-muted/30 rounded text-xs text-muted-foreground italic">
                  No job associated with this report
                </div>
              )}

              {/* Technical Info */}
              <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
                <div className="font-medium text-muted-foreground">Technical Info</div>
                {selectedReport?.page_url && (
                  <div className="truncate">
                    <span className="text-muted-foreground">Page:</span>{" "}
                    <a href={selectedReport.page_url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:underline">
                      {selectedReport.page_url}
                    </a>
                  </div>
                )}
                {selectedReport?.browser_info && (
                  <div className="truncate text-muted-foreground">{selectedReport.browser_info}</div>
                )}
              </div>

              {/* Admin notes */}
              <div>
                <label className="text-xs font-medium">Admin Notes</label>
                <Textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="Internal notes..."
                  className="mt-1 text-xs h-16"
                />
              </div>
            </div>
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex gap-1">
              {(["open", "in_progress", "resolved", "wont_fix", "duplicate"] as ReportStatus[]).map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={selectedReport?.status === status ? "default" : "outline"}
                  className={`h-7 px-2 text-xs ${selectedReport?.status === status && status === "resolved" ? "bg-green-600 hover:bg-green-700" : ""}`}
                  onClick={() => selectedReport && updateReportStatus(selectedReport.id, status, editingNotes)}
                >
                  {status === "resolved" && <CheckCircle className="w-3 h-3 mr-1" />}
                  {formatReportStatus(status)}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  if (!selectedReport) return
                  const hasCV = selectedReport.profiles?.cv_url ? "Yes" : "No"
                  const hasScreening = selectedReport.profiles?.screening_answers ? "Yes" : "No"
                  const debugInfo = `=== BUG REPORT DEBUG INFO ===

REPORT
------
Report ID: ${selectedReport.id}
Type: ${selectedReport.report_type}
Status: ${selectedReport.status}
Title: ${selectedReport.title}
Created: ${selectedReport.created_at}
Page URL: ${selectedReport.page_url || "N/A"}
Browser: ${selectedReport.browser_info || "N/A"}

USER
----
User ID: ${selectedReport.user_id}
Name: ${selectedReport.profiles?.full_name || "?"}
Email: ${selectedReport.profiles?.email || "?"}
Plan: ${selectedReport.profiles?.subscription_plan || "free"}
Account Created: ${selectedReport.profiles?.created_at || "?"}
Has CV: ${hasCV}
Has Screening Answers: ${hasScreening}
Other Reports from User: ${selectedReport.user_report_count || 0}

JOB CONTEXT
-----------
Job ID: ${selectedReport.job_id || "N/A"}
Job Title: ${selectedReport.job_title || "N/A"}
Company: ${selectedReport.job_company || "N/A"}
Platform: ${selectedReport.job_details?.platform_detected || "N/A"}
Job Status: ${selectedReport.job_details?.job_status || "N/A"}
Application URL: ${selectedReport.job_details?.application_url || "N/A"}
Other Reports for Job: ${selectedReport.job_report_count || 0}

DESCRIPTION
-----------
${selectedReport.description}

=== END DEBUG INFO ===`
                  navigator.clipboard.writeText(debugInfo)
                  toast({ title: "Copied", description: "Full debug info copied to clipboard" })
                }}
              >
                Copy Debug
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={() => selectedReport && deleteReport(selectedReport.id)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedReport(null)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Tester Confirmation */}
      <AlertDialog open={!!testerToRemove} onOpenChange={() => setTesterToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Tester Status</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove tester status from <span className="font-medium">{testerToRemove?.email}</span>?
              They will lose their Pro-level access and return to their normal subscription plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeTesterStatus} className="bg-red-500 hover:bg-red-600">
              Remove Tester
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Invite Confirmation */}
      <AlertDialog open={!!inviteToRevoke} onOpenChange={() => setInviteToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invite Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke invite code <code className="px-2 py-1 bg-muted rounded font-mono text-sm">{inviteToRevoke?.code}</code>?
              <br /><br />
              <span className="text-muted-foreground">Note: Revoking won&apos;t affect users who already used this code.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={revokeInvite} className="bg-red-500 hover:bg-red-600">
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Announcement Dialog */}
      <Dialog open={isCreatingAnnouncement} onOpenChange={setIsCreatingAnnouncement}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Announcement</DialogTitle>
            <DialogDescription>
              Create a new banner announcement for dashboard users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={announcementForm.message}
                onChange={(e) => setAnnouncementForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Your announcement message..."
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={announcementForm.type}
                  onValueChange={(v) => setAnnouncementForm(f => ({ ...f, type: v as AnnouncementType }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info (Blue)</SelectItem>
                    <SelectItem value="warning">Warning (Amber)</SelectItem>
                    <SelectItem value="promo">Promo (Purple)</SelectItem>
                    <SelectItem value="maintenance">Maintenance (Red)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  min={0}
                  max={100}
                  value={announcementForm.priority}
                  onChange={(e) => setAnnouncementForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label>Target Plans</Label>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={announcementForm.target_plans === null}
                    onCheckedChange={(checked) => setAnnouncementForm(f => ({
                      ...f,
                      target_plans: checked ? null : ['free']
                    }))}
                  />
                  <span className="text-sm">All plans</span>
                </div>
                {announcementForm.target_plans !== null && (
                  <div className="flex gap-2">
                    <Badge
                      variant={announcementForm.target_plans.includes('free') ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setAnnouncementForm(f => ({
                        ...f,
                        target_plans: f.target_plans?.includes('free')
                          ? f.target_plans.filter(p => p !== 'free')
                          : [...(f.target_plans || []), 'free']
                      }))}
                    >
                      Free
                    </Badge>
                    <Badge
                      variant={announcementForm.target_plans.includes('pro') ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setAnnouncementForm(f => ({
                        ...f,
                        target_plans: f.target_plans?.includes('pro')
                          ? f.target_plans.filter(p => p !== 'pro')
                          : [...(f.target_plans || []), 'pro']
                      }))}
                    >
                      Pro
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={announcementForm.is_active}
                onCheckedChange={(checked) => setAnnouncementForm(f => ({ ...f, is_active: checked }))}
              />
              <Label>Active immediately</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingAnnouncement(false)}>
              Cancel
            </Button>
            <Button
              onClick={createAnnouncement}
              disabled={!announcementForm.message.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Announcement Dialog */}
      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
            <DialogDescription>
              Update the announcement details
            </DialogDescription>
          </DialogHeader>
          {selectedAnnouncement && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-message">Message</Label>
                <Textarea
                  id="edit-message"
                  defaultValue={selectedAnnouncement.message}
                  onChange={(e) => setSelectedAnnouncement(a => a ? { ...a, message: e.target.value } : null)}
                  className="mt-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-type">Type</Label>
                  <Select
                    value={selectedAnnouncement.type}
                    onValueChange={(v) => setSelectedAnnouncement(a => a ? { ...a, type: v as AnnouncementType } : null)}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info (Blue)</SelectItem>
                      <SelectItem value="warning">Warning (Amber)</SelectItem>
                      <SelectItem value="promo">Promo (Purple)</SelectItem>
                      <SelectItem value="maintenance">Maintenance (Red)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-priority">Priority</Label>
                  <Input
                    id="edit-priority"
                    type="number"
                    min={0}
                    max={100}
                    value={selectedAnnouncement.priority}
                    onChange={(e) => setSelectedAnnouncement(a => a ? { ...a, priority: parseInt(e.target.value) || 0 } : null)}
                    className="mt-2"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={selectedAnnouncement.is_active}
                  onCheckedChange={(checked) => setSelectedAnnouncement(a => a ? { ...a, is_active: checked } : null)}
                />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAnnouncement(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedAnnouncement && updateAnnouncement(selectedAnnouncement.id, {
                message: selectedAnnouncement.message,
                type: selectedAnnouncement.type,
                priority: selectedAnnouncement.priority,
                is_active: selectedAnnouncement.is_active,
              })}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
