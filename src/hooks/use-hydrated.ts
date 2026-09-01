"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => undefined
const getClientSnapshot = () => true
const getServerSnapshot = () => false

/** Returns false for the server snapshot and true after client hydration. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}
