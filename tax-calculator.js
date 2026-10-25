(function(){
'use strict';
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const short=n=>n>=1e12?'$'+(n/1e12).toFixed(2)+'T':n>=1e9?'$'+(n/1e9).toFixed(1)+'B':fmt(n);
const note=$('taxCalcStatus'),input=$('taxAmount'),out=$('taxCalcResults'),year=$('taxCalcYear');
if(!note||!input||!out)return;
let categories=[],dataYear=null;
const create=(tag,cls,value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el};
function render(){
 out.replaceChildren();
 if(!categories.length)return;
 const dollars=Number(input.value);
 if(!Number.isFinite(dollars)||dollars<0){note.textContent='Enter a valid nonnegative amount.';return}
 const sum=categories.reduce((s,x)=>s+x.amount,0);
 note.textContent='Illustrative allocation of '+fmt(dollars)+' using FY '+dataYear+' federal outlays by budget function.';
 const ranked=categories.map(x=>({...x,share:x.amount/sum})).sort((a,b)=>b.amount-a.amount);
 for(const c of ranked){
  const row=create('div','tax-calc-row');
  const header=create('div','tax-calc-row-head');
  header.append(create('span','',c.name),create('strong','',fmt(dollars*c.share)));
  const bar=create('div','tax-calc-track'),fill=create('div','tax-calc-fill');
  fill.style.width=(100*c.share).toFixed(2)+'%';bar.append(fill);
  row.append(header,bar,create('small','',(c.share*100).toFixed(1)+'% of recorded function outlays'));out.append(row);
 }
}
async function load(){
 try{
  note.textContent='Loading Treasury budget-function data…';
  const fy=2025;
  const endpoint='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_9';
  const params=new URLSearchParams({'filter':'record_calendar_month:eq:09,record_fiscal_year:eq:'+fy+',record_type_cd:eq:F','page[size]':'500','page[number]':'1'});
  const response=await fetch(endpoint+'?'+params);
  if(!response.ok)throw Error('Treasury HTTP '+response.status);
  const j=await response.json(),records=j.data||[];
  if(!records.length)throw Error('No function records');
  // Budget-function rows (level 2), excluding higher-level totals to prevent double counting.
  const selected=records.filter(r=>Number(r.sequence_level_nbr)===2&&r.classification_desc&&Number.isFinite(Number(r.current_fytd_rcpt_outly_amt)));
  const grouped=new Map();
  for(const r of selected){
   const name=String(r.classification_desc).trim();
   const amount=Number(r.current_fytd_rcpt_outly_amt);
   if(!name||amount<=0||/total|subtotal/i.test(name))continue;
   grouped.set(name,(grouped.get(name)||0)+amount);
  }
  const rows=[...grouped].map(([name,amount])=>({name,amount}));
  const total=rows.reduce((sum,x)=>sum+x.amount,0);
  if(rows.length<7||total<1e12||total>20e12)throw Error('Treasury function totals could not be validated');
  categories=rows;dataYear=fy;
  year.textContent='FY '+fy+' · U.S. Treasury';
  render();
 }catch(e){note.textContent='The official budget-function breakdown is unavailable right now. No estimates have been substituted.';out.replaceChildren()}
}
input.addEventListener('input',render);
document.querySelectorAll('[data-tax-preset]').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.taxPreset;render()}));
load();
})();