import {createInterface} from 'node:readline';
let initialized=false;
createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);
 if(m.method==='notifications/initialized'){initialized=m.jsonrpc==='2.0';return;}
 if(m.method==='silence')return;
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{initialized}})+'\n');
});
