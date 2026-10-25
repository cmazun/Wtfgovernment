/* On-demand official USAspending contract record expansion. */
(function(){
'use strict';
const cache=new Map();
const by=(obj,path)=>path.split('.').reduce((v,key)=>v==null?undefined:v[key],obj);
const first=(obj,paths)=>{for(const p of paths){const v=by(obj,p);if(v!==undefined&&v!==null&&v!==''&&typeof v!=='object')return v;}return null;};
const text=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=String(value);return n;};
const money=(value)=>{const n=Number(value);return Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):null;};
const date=(value)=>{if(!value)return null;const v=String(value).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:null;};
const readable=(value)=>{if(value===null||value===undefined||value==='')return null;return String(value);};
const looksLikeCode=(s)=>/^(IGF|OT|\s|:|;|-|\.|\d)+$/i.test(String(s||'').trim())||String(s||'').trim().length<8;
function addField(box,label,value){
 const v=readable(value);if(!v)return;
 const row=text('div','award-deep-field','');
 row.append(text('strong','',label),text('p','',v));box.append(row);
}
function addHeading(box,title){box.append(text('h4','award-deep-heading',title));}
function render(box,data,transactions,id){
 box.replaceChildren();
 const c=data.latest_transaction_contract_data||{};
 const recipient=data.recipient||{};
 const awarding=data.awarding_agency||{};
 const funding=data.funding_agency||{};
 const period=data.period_of_performance||{};
 const description=first(data,['description','award_description','latest_transaction_contract_data.transaction_description','latest_transaction_contract_data.description','latest_transaction_contract_data.product_or_service_code_description']);
 addHeading(box,'What the government purchased');
 const desc=first(data,['description','award_description','latest_transaction_contract_data.transaction_description','latest_transaction_contract_data.description']);
 const psc=first(c,['product_or_service_code_description','product_or_service_code','psc_description','psc']);
 if(desc&&!looksLikeCode(desc))addField(box,'Official contract description',desc);
 else addField(box,'Description quality', 'The official description is missing or is a reporting code, not a plain-English explanation. The categories below may offer additional context.');
 addField(box,'Product or service',psc);
 addField(box,'Industry classification',first(c,['naics_description','naics','naics_code']));
 addHeading(box,'Contract value and funding');
 addField(box,'Federal obligations reported for this award',money(first(data,['total_obligation','total_obligated_amount','total_obligations'])));
 addField(box,'Potential total award value',money(first(data,['total_potential_value_of_award','total_potential_value','base_and_all_options_value','total_contract_value'])));
 addField(box,'Reported outlays (payments)',money(first(data,['total_outlays','total_outlay'])));
 addField(box,'Contract pricing / type',first(c,['type_of_contract_pricing_description','type_of_contract_pricing','contract_award_type_description','contract_award_type']));
 addHeading(box,'Dates and government customer');
 addField(box,'Award date',date(first(data,['date_signed','award_date','base_obligation_date'])));
 addField(box,'Performance start',date(first(period,['start_date','start'])));
 addField(box,'Current performance end',date(first(period,['current_end_date','end_date'])));
 addField(box,'Potential end with options',date(first(period,['potential_end_date'])));
 addField(box,'Awarding agency',first(awarding,['toptier_agency.name','subtier_agency.name','office_agency_name'])||first(data,['awarding_agency_name']));
 addField(box,'Awarding office',first(awarding,['office_agency_name','office_agency_code']));
 addField(box,'Funding agency',first(funding,['toptier_agency.name','subtier_agency.name','office_agency_name']));
 addField(box,'Recipient',first(recipient,['recipient_name','name']));
 addField(box,'Recipient UEI',first(recipient,['recipient_uei','uei']));
 if(transactions&&transactions.length){
 addHeading(box,'Recent contract actions and modifications');
 for(const t of transactions.slice(0,5)){
  const row=text('div','award-deep-action','');
  const label=[date(t.action_date),t.modification_number?'Mod '+t.modification_number:null,t.action_type_description].filter(Boolean).join(' · ');
  row.append(text('strong','',label||'Contract action'));
  if(t.federal_action_obligation!==null&&t.federal_action_obligation!==undefined)row.append(text('p','','Obligation change: '+(money(t.federal_action_obligation)||'Not reported')));
  if(t.description&&!looksLikeCode(t.description))row.append(text('p','',String(t.description).slice(0,400)));
  box.append(row);
 }
 }
 const note=text('p','award-deep-note','Figures describe different measures and may cover multiple fiscal years. Obligations are commitments, potential value may include unexercised options, and outlays are payments. Missing fields are omitted rather than estimated.');
 box.append(note);
 const link=document.createElement('a');link.href='https://www.usaspending.gov/award/'+encodeURIComponent(id);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open this specific award on USAspending ↗';box.append(link);
}
async function get(url,options){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
 try{const response=await fetch(url,{...options,signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return await response.json();}
 finally{clearTimeout(timer)}
}
async function expand(details){
 const id=details.dataset.awardInternalId;
 if(!id||details.dataset.enriched==='true')return;
 let box=details.querySelector('.award-deep');
 if(!box){box=text('div','award-deep','Loading detailed federal award record…');details.append(box);}
 if(details.dataset.loading==='true')return;
 details.dataset.loading='true';
 try{
  let result=cache.get(id);
  if(!result){
   const award=await get('https://api.usaspending.gov/api/v2/awards/'+encodeURIComponent(id)+'/');
   let actions=null;
   try{
    const response=await get('https://api.usaspending.gov/api/v2/transactions/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({award_id:id,page:1,limit:5,sort:'action_date',order:'desc'})});
    actions=Array.isArray(response.results)?response.results:[];
   }catch(_error){actions=null;}
   result={award,actions};cache.set(id,result);
  }
  render(box,result.award,result.actions,id);
  details.dataset.enriched='true';
 }catch(error){
  box.replaceChildren();
  box.append(text('p','award-deep-error','Additional award data could not be loaded ('+error.message+'). The basic search details above remain available.'));
  const retry=text('button','secondary','Retry detailed record');
  retry.type='button';retry.addEventListener('click',()=>{details.dataset.loading='false';expand(details)});box.append(retry);
 }finally{details.dataset.loading='false'}
}
document.addEventListener('toggle',(event)=>{
 const el=event.target;
 if(el instanceof HTMLDetailsElement&&el.open&&el.classList.contains('defense-award-details'))expand(el);
},true);
})();