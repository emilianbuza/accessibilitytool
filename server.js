import express from 'express';
import cors from 'cors';
import pa11y from 'pa11y';
// wcag-de.json laden
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let wcagDe = {};
try {
  wcagDe = JSON.parse(fs.readFileSync(join(__dirname, 'wcag-de.json'), 'utf8'));
  console.log('✅ wcag-de.json geladen!');
} catch (e) {
  console.warn('⚠️ wcag-de.json nicht gefunden');
}

const app = express();
const PORT = process.env.PORT || 3040;

app.use(express.json({ limit: '1mb' }));
app.use(cors());

// URL-Validierung
const isValidUrl = (str) => {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

const enforceHttps = (url) => {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:') {
      u.protocol = 'https:';
    }
    return u.toString();
  } catch {
    return url;
  }
};

// VERBESSERTE REPORT-VERARBEITUNG (ersetzt CrapGPT's chaos)
function processAndCleanIssues(issues) {
  // Issue-Kategorisierung nach Wichtigkeit
  const criticalPatterns = [
    'H25.2',           // Page title
    'G18.Fail',        // Color contrast
    'F77',             // Duplicate IDs
    'H32.2',           // Form submit
    '2_4_4.H77',       // Link text
    '3_3_1',           // Form errors
    '3_3_2',           // Required fields
    '4_1_1'            // Valid HTML
  ];

  const warningPatterns = [
    'H67.1',           // Image alt/title
    'G149',            // Focus visible
    'G141',            // Heading structure
    '1_4_4',           // Text resize
    '2_4_1',           // Skip links
    '2_4_7'            // Focus visible
  ];

  // Deutsche Übersetzungen für die wichtigsten Issues
  // ERSETZE dein translations Objekt in processAndCleanIssues mit diesem:

const translations = {
  'WCAG2AA.Principle2.Guideline2_4.2_4_2.H25.2': {
    title: 'Seitentitel fehlt oder unbrauchbar',
    description: 'Der Seitentitel ist leer, zu allgemein oder nicht aussagekräftig.',
    fix: 'Eindeutige, beschreibende Titel für alle Seiten hinzufügen'
  },
  'WCAG2AA.Principle2.Guideline2_4.2_4_4.H77': {
    title: 'Linktexte sind nicht aussagekräftig',
    description: 'Links mit Texten wie "Hier klicken", "Mehr" oder "Link" sind nicht aussagekräftig.',
    fix: '"Hier klicken" durch beschreibende Texte ersetzen: "Zur Produktseite", "Kontakt aufnehmen"'
  },
  'WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail': {
    title: 'Kontrast zu niedrig',
    description: 'Text- und Hintergrundfarben haben weniger als 4,5:1 Kontrast.',
    fix: 'Farben anpassen: Dunkler Text auf hellem Hintergrund oder umgekehrt'
  },
  'WCAG2AA.Principle4.Guideline4_1.4_1_1.F77': {
    title: 'Doppelte IDs gefunden',
    description: 'Mehrere HTML-Elemente haben die gleiche ID.',
    fix: 'Jede ID nur einmal pro Seite verwenden - IDs müssen eindeutig sein'
  },
  'WCAG2AA.Principle3.Guideline3_2.3_2_2.H32.2': {
    title: 'Formulare ohne Submit-Button',
    description: 'Formulare haben keinen Absende-Button.',
    fix: '<button type="submit">Absenden</button> zu allen Formularen hinzufügen'
  },
  'WCAG2AA.Principle3.Guideline3_3.3_3_1.G83': {
    title: 'Fehlermeldungen fehlen',
    description: 'Formulare zeigen keine klaren Fehlermeldungen.',
    fix: 'Verständliche Fehlermeldungen hinzufügen: "Bitte E-Mail-Adresse eingeben"'
  },
  'WCAG2AA.Principle3.Guideline3_3.3_3_2.G131': {
    title: 'Pflichtfelder nicht gekennzeichnet',
    description: 'Erforderliche Formularfelder sind nicht erkennbar.',
    fix: 'Pflichtfelder mit * markieren und "Pflichtfeld" Label hinzufügen'
  },
  'WCAG2AA.Principle1.Guideline1_1.1_1_1.H67.1': {
    title: 'Problematische Bild-Attribute',
    description: 'Bilder mit leerem alt-Text haben trotzdem einen title.',
    fix: 'Entweder title-Attribut entfernen oder sinnvollen alt-Text hinzufügen'
  },
  'WCAG2AA.Principle1.Guideline1_1.1_1_1.G94.Image': {
    title: 'Bilder ohne Alt-Text',
    description: 'Informative Bilder haben keinen Alternativtext.',
    fix: 'Alt-Text hinzufügen: <img src="logo.jpg" alt="Firmenlogo ReguKit">'
  },
  'WCAG2AA.Principle2.Guideline2_4.2_4_7.G149': {
    title: 'Fokus nicht sichtbar',
    description: 'Keyboard-Navigation zeigt nicht welches Element aktiv ist.',
    fix: 'CSS hinzufügen: :focus { outline: 2px solid #0066cc; border-radius: 2px; }'
  },
  'WCAG2AA.Principle1.Guideline1_3.1_3_1_A.G141': {
    title: 'Falsche Überschriften-Struktur',
    description: 'Überschriften-Hierarchie ist unlogisch.',
    fix: 'Überschriften korrekt verschachteln: H1 → H2 → H3, nie H1 → H3'
  },
  'WCAG2AA.Principle1.Guideline1_4.1_4_4.G142': {
    title: 'Text nicht skalierbar',
    description: 'Text kann nicht auf 200% vergrößert werden.',
    fix: 'Relative Einheiten verwenden (em, rem) statt feste Pixel-Werte'
  },
  'WCAG2AA.Principle1.Guideline1_3.1_3_1.H42': {
    title: 'Falsche Überschriften-Tags',
    description: 'Text sieht aus wie Überschrift, aber verwendet falsche HTML-Tags.',
    fix: 'Richtige Überschriften-Tags verwenden: <h2>Titel</h2> statt <p><strong>Titel</strong></p>'
  },
  'WCAG2AA.Principle2.Guideline2_4.2_4_1.G1': {
    title: 'Keine Skip-Links',
    description: 'Navigation kann nicht übersprungen werden.',
    fix: 'Skip-Link hinzufügen: <a href="#main">Zum Hauptinhalt springen</a>'
  },
  'WCAG2AA.Principle4.Guideline4_1.4_1_2.H91.A.Placeholder': {
    title: 'Links ohne Text',
    description: 'Links haben keinen erkennbaren Text oder Beschreibung.',
    fix: 'Linktext hinzufügen oder aria-label verwenden: <a aria-label="Zur Startseite">🏠</a>'
  },
  'WCAG2AA.Principle1.Guideline1_1.1_1_1.H67.2': {
    title: 'Dekorative Bilder falsch markiert',
    description: 'Schmuckbilder haben unnötigen title-Text.',
    fix: 'Nur alt="" für Schmuckbilder, kein title-Attribut'
  },
  'WCAG2AA.Principle1.Guideline1_4.1_4_2.F23': {
    title: 'Horizontales Scrollen bei Zoom',
    description: 'Bei 200% Zoom muss horizontal gescrollt werden.',
    fix: 'Responsive Design verwenden: max-width: 100%, flexible Layouts'
  },
  'WCAG2AA.Principle1.Guideline1_3.1_3_1.H48': {
    title: 'Listen falsch strukturiert',
    description: 'Aufzählungen verwenden keine korrekten Listen-Tags.',
    fix: 'Richtige Listen verwenden: <ul><li>Punkt 1</li><li>Punkt 2</li></ul>'
  },
'WCAG2AA.Principle2.Guideline2_4.2_4_6.G130': {
  title: 'Es gibt keine visuelle Hervorhebung der aktuellen Position',
  description: 'Nutzer wissen nicht wo sie sich befinden.',
  fix: 'Breadcrumb-Navigation oder aktuelle Seite markieren'
},
  'WCAG2AA.Principle3.Guideline3_1.3_1_2.H58': {
    title: 'Sprachangaben fehlen',
    description: 'Fremdsprachige Texte sind nicht markiert.',
    fix: 'Lang-Attribut hinzufügen: <span lang="en">Hello World</span>'
  },
'WCAG2AA.Principle2.Guideline2_4.2_4_1.G1,G123,G124.NoSuchID': {
  title: 'Link verweist auf nicht existierende Anker-ID',
  description: 'Links zeigen auf Ziele die nicht vorhanden sind.',
  fix: 'Kaputte Anker-Links (#section1) reparieren oder entfernen'
},
'WCAG2AA.Principle2.Guideline2_4.2_4_6.G130,G131': {
  title: 'Keine Orientierungshilfe auf der Website',
  description: 'Nutzer wissen nicht wo sie sich befinden.',
  fix: 'Breadcrumb-Navigation hinzufügen: Home > Kategorie > Aktuelle Seite'
},
'WCAG2AA.Principle3.Guideline3_3.3_3_4.G98,G99,G155,G164,G168.LegalForms': {
  title: 'Bei rechtlich verbindlichen Formularen fehlen Bestätigungsschritte',
  description: 'Wichtige Formulare haben keine Bestätigung.',
  fix: 'Bestätigungsseite hinzufügen: "Sind Sie sicher? [Ja] [Nein]"'
},
'WCAG2AA.Principle1.Guideline1_4.1_4_10.C32,C31,C33,C38,SCR34,G206': {
  title: 'Zoom wird behindert',
  description: 'Website kann nicht richtig gezoomt werden.',
  fix: 'viewport meta-tag anpassen: <meta name="viewport" content="width=device-width, initial-scale=1">'
},
'WCAG2AA.Principle1.Guideline1_1.1_1_1.G73,G74': {
  title: 'Komplexe Bilder ohne ausführliche Beschreibung',
  description: 'Diagramme/Charts haben nur kurzen alt-Text.',
  fix: 'Ausführliche Beschreibung in Text daneben oder per aria-describedby'
},
'WCAG2AA.Principle1.Guideline1_4.1_4_3.G145.Fail': {
  title: 'Kontrast zu niedrig (große Schrift)',
  description: 'Große Schrift hat weniger als 3:1 Kontrast.',
  fix: 'Kontrast für große Texte (18pt+) auf mindestens 3:1 erhöhen'
}
};

  // Issues gruppieren und deduplizieren
  const grouped = {};
  for (const issue of issues) {
    const key = issue.code || 'unknown';
    if (!grouped[key]) {
    grouped[key] = {
  code: key,
  type: issue.type,
  count: 0,
  messages: new Set(),
  selectors: new Set(),  // ✅ RICHTIG - Sammelt alle!
  isPriority: 'low'
};
      
      // Priorität bestimmen
      if (criticalPatterns.some(pattern => key.includes(pattern))) {
        grouped[key].isPriority = 'critical';
      } else if (warningPatterns.some(pattern => key.includes(pattern))) {
        grouped[key].isPriority = 'warning';
      }
      
    // Deutsche Übersetzung hinzufügen
const germanText = wcagDe[key] || translations[key]?.description || 'Unbekanntes Problem';
grouped[key].translation = {
  title: translations[key]?.title || (germanText && germanText.length > 10 ? germanText.split('.')[0] : key.replace(/^WCAG2AA\./, '').replace(/Principle\d\.Guideline\d_\d\.\d_\d_\d\./, '')),
  description: germanText,
  fix: translations[key]?.fix || 'Siehe WCAG-Richtlinien'
};
    }
    
    grouped[key].count++;
if (issue.message) {
  grouped[key].messages.add(issue.message.trim());
}
if (issue.selector) {  // ✅ Selektoren sammeln!
  grouped[key].selectors.add(issue.selector);
}
  }

  // In Array umwandeln und sortieren
return Object.values(grouped)
  .map(g => ({
    ...g,
    messages: Array.from(g.messages),
    samples: Array.from(g.selectors).slice(0, 3)  // ✅ Erste 3 Selektoren
  }))
    .sort((a, b) => {
      // Zuerst nach Priorität, dann nach Anzahl
      const priorityOrder = { critical: 0, warning: 1, low: 2 };
      const typePriority = priorityOrder[a.isPriority] - priorityOrder[b.isPriority];
      if (typePriority !== 0) return typePriority;
      return b.count - a.count;
    });
}

// Verbessertes Scoring-System
function calculateDetailedScore({ errors, warnings, notices }) {
  // Gewichtetes Scoring-System
  const errorPenalty = Math.min(60, errors * 10);      // Errors: bis -60 Punkte
  const warningPenalty = Math.min(25, warnings * 3);   // Warnings: bis -25 Punkte  
  const noticePenalty = Math.min(15, notices * 1);     // Notices: bis -15 Punkte
  
  const totalPenalty = errorPenalty + warningPenalty + noticePenalty;
  const score = Math.max(0, 100 - totalPenalty);
  
  let grade = 'F';
  let gradeColor = '#dc2626';
  
  if (score >= 95) {
    grade = 'A+';
    gradeColor = '#059669';
  } else if (score >= 90) {
    grade = 'A';
    gradeColor = '#10b981';
  } else if (score >= 80) {
    grade = 'B';
    gradeColor = '#84cc16';
  } else if (score >= 70) {
    grade = 'C';
    gradeColor = '#eab308';
  } else if (score >= 60) {
    grade = 'D';
    gradeColor = '#f59e0b';
  }
  
  return {
    score,
    grade,
    gradeColor,
    breakdown: {
      errorPenalty,
      warningPenalty, 
      noticePenalty,
      totalPenalty
    },
    assessment: getScoreAssessment(score)
  };
}

function getScoreAssessment(score) {
  if (score >= 90) return 'Hervorragend - Kleine Optimierungen möglich';
  if (score >= 80) return 'Gut - Wenige Verbesserungen nötig';
  if (score >= 70) return 'Befriedigend - Mehrere Probleme beheben';
  if (score >= 60) return 'Ausreichend - Wichtige Mängel vorhanden';
  if (score >= 40) return 'Mangelhaft - Viele kritische Probleme';
  return 'Kritisch - Sofortiger Handlungsbedarf!';
}

// Zusammenfassung generieren
function generateSummary(processedIssues, counts) {
  const criticalIssues = processedIssues.filter(i => i.isPriority === 'critical');
  const warningIssues = processedIssues.filter(i => i.isPriority === 'warning');
  
  return {
    total: processedIssues.length,
    criticalCount: criticalIssues.length,
    warningCount: warningIssues.length,
    topCritical: criticalIssues.slice(0, 3).map(i => ({
      title: i.translation?.title || i.code.replace(/^WCAG2AA\./, ''),
      count: i.count,
      fix: i.translation?.fix || 'Siehe WCAG-Richtlinien'
    })),
    quickWins: getQuickWins(criticalIssues)
  };
}

function getQuickWins(criticalIssues) {
  const quickWinCodes = ['H25.2', 'F77', 'H32.2']; // Einfach zu beheben
  return criticalIssues
    .filter(issue => quickWinCodes.some(code => issue.code.includes(code)))
    .map(issue => issue.translation?.title || issue.code)
    .slice(0, 3);
}

// HAUPTENDPUNKT - Verbessert!
app.post('/api/a11y-check', async (req, res) => {
  const startTime = Date.now();
  let { url } = req.body || {};
  
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ 
      success: false,
      error: 'Bitte eine gültige URL mit http(s) angeben.' 
    });
  }

  url = enforceHttps(url);
  console.log(`[A11Y-CHECK] Starte Analyse für: ${url}`);

  try {
    const results = await pa11y(url, {
      standard: 'WCAG2AA',
      includeNotices: true,
      includeWarnings: true,
      timeout: 90000,
      wait: 1000,
      chromeLaunchConfig: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        ignoreHTTPSErrors: true
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36'
      }
    });

    // HIER IST DIE VERBESSERTE VERARBEITUNG:
    const counts = results.issues.reduce((acc, i) => {
      if (i.type === 'error') acc.errors++;
      else if (i.type === 'warning') acc.warnings++;
      else acc.notices++;
      return acc;
    }, { errors: 0, warnings: 0, notices: 0 });

    const scoring = calculateDetailedScore(counts);
    const processedIssues = processAndCleanIssues(results.issues);
    const summary = generateSummary(processedIssues, counts);
    const analysisTime = Date.now() - startTime;

    // Saubere, strukturierte Antwort
    res.json({
      success: true,
      url,
      standard: 'WCAG 2.1 AA (via pa11y WCAG2AA)',
      counts,
      ...scoring,
      timestamp: new Date().toISOString(),
      analysisTimeMs: analysisTime,
      issues: processedIssues,        // Dedupliziert und übersetzt!
      summary,                        // Top-Probleme mit Quick-Wins
      meta: {
        totalIssuesFound: results.issues.length,
        uniqueIssueTypes: processedIssues.length,
        worstOffenders: processedIssues.slice(0, 5).map(i => 
          i.translation?.title || i.code.replace(/^WCAG2AA\./, '')
        )
      }
    });

  } catch (err) {
    console.error('[A11Y-CHECK] Fehler bei Analyse:', err.name, err.message);
    const analysisTime = Date.now() - startTime;
    
    res.status(500).json({ 
      success: false,
      error: `Analyse fehlgeschlagen: ${err.name} – ${err.message}`,
      timestamp: new Date().toISOString(),
      analysisTimeMs: analysisTime
    });
  }
});

// ERSETZE den /embed.js Endpunkt in deiner server.js mit diesem Code:

app.get('/embed.js', (_req, res) => {
  const widget = `
    … neuer Widget-Code …
  `;
  res.type('application/javascript').send(widget);
});

// Demo-Seite
app.get('/', (_req, res) => {
  res.type('text/html').send(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Verbesserter A11y Check Widget</title></head><body>
  <h1 style="font-family: system-ui, sans-serif;">Verbesserter A11y Check Widget – Jetzt mit sauberen Reports! 🚀</h1>
  <p>Keine Wall-of-Text mehr, sondern strukturierte, verständliche Ergebnisse!</p>
  <div id="regukit-a11y"></div>
  <script src="/embed.js" data-endpoint="/api/a11y-check"></script>
  </body></html>`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ReguKit A11y Check läuft auf Port ${PORT}`);
  console.log(`💪 Jetzt mit sauberen Reports!`);
});










