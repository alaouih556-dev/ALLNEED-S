import { formatFileSize } from '@/lib/documents'

/*
 * Conversion « images scannées → PDF » côté client, sans dépendance externe.
 * Un PDF minimal est assemblé : une image JPEG par page (flux DCTDecode), au
 * format A4 portrait. Les images JPG/PNG sont ré-encodées via canvas à haute
 * qualité (0.92) uniquement pour homogénéiser format et orientation EXIF.
 * Aucun OCR, aucune extraction de texte, aucune compression agressive.
 */

export const DOCUMENT_FILE_ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png'
export const PDF_MIME = 'application/pdf'
/** Plafond aligné sur le backend (MAX_BODY_BYTES = 1 Mo). */
export const MAX_DOCUMENT_DATA_URL_CHARS = 900000

const JPEG_QUALITY = 0.92
const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89
const MARGIN = 24

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export function isAcceptedImage(file: File): boolean {
  return file.type === 'image/jpeg' || file.type === 'image/png' || /\.(jpe?g|png)$/i.test(file.name)
}

/** Vérifie la signature binaire (%PDF) : l'extension ne suffit pas. */
export async function isValidPdfFile(file: File): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    return head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46
  } catch {
    return false
  }
}

/** Nom de fichier sûr : séparateurs retirés (pas de traversée), extension .pdf forcée. */
export function sanitizePdfName(name: string, fallback = 'document'): string {
  const base = String(name || '')
    .replace(/\.(pdf|jpe?g|png)$/i, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return `${base || fallback}.pdf`
}

interface PdfImage {
  bytes: Uint8Array
  width: number
  height: number
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function imageToJpeg(file: File): Promise<PdfImage> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas indisponible pour la conversion.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return { bytes, width: canvas.width, height: canvas.height }
  } finally {
    bitmap.close?.()
  }
}

function buildPdf(images: PdfImage[]): Uint8Array {
  if (!images.length) throw new Error('Aucune image à convertir.')
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  let size = 0
  const offsets: number[] = []
  const push = (chunk: Uint8Array) => {
    parts.push(chunk)
    size += chunk.length
  }
  const ascii = (text: string) => push(encoder.encode(text))
  const mark = (id: number) => {
    offsets[id] = size
  }

  const objectCount = 2 + images.length * 3

  ascii('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n')

  mark(1)
  ascii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  mark(2)
  const kids = images.map((_, index) => `${3 + index * 3} 0 R`).join(' ')
  ascii(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${images.length} >>\nendobj\n`)

  images.forEach((image, index) => {
    const pageId = 3 + index * 3
    const contentId = pageId + 1
    const imageId = pageId + 2
    const scale = Math.min((A4_WIDTH - MARGIN * 2) / image.width, (A4_HEIGHT - MARGIN * 2) / image.height, 1)
    const drawW = +(image.width * scale).toFixed(2)
    const drawH = +(image.height * scale).toFixed(2)
    const drawX = +((A4_WIDTH - drawW) / 2).toFixed(2)
    const drawY = +((A4_HEIGHT - drawH) / 2).toFixed(2)
    const content = encoder.encode(`q\n${drawW} 0 0 ${drawH} ${drawX} ${drawY} cm\n/Im0 Do\nQ\n`)

    mark(pageId)
    ascii(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`)

    mark(contentId)
    ascii(`${contentId} 0 obj\n<< /Length ${content.length} >>\nstream\n`)
    push(content)
    ascii('endstream\nendobj\n')

    mark(imageId)
    ascii(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`)
    push(image.bytes)
    ascii('\nendstream\nendobj\n')
  })

  const xrefOffset = size
  const total = objectCount + 1
  let xref = `xref\n0 ${total}\n0000000000 65535 f\r\n`
  for (let id = 1; id <= objectCount; id += 1) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n\r\n`
  }
  ascii(xref)
  ascii(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)

  const output = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

export interface PdfConversionResult {
  fileUrl: string
  fileName: string
  sizeLabel: string
}

/**
 * Fusionne une ou plusieurs images (dans l'ordre du tableau) en un seul PDF.
 * 1 image = 1 page. Renvoie une data URL PDF prête à être déposée.
 */
export async function imagesToPdf(files: File[], title?: string): Promise<PdfConversionResult> {
  if (!files.length) throw new Error('Aucune image à convertir.')
  const images: PdfImage[] = []
  for (const file of files) images.push(await imageToJpeg(file))
  const bytes = buildPdf(images)
  const dataUrl = `data:application/pdf;base64,${bytesToBase64(bytes)}`
  if (dataUrl.length > MAX_DOCUMENT_DATA_URL_CHARS) {
    throw new Error('PDF trop volumineux. Réduisez le nombre ou la taille des images.')
  }
  return {
    fileUrl: dataUrl,
    fileName: sanitizePdfName(title || files[0]?.name || 'document'),
    sizeLabel: formatFileSize(bytes.length),
  }
}
