"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  MapPin,
  SlidersHorizontal,
  X,
  Loader2,
} from "lucide-react"

interface SearchFilters {
  keywords: string
  location: string
  remote: boolean
  jobType: string
}

interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void
  onFilterChange?: (filters: SearchFilters) => void
  isLoading?: boolean
  isAdmin?: boolean
  className?: string
}

export function SearchBar({ onSearch, onFilterChange, isLoading, isAdmin = false, className }: SearchBarProps) {
  const [filters, setFilters] = React.useState<SearchFilters>({
    keywords: "",
    location: "",
    remote: false,
    jobType: "all",
  })
  const [showFilters, setShowFilters] = React.useState(false)

  // Call onFilterChange whenever filters change
  const updateFilters = React.useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters)
    onFilterChange?.(newFilters)
  }, [onFilterChange])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(filters)
  }

  const handleClear = () => {
    const clearedFilters = {
      keywords: "",
      location: "",
      remote: false,
      jobType: "all",
    }
    setFilters(clearedFilters)
    onFilterChange?.(clearedFilters)
  }

  const hasFilters = filters.keywords || filters.location || filters.remote || filters.jobType !== "all"

  return (
    <div className={cn("w-full", className)}>
      <form onSubmit={handleSearch}>
        {/* Main search bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Keywords input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
            <Input
              placeholder="Job title, skills, or company"
              value={filters.keywords}
              onChange={(e) => updateFilters({ ...filters, keywords: e.target.value })}
              className="pl-10 h-10"
            />
          </div>

          {/* Location input */}
          <div className="relative sm:w-56">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
            <Input
              placeholder="City or country"
              value={filters.location}
              onChange={(e) => updateFilters({ ...filters, location: e.target.value })}
              className="pl-10 h-10"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            {/* Filter toggle */}
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-10 px-3",
                showFilters && "bg-zinc-100 dark:bg-white/[0.05] border-zinc-300 dark:border-white/[0.10]"
              )}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="ml-2">Filters</span>
              {(filters.remote || filters.jobType !== "all") && (
                <span className="ml-1 w-1.5 h-1.5 bg-zinc-600 dark:bg-zinc-400 rounded-full" />
              )}
            </Button>

            {/* Search button - only visible for admin/tester */}
            {isAdmin && (
              <Button
                type="submit"
                variant="metallic"
                className="h-10 px-5 gap-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="mt-3 p-4 bg-white dark:bg-white/[0.02] rounded-lg border border-zinc-200 dark:border-white/[0.06] transition-colors duration-200 animate-fade-in">
            <div className="flex flex-wrap items-end gap-6">
              {/* Job Type */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Job Type</Label>
                <Select
                  value={filters.jobType}
                  onValueChange={(value) => updateFilters({ ...filters, jobType: value })}
                >
                  <SelectTrigger className="w-36 h-9">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Remote toggle */}
              <div className="flex items-center gap-2.5 pb-1">
                <Switch
                  id="remote"
                  checked={filters.remote}
                  onCheckedChange={(checked) => updateFilters({ ...filters, remote: checked })}
                />
                <Label htmlFor="remote" className="text-sm cursor-pointer text-zinc-700 dark:text-zinc-300">
                  Remote Only
                </Label>
              </div>

              {/* Clear filters */}
              {hasFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  onClick={handleClear}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
