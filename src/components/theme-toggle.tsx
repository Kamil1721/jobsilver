"use client"

// Dawn is a light-only product (theme-provider hard-locks the theme to
// "light" and setTheme is a no-op). A Light/Dark/System menu would be a
// deceptive control, so this component intentionally renders nothing.
// Kept as a module so existing import sites keep compiling.
export function ThemeToggle() {
  return null
}
