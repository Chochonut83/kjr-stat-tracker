// Connects the app to your Firebase project. You don't need to edit this file.
import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,signInAnonymously,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,memoryLocalCache,doc,collection,getDoc,getDocs,setDoc,deleteDoc,onSnapshot,query,orderBy,writeBatch,runTransaction} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const norm=e=>{const x=new Error((e&&e.message)||String(e));x.code=String((e&&e.code)||"unknown").replace(/^firestore\//,"").replace(/^auth\//,"").replace(/-/g,"_");return x};
const cfg=window.FIREBASE_CONFIG;
let api;
if(!cfg||!cfg.apiKey||/PASTE/i.test(cfg.apiKey)){
  api={noConfig:true};
}else{
  const app=initializeApp(cfg);
  let fs;
  try{fs=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()}),ignoreUndefinedProperties:true})}
  catch(e){fs=initializeFirestore(app,{localCache:memoryLocalCache(),ignoreUndefinedProperties:true})}
  const auth=getAuth(app);
  // Reuse this phone's anonymous sign-in if it has one; only create one the very first time.
  const ready=new Promise((res,rej)=>{let asked=false;const un=onAuthStateChanged(auth,u=>{
    if(u){un();res({uid:u.uid})}
    else if(!asked){asked=true;signInAnonymously(auth).catch(e=>{un();rej(norm(e))})}
  })});
  const D=p=>doc(fs,p),C=p=>collection(fs,p);
  const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(Object.assign(new Error("timeout"),{code:"timeout"})),ms))]);
  api={
    ready,
    get:async p=>{try{const s=await getDoc(D(p));return s.exists()?s.data():null}catch(e){throw norm(e)}},
    getColl:async p=>{try{const s=await getDocs(C(p));return s.docs.map(d=>({id:d.id,data:d.data()}))}catch(e){throw norm(e)}},
    set:(p,d)=>setDoc(D(p),d).catch(e=>{throw norm(e)}),
    del:p=>deleteDoc(D(p)).catch(e=>{throw norm(e)}),
    batch:async ops=>{const b=writeBatch(fs);for(const o of ops){if(o.op==="del")b.delete(D(o.path));else b.set(D(o.path),o.data)}try{await b.commit()}catch(e){throw norm(e)}},
    watchDoc:(p,cb,err)=>onSnapshot(D(p),s=>cb(s.exists()?s.data():null,{fromCache:s.metadata.fromCache,pending:s.metadata.hasPendingWrites}),e=>err&&err(norm(e))),
    watchColl:(p,field,dir,cb,err)=>onSnapshot(query(C(p),orderBy(field,dir||"asc")),{includeMetadataChanges:true},s=>cb(s.docs.map(d=>d.data()),{fromCache:s.metadata.fromCache}),e=>err&&err(norm(e))),
    // Read-modify-write in one step, so two phones can't both grab the tracker spot.
    claim:(p,fn)=>withTimeout(runTransaction(fs,async t=>{const s=await t.get(D(p));const next=fn(s.exists()?s.data():null);t.set(D(p),next);return next}),9000).catch(e=>{throw e&&(e.code==="busy"||e.code==="timeout")?e:norm(e)}),
  };
}
window.__teamDB(api);
