const INTERNAL_URL_BASE = "https://jobsilver.invalid"
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

function parseHttpOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return null
    }

    return url.origin
  } catch {
    return null
  }
}

function isIpv4Loopback(hostname: string): boolean {
  const octets = hostname.split(".")
  return octets.length === 4 && octets[0] === "127" && octets.every(octet => {
    const value = Number(octet)
    return Number.isInteger(value) && value >= 0 && value <= 255
  })
}

function isIpv4MappedLoopback(hostname: string): boolean {
  const match = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(hostname)
  if (!match) return false

  const highBits = Number.parseInt(match[1], 16)
  return (highBits >> 8) === 127
}

function isLoopbackOrigin(origin: string): boolean {
  const hostname = new URL(origin).hostname.toLowerCase()
  const normalizedHostname = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname

  if (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    isIpv4Loopback(normalizedHostname)
  ) {
    return true
  }

  const ipv6Hostname = normalizedHostname.startsWith("[") && normalizedHostname.endsWith("]")
    ? normalizedHostname.slice(1, -1)
    : normalizedHostname

  return ipv6Hostname === "::1" || isIpv4MappedLoopback(ipv6Hostname)
}

/**
 * Accept only a same-site path. Protocol-relative URLs, backslashes, control
 * characters, and absolute URLs fall back to the supplied safe destination.
 */
export function getSafeInternalPath(
  value: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    CONTROL_CHARACTERS.test(value)
  ) {
    return fallback
  }

  try {
    const url = new URL(value, INTERNAL_URL_BASE)
    if (url.origin !== INTERNAL_URL_BASE || url.username || url.password) {
      return fallback
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

/**
 * Use the live loopback origin during local development. Everywhere else, fail
 * closed unless the deployment provides an explicit trusted application URL.
 */
export function getAppOrigin(requestUrl: string): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL
    ? parseHttpOrigin(process.env.NEXT_PUBLIC_APP_URL)
    : null
  const requestOrigin = parseHttpOrigin(requestUrl)

  if (
    process.env.NODE_ENV === "development" &&
    requestOrigin &&
    isLoopbackOrigin(requestOrigin)
  ) {
    return requestOrigin
  }

  if (!configuredOrigin) {
    throw new Error("A valid NEXT_PUBLIC_APP_URL is required")
  }

  if (
    process.env.NODE_ENV === "production" &&
    isLoopbackOrigin(configuredOrigin)
  ) {
    throw new Error("NEXT_PUBLIC_APP_URL must not use a loopback origin in production")
  }

  return configuredOrigin
}

/** Resolve a relative or absolute URL only when it belongs to the application origin. */
export function getTrustedSameOriginUrl(
  value: string | null | undefined,
  appOrigin: string
): string | undefined {
  if (!value?.trim()) return undefined

  try {
    const trustedOrigin = parseHttpOrigin(appOrigin)
    if (!trustedOrigin) return undefined

    const url = new URL(value, trustedOrigin)
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.origin !== trustedOrigin
    ) {
      return undefined
    }

    return url.toString()
  } catch {
    return undefined
  }
}
