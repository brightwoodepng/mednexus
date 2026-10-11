import { it } from "vitest"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict'), ts = require('typescript');
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let db, lock = Promise.resolve(), injectedFailure = false;
const json = (value, init = {}) => Response.json(value, init);
function connect() {
  let releaseLock, snapshot;
  return { release() {}, async query(sql, params = []) {
    if(sql === 'BEGIN') return { rows: [] };
    if(sql === 'COMMIT' || sql === 'ROLLBACK') { if(sql === 'ROLLBACK' && snapshot) {db.balance=snapshot.balance;db.inventory=new Map(snapshot.inventory);db.ledger=[...snapshot.ledger]} releaseLock?.();releaseLock=undefined;return {rows:[]}; }
    if(sql.includes('SELECT balance FROM mednexus_season_wallets')) {const previous=lock;lock=new Promise(resolve=>releaseLock=resolve);await previous;snapshot={balance:db.balance,inventory:new Map(db.inventory),ledger:[...db.ledger]};return {rows:[{balance:db.balance}]};}
    if(sql.includes('INSERT INTO mednexus_user_inventory')) {if(!db.inventory.has(params[1]))db.inventory.set(params[1],0);return {rows:[]};}
    if(sql.includes('SELECT quantity FROM mednexus_user_inventory')) return {rows:[{quantity:db.inventory.get(params[1])??0}]};
    if(sql.includes('UPDATE mednexus_user_inventory')) {if(injectedFailure && params[1]==='frame_gold')throw Error('Injected grant failure');db.inventory.set(params[1],Number(params[2]));return {rows:[]};}
    if(sql.includes('UPDATE mednexus_season_wallets')) {db.balance-=Number(params[1]);return {rows:[]};}
    if(sql.includes('INSERT INTO mednexus_np_transactions')) {db.ledger.push(JSON.parse(params[4]));return {rows:[]};}
    if(sql.includes('SELECT balance, lifetime_earned')) return {rows:[{balance:db.balance,lifetime_earned:10000,rank_points:0}]};
    throw Error('Unexpected SQL: '+sql);
  }};
}
const stubs = {
  'next/server': {NextResponse:{json}},
  '@/lib/db': {default:{connect:async()=>connect()}},
  '@/lib/request-auth': {requireRegisteredUser:async()=>({uid:'authenticated-user'}),unauthorized:()=>json({}, {status:401})},
  '@/lib/economy-seasons': {getActiveSeason:async()=>({id:'season-1'})},
  '@/lib/economy-api': {countEconomyQueries:x=>x,economyJson:(name,value)=>json(value),economyMetrics:()=>({})},
  '@/lib/notification-schema': {ensureNotificationSchema:async()=>{}},
  '@/lib/personal-notifications': {notifyUser:async()=>{}},
};
const cache = {};
function loadModule(file) {
  if(cache[file])return cache[file].exports;
  const mod={exports:{}};cache[file]=mod;
  const text=fs.readFileSync(file,'utf8');const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',js)(id=>stubs[id]??(id.startsWith('@/')?loadModule(path.resolve(sourceRoot,id.slice(2)+'.ts')):require(id)),mod,mod.exports);return mod.exports;
}
const {POST}=loadModule(path.resolve(sourceRoot,'app/api/economy/store/route.ts'));
const buy=(id,extra={})=>POST(new Request('http://mednexus.test/api/economy/store',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({itemId:id,...extra})}));
function reset(balance=10000,inventory={}){db={balance,inventory:new Map(Object.entries(inventory)),ledger:[]};lock=Promise.resolve();injectedFailure=false;}
it("grants the complete bundle once at its configured price", async () => {
 let response, responses;
 reset();response=await buy('bundle_peeps_amani_gold');assert.equal(response.status,200);const result=await response.json();assert.equal(db.balance,7790);assert.deepEqual(result.inventory,{bundle_peeps_amani_gold:1,avatar_peeps_amani:1,frame_gold:1});assert.deepEqual(db.ledger[0].grantedComponents,['avatar_peeps_amani','frame_gold']);
});
it("charges only for the unowned frame", async () => {
 let response, responses;
 reset(2000,{avatar_peeps_amani:1});response=await buy('bundle_peeps_amani_gold');assert.equal(response.status,200);assert.equal(db.balance,810);assert.equal(db.inventory.get('avatar_peeps_amani'),1);assert.deepEqual(db.ledger[0].grantedComponents,['frame_gold']);
});
it("rejects a fully owned look without charging", async () => {
 let response, responses;
 reset(10000,{avatar_peeps_amani:1,frame_gold:1});response=await buy('bundle_peeps_amani_gold');assert.equal(response.status,400);assert.equal(db.balance,10000);assert.equal(db.ledger.length,0);assert.equal(db.inventory.has('bundle_peeps_amani_gold'),false);
});
it("rolls back inventory when the balance is insufficient", async () => {
 let response, responses;
 reset(1000);response=await buy('bundle_peeps_amani_gold');assert.equal(response.status,400);assert.equal(db.balance,1000);assert.equal(db.inventory.size,0);
});
it("rolls back all grants when a component update fails", async () => {
 let response, responses;
 reset();injectedFailure=true;const oldError=console.error;console.error=()=>{};response=await buy('bundle_peeps_amani_gold');console.error=oldError;assert.equal(response.status,500);assert.equal(db.inventory.size,0);assert.equal(db.balance,10000);assert.equal(db.ledger.length,0);
});
it("serializes duplicate simultaneous purchases", async () => {
 let response, responses;
 reset();responses=await Promise.all([buy('bundle_peeps_amani_gold'),buy('bundle_peeps_amani_gold')]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);assert.equal(db.balance,7790);assert.equal(db.ledger.length,1);
});
it("credits the shared frame across overlapping bundle purchases", async () => {
 let response, responses;
 reset();responses=await Promise.all([buy('bundle_peeps_amani_gold'),buy('bundle_adventurer_nova_gold')]);assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(db.balance,6260);assert.equal(db.inventory.get('frame_gold'),1);assert.equal(db.ledger.length,2);
});
it("rejects invalid quantities before charging", async () => {
 let response, responses;
 reset();response=await buy('bundle_peeps_amani_gold',{quantity:100,price:0});assert.equal(response.status,400);assert.equal(db.balance,10000);
});
it("preserves individual cosmetic purchase behavior", async () => {
 let response, responses;
 reset();response=await buy('title_pre_med');assert.equal(response.status,200);assert.equal(db.balance,9000);response=await buy('title_pre_med');assert.equal(response.status,400);assert.equal(db.balance,9000);
});
it("preserves consumable quantity bundles", async () => {
 let response, responses;
 reset();response=await buy('lifeline_freeze',{bundleId:'bundle_3'});assert.equal(response.status,200);assert.equal(db.balance,9325);assert.equal(db.inventory.get('lifeline_freeze'),3);
});