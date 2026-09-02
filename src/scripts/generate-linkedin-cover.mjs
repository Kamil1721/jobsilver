import { fileURLToPath } from "node:url"
import path from "node:path"
import sharp from "sharp"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, "../..")
const publicDirectory = path.join(projectRoot, "public")

const width = 4200
const height = 700
const navy = "#17253D"
const cream = "#F4F1E9"
const coral = "#D85B37"
const silver = "#C7CDD6"
const semiboldFontFile = path.join(
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

async function renderText({ text, font, fontfile, color, width: textWidth, spacing }) {
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

const scene = await sharp(
  path.join(publicDirectory, "illustrations/hero-dawn.png"),
)
  .resize(1900, height, {
    fit: "cover",
    position: "centre",
  })
  .png()
  .toBuffer()

const headline = await renderText({
  text: "Wake up to jobs\nworth your time.",
  font: "Geist SemiBold 132",
  fontfile: semiboldFontFile,
  color: navy,
  width: 1500,
  spacing: -11,
})

const url = await renderText({
  text: "jobsilver.com",
  font: "Geist 42",
  fontfile: regularFontFile,
  color: navy,
  width: 440,
  spacing: 10,
})

const atmosphere = Buffer.from(`
  <svg width="4200" height="700" viewBox="0 0 4200 700" xmlns="http://www.w3.org/2000/svg">
    <rect width="4200" height="700" fill="${cream}"/>
    <path d="M0 610C420 530 706 526 1050 596V700H0Z" fill="#E8DED0" fill-opacity="0.56"/>
    <path d="M0 650C370 592 700 590 1040 640V700H0Z" fill="#FFFDFB" fill-opacity="0.92"/>
    <circle cx="482" cy="640" r="190" fill="${coral}"/>
    <rect x="0" y="638" width="1060" height="18" fill="${cream}"/>
  </svg>
`)

const sceneFade = Buffer.from(`
  <svg width="580" height="700" viewBox="0 0 580 700" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${cream}"/>
        <stop offset="0.42" stop-color="${cream}" stop-opacity="0.93"/>
        <stop offset="0.72" stop-color="${cream}" stop-opacity="0.38"/>
        <stop offset="1" stop-color="${cream}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="580" height="700" fill="url(#fade)"/>
  </svg>
`)

const accentRule = Buffer.from(`
  <svg width="970" height="12" viewBox="0 0 970 12" xmlns="http://www.w3.org/2000/svg">
    <rect width="74" height="8" y="2" rx="4" fill="${coral}"/>
    <rect x="96" width="874" height="2" y="5" fill="${silver}" fill-opacity="0.82"/>
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
    { input: atmosphere, left: 0, top: 0 },
    { input: scene, left: 2300, top: 0 },
    { input: sceneFade, left: 2250, top: 0 },
    { input: headline, left: 920, top: 122 },
    { input: url, left: 930, top: 527 },
    { input: accentRule, left: 930, top: 615 },
  ])
  .removeAlpha()
  .png({ compressionLevel: 9, palette: true, quality: 100 })
  .withMetadata({ density: 144 })
  .toFile(path.join(publicDirectory, "linkedin-company-cover.png"))

console.log("Generated public/linkedin-company-cover.png at 4200x700")
