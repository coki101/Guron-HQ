const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'pump.js'),'utf8');
function harness({fail=false,expired=false,status='confirmed',storage=new Map()}={}){
  const elements=new Map(), calls=[];
  class Element {
    constructor(){this.children=[];}
    append(...items){this.children.push(...items);}
    replaceChildren(){this.children=[];}
    remove(){}
  }
  const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement:()=>new Element()};
  const key={equals:()=>true,toString:()=>'test-key'};
  const wallet={isPhantom:true,publicKey:key,connect:async()=>({publicKey:key}),signTransaction:async()=>{calls.push('sign');return {signature:Uint8Array.of(1),serialize:()=>Uint8Array.of(1)};}};
  const window={phantom:{solana:wallet},solanaWeb3:{Keypair:{generate:()=>({publicKey:key})},Transaction:{from:()=>({feePayer:key,partialSign(){}})}},addEventListener(){},removeEventListener(){}};
  const fetch=async(url,options)=>{
    const {method}=JSON.parse(options.body);
    calls.push(method||'prepare');
    const data=url.endsWith('prepare')?(fail?{error:'Simulation rejected'}:{wire:'AA==',feeLamports:10000,lastValidBlockHeight:100}):{result:method==='getBlockHeight'?(expired?101:50):method==='getSignatureStatuses'?{value:[{confirmationStatus:status}]}:'2'};
    return {ok:!data.error,json:async()=>data};
  };
  const localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
  const publish=vm.runInNewContext(source+'\npublishPumpToken',{document,window,fetch,location:{origin:'http://localhost:3000',hash:'#launch-token'},atob,btoa,Uint8Array,AbortSignal,localStorage,setTimeout});
  const panel=document.getElementById('pump-receipt');
  return {publish,calls,storage,panel};
}
for(const scenario of ['cancel','expired','confirmed','simulation failure']){
  test(scenario,async()=>{
    const h=harness({fail:scenario==='simulation failure',expired:scenario==='expired'});
    const work=h.publish({route:'Pump.fun'});
    await new Promise(resolve=>setImmediate(resolve));
    assert.ok(!h.calls.includes('sign'));
    if(scenario!=='simulation failure')h.panel.children.find(e=>e.textContent===(scenario==='cancel'?'Cancel launch':'Sign launch in Phantom')).onclick();
    await work;
    assert.equal(h.calls.includes('sendTransaction'),scenario==='confirmed');
    assert.equal(h.calls.includes('sign'),scenario==='confirmed');
    if(scenario==='confirmed'){
      assert.equal(JSON.parse([...h.storage.values()][0]).state,'confirmed');
      assert.match(harness({storage:h.storage}).panel.children[0].textContent,/confirmed/);
    }
  });
}
