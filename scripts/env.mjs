/** Only public frontend configuration is permitted. Never export every env key. */
export function loadPublicConfig(env={},file='') {
  const allowed=new Set(['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY']);
  const parsed={};
  for(const line of file.split(/\r?\n/)) {
    const match=line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if(!match||!allowed.has(match[1]))continue;
    let value=match[2];
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    else value=value.replace(/\s+#.*$/,'').trim();
    parsed[match[1]]=value;
  }
  return {
    supabaseUrl:env.SUPABASE_URL??env.NEXT_PUBLIC_SUPABASE_URL??parsed.SUPABASE_URL??parsed.NEXT_PUBLIC_SUPABASE_URL??'',
    supabaseAnonKey:env.SUPABASE_PUBLISHABLE_KEY??env.SUPABASE_ANON_KEY??env.NEXT_PUBLIC_SUPABASE_ANON_KEY??parsed.SUPABASE_PUBLISHABLE_KEY??parsed.SUPABASE_ANON_KEY??parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY??''
  };
}
