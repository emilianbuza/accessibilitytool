import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import pa11y from 'pa11y';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const wcagDe = JSON.parse(fs.readFileSync(path.join(__dirname, 'wcag-de.json'), 'utf8'));


const app = express();

// --- Security ---
app.use(helmet());

// --- CORS: nur für deine Domain (ReguKit) freigeben ---
app.use(cors({
  origin: [
    'https://regukit.com',
    'https://www.regukit.com'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// --- Rate Limiting ---
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 10, // max. 10 Requests pro Minute
  message: { error: 'Rate limit exceeded. Please wait and try again.' }
});
app.use('/api/', limiter);

// --- Body Parser ---
app.use(express.json());

// --- Helper: URL-Validierung ---
function validateUrl(input) {
  try {
    const url = new URL(input);
    if (!/^https?:$/.test(url.protocol)) return false;
    return true;
  } catch {
    return false;
  }
}

// --- API-Endpunkt ---
app.post('/api/a11y-check', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Keine URL angegeben oder falsches Format.' });
  }

  try {
    console.log(`[A11Y-CHECK] Starte Analyse für: ${url}`);

    const results = await pa11y(url, {
      standard: 'WCAG2AA',
      timeout: 60000,
      includeNotices: true,
      includeWarnings: true,
      chromeLaunchConfig: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        ignoreHTTPSErrors: true
      },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, wie Gecko) Chrome/116.0.0.0 Safari/537.36'
      }
    });

    // Gefundene Codes loggen (optional)
    try {
      const uniqueCodes = [...new Set(results.issues.map(i => i.code))];
      console.log('[A11Y-CODES] Gefundene Codes:', uniqueCodes);
    } catch (_) {}

    // Deutsche Übersetzungen einfügen
    const translatedIssues = results.issues.map(issue => {
      const german = wcagDe[issue.code];
      return {
        code: issue.code,
        type: issue.type,
        selector: issue.selector || null,
        message: german || issue.message
      };
    });

    // Score/Grade berechnen
    const totalIssues = translatedIssues.length;
    const score = Math.max(0, 100 - totalIssues * 2);
    const grade = score >= 90 ? 'A'
               : score >= 75 ? 'B'
               : score >= 50 ? 'C'
               : score >= 25 ? 'D'
               : 'F';

    // Anzahl Fehler/Warnungen zählen
    const counts = translatedIssues.reduce((acc, i) => {
      if (i.type === 'error') acc.errors++;
      else if (i.type === 'warning') acc.warnings++;
      else acc.notices++;
      return acc;
    }, { errors: 0, warnings: 0, notices: 0 });

    res.json({
      success: true,
      url,
      standard: 'WCAG 2.1 AA (pa11y: WCAG2AA)',
      score,
      grade,
      counts,
      issues: translatedIssues
    });

  } catch (err) {
    console.error('[A11Y-CHECK] Fehler:', err?.name, err?.message);
    return res.status(500).json({
      success: false,
      error: 'Analyse fehlgeschlagen. Die Site blockiert evtl. Bots/CORS oder ist nicht erreichbar.'
    });
  }
});

// --- Hinweisblock für Frontend-Nutzer ---
app.get('/api/a11y-info', (req, res) => {
  res.json({
    info: `Dieser automatisierte Barrierefreiheits-Check prüft WCAG 2.1 AA Kriterien wie Kontraste, Alternativtexte, Struktur, Formularkennzeichnungen und mehr. 
Was er nicht prüft: inhaltliche Verständlichkeit, komplexe Tastaturnavigation oder sinnvolle Alternativtexte – diese müssen manuell validiert werden.`
  });
});

// --- Server starten ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Accessibility API running on port ${PORT}`);
});






