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

// --- CORS: nur für deine Domain freigeben ---
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
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Rate limit exceeded. Please wait and try again.' }
});
app.use('/api/', limiter);

// --- Body Parser ---
app.use(express.json());

// --- URL-Validierung ---
function validateUrl(input) {
  try {
    const url = new URL(input);
    return /^https?:$/.test(url.protocol);
  } catch {
    return false;
  }
}

// --- Scoring ---
function scoreFromCounts({errors, warnings}) {
  const penalty = Math.min(80, errors*6) + Math.min(15, warnings*1.5);
  const score = Math.max(0, 100 - Math.round(penalty));
  const grade = score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'F';
  return {score, grade};
}

// --- API ---
app.post('/api/a11y-check', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string' || !validateUrl(url)) {
    return res.status(400).json({ error: 'Keine gültige URL angegeben.' });
  }

  try {
    console.log(`[A11Y-CHECK] Starte Analyse für: ${url}`);

    const results = await pa11y(url, {
      standard: 'WCAG2AA',
      timeout: 60000,
      includeNotices: true,
      includeWarnings: true,
      hideElements: [
        '#cmplz-cookiebanner-container',
        '#cmplz-manage-consent',
        '#ez-toc-sticky-container'
      ].join(','),
      chromeLaunchConfig: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        ignoreHTTPSErrors: true
      },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, wie Gecko) Chrome/116.0.0.0 Safari/537.36'
      }
    });

    // Counts
    const counts = results.issues.reduce((a, i) => {
      if (i.type === 'error') a.errors++;
      else if (i.type === 'warning') a.warnings++;
      else a.notices++;
      return a;
    }, { errors: 0, warnings: 0, notices: 0 });

    const {score, grade} = scoreFromCounts(counts);

    // Gruppierung nach Code
    const grouped = {};
    for (const issue of results.issues) {
      const key = issue.code;
      if (!grouped[key]) {
        grouped[key] = {
          code: issue.code,
          type: issue.type,
          count: 0,
          message: wcagDe[issue.code] || issue.message,
          samples: []
        };
      }
      grouped[key].count++;
      if (grouped[key].samples.length < 3) {
        grouped[key].samples.push(issue.selector);
      }
    }

    res.json({
      success: true,
      url,
      standard: 'WCAG 2.1 AA (pa11y: WCAG2AA)',
      score,
      grade,
      counts,
      issues: Object.values(grouped)
    });

  } catch (err) {
    console.error('[A11Y-CHECK] Fehler:', err?.name, err?.message);
    return res.status(500).json({
      success: false,
      error: 'Analyse fehlgeschlagen. Die Site blockiert evtl. Bots/CORS oder ist nicht erreichbar.'
    });
  }
});

// --- Hinweis-Endpunkt ---
app.get('/api/a11y-info', (req, res) => {
  res.json({
    info: `Dieser automatisierte Barrierefreiheits-Check prüft WCAG 2.1 AA Kriterien wie Kontraste, Alternativtexte, Struktur, Formularkennzeichnungen und mehr. 
Was er nicht prüft: inhaltliche Verständlichkeit, komplexe Tastaturnavigation oder sinnvolle Alternativtexte – diese müssen manuell validiert werden.`
  });
});

// --- Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Accessibility API running on port ${PORT}`);
});
