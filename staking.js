(() => {
  const get = id => document.getElementById('chain-'+id);
  const message = text => {get('message').textContent=text;};
  const bytes = new TextEncoder();
  const meta = (pubkey,isWritable=false,isSigner=false)=>({pubkey,isWritable,isSigner});
  let ctx;
  let busy=false;
  const headerButton=document.getElementById('hq-connect');
  const disconnect=document.getElementById('hq-disconnect');
  const notice=document.getElementById('hq-wallet-status');
  let provider, account;
  function walletStatus(text){
    if(notice){notice.textContent=text;notice.hidden=!text;}
  }
  function syncAccount(key){
    const address=key?.toString() || '';
    if(address!==account){clearActions();message('');}
    account=address;
    if(headerButton)headerButton.textContent=address ? address.slice(0,4)+'…'+address.slice(-4) : 'Connect wallet';
    if(disconnect)disconnect.hidden=!address;
    get('connect').textContent=address ? 'Refresh staking position' : 'Connect wallet for staking';
    walletStatus('');
  }
  async function connect(){
    const injected=window.phantom?.solana || (window.solana?.isPhantom && window.solana);
    if(!injected)throw Error('Enable the Phantom extension, or open GURON in the Phantom mobile browser.');
    if(provider!==injected){
      provider=injected;
      provider.on?.('accountChanged',syncAccount);
      provider.on?.('disconnect',()=>syncAccount(null));
    }
    const user=provider.isConnected && provider.publicKey ? provider.publicKey : (await provider.connect()).publicKey;
    syncAccount(user);
    return {wallet:provider,user};
  }
  async function loadSdk() {
    if(window.solanaWeb3)return window.solanaWeb3;
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='/vendor/web3.js';script.onload=resolve;script.onerror=()=>reject(Error('Start the GURON server with its dependencies installed.'));
      document.head.append(script);
    });
    return window.solanaWeb3;
  }
  function clearActions(){
    get('form').hidden=true;
    get('redeem').hidden=true;
    ctx=null;
  }
  async function inspect(){
    clearActions();
    if(location.protocol==='file:')throw Error('Open GURON through its local server to use devnet.');
    const {wallet,user}=await connect();
    const config=await (await fetch('staking-config.json',{cache:'no-store'})).json();
    if(!config.program||!config.securityWallet||!config.mint)throw Error('Devnet pool setup pending. The practice vault is available below.');
    const w=await loadSdk();
    const rpc=new w.Connection(w.clusterApiUrl('devnet'),'confirmed');
    const pk=value=>new w.PublicKey(value);
    const program=pk(config.program), mint=pk(config.mint), admin=pk(config.securityWallet);
    const derive=(name,...keys)=>w.PublicKey.findProgramAddressSync([bytes.encode(name),...keys.map(key=>key.toBytes())],program)[0];
    const pool=derive('pool',admin,mint), vault=derive('vault',pool), position=derive('position',pool,user);
    const [account,mintInfo,pos]=await rpc.getMultipleAccountsInfo([pool,mint,position]);
    if(!account?.owner.equals(program)||account.data.length!==88||!mintInfo)throw Error('Configured pool is unavailable on devnet.');
    const view=new DataView(Uint8Array.from(account.data).buffer);
    const rates=[72,74,76].map(offset=>view.getUint16(offset,true)/100);
    const decimals=mintInfo.data[44];
    get('info').textContent='30-day rewards by tier (1k / 10k / 100k): '+rates.join('% / ')+'%.';
    const accounts=await rpc.getTokenAccountsByOwner(user,{mint});
    const owned=accounts.value.map(item=>({key:item.pubkey,amount:new DataView(Uint8Array.from(item.account.data).buffer).getBigUint64(64,true)})).sort((a,b)=>a.amount>b.amount?-1:a.amount<b.amount?1:0);
    if(!owned.length)throw Error('Create a token account for this mint in your devnet wallet.');
    if(account!==user.toString())throw Error("Wallet changed. Refresh your staking position.");
    ctx={w,user,wallet,rpc,program,pool,mint,vault,position,tokenProgram:mintInfo.owner,owned,decimals};
    if(pos){
      const data=new DataView(Uint8Array.from(pos.data).buffer);
      const unlock=Number(data.getBigInt64(24,true));
      message('Position matures '+new Date(unlock*1000).toISOString()+'. Principal and reward are paid together.');
      get('redeem').hidden=false;
    }else{
      get('form').hidden=Boolean(view.getUint8(86));
      message(get('form').hidden?'Deposits paused.':'Connected to devnet.');
    }
  }
  async function transact(name){
    const c=ctx;
    if(!c||!c.wallet.publicKey?.equals(c.user))throw Error('Reconnect the current wallet.');
    const stake=name==='stake';
    const data=new Uint8Array(stake?16:8);
    data.set(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.encode('global:'+name))).slice(0,8));
    if(stake){
      const amount=BigInt(get('amount').value)*10n**BigInt(c.decimals);
      if(amount>c.owned[0].amount||amount>0xffffffffffffffffn)throw Error('Amount exceeds the available token balance.');
      new DataView(data.buffer).setBigUint64(8,amount,true);
    }
    const keys=[meta(c.user,true,true),meta(c.pool,true),meta(c.mint),meta(c.vault,true),meta(c.owned[0].key,true),meta(c.position,true),meta(c.tokenProgram)];
    if(stake)keys.push(meta(c.w.SystemProgram.programId));
    const block=await c.rpc.getLatestBlockhash();
    const tx=new c.w.Transaction({feePayer:c.user,blockhash:block.blockhash,lastValidBlockHeight:block.lastValidBlockHeight}).add(new c.w.TransactionInstruction({programId:c.program,keys,data}));
    const signed=await c.wallet.signTransaction(tx);
    const sig=await c.rpc.sendRawTransaction(signed.serialize(),{skipPreflight:false});
    message('Submitted: '+sig);
    const result=await c.rpc.confirmTransaction({...block,signature:sig},'confirmed');
    if(result.value.err)throw Error('Devnet transaction failed: '+sig);
    await inspect();
    message('Confirmed: '+sig);
  }
  async function run(action){
    if(busy)return;
    busy=true;
    get('connect').disabled=true;get('form').inert=true;get('redeem').disabled=true;
    try{await action();}catch(error){const text=error.code===4001?'Wallet request cancelled.':error.message;message(text);walletStatus(text);}
    finally{busy=false;get('connect').disabled=false;get('form').inert=false;get('redeem').disabled=false;}
  }
  if(headerButton)headerButton.onclick=()=>run(async()=>{
    await connect();
    location.hash='staking';
    await inspect();
  });
  if(disconnect)disconnect.onclick=()=>run(async()=>{await provider.disconnect();syncAccount(null);});
  get('connect').onclick=()=>run(inspect);
  get('form').onsubmit=e=>{e.preventDefault();run(()=>transact('stake'));};
  get('redeem').onclick=()=>run(()=>transact('redeem'));
})();
