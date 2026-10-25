/* Federal Spending Search and Spending Facts — isolated from the main dashboard. */
(function () {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const money = (n) => {
    if (!Number.isFinite(n)) return '—';
    const a = Math.abs(n);
    return '$' + (a >= 1e12 ? (n / 1e12).toFixed(2) + 'T' :
      a >= 1e9 ? (n / 1e9).toFixed(1) + 'B' :
      a >= 1e6 ? (n / 1e6).toFixed(1) + 'M' :
      Math.round(n).toLocaleString('en-US'));
  };
  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value == null ? '' : String(value);
    return node;
  }
  let requestId = 0;
  async function searchContracts() {
    const q = byId('spQuery').value.trim();
    const results = byId('spResults');
    const status = byId('spStatus');
    results.replaceChildren();
    if (q.length < 2) {
      status.textContent = 'Enter at least two characters to search.';
      return;
    }
    const id = ++requestId;
    const fy = Number(byId('year').value) || 2026;
    status.textContent = 'Searching USAspending contract records…';
    const body = {
      filters: {
        time_period: [{ start_date: (fy - 1) + '-10-01', end_date: fy + '-09-30' }],
        award_type_codes: ['A', 'B', 'C', 'D'],
        keywords: [q]
      },
      fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Description', 'Awarding Agency'],
      page: 1, limit: 20, sort: 'Award Amount', order: 'desc'
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const payload = await response.json();
      if (id !== requestId) return;
      const rows = Array.isArray(payload.results) ? payload.results : [];
      status.textContent = rows.length + ' matching awards returned · FY ' + fy +
        ' · sorted by reported award amount';
      for (const row of rows) {
        const card = element('article', 'sp-item', '');
        card.append(
          element('strong', '', row['Recipient Name'] || 'Recipient not reported'),
          element('b', '', money(Number(row['Award Amount']))),
          element('p', '', String(row.Description || 'No description supplied').slice(0, 350)),
          element('p', 'sp-meta', String(row['Awarding Agency'] || '') +
            ' · Award ' + String(row['Award ID'] || 'not reported'))
        );
        results.append(card);
      }
      if (!rows.length) results.append(element('p', 'small', 'No matching awards. Try another keyword.'));
    } catch (error) {
      if (id !== requestId) return;
      status.textContent = 'Search unavailable: ' + (error.name === 'AbortError' ? 'Request timed out' : error.message) +
        '. Please try again.';
    } finally {
      clearTimeout(timeout);
    }
  }
  byId('spGo').addEventListener('click', searchContracts);
  byId('spQuery').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') searchContracts();
  });
  let annual = [];
  let factPage = 0;
  function showFacts() {
    const host = byId('spFacts');
    host.replaceChildren();
    const rows = annual.filter((row) => Number.isFinite(Number(row.outlays)) &&
      Number(row.outlays) > 0 && !row.partial)
      .sort((a, b) => Number(b.year) - Number(a.year));
    if (!rows.length) {
      host.append(element('p', 'small', 'Waiting for published Treasury figures.'));
      return;
    }
    const latest = rows[0];
    const outlays = Number(latest.outlays);
    const receipts = Number(latest.receipts);
    const year = latest.year;
    const facts = [
      ['Spending per day', money(outlays / 365.25),
        'FY ' + year + ' federal outlays, averaged over a year.'],
      ['Spending per second', money(outlays / 31557600),
        'FY ' + year + ' federal outlays, averaged over a year.']
    ];
    if (receipts > 0) {
      facts.push(['Spent per $1 collected', '$' + (outlays / receipts).toFixed(2),
        'FY ' + year + ' Treasury outlays divided by federal receipts.']);
      if (outlays > receipts) {
        facts.push(['Average daily deficit', money((outlays - receipts) / 365.25),
          'FY ' + year + ' federal deficit averaged over a year.']);
        facts.push(['Spending not covered by receipts',
          ((outlays - receipts) / outlays * 100).toFixed(1) + '%',
          'FY ' + year + ' deficit as a share of outlays.']);
      }
    }
    if (rows.length > 1 && Number(rows[rows.length - 1].outlays) > 0) {
      const earliest = rows[rows.length - 1];
      facts.push(['Growth since FY ' + earliest.year,
        ((outlays / Number(earliest.outlays) - 1) * 100).toFixed(1) + '%',
        'Change in nominal annual federal outlays through FY ' + year + '.']);
    }
    for (let i = 0; i < Math.min(4, facts.length); i++) {
      const fact = facts[(factPage * 4 + i) % facts.length];
      const card = element('article', 'sp-fact', '');
      card.append(
        element('strong', '', fact[0]),
        element('b', '', fact[1]),
        element('p', '', fact[2])
      );
      host.append(card);
    }
  }
  window.addEventListener('treasury-annual-data', (event) => {
    annual = Array.isArray(event.detail) ? event.detail : [];
    showFacts();
  });
  byId('spMoreFacts').addEventListener('click', () => {
    factPage++;
    showFacts();
  });
})();
