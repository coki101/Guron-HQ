(() => {
  const form = document.querySelector('#launch-form');
  const fields = form.elements;
  const get = id => document.getElementById(id);
  const defaultLogo = 'assets/brand.jpg';
  let artwork = defaultLogo;
  let reviewed;
  let imageVersion = 0;

  function draft() {
    return {
      format: 'guron-launch-draft-v1',
      name: fields.namedItem('name').value.trim(),
      symbol: fields.symbol.value.trim().toUpperCase(),
      description: fields.description.value.trim(),
      website: fields.website.value.trim(),
      route: fields.route.value,
      network: 'Solana',
      logo: artwork,
      settings: fields.route.value === 'Standard' ? {
        supply: fields.supply.value, liquiditySOL: fields.liquidity.value
      } : null
    };
  }

  function preview() {
    const token = draft();
    reviewed = null;
    get('launch-review').hidden = true;
    get('launch-status').textContent = '';
    const settings = get('standard-settings');
    settings.hidden = settings.disabled = !token.settings;
    get('pump-note').hidden = Boolean(token.settings);
    get('token-name').textContent = token.name || 'Token name';
    get('token-symbol').textContent = '$' + (token.symbol || 'TICKER');
    get('token-description').textContent = token.description;
    get('token-logo').src = artwork;
    get('token-settings').textContent = token.settings
      ? 'Standard · '+Number(token.settings.supply).toLocaleString('en-US')+' tokens · '+token.settings.liquiditySOL+' SOL planned'
      : 'Solana · Pump.fun';
    for (const name of ['name','description']) {
      const tooLong = name === 'name' && token.route === 'Pump.fun' && new TextEncoder().encode(token.name).length > 32;
      fields.namedItem(name).setCustomValidity(tooLong ? 'Pump.fun accepts a name of up to 32 UTF-8 bytes.' : token[name] ? '' : 'Enter a value.');
    }
  }
  form.addEventListener('input', preview);
  fields.route.onchange = preview;
  fields.logo.onchange = async () => {
    const version = ++imageVersion;
    const file = fields.logo.files[0];
    fields.logo.setCustomValidity('');
    artwork = defaultLogo;
    preview();
    if (!file) return;
    fields.logo.setCustomValidity('Checking image…');
    try {
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 2*1024*1024) throw Error();
      const data = await new Promise((resolve,reject)=>{
        const reader = new FileReader();
        reader.onload = ()=>resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const img = new Image();
      img.src = data;
      await img.decode();
      if (version !== imageVersion) return;
      artwork = data;
      fields.logo.setCustomValidity('');
      preview();
    } catch {
      if (version !== imageVersion) return;
      fields.logo.setCustomValidity('Select a readable PNG, JPEG or WebP under 2 MB.');
      fields.logo.reportValidity();
    }
  };
  form.onsubmit = event => {
    event.preventDefault();
    reviewed = draft();
    const summary = [reviewed.name+' ($'+reviewed.symbol+')',get('token-settings').textContent];
    if (reviewed.website) summary.push(reviewed.website);
    get('launch-summary').textContent = summary.join(' · ')+(reviewed.route === 'Pump.fun' ? '. Mainnet creation only. Confirm costs in Phantom.' : '. Draft only.');
    get('pump-open').hidden = reviewed.route !== 'Pump.fun';
    get('launch-review').hidden = false;
    get('launch-review').focus();
  };
  get('pump-open').onclick = () => { if (reviewed?.route === 'Pump.fun') publishPumpToken(reviewed); };
  get('download-draft').onclick = () => {
    if (!reviewed) return;
    const blob = new Blob([JSON.stringify(reviewed,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = reviewed.symbol.toLowerCase()+'-launch.json';
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    get('launch-status').textContent = 'Draft export prepared.';
  };
  preview();
})();


