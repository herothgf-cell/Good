export interface ServerConfig {url:string;publicKey:string;serviceKey:string;origin:string;databaseHeaders:Record<string,string>}
export function loadServerConfig(get:(name:string)=>string|undefined):ServerConfig;
