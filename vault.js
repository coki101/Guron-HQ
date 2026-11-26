(() => {
  const get = id => document.getElementById('v-' + id);
  const tiers = [
    {name:'Detective', minimum:1000, apy:0.6},
    {name:'Investigator', minimum:10000, apy:0.9},
    {name:'Guru Hunter', minimum:100000, apy:1.2}
  ];
  const format = value => value.toLocaleString('en-US',{maximumFractionDigits:2});
  const tierFor = amount => tiers.filter(tier => amount >= tier.minimum).pop();
  // Settle rewards once, at maturity, to two decimal places per position.
  const reward = amount => Math.floor(amount * Math.expm1(Math.log1p(tierFor(amount).apy)*30/365)*100)/100;
  const key = 'guron.practiceVault.v1';
  let state = {day:0,cash:125000,pending:0,positions:[]};
  try {
    const saved = JSON.parse(sessionStorage.getItem(key));
    if (saved && Number.isSafeInteger(saved.day) && Number.isFinite(saved.cash) && Number.isFinite(saved.pending) && Array.isArray(saved.positions) && saved.positions.every(p=>Number.isSafeInteger(p.amount)&&p.amount>=1000&&Number.isSafeInteger(p.unlock))) state=saved;
  } catch {}
  function commit(message) {
    try {sessionStorage.setItem(key,JSON.stringify(state));}
    catch {message += ' Progress is available for this page visit.';}
    get('status').textContent=message;
    render();
  }
  function estimate() {
    const amount=get('amount').valueAsNumber;
    const tier=tierFor(amount);
    for(const button of get('tiers').children)button.setAttribute('aria-pressed',String(tier?.name===button.dataset.tier));
    get('estimate').textContent=tier && Number.isSafeInteger(amount) ? tier.name+' · Estimated 30-day reward: '+format(reward(amount))+' practice GURON.' : 'Enter at least 1,000 whole practice tokens.';
  }
  function render() {
    get('cash').textContent=format(state.cash);
    get('staked').textContent=format(state.positions.reduce((sum,p)=>sum+p.amount,0));
    get('rewards').textContent=format(state.pending);
    get('count').textContent=state.positions.length+' open positions';
    get('day').textContent='Day '+state.day;
    get('claim').disabled=state.pending===0;
    get('amount').max=Math.floor(state.cash);
    const list=get('positions');
    list.replaceChildren();

    state.positions.forEach((position,index)=>{
      const remaining=Math.max(0,position.unlock-state.day);
      const status=remaining?'Locked':'Unlocked';
      if(get('filter').value!=='All' && get('filter').value!==status)return;
      const row=document.createElement('div');
      row.className='position-row';
      const name=document.createElement('b');
      name.textContent=tierFor(position.amount).name+' · '+format(position.amount)+' GURON';
      const lock=document.createElement('small');
      lock.textContent=remaining ? remaining+' days left · Unlock day '+position.unlock : 'Ready to withdraw';
      const progress=document.createElement('progress');
      progress.max=30;progress.value=30-remaining;progress.setAttribute('aria-label','Lock period completed');
      const earnings=document.createElement('span');
      earnings.textContent='Term reward · '+format(reward(position.amount))+' GURON';
      const button=document.createElement('button');
      button.textContent='Unstake';
      button.disabled=state.day<position.unlock;
      button.onclick=()=>{
        if(state.day<position.unlock || state.positions[index]!==position) return;
        state.cash+=position.amount;
        state.positions.splice(index,1);
        commit('Principal returned to your practice balance.');
      };
      row.append(name,lock,earnings,button,progress);list.append(row);
    });
    if(!list.children.length)list.textContent=state.positions.length?'No positions match this filter.':'Your first deposit will appear here with its reward and unlock date.';
    estimate();
  }
  for(const tier of tiers) {
    const row=document.createElement('button');
    row.type='button';row.dataset.tier=tier.name;
    const medal=['bronze','silver','gold'][tiers.indexOf(tier)];
    row.innerHTML='<img alt="" src="assets/tier-'+medal+'.jpg"><b>'+tier.name+'</b><small>From '+format(tier.minimum)+'</small><strong>'+tier.apy*100+'%</strong><small>Demo APY</small>';
    row.onclick=()=>{get('amount').value=tier.minimum;estimate();};
    get('tiers').append(row);
  }
  get('amount').oninput=estimate;
  get('max').onclick=()=>{get('amount').value=Math.floor(state.cash);estimate();};
  get('form').onsubmit=event=>{
    event.preventDefault();
    const amount=get('amount').valueAsNumber;
    if(!Number.isSafeInteger(amount)||amount<1000||amount>state.cash)return;
    state.cash-=amount;
    state.positions.push({amount,unlock:state.day+30});
    commit('Position opened for 30 simulated days.');
  };
  function advance(days){
    const next=state.day+days;
    for(const position of state.positions){
      if(position.unlock>state.day && position.unlock<=next) state.pending=Math.round((state.pending+reward(position.amount))*100)/100;
    }
    state.day=next;
    commit('Simulation advanced '+days+' days.');
  };
  get('week').onclick=()=>advance(7);
  get('advance').onclick=()=>advance(30);
  get('filter').onchange=render;
  for(const button of document.querySelectorAll('[data-share]'))button.onclick=()=>{get('amount').value=Math.floor(state.cash*Number(button.dataset.share)/100);estimate();};
  function switchMode(chain){
    get('chain-panel').hidden=!chain;get('practice-panel').hidden=chain;
    get('chain-mode').setAttribute('aria-pressed',String(chain));
    get('practice-mode').setAttribute('aria-pressed',String(!chain));
  }
  get('chain-mode').onclick=()=>switchMode(true);
  get('practice-mode').onclick=()=>switchMode(false);
  document.addEventListener('guron:open-wallet-vault',()=>switchMode(true));
  get('claim').onclick=()=>{
    state.cash=Math.round((state.cash+state.pending)*100)/100;
    state.pending=0;
    commit('Practice rewards added to your balance.');
  };
  render();
})();
