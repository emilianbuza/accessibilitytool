/**
 * ReguKit A11y Check Widget
 * Node + Express + pa11y
 *
 * Features
 * - POST /api/a11y-check { url } -> runs pa11y (WCAG2AA) and returns a score, grade, counts, and issues grouped by rule
 * - GET  /embed.js -> drops a tiny widget you can embed on any page via <script>…</script>
 * - CORS enabled so you can host API on regukit.com and embed widget anywhere on your site
 *
 * Usage
 *   1) Save as server.js (or a11y-widget.js)
 *   2) npm init -y
 *      npm i express cors pa11y
 *   3) node server.js
 *   4) Embed on any page:
 *      <script src="https://YOUR_DOMAIN/embed.js" data-endpoint="https://YOUR_DOMAIN/api/a11y-check"></script>
 */

const express = require('express');
const cors = require('cors');
const pa11y = require('pa11y');

const app = express();
const PORT = process.env.PORT || 3040;

app.use(express.json({ limit: '1mb' }));
app.use(cors());

// --- Utils ---
const isValidUrl = (str) => {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

function scoreFromCounts({ errors, warnings, notices }) {
  // Lightweight scoring heuristic – tune as you like
  // Errors weigh most, warnings some, notices a little.
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
    if (!groups[key]) groups[key] = { code: key, type: i.type, typeCode: i.typeCode, count: 0, messages: new Set(), selectors: [] };
    groups[key].count++;
    if (i.message) groups[key].messages.add(i.message.trim());
    if (i.selector) groups[key].selectors.push(i.selector);
  }
  // Convert Set to array and sort by severity then count
  const order = { error: 0, warning: 1, notice: 2 };
  const arr = Object.values(groups).map(g => ({ ...g, messages: Array.from(g.messages) }));
  arr.sort((a, b) => (order[a.type] - order[b.type]) || (b.count - a.count));
  return arr;
}

// --- API: run pa11y ---
app.post('/api/a11y-check', async (req, res) => {
  const { url } = req.body || {};
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Bitte eine gültige URL mit http(s) angeben.' });
  }
  try {
    const results = await pa11y(url, {
      standard: 'WCAG2AA',
      // You can tweak these flags as needed
      includeNotices: true,
      includeWarnings: true,
      timeout: 60000,
      wait: 500, // allow initial async content to render
      // chromeLaunchConfig: { args: ['--no-sandbox'] },
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
    console.error('pa11y error:', err.message);
    res.status(500).json({ error: 'Analyse fehlgeschlagen. Die Site blockiert evtl. Bots/CORS oder ist nicht erreichbar.' });
  }
});

// --- Embeddable widget JS ---
app.get('/embed.js', (_req, res) => {
  res.type('application/javascript').send(`(function(){
    const SCRIPT = document.currentScript;
    const ENDPOINT = (SCRIPT && SCRIPT.dataset && SCRIPT.dataset.endpoint) || '/api/a11y-check';

    function h(tag, attrs, children){
      const el = document.createElement(tag);
      if (attrs) Object.entries(attrs).forEach(([k,v])=>{
        if (k === 'style' && typeof v === 'object') Object.assign(el.style, v); else el.setAttribute(k, v);
      });
      (children||[]).forEach(c => el.appendChild(typeof c==='string' ? document.createTextNode(c) : c));
      return el;
    }

    function render(container){
      container.innerHTML='';
      const wrap = h('div', { class: 'regukit-a11y-widget', style: { fontFamily: 'system-ui, sans-serif', maxWidth: '720px', border: '1px solid #eee', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)'} });
      const title = h('div', { style: { fontWeight: '700', fontSize: '18px', marginBottom: '8px' } }, ['Barrierefreiheits-Check (WCAG 2.1 AA)']);
      const form = h('form', { style: { display: 'flex', gap: '8px', marginBottom: '12px' } });
      const input = h('input', { type: 'url', placeholder: 'https://example.com', required: 'required', style: { flex: '1', padding: '10px', border: '1px solid #ddd', borderRadius: '8px' } });
      const btn = h('button', { type: 'submit', style: { padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', background: 'white' } }, ['Prüfen']);
      const small = h('div', { style: { fontSize: '12px', color: '#666', marginTop: '4px' } }, ['Hinweis: Externe Seiten können Prüfungen blockieren.']);
      const result = h('div', { style: { marginTop: '12px' } });

      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        result.innerHTML = '';
        const url = input.value.trim();
        const spinner = h('div', { style: { fontSize: '14px' } }, ['Analysiere…']);
        result.appendChild(spinner);
        try {
          const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data && data.error || 'Fehler');

          const barWrap = h('div', { style: { margin: '8px 0 4px' } });
          const barBg = h('div', { style: { height: '12px', background: '#f2f2f2', borderRadius: '6px', overflow: 'hidden' } });
          const bar = h('div', { style: { width: data.score + '%', height: '100%', background: data.score>=90?'#2ecc71':data.score>=70?'#f1c40f':'#e74c3c' } });
          barBg.appendChild(bar); barWrap.appendChild(barBg);

          const meta = h('div', { style: { display: 'flex', gap: '12px', fontSize: '14px', marginTop: '6px', flexWrap: 'wrap' } }, [
            h('div', null, ['Score: ', String(data.score)]),
            h('div', null, ['Grade: ', String(data.grade)]),
            h('div', null, ['Fehler: ', String(data.counts.errors)]),
            h('div', null, ['Warnungen: ', String(data.counts.warnings)]),
            h('div', null, ['Hinweise: ', String(data.counts.notices)]),
          ]);

          const listTitle = h('div', { style: { fontWeight: '600', marginTop: '10px' } }, ['Top-Baustellen (gruppiert nach Regel)']);
          const list = h('div', { style: { fontSize: '14px' } });
          data.issues.slice(0, 10).forEach(g=>{
            const item = h('div', { style: { padding: '8px 0', borderBottom: '1px solid #f2f2f2' } });
            item.appendChild(h('div', { style: { fontWeight: '600' } }, [g.type.toUpperCase(), ' • ', g.code, ' (', String(g.count), ')']));
            g.messages.slice(0,2).forEach(m=> item.appendChild(h('div', { style: { color: '#333' } }, [m])));
            list.appendChild(item);
          });

          result.innerHTML = '';
          result.appendChild(barWrap);
          result.appendChild(meta);
          result.appendChild(listTitle);
          result.appendChild(list);
        } catch (err) {
          result.innerHTML = '';
          result.appendChild(h('div', { style: { color: '#e74c3c', fontSize: '14px' } }, ['Fehler: ', err.message]));
        }
      });

      form.appendChild(input); form.appendChild(btn);
      wrap.appendChild(title);
      wrap.appendChild(form);
      wrap.appendChild(small);
      wrap.appendChild(result);
      container.appendChild(wrap);
    }

    // Mount point: <div id="regukit-a11y"></div> OR auto-create one below the script
    (function(){
      let mount = document.getElementById('regukit-a11y');
      if (!mount) {
        mount = document.createElement('div');
        mount.id = 'regukit-a11y';
        (SCRIPT && SCRIPT.parentNode ? SCRIPT.parentNode.insertBefore(mount, SCRIPT) : document.body.appendChild(mount));
      }
      render(mount);
    })();
  })();`);
});

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
