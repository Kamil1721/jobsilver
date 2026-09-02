import { fileURLToPath } from "node:url"
import path from "node:path"
import sharp from "sharp"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, "../..")
const publicDirectory = path.join(projectRoot, "public")

const width = 1200
const height = 630
const navy = "#17253D"
const cream = "#F4F1E9"
const coral = "#D85B37"
const silver = "#C7CDD6"
const fontFile = path.join(
  projectRoot,
  "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf",
)
const regularFontFile = path.join(
  projectRoot,
  "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
)

function escapeMarkup(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

async function renderText({
  text,
  font,
  fontfile,
  color,
  width: textWidth,
  spacing,
}) {
  return sharp({
    text: {
      text: `<span foreground="${color}">${escapeMarkup(text)}</span>`,
      font,
      fontfile,
      width: textWidth,
      align: "left",
      rgba: true,
      spacing,
    },
  })
    .png()
    .toBuffer()
}

const hero = await sharp(path.join(publicDirectory, "illustrations/hero-dawn.png"))
  .resize(height, height, { fit: "cover" })
  .png()
  .toBuffer()

const mark = await sharp(path.join(publicDirectory, "jobsilver-mark.svg"))
  .resize(54, 54)
  .png()
  .toBuffer()

const wordmark = await renderText({
  text: "JobSilver",
  font: "Geist SemiBold 31",
  fontfile: fontFile,
  color: navy,
  width: 250,
  spacing: -2,
})

const headline = await renderText({
  text: "Wake up to\njobs worth\nyour time.",
  font: "Geist SemiBold 70",
  fontfile: fontFile,
  color: navy,
  width: 550,
  spacing: -7,
})

const description = await renderText({
  text: "Fresh matches based on your preferences, plus help\npreparing the applications you choose.",
  font: "Geist 21",
  fontfile: regularFontFile,
  color: navy,
  width: 525,
  spacing: 7,
})

const edgeFade = Buffer.from(`
  <svg width="260" height="630" viewBox="0 0 260 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${cream}"/>
        <stop offset="0.46" stop-color="${cream}" stop-opacity="0.94"/>
        <stop offset="0.76" stop-color="${cream}" stop-opacity="0.35"/>
        <stop offset="1" stop-color="${cream}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="260" height="630" fill="url(#fade)"/>
  </svg>
`)

const accent = Buffer.from(`
  <svg width="480" height="12" viewBox="0 0 480 12" xmlns="http://www.w3.org/2000/svg">
    <rect width="46" height="6" y="3" rx="3" fill="${coral}"/>
    <rect x="58" width="422" height="1" y="5.5" fill="${silver}" fill-opacity="0.78"/>
  </svg>
`)

await sharp({
  create: {
    width,
    height,
    channels: 3,
    background: cream,
  },
})
  .composite([
    { input: hero, left: 620, top: 0 },
    { input: edgeFade, left: 538, top: 0 },
    { input: mark, left: 70, top: 54 },
    { input: wordmark, left: 139, top: 65 },
    { input: headline, left: 68, top: 160 },
    { input: description, left: 72, top: 456 },
    { input: accent, left: 72, top: 564 },
  ])
  .removeAlpha()
  .png({ compressionLevel: 9, palette: false })
  .withMetadata({ density: 144 })
  .toFile(path.join(publicDirectory, "og-image.png"))

console.log("Generated public/og-image.png at 1200x630")
