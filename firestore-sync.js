import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOVGz7QH_iPtxoM25baGqTIR-2yxUQwH8",
  authDomain: "comforting-otter.firebaseapp.com",
  projectId: "comforting-otter",
  storageBucket: "comforting-otter.firebasestorage.app",
  messagingSenderId: "1074346290690",
  appId: "1:1074346290690:web:bd2721e73fbdf029e7411b",
  measurementId: "G-2JT31JFGNJ"
};

const DURABLE_KEY = 'modelMatchupDurableStatsV1';
const SYNCED_KEY = 'modelMatchupFirestoreSyncedStatsV1';
const STAT_KEYS = ['wins','losses','tourneyBonus','tourneyCount','rating','ratingSeededFromWinPctV1'];
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let flushing = false;
let wrappedCloudSave = false;

signInAnonymously(auth).catch(err=>console.warn('Firestore stats anonymous auth unavailable',err));

function readJson(key){
  try{
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }catch(_e){ return {}; }
}
function writeJson(key,value){
  try{ localStorage.setItem(key,JSON.stringify(value||{})); return true; }
  catch(err){ console.warn('Could not persist Firestore stat sync state',err); return false; }
}
function currentDurable(id){
  const row = readJson(DURABLE_KEY)[id];
  return row && typeof row === 'object' ? row : null;
}
function statPatchFrom(row){
  if(!row || !row.id) return null;
  const patch = { id: row.id, updatedAt: new Date().toISOString() };
  for(const key of STAT_KEYS){ if(row[key] !== undefined) patch[key] = row[key]; }
  return patch;
}

async function flush(){
  if(flushing || !navigator.onLine) return;
  flushing = true;
  try{
    const durable = readJson(DURABLE_KEY);
    const synced = readJson(SYNCED_KEY);
    const pending = Object.values(durable)
      .filter(row=>row && row.id)
      .filter(row=>Number(row.updatedAt||0) > Number(synced[row.id]||0))
      .sort((a,b)=>Number(a.updatedAt||0)-Number(b.updatedAt||0))
      .slice(0,12);

    for(const row of pending){
      const patch = statPatchFrom(row);
      if(!patch) continue;
      try{
        await setDoc(doc(db,'images',row.id),patch,{merge:true});
        const latest = currentDurable(row.id);
        if(latest && Number(latest.updatedAt||0) === Number(row.updatedAt||0)){
          synced[row.id] = Number(row.updatedAt||Date.now());
          writeJson(SYNCED_KEY,synced);
        }
      }catch(err){
        console.warn('Firestore stat sync failed for',row.id,err);
        break;
      }
    }
  }finally{
    flushing = false;
  }
}

function wrapExistingCloudSave(){
  if(wrappedCloudSave || typeof window.saveItemToCloud !== 'function') return;
  const original = window.saveItemToCloud;
  window.saveItemToCloud = async function(item){
    if(item && item.id){
      const durable = currentDurable(item.id);
      if(durable) item = {...item,...Object.fromEntries(STAT_KEYS.filter(k=>durable[k]!==undefined).map(k=>[k,durable[k]]))};
    }
    return original(item);
  };
  wrappedCloudSave = true;
}

setInterval(()=>{ wrapExistingCloudSave(); flush().catch(()=>{}); },1000);
window.addEventListener('online',()=>flush().catch(()=>{}));
window.addEventListener('pageshow',()=>flush().catch(()=>{}));
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) flush().catch(()=>{}); });
setTimeout(()=>{ wrapExistingCloudSave(); flush().catch(()=>{}); },250);
