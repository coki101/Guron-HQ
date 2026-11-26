// Fictional editorial records. Each evidence item belongs to its own dossier.
const archiveCases = [
  ['001','The 100X Guru','Open','suspect','He buys every bottom, calls every top and never shows the wallet.','I bought the bottom… again. Easy 100x.','A cropped screenshot omits the transaction signature.','The first dated entry in the file comes after the advertised call.','No proof. All hype.'],
  ['002','The Missing Wallet','In Review','missing','A huge profit… but the main wallet disappeared.','All my trades are public. Check the wallet.','The original post links to an address with no matching entry.','A second address appears in the follow-up screenshot. Its ownership is unresolved.','Two addresses. One missing link.'],
  ['003','The Exit King','Verified','king','He rallied his followers while quietly selling.','Still holding every token.','The signed message in this fictional file identifies the promotional wallet.','The case ledger records two sales from that address after the hold announcement.','The wallet sold. The story held.'],
  ['004','The Rug Doctor','Closed','doctor','A revolutionary token, a big narrative and a vanished pool.','Liquidity is here to stay.','The archived launch note promises a lock without identifying a locker.','The final pool entry records a withdrawal. The operator remains unidentified.','Pool drained. Identity unresolved.']
].map(([id,name,status,art,summary,claim,first,second,verdict])=>({id,name,status,art,summary,claim,evidence:[first,second],verdict}));
let currentStatus = 'All Cases';
let selectedId = '001';
const search = document.querySelector('#search');
const filters = document.querySelector('#filters');
const records = document.querySelector('#records');
const dossier = document.querySelector('#dossier');
for(const status of ['All Cases', ...new Set(archiveCases.map(item=>item.status))]){
  const button=document.createElement('button');
  const count=archiveCases.filter(item=>status==='All Cases'||item.status===status).length;
  button.textContent=status+' ('+count+')';
  button.dataset.status=status;
  button.onclick=()=>{currentStatus=status;renderArchive();};
  filters.append(button);
}
function showDossier(item){
  dossier.innerHTML='<small>CASE #'+item.id+' · FICTIONAL DOSSIER</small><h2>'+item.name+'</h2><div class="paper"><figure><img src="assets/'+item.art+'.jpg" alt=""><figcaption>'+item.name+'</figcaption></figure><div><strong>The claim</strong><blockquote>“'+item.claim+'”</blockquote><strong>The evidence</strong><ul>'+item.evidence.map(line=>'<li>'+line+'</li>').join('')+'</ul></div></div><footer><small>GURON’S VERDICT</small><h3>'+item.verdict+'</h3></footer>';
}
function renderArchive(){
  const query=search.value.trim().toLowerCase();
  const matches=archiveCases.filter(item=>(currentStatus==='All Cases'||item.status===currentStatus)&&[item.name,'#'+item.id,item.summary].join(' ').toLowerCase().includes(query));
  const selected=matches.find(item=>item.id===selectedId)||matches[0];
  for(const button of filters.children) button.setAttribute('aria-pressed',String(button.dataset.status===currentStatus));
  records.replaceChildren();
  for(const item of matches){
    const button=document.createElement('button');
    button.className='record';
    button.setAttribute('aria-pressed',String(item===selected));
    button.innerHTML='<img src="assets/'+item.art+'.jpg" alt=""><div><small>CASE #'+item.id+'</small><b>'+item.status+'</b><h3>'+item.name+'</h3><span>'+item.summary+'</span></div>';
    button.onclick=()=>{
      selectedId=item.id;
      for(const sibling of records.children) sibling.setAttribute('aria-pressed',String(sibling===button));
      showDossier(item);
      if(matchMedia('(max-width:850px)').matches) dossier.scrollIntoView({block:'start'});
    };
    records.append(button);
  }
  document.querySelector('#empty').hidden=Boolean(selected);
  dossier.hidden=!selected;
  if(selected){selectedId=selected.id;showDossier(selected);}
}
search.addEventListener('input',renderArchive);
document.querySelector('#reset').onclick=()=>{currentStatus='All Cases';search.value='';renderArchive();search.focus();};
