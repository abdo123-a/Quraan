# Offline Holy Quran — Professional PWA (القرآن الكريم)

A lightweight, fast, zero-dependency Progressive Web App (PWA) for reading the complete Holy Quran offline, with permanent reading-position marking and full dataset integrity.

## Dataset Provenance & Integrity Verification
- **Complete Text**: All **114 Surahs**, **30 Juz**, **604 Madinah Mushaf pages**, and **6,236 verses** (Riwayat Hafs 'an Asim).
- **Cross-Verified Sources**: Every single verse was cross-checked word-by-word across both provided verified sources (`quran.docx` and `ARQURAN.TXT` v2.08):
  - Clean, fully diacritized Quranic text extracted from `quran.docx` (with Surah 15 v.99 properly separated as verse 99).
  - Exact Madinah Mushaf page numbers (1–604), Juz boundaries (1–30), and all 15 Sajdah verse indicators verified and merged.
  - Known formatting defects in `ARQURAN.TXT` (e.g., misplaced verse 7/8 boundary in Surah 24, missing `{40}` in Surah 38, stray spaces in S5:32 / S15:51 / S28:29 / S114:6, and verse-label typos) were caught and avoided.

## Core Features
1. **3 Reading Styles** (switchable without losing reading position):
   - **Traditional Mushaf**: Continuous RTL prose grouped by Madinah Mushaf pages (1–604) with verse medallions.
   - **Clean Modern**: Spacious verse-by-verse cards with page/Juz metadata.
   - **Minimal Focus**: Distraction-free reading canvas with floating toggle.
2. **Permanent Reading Marker (IndexedDB + `localStorage` Mirror)**:
   - **Long-press** any verse (or right-click on desktop) to open the contextual menu.
   - Set, move, jump to, or explicitly remove the reading marker.
   - Survives refreshes, browser restarts, offline launches, theme switches, and reading-style switches. Never overwritten by normal browsing.
   - **"Continue Reading"** button & launch banner jump directly to the saved verse.
3. **100% Offline-First PWA**:
   - Cache-first Service Worker (`sw.js`) caches all app files and `data/quran.json` locally.
   - Zero external CDNs, zero external APIs, zero internet-dependent fonts or images.

---

## How to Run & Install for True Offline Use

> **Important:** Browsers block Service Workers and `fetch()` on `file://` URLs. To install the app and use it 100% offline in Chrome, serve the folder once over `http://localhost` (or deploy to any static HTTPS host like GitHub Pages / Netlify / Cloudflare Pages).

### Option A: Desktop Chrome (Windows / macOS / Linux)
1. Unzip `offline-holy-quran-pwa.zip`.
2. Open a terminal inside the `offline-quran-pwa` folder and start a local server:
   - **Python 3**: `python -m http.server 8080`
   - **Node.js**: `npx serve -p 8080`
3. Open **Google Chrome** and go to `http://localhost:8080`.
4. Wait ~2 seconds for the Service Worker to cache the complete Quran (`data/quran.json`).
5. Click the **Install** icon in Chrome's address bar (or Menu `⋮` → **Install app**).
6. You can now disconnect the internet, close Chrome, and reopen the installed app completely offline.

### Option B: Android Chrome (Phones & Tablets)
**Simplest Permanent Method (Free Static Hosting — Recommended):**
1. Upload the `offline-quran-pwa` folder to **GitHub Pages**, **Cloudflare Pages**, or **Netlify Drop** (HTTPS).
2. Open the HTTPS URL once in **Google Chrome** on your Android device.
3. Tap Chrome's menu (`⋮`) → **Add to Home screen** / **Install app**.
4. Open it once while online so the Service Worker caches all 6,236 verses.
5. Turn on Airplane Mode, close Chrome, and open the app from your home screen — it works 100% offline permanently.

**Local Network Method (Without Internet Hosting):**
- Run `python -m http.server 8080` on a PC on the same Wi-Fi, or use a local Android server app (e.g., Termux `python -m http.server 8080` on `http://localhost:8080` — Chrome treats `localhost` as a secure context for PWA installation & Service Workers).

---

## Offline & Integrity Verification Checklist
1. Open the app via `http://localhost:8080` (or HTTPS) and confirm Settings shows **"مفعّل وجاهز للعمل الكامل بدون إنترنت"**.
2. Disconnect Wi-Fi / enable Airplane Mode.
3. Close and reopen the browser/app; verify all 114 Surahs and 6,236 verses load immediately.
4. Long-press any verse → **تعيين كعلامة توقف**, close and reopen the app, and confirm the highlight & **متابعة القراءة** button persist.
5. Switch Light/Dark themes and all 3 reading styles and confirm the marker stays highlighted and intact.
