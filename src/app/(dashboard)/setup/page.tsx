"use client"

import * as React from "react"
import { SetupWizard } from "@/components/setup/setup-wizard"
import styles from "./dawn-setup.module.css"

export default function SetupPage() {
  return (
    <main className={styles.shell}>
      <div className={styles.content}>
        <SetupWizard />
      </div>
    </main>
  )
}
