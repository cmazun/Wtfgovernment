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
  let factIndex = 0;
  let factItems = [];
  function buildFacts() {
    const rows = annual.filter(r => !r.partial && Number(r.outlays) > 0)
      .sort((a,b) => Number(b.year)-Number(a.year));
    if (!rows.length) return [];
    const r=rows[0],spent=Number(r.outlays),collected=Number(r.receipts),year=r.year;
    const seconds=365.25*86400;
    const list=[
      {category:'While you sleep',title:'Eight hours of federal spending',value:money(spent/seconds*8*3600),detail:'An eight-hour illustration at FY '+year+' average outlays. Not a live reading.'},
      {category:'In one minute',title:'The 60-second receipt',value:money(spent/seconds*60),detail:'One minute at FY '+year+' average spending.'},
      {category:'In one hour',title:'One hour on the federal clock',value:money(spent/seconds*3600),detail:'One hour at FY '+year+' average spending.'},
      {category:'A single day',title:'24 hours of federal outlays',value:money(spent/365.25),detail:'Average daily spending during FY '+year+'.'},
      {category:'Put it in perspective',title:'Days to spend $1 trillion',value:(1e12/(spent/365.25)).toFixed(1)+' days',detail:'At FY '+year+' average federal outlays.'}
    ];
    if(collected>0){
      list.push({category:'Revenue vs. spending',title:'Spent for every $1 collected',value:'$'+(spent/collected).toFixed(2),detail:'FY '+year+' outlays divided by receipts.'});
      if(spent>collected)list.push({category:'The gap',title:'Daily spending beyond receipts',value:money((spent-collected)/365.25),detail:'Average daily FY '+year+' deficit, not daily borrowing transactions.'});
    }
    if(rows.length>1){
      const first=rows[rows.length-1];
      if(Number(first.outlays)>0)list.push({category:'Then vs. now',title:'Spending growth since FY '+first.year,value:((spent/Number(first.outlays)-1)*100).toFixed(1)+'%',detail:'Nominal outlays; not adjusted for inflation.'});
    }
    return list;
  }
  function showFacts(){
    const host=byId('spFacts'),counter=byId('spFactCounter'),prev=byId('spPrevFacts'),next=byId('spMoreFacts');
    host.replaceChildren();
    factItems=buildFacts();
    if(!factItems.length){host.append(element('p','small','Waiting for published Treasury figures.'));if(counter)counter.textContent='';return}
    factIndex=((factIndex%factItems.length)+factItems.length)%factItems.length;
    const fact=factItems[factIndex];
    const card=element('article','sp-fact sp-fact-feature','');
    card.append(element('span','sp-fact-eyebrow',fact.category),element('strong','',fact.title),element('b','',fact.value),element('p','',fact.detail));
    const bar=element('div','sp-fact-progress','');
    for(let i=0;i<factItems.length;i++){
      const dot=element('span',i===factIndex?'is-current':'','');
      bar.append(dot);
    }
    card.append(bar);host.append(card);
    if(counter)counter.textContent=(factIndex+1)+' of '+factItems.length;
    if(prev)prev.disabled=factItems.length<2;
    if(next)next.disabled=factItems.length<2;
  }
  window.addEventListener('treasury-annual-data',event=>{
    annual=Array.isArray(event.detail)?event.detail:[];
    factIndex=0;showFacts();
  });
  byId('spMoreFacts').addEventListener('click',()=>{factIndex++;showFacts()});
  const previous=byId('spPrevFacts');
  if(previous)previous.addEventListener('click',()=>{factIndex--;showFacts()});
  const random=byId('spRandomFact');
  if(random)random.addEventListener('click',()=>{if(factItems.length>1){const offset=1+Math.floor(Math.random()*(factItems.length-1));factIndex+=offset;showFacts()}});

})();
