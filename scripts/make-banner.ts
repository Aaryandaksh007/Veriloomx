// Generates a deterministic "off-brand" sample banner for the VeriLoom demo.
// Exact hex values guarantee reproducible CIELAB ΔE + WCAG findings.
import sharp from 'sharp'

const W = 1200
const H = 630

const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- Off-brand bright yellow background (#FDE047 — NOT in Inkloom palette) -->
  <rect width="${W}" height="${H}" fill="#FDE047"/>
  <!-- Off-brand electric purple decoration (#A855F7) -->
  <circle cx="1050" cy="120" r="150" fill="#A855F7" opacity="0.9"/>
  <circle cx="130" cy="540" r="90" fill="#A855F7" opacity="0.85"/>
  <rect x="60" y="80" width="26" height="180" rx="8" fill="#A855F7"/>
  <!-- White headline on light yellow => severe WCAG failure (~1.1:1) -->
  <text x="130" y="230" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="96" fill="#FFFFFF">MEGA SUMMER SALE</text>
  <!-- Purple sub-headline on yellow => another likely failure -->
  <text x="130" y="330" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="56" fill="#A855F7">50% OFF everything. Limited days only!</text>
  <!-- Dark stone footer — the only compliant element (brand Ink #292524) -->
  <text x="130" y="560" font-family="DejaVu Sans, sans-serif" font-size="40" fill="#292524">inkloom.ai/summer</text>
</svg>`

const buffer = await sharp(Buffer.from(svg)).png().toFile('public/samples/banner-sale.png')
console.log('banner-sale.png written:', buffer.width + 'x' + buffer.height, buffer.size + ' bytes')
