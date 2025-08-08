const express = require('express');
const cors = require('cors');
const pa11y = require('pa11y');

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
  const translations = {
    'WCAG2AA.Principle2.Guideline2_4.2_4_2.H25.2': {
      title: 'Seitentitel fehlt oder unbrauchbar',
      description: 'Der Seitentitel ist leer, zu allgemein oder nicht aussagekräftig. Beispiel: "Kontakt – ReguKit" statt "Untitled Document"',
      fix: 'Eindeutige, beschreibende Titel für alle Seiten hinzufügen'
    },
    'WCAG2AA.Principle2.Guideline2_4.2_4_4.H77': {
      title: 'Unbrauchbare Linktexte',
      description: 'Links mit Texten wie "Hier klicken", "Mehr" oder "Link" sind nicht aussagekräftig für Screenreader',
      fix: '"Hier klicken" durch beschreibende Texte ersetzen: "Produktdetails anzeigen"'
    },
    'WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail': {
      title: 'Kontrast zu niedrig',
      description: 'Text- und Hintergrundfarben haben weniger als 4,5:1 Kontrast (3:1 für große Schrift)',
      fix: 'Farben anpassen für bessere Lesbarkeit - Tools: WebAIM Contrast Checker'
    },
    'WCAG2AA.Principle4.Guideline4_1.4_1_1.F77': {
      title: 'Doppelte IDs gefunden',
      description: 'Mehrere HTML-Elemente haben die gleiche ID. Das verwirrt Screenreader und JavaScript',
      fix: 'Jede ID nur einmal pro Seite verwenden'
    },
    'WCAG2AA.Principle3.Guideline3_2.3_2_2.H32.2': {
      title: 'Formulare ohne Submit-Button',
      description: 'Formulare haben keinen Absende-Button. Nutzer ohne Maus können diese nicht verwenden',
      fix: '<button type="submit"> oder <input type="submit"> zu Formularen hinzufügen'
    },
    'WCAG2AA.Principle1.Guideline1_1.1_1_1.H67.1': {
      title: 'Problematische Bild-Attribute',
      description: 'Bilder mit leerem alt="" haben trotzdem einen title-Text. Das verwirrt Screenreader',
      fix: 'Entweder title entfernen oder aussagekräftigen alt-Text hinzufügen'
    },
    'WCAG2AA.Principle2.Guideline2_4.2_4_7.G149': {
      title: 'Fokus nicht sichtbar',
      description: 'Keyboard-Navigation zeigt nicht klar, welches Element gerade aktiv ist',
      fix: 'CSS focus-styles hinzufügen: :focus { outline: 2px solid #0066cc; }'
    },
    'WCAG2AA.Principle1.Guideline1_3.1_3_1_A.G141': {
      title: 'Falsche Überschriften-Struktur',
      description: 'Überschriften-Hierarchie ist nicht logisch (z.B. H5 nach H2)',
      fix: 'Überschriften in logischer Reihenfolge: H1 → H2 → H3 → H4...'
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
        selector: issue.selector || null,
        isPriority: 'low'
      };
      
      // Priorität bestimmen
      if (criticalPatterns.some(pattern => key.includes(pattern))) {
        grouped[key].isPriority = 'critical';
      } else if (warningPatterns.some(pattern => key.includes(pattern))) {
        grouped[key].isPriority = 'warning';
      }
      
      // Deutsche Übersetzung hinzufügen
      if (translations[key]) {
        grouped[key].translation = translations[key];
      }
    }
    
    grouped[key].count++;
    if (issue.message) {
      grouped[key].messages.add(issue.message.trim());
    }
  }

  // In Array umwandeln und sortieren
  return Object.values(grouped)
    .map(g => ({
      ...g,
      messages: Array.from(g.messages)
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

// Widget (bleibt gleich wie bei CrapGPT, funktioniert ja)
app.get('/embed.js', (_req, res) => {
  res.type('application/javascript').send(`(function(){
    const SCRIPT = document.currentScript;
    const ENDPOINT = (SCRIPT && SCRIPT.dataset && SCRIPT.dataset.endpoint) || '/api/a11y-check';
    function h(t,a,c){const e=document.createElement(t);if(a)Object.entries(a).forEach(([k,v])=>{if(k==='style'&&typeof v==='object')Object.assign(e.style,v);else e.setAttribute(k,v)});(c||[]).forEach(ch=>e.appendChild(typeof ch==='string'?document.createTextNode(ch):ch));return e;}
    function render(container){
      container.innerHTML='';
      const wrap=h('div',{style:{fontFamily:'system-ui,sans-serif',maxWidth:'720px',border:'1px solid #eee',borderRadius:'12px',padding:'16px',boxShadow:'0 2px 10px rgba(0,0,0,0.04)'}});
      const title=h('div',{style:{fontWeight:'700',fontSize:'18px',marginBottom:'8px'}},['Barrierefreiheits-Check (WCAG 2.1 AA)']);
      const form=h('form',{style:{display:'flex',gap:'8px',marginBottom:'12px'}});
      const input=h('input',{type:'url',placeholder:'https://example.com',required:'required',style:{flex:'1',padding:'10px',border:'1px solid #ddd',borderRadius:'8px'}});
      const btn=h('button',{type:'submit',style:{padding:'10px 14px',border:'1px solid #ddd',borderRadius:'8px',cursor:'pointer',background:'white'}},['Prüfen']);
      const result=h('div',{style:{marginTop:'12px'}});
      form.addEventListener('submit',async e=>{
        e.preventDefault();
        result.innerHTML='';
        const url=input.value.trim();
        result.appendChild(h('div',{style:{fontSize:'14px'}},['Analysiere…']));
        try{
          const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});
          const data=await res.json();
          if(!res.ok || !data.success) throw new Error(data && data.error || 'Fehler');
          result.innerHTML='';
          // VERBESSERTE ANZEIGE:
          result.appendChild(h('div',{style:{padding:'12px',background:data.score>=70?'#dcfce7':'#fef2f2',border:'1px solid '+(data.score>=70?'#16a34a':'#dc2626'),borderRadius:'8px'}}, [
            'Score: '+data.score+'/100 • Note: '+data.grade+' • '+data.assessment,
            h('br'),
            'Kritische Probleme: '+data.summary.criticalCount+' • Warnungen: '+data.summary.warningCount
          ]));
        }catch(err){
          result.innerHTML='';
          result.appendChild(h('div',{style:{color:'#e74c3c',fontSize:'14px'}},['Fehler: ',err.message]));
        }
      });
      form.appendChild(input);form.appendChild(btn);
      wrap.appendChild(title);wrap.appendChild(form);wrap.appendChild(result);
      container.appendChild(wrap);
    }
    (function(){let m=document.getElementById('regukit-a11y');if(!m){m=document.createElement('div');m.id='regukit-a11y';(SCRIPT&&SCRIPT.parentNode?SCRIPT.parentNode.insertBefore(m,SCRIPT):document.body.appendChild(m));}render(m);})();
  })();`);
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
