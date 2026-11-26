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
    get('estimate').textContent=tier && Number.isSafeInteger(amount) ? tier.name+' · Estimated 30-day reward: '+format(reward(amount))+' practice GURON.' : 'Enter at least 1,000 whole practice tokens.';
  }
  function render() {
    get('cash').textContent=format(state.cash);
    get('staked').textContent=format(state.positions.reduce((sum,p)=>sum+p.amount,0));
    get('rewards').textContent=format(state.pending);
    get('day').textContent='Day '+state.day;
    get('claim').disabled=state.pending===0;
    get('amount').max=Math.floor(state.cash);
    const list=get('positions');
    list.replaceChildren();
    if (!state.positions.length) list.textContent='Your vault has no open positions.';
    state.positions.forEach((position,index)=>{
      const row=document.createElement('div');
      row.className='position-row';
      const name=document.createElement('b');
      name.textContent=tierFor(position.amount).name+' · '+format(position.amount)+' GURON';
      const lock=document.createElement('small');
      lock.textContent='Unlock day '+position.unlock;
      const button=document.createElement('button');
      button.textContent='Unstake';
      button.disabled=state.day<position.unlock;
      button.onclick=()=>{
        if(state.day<position.unlock || state.positions[index]!==position) return;
        state.cash+=position.amount;
        state.positions.splice(index,1);
        commit('Principal returned to your practice balance.');
      };
      row.append(name,lock,button);list.append(row);
    });
    estimate();
  }
  for(const tier of tiers) {
    const row=document.createElement('div');
    row.innerHTML='<span>'+tier.name+'<br><small>≥ '+format(tier.minimum)+'</small></span><b>'+tier.apy*100+'% demo APY</b>';
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
  get('advance').onclick=()=>{
    const next=state.day+30;
    for(const position of state.positions){
      if(position.unlock>state.day && position.unlock<=next) state.pending=Math.round((state.pending+reward(position.amount))*100)/100;
    }
    state.day=next;
    commit('Simulation advanced 30 days.');
  };
  get('claim').onclick=()=>{
    state.cash=Math.round((state.cash+state.pending)*100)/100;
    state.pending=0;
    commit('Practice rewards added to your balance.');
  };
  render();
})();
