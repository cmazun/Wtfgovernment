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
 const c=data.latest_transaction_contract_data||{}, period=data.period_of_performance||{};
 const desc=first(data,['description','award_description','latest_transaction_contract_data.transaction_description','latest_transaction_contract_data.description']);
 const psc=first(c,['product_or_service_code_description','psc_description','product_or_service_code','psc']);
 const naics=first(c,['naics_description','naics','naics_code']);
 const obligation=first(data,['total_obligation','total_obligated_amount','total_obligations']);
 const potential=first(data,['total_potential_value_of_award','total_potential_value','base_and_all_options_value','total_contract_value']);
 const outlays=first(data,['total_outlays','total_outlay']);
 const intro=text('p','award-deep-intro','Official federal contract details');
 box.append(intro);
 if(desc&&!looksLikeCode(desc))addField(box,'Purpose',desc);
 else if(psc||naics)addField(box,'What it covers',String(psc||'')+(naics&&naics!==psc?' · '+naics:''));
 else addField(box,'Purpose','The federal record does not provide a useful description.');
 if(psc&&desc&&!looksLikeCode(desc))addField(box,'Service category',psc);
 if(naics&&(!psc||!desc||looksLikeCode(desc)))addField(box,'Industry',naics);
 addField(box,'Obligated',money(obligation));
 if(potential!==null&&Number(potential)>0)addField(box,'Potential contract value',money(potential));
 if(outlays!==null&&Number(outlays)>0)addField(box,'Payments reported',money(outlays));
 const signed=date(first(data,['date_signed','award_date','base_obligation_date']));
 const ends=date(first(period,['current_end_date','end_date','potential_end_date']));
 if(signed||ends)addField(box,'Contract dates',[signed?'Awarded '+signed:null,ends?'Ends '+ends:null].filter(Boolean).join(' · '));
 addField(box,'Contract type',first(c,['type_of_contract_pricing_description','contract_award_type_description','type_of_contract_pricing','contract_award_type']));
 const office=first(data,['awarding_agency.office_agency_name','awarding_agency.subtier_agency.name','awarding_agency.toptier_agency.name','awarding_agency_name']);
 addField(box,'Government customer',office);
 const note=text('p','award-deep-note','Obligated means funding committed, not necessarily paid. A missing or zero potential value does not mean the contract is worth $0.');
 box.append(note);
 const link=document.createElement('a');link.href='https://www.usaspending.gov/award/'+encodeURIComponent(id);link.target='_blank';link.rel='noopener noreferrer';link.textContent='View full official award record ↗';box.append(link);
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