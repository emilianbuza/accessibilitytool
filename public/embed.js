(function(){
  'use strict';

  const SCRIPT = document.currentScript;
  const ENDPOINT = (SCRIPT && SCRIPT.dataset && SCRIPT.dataset.endpoint) || '/api/a11y-check';

  // ---------- Helpers ----------
  function el(tag, opts={}, children=[]){
    const n = document.createElement(tag);
    const { style={}, attrs={}, type, placeholder, required, textContent } = opts;
    if (type) n.type = type;
    if (placeholder) n.placeholder = placeholder;
    if (required) n.required = true;
    if (textContent != null) n.textContent = textContent;
    if (attrs) Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k]));
    Object.assign(n.style, style);
    (children||[]).forEach(c => n.appendChild(typeof c==='string' ? document.createTextNode(c) : c));
    return n;
  }
  const setText = (node, v) => { node.textContent = v == null ? '' : String(v); return node; };

  // ---------- Loading Overlay ----------
  let overlay;
  function ensureOverlay(){
    if (overlay) return overlay;
    overlay = el('div', {
      attrs:{ role:'dialog', 'aria-modal':'true', 'aria-label':'Analyse läuft' },
      style:{
        position:'fixed', inset:'0', background:'rgba(17,24,39,0.45)',
        display:'none', alignItems:'center', justifyContent:'center',
        zIndex:'2147483647', backdropFilter:'blur(1px)'
      }
    });
    const card = el('div', { style:{
      background:'#fff', borderRadius:'12px', padding:'18px 22px',
      boxShadow:'0 10px 25px rgba(0,0,0,0.15)', display:'flex', gap:'12px', alignItems:'center'
    }});
    const spin = el('div', { style:{ width:'28px', height:'28px' }});
    spin.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="#E5E7EB" stroke-width="4" fill="none"></circle><path d="M22 12a10 10 0 0 0-10-10" stroke="#3B82F6" stroke-width="4" stroke-linecap="round" fill="none"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite"/></path></svg>';
    const txtBox = el('div', { attrs:{ 'aria-live':'polite', role:'status' }}, [
      el('div', { style:{ fontWeight:'700', color:'#111827', marginBottom:'2px' }}, ['Wird geprüft …']),
      el('div', { style:{ fontSize:'12px', color:'#6B7280' }}, ['(kann 5–60 Sekunden dauern)'])
    ]);
    card.appendChild(spin); card.appendChild(txtBox);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    return overlay;
  }
  function showLoading(){ const o=ensureOverlay(); o.style.display='flex'; const c=o.firstChild; if (c) { c.tabIndex=-1; c.focus({preventScroll:true}); } }
  function hideLoading(){ if (overlay) overlay.style.display='none'; }

  // ---------- Mount ----------
  function mountRoot(){
    const existing = document.getElementById('regukit-a11y');
    if (existing) return existing;
    const host = el('div', { attrs:{ id:'regukit-a11y' }, style:{ maxWidth:'900px', margin:'20px auto' }});
    document.body.appendChild(host);
    return host;
  }

  // ---------- API ----------
  async function runAudit(url){
    const r = await fetch(ENDPOINT, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ url })
    });
    if (!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }

  // ---------- UI ----------
  function renderForm(container){
    const box = el('div', { style:{
      fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
      border:'2px solid #e5e7eb', borderRadius:'12px', padding:'16px',
      background:'#fff', boxShadow:'0 4px 6px rgba(0,0,0,0.05)'
    }});
    const h = el('h3', { style:{ margin:'0 0 12px 0', fontSize:'18px', color:'#111827' }}, ['🔍 Barrierefreiheits-Check (WCAG 2.1 AA)']);
    const row = el('div', { style:{ display:'flex', gap:'8px', flexWrap:'wrap' }});
    const input = el('input', { type:'url', placeholder:'https://example.com', required:true, style:{ flex:'1', minWidth:'260px', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:'8px', fontSize:'14px' }});
    const btn = el('button', { attrs:{ type:'button' }, style:{ padding:'10px 14px', border:'0', borderRadius:'8px', cursor:'pointer', fontWeight:'600', color:'#fff', background:'#3b82f6' }}, ['Prüfen']);
    const status = el('div', { style:{ marginTop:'8px', fontSize:'12px', color:'#6b7280' }});
    const results = el('div', { style:{ marginTop:'16px' }});

    btn.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) { setText(status, 'Bitte eine gültige URL eingeben.'); input.focus(); return; }
      results.innerHTML = ''; setText(status, '');
      showLoading();
      try {
        const data = await runAudit(url);
        renderResults(results, data);
      } catch(e){
        setText(status, 'Fehler: ' + (e.message || e)); status.style.color = '#dc2626';
      } finally {
        hideLoading();
      }
    });

    row.appendChild(input); row.appendChild(btn);
    box.appendChild(h); box.appendChild(row); box.appendChild(status); box.appendChild(results);
    container.appendChild(box);
  }

  function renderResults(container, data){
    const scoreColor = data.score >= 90 ? '#059669' : data.score >= 70 ? '#eab308' : data.score >= 50 ? '#f59e0b' : '#dc2626';

    // Hauptscore mit besserem Design
    const scoreCard = el('div', {
      style: {
        background: `linear-gradient(135deg, ${scoreColor}15, ${scoreColor}08)`,
        border: `2px solid ${scoreColor}30`,
        borderRadius: '16px',
        padding: '24px',
        textAlign: 'center',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden'
      }
    });

    // Score Nummer mit Animation
    const scoreNum = el('div', {
      style: {
        fontSize: '3.5rem',
        fontWeight: '800',
        color: scoreColor,
        marginBottom: '8px',
        textShadow: `0 2px 4px ${scoreColor}20`
      }
    }, [`${data.score}/100`]);

    const gradeRow = el('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }
    });

    gradeRow.appendChild(el('span', {
      style: {
        fontSize: '1.5rem',
        fontWeight: '700',
        background: scoreColor,
        color: '#fff',
        padding: '6px 16px',
        borderRadius: '20px',
        boxShadow: `0 4px 12px ${scoreColor}40`
      }
    }, [`Note: ${data.grade || '–'}`]));

    const assessment = el('div', {
      style: {
        fontSize: '1rem',
        color: '#4b5563',
        fontWeight: '500',
        background: 'rgba(255,255,255,0.8)',
        padding: '8px 16px',
        borderRadius: '8px',
        display: 'inline-block'
      }
    }, [data.assessment || '']);

    scoreCard.appendChild(scoreNum);
    scoreCard.appendChild(gradeRow);
    scoreCard.appendChild(assessment);

    // Verbesserte Statistiken mit Icons
    const statsGrid = el('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }
    });

    const stats = [
      { 
        icon: '🚨', 
        label: 'Kritisch', 
        value: data.summary?.criticalCount ?? data.counts?.errors ?? 0, 
        color: '#dc2626',
        bg: '#fef2f2'
      },
      { 
        icon: '⚠️', 
        label: 'Warnungen', 
        value: data.summary?.warningCount ?? data.counts?.warnings ?? 0, 
        color: '#f59e0b',
        bg: '#fffbeb'
      },
      { 
        icon: '📊', 
        label: 'Gesamt', 
        value: data.summary?.total ?? (data.meta?.totalIssuesFound ?? 0), 
        color: '#6b7280',
        bg: '#f9fafb'
      }
    ];

    stats.forEach(stat => {
      const card = el('div', {
        style: {
          background: stat.bg,
          border: `2px solid ${stat.color}20`,
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          cursor: 'default'
        }
      });

      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = `0 8px 20px ${stat.color}20`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
      });

      const iconDiv = el('div', { style: { fontSize: '1.5rem', marginBottom: '8px' }}, [stat.icon]);
      const valueDiv = el('div', {
        style: {
          fontSize: '2rem',
          fontWeight: '800',
          color: stat.color,
          marginBottom: '4px'
        }
      }, [String(stat.value)]);
      const labelDiv = el('div', {
        style: {
          fontSize: '0.875rem',
          color: stat.color,
          fontWeight: '600',
          opacity: '0.8'
        }
      }, [stat.label]);

      card.appendChild(iconDiv);
      card.appendChild(valueDiv);
      card.appendChild(labelDiv);
      statsGrid.appendChild(card);
    });

    container.appendChild(scoreCard);
    container.appendChild(statsGrid);

    // Verbesserte kritische Probleme Sektion
    const topCritical = Array.isArray(data.summary?.topCritical) ? data.summary.topCritical : [];
    if (topCritical.length) {
      const criticalCard = el('div', {
        style: {
          background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
          border: '2px solid #fecaca',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px',
          position: 'relative'
        }
      });

      const header = el('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
          fontSize: '1.1rem',
          fontWeight: '700',
          color: '#991b1b'
        }
      }, ['🚨 Dringend zu beheben']);

      criticalCard.appendChild(header);

      topCritical.forEach((issue, index) => {
        const issueRow = el('div', {
          style: {
            background: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: index < topCritical.length - 1 ? '12px' : '0',
            border: '1px solid rgba(220, 38, 38, 0.1)',
            transition: 'transform 0.2s ease'
          }
        });

        issueRow.addEventListener('mouseenter', () => {
          issueRow.style.transform = 'scale(1.02)';
        });

        issueRow.addEventListener('mouseleave', () => {
          issueRow.style.transform = 'scale(1)';
        });

        const titleRow = el('div', {
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }
        });

        const title = el('span', {
          style: { fontWeight: '600', color: '#1f2937', fontSize: '0.95rem' }
        }, [issue.title || '']);

        const badge = el('span', {
          style: {
            background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '700',
            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)'
          }
        }, [`${issue.count || 0}x`]);

        titleRow.appendChild(title);
        titleRow.appendChild(badge);

        const fix = el('div', {
          style: {
            background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            marginTop: '8px'
          }
        }, [`💡 ${issue.fix || 'Siehe WCAG-Richtlinien'}`]);

        issueRow.appendChild(titleRow);
        if (issue.fix) issueRow.appendChild(fix);
        criticalCard.appendChild(issueRow);
      });

      container.appendChild(criticalCard);
    }

    // Verbesserte Quick Wins
    const quickWins = Array.isArray(data.summary?.quickWins) ? data.summary.quickWins : [];
    if (quickWins.length) {
      const quickCard = el('div', {
        style: {
          background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
          border: '2px solid #a7f3d0',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px'
        }
      });

      const quickHeader = el('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          fontSize: '1.1rem',
          fontWeight: '700',
          color: '#065f46'
        }
      }, ['🎯 Schnell behebbar']);

      const quickList = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' }});

      quickWins.forEach(win => {
        const item = el('div', {
          style: {
            background: 'rgba(255, 255, 255, 0.8)',
            padding: '10px 16px',
            borderRadius: '8px',
            color: '#047857',
            fontWeight: '500',
            fontSize: '0.9rem',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }
        });

        const checkIcon = el('span', { style: { color: '#10b981', fontWeight: '700' }}, ['✓']);
        const text = el('span', {}, [win]);

        item.appendChild(checkIcon);
        item.appendChild(text);
        quickList.appendChild(item);
      });

      quickCard.appendChild(quickHeader);
      quickCard.appendChild(quickList);
      container.appendChild(quickCard);
    }

    // Detaillierte Issues (falls vorhanden)
    if (Array.isArray(data.issues) && data.issues.length) {
      renderDetails(container, data.issues);
    }
  }

  // ---------- Details (Tabs) ----------
  function renderDetails(container, issues) {
    const detailsBtn = el('button', {
      attrs: { type: 'button', 'aria-expanded': 'false' },
      style: {
        width: '100%',
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        color: '#fff',
        border: 'none',
        borderRadius: '12px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        marginTop: '20px',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }
    });

    const btnIcon = el('span', { style: { fontSize: '1.2rem' }}, ['🔍']);
    const btnText = el('span', {}, ['Alle Details anzeigen']);

    detailsBtn.appendChild(btnIcon);
    detailsBtn.appendChild(btnText);

    detailsBtn.addEventListener('mouseenter', () => {
      detailsBtn.style.transform = 'translateY(-2px)';
      detailsBtn.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
    });

    detailsBtn.addEventListener('mouseleave', () => {
      detailsBtn.style.transform = 'translateY(0)';
      detailsBtn.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
    });

    const detailsContainer = el('div', {
      style: {
        display: 'none',
        marginTop: '16px',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(0, 0, 0, 0.1)'
      }
    });

    const id = 'a11y-details-' + Math.random().toString(36).slice(2);
    detailsContainer.id = id;
    detailsBtn.setAttribute('aria-controls', id);

    let isOpen = false;
    detailsBtn.addEventListener('click', () => {
      isOpen = !isOpen;
      detailsContainer.style.display = isOpen ? 'block' : 'none';
      btnText.textContent = isOpen ? 'Details ausblenden' : 'Alle Details anzeigen';
      btnIcon.textContent = isOpen ? '❌' : '🔍';
      detailsBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

      if (isOpen && !detailsContainer.hasChildNodes()) {
        buildImprovedTabs(detailsContainer, issues);
      }
    });

    container.appendChild(detailsBtn);
    container.appendChild(detailsContainer);
  }

  function buildImprovedTabs(container, issues) {
    const critical = issues.filter(i => i.isPriority === 'critical');
    const warning = issues.filter(i => i.isPriority === 'warning');
    const low = issues.filter(i => i.isPriority === 'low');

    const tabs = [
      { id: 'critical', label: 'Kritisch', icon: '🚨', color: '#dc2626', issues: critical },
      { id: 'warning', label: 'Warnungen', icon: '⚠️', color: '#f59e0b', issues: warning },
      { id: 'low', label: 'Hinweise', icon: '💡', color: '#6b7280', issues: low }
    ].filter(t => t.issues.length);

    if (!tabs.length) return;

    let activeTab = tabs[0].id;
    const tabButtons = {};
    const tabPanels = {};

    // Tab-Navigation
    const tabNav = el('div', {
      attrs: { role: 'tablist', 'aria-label': 'A11y-Ergebnis-Tabs' },
      style: {
        display: 'flex',
        background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
        borderBottom: '2px solid #e2e8f0'
      }
    });

    function activateTab(tabId) {
      activeTab = tabId;
      tabs.forEach(tab => {
        const btn = tabButtons[tab.id];
        const panel = tabPanels[tab.id];
        if (!btn || !panel) return;

        const isActive = tab.id === tabId;
        btn.setAttribute('aria-selected', String(isActive));
        btn.setAttribute('tabindex', isActive ? '0' : '-1');
        btn.style.background = isActive ? '#fff' : 'transparent';
        btn.style.borderBottom = isActive ? `3px solid ${tab.color}` : '3px solid transparent';
        btn.style.color = isActive ? tab.color : '#6b7280';
        btn.style.fontWeight = isActive ? '700' : '600';
        panel.style.display = isActive ? 'block' : 'none';
      });
    }

    tabs.forEach(tab => {
      const btn = el('button', {
        attrs: {
          role: 'tab',
          id: `tab-${tab.id}`,
          'aria-selected': String(tab.id === activeTab),
          'aria-controls': `panel-${tab.id}`,
          tabindex: tab.id === activeTab ? '0' : '-1'
        },
        style: {
          flex: '1',
          padding: '16px 20px',
          border: 'none',
          background: tab.id === activeTab ? '#fff' : 'transparent',
          borderBottom: tab.id === activeTab ? `3px solid ${tab.color}` : '3px solid transparent',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: tab.id === activeTab ? '700' : '600',
          color: tab.id === activeTab ? tab.color : '#6b7280',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }
      });

      const icon = el('span', { style: { fontSize: '1.1rem' }}, [tab.icon]);
      const text = el('span', {}, [`${tab.label} (${tab.issues.length})`]);

      btn.appendChild(icon);
      btn.appendChild(text);
      btn.addEventListener('click', () => activateTab(tab.id));

      tabButtons[tab.id] = btn;
      tabNav.appendChild(btn);
    });

    // Tab-Inhalte
    const tabContent = el('div', { style: { background: '#fff' }});

    tabs.forEach(tab => {
      const panel = el('div', {
        attrs: {
          role: 'tabpanel',
          id: `panel-${tab.id}`,
          'aria-labelledby': `tab-${tab.id}`
        },
        style: {
          display: tab.id === activeTab ? 'block' : 'none',
          maxHeight: '500px',
          overflowY: 'auto'
        }
      });

      renderTabContent(panel, tab.issues, tab.color);
      tabPanels[tab.id] = panel;
      tabContent.appendChild(panel);
    });

    container.appendChild(tabNav);
    container.appendChild(tabContent);
  }

  // Verbesserte Tab-Inhalte
  function renderTabContent(panel, issues, color) {
    issues.forEach((issue, index) => {
      const issueCard = el('div', {
        style: {
          padding: '20px',
          borderBottom: index < issues.length - 1 ? '1px solid #f3f4f6' : 'none',
          transition: 'background 0.2s ease'
        }
      });

      issueCard.addEventListener('mouseenter', () => {
        issueCard.style.background = '#f9fafb';
      });

      issueCard.addEventListener('mouseleave', () => {
        issueCard.style.background = 'transparent';
      });

      // Titel mit Badge
      const titleRow = el('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }
      });

      const title = el('h4', {
        style: {
          margin: '0',
          fontSize: '1.1rem',
          fontWeight: '700',
          color: '#1f2937',
          flex: '1',
          marginRight: '12px'
        }
      }, [issue.translation?.title || issue.code.replace(/^WCAG2AA\./, '')]);

      const badge = el('span', {
        style: {
          background: `linear-gradient(135deg, ${color}, ${color}dd)`,
          color: '#fff',
          padding: '6px 12px',
          borderRadius: '16px',
          fontSize: '0.8rem',
          fontWeight: '700',
          boxShadow: `0 2px 6px ${color}40`,
          whiteSpace: 'nowrap'
        }
      }, [`${issue.count || 0}x`]);

      titleRow.appendChild(title);
      titleRow.appendChild(badge);

      // Priorität und Typ
      const metaRow = el('div', {
        style: {
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          fontSize: '0.8rem',
          color: '#6b7280'
        }
      });

      const priorityBadge = el('span', {
        style: {
          background: `${color}20`,
          color: color,
          padding: '2px 8px',
          borderRadius: '8px',
          fontWeight: '600',
          textTransform: 'uppercase',
          fontSize: '0.75rem'
        }
      }, [issue.isPriority || '']);

      const typeBadge = el('span', {
        style: {
          background: '#f3f4f6',
          color: '#4b5563',
          padding: '2px 8px',
          borderRadius: '8px',
          fontWeight: '500',
          fontSize: '0.75rem'
        }
      }, [issue.type || '']);

      metaRow.appendChild(priorityBadge);
      metaRow.appendChild(typeBadge);

      // Beschreibung
      const description = el('p', {
        style: {
          margin: '0 0 12px 0',
          color: '#4b5563',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }
      }, [issue.translation?.description || 'Keine Beschreibung verfügbar']);

      // Lösungsvorschlag
      const fixBox = el('div', {
        style: {
          background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
          border: '1px solid #bae6fd',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '12px'
        }
      });

      const fixText = el('div', {
        style: {
          color: '#0369a1',
          fontSize: '0.9rem',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px'
        }
      });

      const lightbulb = el('span', { style: { fontSize: '1.1rem', flexShrink: '0' }}, ['💡']);
      const fix = el('span', {}, [issue.translation?.fix || 'Siehe WCAG-Richtlinien']);

      fixText.appendChild(lightbulb);
      fixText.appendChild(fix);
      fixBox.appendChild(fixText);

      // Betroffene Elemente (falls vorhanden)
      if (Array.isArray(issue.samples) && issue.samples.length) {
        const samplesBox = el('div', {
          style: {
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '0.85rem'
          }
        });

        const samplesTitle = el('div', {
          style: {
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }
        }, ['📍 Betroffene Elemente:']);

        const samplesList = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' }});

        const uniqueSamples = [...new Set(issue.samples)].slice(0, 5);
        uniqueSamples.forEach(sample => {
          const prettySample = sample
            .replace(/^html\s*>\s*body\s*>\s*/i, '')
            .replace(/\s*>\s*/g, ' › ')
            .replace(/:nth-child\(\d+\)/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();

          const sampleItem = el('code', {
            style: {
              background: '#fff',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid #e5e7eb',
              fontSize: '0.8rem',
              color: '#1f2937',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }
          }, [prettySample || sample]);

          samplesList.appendChild(sampleItem);
        });

        samplesBox.appendChild(samplesTitle);
        samplesBox.appendChild(samplesList);
        issueCard.appendChild(samplesBox);
      }

      issueCard.appendChild(titleRow);
      issueCard.appendChild(metaRow);
      issueCard.appendChild(description);
      issueCard.appendChild(fixBox);

      panel.appendChild(issueCard);
    });
  }

  // ---------- Boot ----------
  function init(){ ensureOverlay(); const root = mountRoot(); root.innerHTML=''; renderForm(root); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
