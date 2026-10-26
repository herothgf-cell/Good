export interface StoragePort {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export interface Config {supabaseUrl:string;supabaseAnonKey:string}
export interface Session {access_token:string;refresh_token:string;expires_at:number;user:{id:string;is_anonymous?:boolean;email?:string}}
export class ApiError extends Error {constructor(message:string,public status=0,public uncertain=false,public code=''){super(message);this.name='ApiError';}}
// Authentication failure is not proof that an earlier, timed-out transaction failed.
export function shouldRetainPending(error:unknown):boolean {return error instanceof ApiError&&(error.uncertain||error.status===401);}
export async function requestJson(url:string,init:RequestInit={}):Promise<any> {
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),20000);
  try {
    const response=await fetch(url,{...init,signal:controller.signal});
    const raw=await response.text(); let data:any=null;
    try{data=raw?JSON.parse(raw):null;}catch{throw new ApiError('서버 응답을 읽지 못했어요. 같은 요청으로 결과를 확인해 주세요.',response.status,true);}
    if(!response.ok) {
      const code=data?.code??data?.error_code??'';
      const messages:Record<string,string>={invalid_credentials:'이메일 또는 비밀번호를 확인해 주세요.',email_not_confirmed:'이메일 인증 또는 계정 확인이 필요해요.',anonymous_provider_disabled:'Supabase에서 아이 기기용 익명 로그인을 활성화해 주세요.'};
      const message=messages[code]??(typeof data?.message==='string'?data.message:typeof data?.error==='string'?data.error:'서버 요청을 처리하지 못했어요.');
      throw new ApiError(message.slice(0,240),response.status,response.status>=500,code);
    }
    return data;
  }catch(error){if(error instanceof ApiError)throw error;throw new ApiError('연결이 끊겼어요. 이미 처리됐을 수 있으니 같은 요청으로 결과를 확인해 주세요.',0,true);}
  finally{clearTimeout(timer);}
}
export function validateConfig(config:Config):boolean {
  if(!config.supabaseUrl&&!config.supabaseAnonKey)return false;
  if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(config.supabaseUrl))throw new Error('Supabase URL은 https 주소여야 해요.');
  if(!config.supabaseAnonKey)throw new Error('Supabase 공개 키가 필요해요.');
  if(config.supabaseAnonKey.startsWith('sb_secret_'))throw new Error('서버 전용 secret 키를 웹앱에 넣으면 안 됩니다. 공개 키를 사용해 주세요.');
  try{const claims=JSON.parse(atob((config.supabaseAnonKey.split('.')[1]??'').replace(/-/g,'+').replace(/_/g,'/')));if(claims.role==='service_role')throw new Error('SERVICE_ROLE');}catch(e){if(e instanceof Error&&e.message==='SERVICE_ROLE')throw new Error('service_role 키는 브라우저에서 사용할 수 없습니다.');}
  return true;
}
export class AuthClient {
  private key:string; private refreshing:Promise<Session>|null=null;
  constructor(public config:Config,private storage:StoragePort){this.key=`praise-star.auth.${new URL(config.supabaseUrl).hostname}`;}
  session():Session|null {try{const raw=this.storage.getItem(this.key);if(!raw)return null;const s=JSON.parse(raw);return s?.access_token&&s?.refresh_token&&s?.user?.id?s:null;}catch{return null;}}
  private save(data:any):Session {
    if(!data?.access_token || !data?.refresh_token || !data?.user?.id)throw new ApiError('로그인 세션을 확인하지 못했어요.',401);
    const session:Session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+(data.expires_in??3600),user:data.user};
    this.storage.setItem(this.key,JSON.stringify(session));return session;
  }
  private headers(token?:string):Record<string,string>{return {'Content-Type':'application/json',apikey:this.config.supabaseAnonKey,...(token?{Authorization:`Bearer ${token}`}:{})};}
  async login(email:string,password:string):Promise<Session>{return this.save(await requestJson(`${this.config.supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:this.headers(),body:JSON.stringify({email:email.trim(),password})}));}
  async anonymous():Promise<Session>{return this.save(await requestJson(`${this.config.supabaseUrl}/auth/v1/signup`,{method:'POST',headers:this.headers(),body:JSON.stringify({data:{nickname:'아이 기기'}})}));}
  async validSession():Promise<Session> {
    const session=this.session(); if(!session)throw new ApiError('가족 계정으로 로그인해 주세요.',401,false,'AUTH_REQUIRED');
    if(session.expires_at>Date.now()/1000+60)return session;
    if(this.refreshing)return this.refreshing;
    this.refreshing=(async()=>{try{return this.save(await requestJson(`${this.config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:this.headers(),body:JSON.stringify({refresh_token:session.refresh_token})}));}
      catch(e){if(e instanceof ApiError&&(e.status===400||e.status===401))this.storage.removeItem(this.key);throw e;}finally{this.refreshing=null;}})();
    return this.refreshing;
  }
  async logout():Promise<void>{const s=this.session();this.storage.removeItem(this.key);if(s)try{await requestJson(`${this.config.supabaseUrl}/auth/v1/logout?scope=local`,{method:'POST',headers:this.headers(s.access_token)});}catch{/* Local session was removed even when network is unavailable. */}}
  async api(path:string,body?:unknown):Promise<any>{const s=await this.validSession();return requestJson(`${this.config.supabaseUrl}${path}`,{method:body===undefined?'GET':'POST',headers:this.headers(s.access_token),...(body===undefined?{}:{body:JSON.stringify(body)})});}
}
