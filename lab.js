(() => {
  const el = id => document.getElementById(id);
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  // Leading base58 ones encode zero bytes and count toward the public key length.
  function isAddress(value) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
    let number = 0n;
    for (const char of value) number = number * 58n + BigInt(alphabet.indexOf(char));
    return value.match(/^1*/)[0].length + (number ? Math.ceil(number.toString(2).length / 8) : 0) === 32;
  }
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem('guron.watchlist') || '[]').filter(isAddress); } catch {}
  let account = '';
  let pending;
  const short = value => value.slice(0,6) + '…' + value.slice(-5);
  function refreshWatchlist() {
    el('watch').replaceChildren(new Option('Select a wallet',''), ...saved.map(address => new Option(short(address),address)));
    el('bookmark').textContent = saved.includes(account) ? 'Remove from watchlist' : 'Add to watchlist';
  }
  function display(address, balance, rows) {
    account = address;
    el('lab-results').hidden = false;
    el('bookmark').hidden = !address;
    el('lab-source').textContent = address ? 'SOLANA MAINNET · FINALIZED' : 'SAMPLE CASE · FICTIONAL DATA';
    el('account').textContent = address || 'Training file #1187';
    el('balance').textContent = balance.toLocaleString('en-US',{maximumFractionDigits:9})+' SOL';
    el('reviewed').textContent = rows.length;
    el('failed').textContent = rows.filter(row=>row.err).length;
    const body = el('activity');
    body.replaceChildren();
    for (const item of rows) {
      const tr = body.insertRow();
      tr.insertCell().textContent = item.blockTime == null ? 'Unavailable' : new Date(item.blockTime*1000).toISOString().slice(0,16).replace('T',' ');
      tr.insertCell().textContent = item.err ? 'Failed' : 'Success';
      const cell = tr.insertCell();
      if (address) {
        const link = document.createElement('a');
        link.href = 'https://explorer.solana.com/tx/'+encodeURIComponent(item.signature);
        link.textContent = short(item.signature)+' ↗';
        link.target = '_blank'; link.rel = 'noopener';
        cell.append(link);
      } else cell.textContent = item.signature;
    }
    if (!rows.length) { const cell = body.insertRow().insertCell(); cell.colSpan=3; cell.textContent='No finalized transactions returned.'; }
    refreshWatchlist();
  }
  function sample() {
    pending?.abort(); pending = null;
    el('wallet').value = ''; el('wallet').setCustomValidity('');
    el('lab-status').textContent='Sample investigation · Enter a public address to query mainnet.';
    display('',432.76,[{blockTime:1737022140,signature:'Sample A'},{blockTime:1737021360,signature:'Sample B',err:true},{blockTime:1737019860,signature:'Sample C'}]);
  }
  async function rpc(method,params,signal) {
    const response = await fetch('https://api.mainnet-beta.solana.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal});
    if (!response.ok) throw new Error('HTTP '+response.status);
    const data = await response.json();
    if (data.error || data.result == null) throw new Error('RPC unavailable');
    return data.result;
  }
  async function investigate(address) {
    pending?.abort();
    const controller = new AbortController(); pending = controller;
    const timer = setTimeout(()=>controller.abort(),15000);
    el('lab-results').hidden=true; el('lab-status').textContent='Reading finalized mainnet activity…';
    try {
      const [balance,rows] = await Promise.all([
        rpc('getBalance',[address,{commitment:'finalized'}],controller.signal),
        rpc('getSignaturesForAddress',[address,{limit:10,commitment:'finalized'}],controller.signal)
      ]);
      if (pending !== controller) return;
      display(address,balance.value/1e9,rows);
      el('lab-status').textContent='Latest lookup · Up to 10 finalized transactions.';
    } catch {
      if (pending === controller) el('lab-status').textContent='Mainnet lookup unavailable. Retry the search or open the sample case.';
    } finally {clearTimeout(timer);}
  }
  el('wallet').oninput=()=>el('wallet').setCustomValidity('');
  el('wallet-form').onsubmit=event=>{
    event.preventDefault();
    const input=el('wallet'), value=input.value.trim();
    if (!isAddress(value)) { input.setCustomValidity('Enter a valid 32-byte Solana public address.'); input.reportValidity(); return; }
    investigate(value);
  };
  el('watch').onchange=event=>{const value=event.target.value;if(value){el('wallet').value=value;el('wallet').setCustomValidity('');investigate(value);}};
  el('bookmark').onclick=()=>{
    if (!account) return;
    const next=saved.includes(account)?saved.filter(value=>value!==account):[...saved,account];
    try {localStorage.setItem('guron.watchlist',JSON.stringify(next));saved=next;refreshWatchlist();}
    catch {el('lab-status').textContent='This browser could not save your watchlist.';}
  };
  el('sample').onclick=sample;
  sample();
})();
