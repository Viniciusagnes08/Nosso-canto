const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const nodes = new Map();
function getNode(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',open:false,disabled:false,addEventListener(){},showModal(){this.open=true},close(){this.open=false},classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){}});return nodes.get(selector)}
const local={};
const context={console,Date,URL,Math,JSON,Map,Set,FormData,File:class {},setTimeout,clearTimeout,AbortSignal,Blob,
 document:{querySelector:getNode,querySelectorAll(){return[]},addEventListener(){},createElement(){return getNode('temp')},body:{append(){}}},
 localStorage:{getItem(k){return local[k]||null},setItem(k,v){local[k]=v}},
 navigator:{},location:{hash:''},crypto:require('crypto').webcrypto,confirm(){return true},
 scrollTo(){},addEventListener(){},
};
context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname+'/assets/app.js','utf8'),context,{filename:'app.js'});
assert(getNode('#app').innerHTML.includes('Perto, mesmo'),'home hero rendered');
for(const route of ['diario','calendario','desafios','memorias','musicas','ajustes','inicio']){
 vm.runInContext(`navigate('${route}')`,context);
 assert(getNode('#app').innerHTML.length>250,route+' rendered');
}
vm.runInContext("data.entries.push({id:'test-1',type:'mood',owner:'self',created:new Date().toISOString(),date:localDay(),mood:'feliz',shared:false});persist();navigate('inicio')",context);
assert(getNode('#app').innerHTML.includes('Humores registrados'),'mood visible in home');
assert(JSON.parse(local['entre-nos-local-v1']).entries.length===1,'record persisted');
vm.runInContext('addPreset(0)',context);
assert(JSON.parse(local['entre-nos-local-v1']).entries.length===2,'challenge persisted');
console.log('OK: seven routes, state write, mood rendering and challenge creation');
