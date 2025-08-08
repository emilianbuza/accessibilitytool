const express = require('express');
const cors = require('cors');
const pa11y = require('pa11y');

const app = express();
const PORT = process.env.PORT || 3040;

app.use(express.json({ limit: '1mb' }));
app.use(cors());

// URL prüfen
const isValidUrl = (str) => {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

// Score berechnen
function scoreFromCounts({ errors, warnings, notices }) {
  const penalty = Math.min(100, errors * 4 + warnings * 1 + Math.floor(notices * 0.25));
  const score = Math.max(0, 100 - penalty);
  let grade = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  return { score, grade };
}

function groupIssues(issues) {
  const groups = {};
  for (const i of issues) {
    const key = i.code || 'unknown';
    if (!groups[key]) groups[key] = { code: key, type: i.type, count: 0, messages: new Set() };
    groups[key].count++;
    if (i.message) groups[key].messages.add(i.message.trim());
  }
  const order = { error: 0, warning: 1, notice: 2 };
  return Object.values(groups)
    .map(g => ({ ...g, messages: Array.from(g.messages) }))
    .sort((a, b) => (order[a.type] - order[b.type]) || (b.count - a.count));
}

// API-Endpunkt
app.post('/api/a11y-check', async (req, res) => {
  const { url } = req.body || {};
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Bitte eine gültige URL mit http(s) angeben.' });
  }

  console.log(`[A11Y-CHECK] Starte Analyse für: ${url}`);

  try {
    const results = await pa11y(url, {
      standard: 'WCAG2AA',
      includeNotices: true,
      includeWarnings: true,
      timeout: 90000, // 90 Sekunden
      wait: 1000,
      chromeLaunchConfig: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36'
      }
    });

    const counts = results.issues.reduce((acc, i) => {
      if (i.type === 'error') acc.errors++;
      else if (i.type === 'warning') acc.warnings++;
      else acc.notices++;
      return acc;
    }, { errors: 0, warnings: 0, notices: 0 });

    const { score, grade } = scoreFromCounts(counts);
    const grouped = groupIssues(results.issues);

    res.json({
      url,
      standard: 'WCAG 2.1 AA',
      counts,
      score,
      grade,
      timestamp: new Date().toISOString(),
      issues: grouped,
    });
  } catch (err) {
    console.error('[A11Y-CHECK] Fehler bei Analyse:', err);
    res.status(500).json({ error: 'Analyse fehlgeschlagen: ' + err.message });
  }
});

// Widget
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
          if(!res.ok) throw new Error(data && data.error || 'Fehler');
          result.innerHTML='';
          result.appendChild(h('div',null,['Score: '+data.score+' • Grade: '+data.grade]));
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

// Root-Seite
app.get('/', (_req, res) => {
  res.type('text/html').send(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>ReguKit A11y Check Widget</title></head><body>
  <h1 style="font-family: system-ui, sans-serif;">ReguKit A11y Check Widget – Demo</h1>
  <div id="regukit-a11y"></div>
  <script src="/embed.js" data-endpoint="/api/a11y-check"></script>
  </body></html>`);
});

app.listen(PORT, () => {
  console.log(`ReguKit A11y Check Widget running on http://localhost:${PORT}`);
});

