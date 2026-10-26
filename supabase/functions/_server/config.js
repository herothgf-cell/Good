/** Server-only configuration. Do not import this module in frontend code. */
export function loadServerConfig(get) {
  const fromMap=(name)=>{
    const raw=get(name);if(!raw)return undefined;
    let map;try{map=JSON.parse(raw);}catch{throw new Error(`${name}: invalid JSON key map`);}
    if(!map||Array.isArray(map)||typeof map.default!=='string'||!map.default.trim())throw new Error(`${name}: default key is required`);
    return map.default;
  };
  const url=get('SUPABASE_URL');
  try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw new Error();}catch{throw new Error('SUPABASE_URL is missing or invalid');}
  const publicKey=fromMap('SUPABASE_PUBLISHABLE_KEYS')||get('SUPABASE_PUBLISHABLE_KEY')||get('SUPABASE_ANON_KEY');
  const serviceKey=fromMap('SUPABASE_SECRET_KEYS')||get('SUPABASE_SECRET_KEY')||get('SUPABASE_SERVICE_ROLE_KEY');
  if(!publicKey||publicKey.startsWith('sb_secret_'))throw new Error('유효한 공개 키가 필요합니다.');
  if(!serviceKey||serviceKey.startsWith('sb_publishable_'))throw new Error('유효한 서버 키가 필요합니다.');
  const origin=get('APP_ORIGIN')||'*';
  if(origin!=='*'){let u;try{u=new URL(origin);}catch{throw new Error('APP_ORIGIN must be an origin');}if(u.origin!==origin)throw new Error('APP_ORIGIN must not contain a path or trailing slash');}
  // New secret keys are not JWTs. The gateway derives the privileged role from apikey.
  const databaseHeaders={apikey:serviceKey,'Content-Type':'application/json',...(serviceKey.startsWith('sb_secret_')?{}:{Authorization:`Bearer ${serviceKey}`})};
  return {url:url.replace(/\/$/,''),publicKey,serviceKey,origin,databaseHeaders};
}
