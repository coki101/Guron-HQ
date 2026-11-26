// Keep the signed transaction identifier before broadcasting. A timeout can occur
// after an RPC has accepted the transaction, so check that receipt before retrying.
const publishPumpToken = (() => {
  const button = document.getElementById('pump-open');
  const panel = document.getElementById('pump-receipt');
  const storageKey = 'guron.pump.receipt.v1';
  let busy = false;
  let receipt;
  try { receipt = JSON.parse(localStorage.getItem(storageKey)); } catch {}
  function save() {
    try { localStorage.setItem(storageKey,JSON.stringify(receipt)); } catch {}
  }
  function draw(message) {
    panel.replaceChildren();
    const note = document.createElement('p');
    note.textContent = message;
    panel.append(note);
    if (!receipt) return;
    const details = document.createElement('p');
    details.textContent = 'Mint '+receipt.mint+' · Transaction '+receipt.signature;
    panel.append(details);
    if (receipt.state === 'pending') {
      const check = document.createElement('button');
      check.className='secondary'; check.textContent='Check confirmation';
      check.onclick=()=>refresh().catch(()=>draw('Confirmation unavailable. Check again before starting another launch.'));
      panel.append(check);
    }
  }
  async function post(path,data) {
    const response = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(120000)});
    const result = await response.json();
    if (!response.ok || result.error) throw Error(result.error?.message || result.error || 'Request failed.');
    return result;
  }
  async function rpc(method,params) {
    return (await post('/api/rpc',{jsonrpc:'2.0',id:1,method,params})).result;
  }
  async function refresh() {
    const active=receipt;
    const result=await rpc('getSignatureStatuses',[[active.signature],{searchTransactionHistory:true}]);
    if (receipt!==active) return;
    const status=result.value[0];
    if (status?.err) active.state='failed';
    else if (['confirmed','finalized'].includes(status?.confirmationStatus)) active.state='confirmed';
    else if (!status && await rpc('getBlockHeight',[{commitment:'finalized'}])>active.lastValidBlockHeight) {
      const history=await rpc('getSignatureStatuses',[[active.signature],{searchTransactionHistory:true}]);
      if (!history.value[0]) active.state='expired';
    }
    save();draw('Pump.fun launch · '+active.state);
  }
  function signatureText(bytes) {
    const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let value=0n, text='';
    for (const byte of bytes) value=value*256n+BigInt(byte);
    while(value){text=alphabet[Number(value%58n)]+text;value/=58n;}
    for(const byte of bytes){if(byte!==0)break;text='1'+text;}
    return text;
  }
  async function sdk() {
    if (!window.solanaWeb3) await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='/vendor/web3.js';script.onload=resolve;script.onerror=()=>reject(Error('Install the GURON server dependencies first.'));
      document.head.append(script);
    });
    return window.solanaWeb3;
  }
  if(receipt?.signature) draw('Last Pump.fun launch · '+receipt.state);
  return async function publish(token) {
    if(busy)return;
    if(receipt?.state==='pending'){draw('Check your pending transaction first.');return;}
    if(location.origin!=='http://localhost:3000'){draw('Start the GURON server and open http://localhost:3000/#launch-token.');return;}
    busy=true;button.disabled=true;
    const form=document.getElementById('launch-form');
    form.inert=true;
    try {
      const wallet=window.phantom?.solana;
      if(!wallet?.isPhantom) throw Error('Enable the Phantom extension for this page.');
      const web3=await sdk();
      const {publicKey}=await wallet.connect();
      const mint=web3.Keypair.generate();
      draw('Publishing artwork and metadata to IPFS…');
      const prepared=await post('/api/pump/prepare',{...token,wallet:publicKey.toString(),mint:mint.publicKey.toString()});
      const tx=web3.Transaction.from(Uint8Array.from(atob(prepared.wire),c=>c.charCodeAt(0)));
      if(!tx.feePayer.equals(publicKey)||!wallet.publicKey?.equals(publicKey))throw Error('Wallet changed. Review the launch again.');
      tx.partialSign(mint);
      // Keep publication and signature as separate user gestures.
      draw('Simulation passed. Network fee: '+(prepared.feeLamports/1e9)+' SOL, plus account rent. Mint: '+mint.publicKey.toString());
      const decision=await new Promise(resolve=>{
        const confirm=document.createElement('button');
        const cancel=document.createElement('button');
        confirm.className='btn';cancel.className='secondary';
        confirm.textContent='Sign launch in Phantom';cancel.textContent='Cancel launch';
        panel.append(confirm,cancel);
        function finish(accepted){
          window.removeEventListener('hashchange',leave);
          confirm.remove();cancel.remove();resolve(accepted);
        }
        function leave(){finish(false);}
        confirm.onclick=()=>finish(true);cancel.onclick=leave;
        window.addEventListener('hashchange',leave,{once:true});
        if(location.hash!=='#launch-token')finish(false);
      });
      if(!decision){draw('Launch cancelled before signature.');return;}
      if(!wallet.publicKey?.equals(publicKey))throw Error('Wallet changed. Prepare the launch again.');
      if(await rpc('getBlockHeight',[{commitment:'confirmed'}])>prepared.lastValidBlockHeight)throw Error('Launch preparation expired. Prepare it again.');
      draw('Review the Solana mainnet transaction in Phantom.');
      const signed=await wallet.signTransaction(tx);
      const bytes=signed.serialize();
      receipt={mint:mint.publicKey.toString(),signature:signatureText(signed.signature),lastValidBlockHeight:prepared.lastValidBlockHeight,state:'pending'};
      save();draw('Submitting signed transaction…');
      await rpc('sendTransaction',[btoa(String.fromCharCode(...bytes)),{encoding:'base64',skipPreflight:false,preflightCommitment:'confirmed',maxRetries:3}]);
      for(let count=0;count<10 && receipt.state==='pending';count++){
        await refresh();
        if(receipt.state==='pending')await new Promise(resolve=>setTimeout(resolve,1800));
      }
    }catch(error){draw(error.code===4001?'Phantom request cancelled.':error.message);}
    finally{busy=false;button.disabled=false;form.inert=false;}
  };
})();

