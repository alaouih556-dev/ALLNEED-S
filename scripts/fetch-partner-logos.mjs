// Downloads the ALLNEEDS partner logos into public/partners/.
//
// Usage: node scripts/fetch-partner-logos.mjs
//
// Rules enforced here:
//   - files are written with the exact required filenames
//   - nothing is resized, recolored or cropped (bytes are stored untouched)
//   - a download is only kept if the payload is a real image (magic bytes)
//   - failed or HTML-error payloads are deleted and reported

import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const OUT_DIR = path.resolve("public/partners");

const LOGOS = [
  {
    id: "anapec",
    file: "anapec.png",
    url: "https://4.bp.blogspot.com/-l_zicamrnKo/WMcRjUSqqeI/AAAAAAAAAso/gzRtt4vxk2AXFkmY5P56SOlt1Tvz6jtlQCPcB/s1600/Anapec.png",
  },
  {
    id: "ofppt",
    file: "ofppt.png",
    url: "https://upload.wikimedia.org/wikipedia/commons/d/df/OFPPT_Logo.png",
  },
  {
    id: "rma",
    file: "rma.jpg",
    url: "https://pbs.twimg.com/profile_images/1613118148533788674/j8kaUBzr.jpg",
  },
  {
    id: "orange",
    file: "orange.png",
    url: "https://www.citwell.com/app/uploads/2025/05/4-2.png",
  },
  {
    id: "bank-of-africa",
    file: "bank-of-africa.webp",
    // Requested source (currently answers 404).
    url: "https://mgmt.manhom.com/images/87447/1730119130/%D8%A7%D9%84%D8%A8%D9%86%D9%83-%D8%A7%D9%84%D8%BA%D8%B1%D8%A8%D9%8A-%D9%84%D9%84%D8%AA%D8%AC%D8%A7%D8%B1%D8%A9-%D8%A7%D9%84%D8%AE%D8%A7%D8%B1%D8%AC%D9%8A%D8%A9-%D9%81%D9%8A-%D8%A7%D9%82%D8%B1%D8%A7.webp",
    // Official BANK OF AFRICA logotype, Wikimedia Commons.
    fallbacks: [
      "https://commons.wikimedia.org/wiki/Special:FilePath/Bank_of_Africa_Logo.png",
    ],
  },
  {
    id: "cash-plus",
    file: "cash-plus.png",
    url: "https://s3-eu-west-1.amazonaws.com/cf-simple-s3-origin-monisnap-v2-assets-dev-424535010097/PNG/MA_7050314.png",
  },
  {
    id: "barid-cash",
    file: "barid-cash.png",
    url: "https://www.paiemaroc.ma/img/references/barid_cash-LGR-LOGICIEL-PAIE-MAROC.png",
  },
  {
    id: "damane-cash",
    file: "damane-cash.jpg",
    // Extracted from https://www.adm.co.ma/fr/agences-damane-cash (og:image).
    // Note: the remote asset is a PNG, but the required filename is .jpg.
    url: "https://www.adm.co.ma/sites/default/files/photos_jawaz/logo_damanecash.png",
  },
  {
    id: "dar-al-moukawil",
    file: "dar-al-moukawil.jpg",
    url: "https://www.berramou.com/sites/default/files/2020-04/dar-al-mokawil-logo.jpg",
  },
  {
    id: "cri-casa",
    file: "cri-casablanca-settat.png",
    url: "https://cdn.prod.website-files.com/6193859779a9349e55cff3d0/61f7ed1c5954a227b60962a7_logo-CRI-blanc%20%282%29.png",
  },
  {
    id: "go-siyaha",
    file: "go-siyaha.jpg",
    url: "https://it.italiatelegraph.com/static/uploads/2025/07/aaazsx.jpg",
  },
  {
    id: "maroc-pme",
    file: "maroc-pme.jpg",
    url: "https://www.ifcarjob.com/storage/avatars/1634832538.jpg",
  },
];

const MIN_BYTES = 1024;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

/** Returns the detected image format, or null when the payload is not an image. */
export function detectImageFormat(buf) {
  if (buf.length >= 8) {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (png.every((byte, i) => buf[i] === byte)) return "png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpeg";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  if (buf.length >= 4 && buf.toString("ascii", 0, 4).startsWith("GIF8")) {
    return "gif";
  }
  if (buf.length >= 4 && buf.toString("ascii", 0, 4) === "%PDF") {
    return "pdf";
  }
  const head = buf.toString("utf8", 0, Math.min(buf.length, 1024)).trim();
  if (head.startsWith("<svg") || head.includes("<svg")) return "svg";
  return null;
}

async function fetchImage(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": UA,
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  const buf = Buffer.from(await res.arrayBuffer());

  if (contentType === "text/html") {
    throw new Error(`HTML page instead of image (${buf.length} bytes)`);
  }
  if (buf.length < MIN_BYTES) {
    throw new Error(`payload too small (${buf.length} bytes)`);
  }

  const format = detectImageFormat(buf);
  if (!format) {
    const preview = buf.toString("utf8", 0, 60).replace(/\s+/g, " ");
    throw new Error(
      `not a recognised image (content-type ${contentType || "?"}, starts "${preview}")`,
    );
  }
  if (format === "pdf") {
    throw new Error("response is a PDF, not an image");
  }

  return { format, bytes: buf.length, buf };
}

async function download(logo) {
  const target = path.join(OUT_DIR, logo.file);
  const sources = [logo.url, ...(logo.fallbacks ?? [])];
  const errors = [];

  for (const source of sources) {
    try {
      const result = await fetchImage(source);
      await writeFile(target, result.buf);
      return { ...result, source };
    } catch (error) {
      errors.push(`${source} -> ${error.message}`);
    }
  }

  throw new Error(errors.join(" | "));
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    await mkdir(OUT_DIR, { recursive: true });
  }

  const ok = [];
  const failed = [];

  for (const logo of LOGOS) {
    const target = path.join(OUT_DIR, logo.file);
    try {
      const { format, bytes, source } = await download(logo);
      const usedFallback = source !== logo.url;
      ok.push(`${logo.file} (${format}, ${(bytes / 1024).toFixed(1)} kB)`);
      console.log(
        `OK    ${logo.file} -> ${format}, ${bytes} bytes${usedFallback ? " [fallback source]" : ""}`,
      );
    } catch (error) {
      if (existsSync(target)) await rm(target, { force: true });
      failed.push(`${logo.file}: ${error.message}`);
      console.error(`FAIL  ${logo.file}: ${error.message}`);
    }
  }

  console.log(`\n${ok.length}/${LOGOS.length} logos downloaded into public/partners/`);
  if (failed.length > 0) {
    console.log("\nFailed (no file left on disk):");
    for (const item of failed) console.log(`  - ${item}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export { LOGOS, OUT_DIR };
