const sections = [
  {id:'home', name:'Home', icon:'⌂'},
  {id:'case-files', name:'Case Files', icon:'▤', short:'Investigations & evidence', art:'guru', label:'CASE #001 · FICTIONAL DOSSIER', title:'The 100X Guru', detail:'The claim: “I bought the bottom. Easy 100x.” The screenshot shows a price, but leaves out the wallet and transaction signature. Guron’s verdict: the entry remains unverified.'},
  {id:'the-lab', name:'The Lab', icon:'⚗', short:'Wallets & transactions', art:'lab', detail:'Follow a wallet through its transfers, holdings and connected addresses. Wallet lookup is planned for the Lab release.'},
  {id:'staking', name:'Staking', icon:'◎', short:'Explore the vault', art:'staking', detail:'The vault will bring staking positions and reward information into HQ. Deposits and rewards are unavailable in this preview.'},
  {id:'guron-ai', name:'Guron AI', icon:'✧', short:'Detective briefings', art:'ai', detail:'Start an investigation with three questions. Which wallet made the trade? When did it enter? Does the transaction support the public claim? The interactive assistant is planned for a later release.'}
];
const meet = {id:'meet', name:'Meet Guron', art:'hero', label:'DETECTIVE PROFILE', detail:'Guron is a ferret detective with a nose for suspicious calls. In his office, every screenshot starts a case. A wallet, a timestamp and a transaction tell him whether the story holds up.'};
const nav = document.querySelector('nav');
const tiles = document.querySelector('.tiles');
for (const section of sections) {
  const link = document.createElement('a');
  link.href = '#' + section.id;
  link.innerHTML = '<i aria-hidden="true">'+section.icon+'</i>'+section.name;
  nav.append(link);
  if (section.short) {
    const tile = link.cloneNode(false);
    tile.innerHTML = '<i aria-hidden="true">'+section.icon+'</i><div><h3>'+section.name+'</h3><span>'+section.short+'</span></div><em>›</em>';
    tiles.append(tile);
  }
}
// Hash-based briefings support direct links and browser back/forward.
const dialog = document.querySelector('dialog');
function renderRoute() {
  const active = [...sections, meet].find(item => '#'+item.id === location.hash) || sections[0];
  for (const link of nav.children) {
    if (link.hash === '#'+active.id) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  const isVault = active.id === 'staking';
  document.querySelector('#vault').hidden = !isVault;
  const isArchive = active.id === 'case-files';
  const isLab = active.id === 'the-lab';
  document.querySelector('#lab').hidden = !isLab;
  document.querySelector('#cases').hidden = !isArchive;
  document.querySelector('.hero').hidden = isArchive || isLab || isVault;
  document.querySelector('.content').hidden = isArchive || isLab || isVault;
  if (isLab || isVault) { if(dialog.open) dialog.close(); return; }
  if (isArchive) {
    if (dialog.open) dialog.close();
    renderArchive();
    return;
  }
  if (active.id === 'home') { if(dialog.open) dialog.close(); return; }
  document.querySelector('#art').src = 'assets/'+active.art+'.jpg';
  document.querySelector('#label').textContent = active.label || 'HQ · SECTION PREVIEW';
  document.querySelector('#title').textContent = active.title || active.name;
  document.querySelector('#detail').textContent = active.detail;
  if (!dialog.open) dialog.showModal();
}
function goHome(){location.hash='home';}
dialog.querySelector('button').onclick = goHome;
dialog.addEventListener('cancel',event=>{event.preventDefault();goHome();});
dialog.addEventListener('click',event=>{if(event.target===dialog) goHome();});
window.addEventListener('hashchange',renderRoute);
renderRoute();




