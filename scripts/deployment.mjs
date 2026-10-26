import {loadPublicConfig} from './env.mjs';
import {readFileSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

/** Validate only public values. Never log the key (including on errors). */
export function checkDeployment(config,{requireCloud=false}={}) {
  const {supabaseUrl:url,supabaseAnonKey:key}=config;
  if(!url&&!key) {
    if(requireCloud)throw new Error('가족 공유 배포에는 Supabase URL과 공개 키가 필요합니다.');
    return 'demo';
  }
  if(!url||!key)throw new Error('Supabase URL과 공개 키를 함께 설정해 주세요.');
  if(/YOUR_|PLACEHOLDER/i.test(url)||/YOUR_|PLACEHOLDER/i.test(key))throw new Error('예시 값을 실제 URL과 공개 키로 교체해 주세요.');
  let parsed;try{parsed=new URL(url);}catch{throw new Error('Supabase URL이 올바르지 않습니다.');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/'||url.endsWith('/'))throw new Error('Supabase URL은 경로와 마지막 /가 없는 HTTPS 주소여야 합니다.');
  if(key.startsWith('sb_secret_'))throw new Error('서버 비밀 키를 게시할 수 없습니다. 공개 키를 사용해 주세요.');
  if(!key.startsWith('sb_publishable_')) {
    let claims;try{claims=JSON.parse(Buffer.from(key.split('.')[1]??'','base64url').toString());}catch{throw new Error('유효한 publishable 또는 anon 공개 키를 입력해 주세요.');}
    if(key.split('.').length!==3||claims?.role!=='anon')throw new Error('anon 역할의 공개 키만 허용합니다.');
  }
  return 'cloud';
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const config=loadPublicConfig(process.env,existsSync('.env.local')?readFileSync('.env.local','utf8'):'');
    const mode=checkDeployment(config,{requireCloud:!process.argv.includes('--allow-demo')});
    console.log(mode==='cloud'?'설정 검사 통과: 가족 공유 모드. 실제 DB·함수 연결은 별도 확인이 필요합니다.':'설정 검사 통과: 체험 모드. 기록은 이 브라우저에만 저장됩니다.');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
