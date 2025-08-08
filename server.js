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
  'WCAG2AA.Principle3.Guideline3_1.3_1_2.H58': {
    title: 'Sprachangaben fehlen',
    description: 'Fremdsprachige Texte sind nicht als solche markiert.',
    fix: 'Lang-Attribut hinzufügen: <span lang="en">Hello World</span>'
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
  const improvedWidget = `
(function() {
  'use strict';
  
  const SCRIPT = document.currentScript;
  const ENDPOINT = (SCRIPT?.dataset?.endpoint) || '/api/a11y-check';
  
  function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key === 'onClick') {
        element.addEventListener('click', value);
      } else {
        element.setAttribute(key, value);
      }
    });
    
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    });
    
    return element;
  }
  
  function renderWidget(container) {
    container.innerHTML = '';
    
    const wrapper = createElement('div', {
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '800px',
        border: '2px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        backgroundColor: '#ffffff',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lineHeight: '1.5'
      }
    });
    
    const title = createElement('div', {
      style: {
        fontWeight: '700',
        fontSize: '20px',
        marginBottom: '16px',
        color: '#1f2937',
        borderBottom: '2px solid #f3f4f6',
        paddingBottom: '12px'
      }
    }, ['🔍 Barrierefreiheits-Check (WCAG 2.1 AA)']);
    
    const form = createElement('form', {
      style: {
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }
    });
    
    const inputWrapper = createElement('div', {
      style: { flex: '1', minWidth: '300px' }
    });
    
    const input = createElement('input', {
      type: 'url',
      placeholder: 'https://example.com',
      required: 'required',
      style: {
        width: '100%',
        padding: '12px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '16px',
        boxSizing: 'border-box'
      }
    });
    
    const button = createElement('button', {
      type: 'submit',
      style: {
        padding: '12px 20px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        fontSize: '16px',
        fontWeight: '600'
      }
    }, ['Prüfen']);
    
    const resultContainer = createElement('div', {
      style: { marginTop: '20px' }
    });
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const url = input.value.trim();
      if (!url) return;
      
      resultContainer.innerHTML = '';
      button.disabled = true;
      button.textContent = 'Analysiere...';
      
      const loadingDiv = createElement('div', {
        style: {
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          fontSize: '14px'
        }
      }, ['🔄 Website wird analysiert, bitte warten...']);
      
      resultContainer.appendChild(loadingDiv);
      
      try {
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        
        resultContainer.innerHTML = '';
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Unbekannter Fehler');
        }
        
        renderResults(resultContainer, data);
        
      } catch (error) {
        resultContainer.innerHTML = '';
        const errorDiv = createElement('div', {
          style: {
            padding: '16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #dc2626',
            borderRadius: '8px',
            color: '#dc2626',
            fontSize: '14px'
          }
        }, ['❌ Fehler: ' + error.message]);
        
        resultContainer.appendChild(errorDiv);
      } finally {
        button.disabled = false;
        button.textContent = 'Prüfen';
      }
    });
    
    inputWrapper.appendChild(input);
    form.appendChild(inputWrapper);
    form.appendChild(button);
    
    wrapper.appendChild(title);
    wrapper.appendChild(form);
    wrapper.appendChild(resultContainer);
    
    container.appendChild(wrapper);
  }
  
  function renderResults(container, data) {
    const scoreColor = data.score >= 90 ? '#059669' : 
                      data.score >= 70 ? '#eab308' : 
                      data.score >= 50 ? '#f59e0b' :
                      '#dc2626';
    
    // Score Header
    const scoreSection = createElement('div', {
      style: {
        textAlign: 'center',
        marginBottom: '20px',
        padding: '20px',
        backgroundColor: scoreColor + '20',
        borderRadius: '12px',
        border: '2px solid ' + scoreColor
      }
    });
    
    const scoreText = createElement('div', {
      style: {
        fontSize: '2.5rem',
        fontWeight: '700',
        color: scoreColor,
        marginBottom: '8px'
      }
    }, [data.score + '/100']);
    
    const gradeText = createElement('div', {
      style: {
        fontSize: '1.2rem',
        fontWeight: '600',
        color: scoreColor,
        marginBottom: '8px'
      }
    }, ['Note: ' + data.grade]);
    
    const assessmentText = createElement('div', {
      style: {
        fontSize: '0.9rem',
        color: '#4b5563',
        fontStyle: 'italic'
      }
    }, [data.assessment]);
    
    scoreSection.appendChild(scoreText);
    scoreSection.appendChild(gradeText);
    scoreSection.appendChild(assessmentText);
    
    // Stats Overview
    const statsSection = createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }
    });
    
    const stats = [
      { label: 'Kritisch', value: data.summary.criticalCount, color: '#dc2626' },
      { label: 'Warnungen', value: data.summary.warningCount, color: '#f59e0b' },
      { label: 'Gesamt', value: data.summary.total, color: '#6b7280' }
    ];
    
    stats.forEach(stat => {
      const statDiv = createElement('div', {
        style: {
          textAlign: 'center',
          padding: '12px',
          backgroundColor: stat.color + '20',
          borderRadius: '8px',
          border: '1px solid ' + stat.color + '40'
        }
      });
      
      const valueDiv = createElement('div', {
        style: {
          fontSize: '1.5rem',
          fontWeight: '700',
          color: stat.color,
          marginBottom: '4px'
        }
      }, [stat.value.toString()]);
      
      const labelDiv = createElement('div', {
        style: {
          fontSize: '0.8rem',
          color: '#4b5563'
        }
      }, [stat.label]);
      
      statDiv.appendChild(valueDiv);
      statDiv.appendChild(labelDiv);
      statsSection.appendChild(statDiv);
    });
    
    // Top Issues
    if (data.summary.topCritical && data.summary.topCritical.length > 0) {
      const issuesSection = createElement('div', {
        style: {
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          border: '1px solid #fecaca'
        }
      });
      
      const issuesTitle = createElement('div', {
        style: {
          fontWeight: '600',
          marginBottom: '12px',
          color: '#991b1b'
        }
      }, ['🚨 Wichtigste Probleme:']);
      
      data.summary.topCritical.forEach(issue => {
        const issueDiv = createElement('div', {
          style: {
            padding: '8px 0',
            borderBottom: '1px solid #fecaca',
            fontSize: '0.9rem'
          }
        });
        
        const titleSpan = createElement('span', {
          style: { fontWeight: '600', color: '#1f2937' }
        }, [issue.title]);
        
        const countSpan = createElement('span', {
          style: {
            backgroundColor: '#dc2626',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '10px',
            fontSize: '0.7rem',
            marginLeft: '8px'
          }
        }, [issue.count + 'x']);
        
        issueDiv.appendChild(titleSpan);
        issueDiv.appendChild(countSpan);
        
        if (issue.fix) {
          const fixDiv = createElement('div', {
            style: {
              marginTop: '4px',
              fontSize: '0.8rem',
              color: '#6b7280',
              fontStyle: 'italic'
            }
          }, ['💡 ' + issue.fix]);
          issueDiv.appendChild(fixDiv);
        }
        
        issuesSection.appendChild(issueDiv);
      });
      
      container.appendChild(scoreSection);
      container.appendChild(statsSection);
      container.appendChild(issuesSection);
    } else {
      container.appendChild(scoreSection);
      container.appendChild(statsSection);
    }
    
    // Quick Wins
    if (data.summary.quickWins && data.summary.quickWins.length > 0) {
      const quickWinsSection = createElement('div', {
        style: {
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#ecfdf5',
          borderRadius: '8px',
          border: '1px solid #a7f3d0'
        }
      });
      
      const quickWinsTitle = createElement('div', {
        style: {
          fontWeight: '600',
          marginBottom: '8px',
          color: '#065f46'
        }
      }, ['🎯 Schnell behebbar:']);
      
      const quickWinsList = createElement('div', {
        style: { fontSize: '0.85rem', color: '#047857' }
      }, [data.summary.quickWins.join(' • ')]);
      
      quickWinsSection.appendChild(quickWinsTitle);
      quickWinsSection.appendChild(quickWinsList);
      container.appendChild(quickWinsSection);
    }
  }
  
  // Widget initialisieren
  function initWidget() {
    let container = document.getElementById('regukit-a11y');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'regukit-a11y';
      
      if (SCRIPT && SCRIPT.parentNode) {
        SCRIPT.parentNode.insertBefore(container, SCRIPT);
      } else {
        document.body.appendChild(container);
      }
    }
    
    renderWidget(container);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
  `;

  res.type('application/javascript').send(improvedWidget);
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

app.listen(PORT, () => {
  console.log(`🚀 Verbesserter ReguKit A11y Check läuft auf http://localhost:${PORT}`);
  console.log(`💪 Jetzt mit sauberen Reports statt CrapGPT's Chaos!`);
});






