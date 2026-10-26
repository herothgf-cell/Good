import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('dist');const port=Number(process.env.PORT??3000);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
http.createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');const filename=path.resolve(root,relative);
 if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404).end('Not found');return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(filename)]??'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(filename).pipe(res);
}catch{res.writeHead(400).end('Bad request');}}).listen(port,'127.0.0.1',()=>console.log(`Praise Star: http://localhost:${port}`));
