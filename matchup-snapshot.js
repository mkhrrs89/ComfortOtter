(function(){
  if(window.ComfortOtterMatchupSnapshot) return;
  const LOCAL_KEY='modelMatchupMatchupSnapshotV1';
  const DB_NAME='modelMatchupMatchupSnapshotDB';
  const STORE='records';
  const STAT_KEYS=['wins','losses','tourneyBonus','tourneyCount','rating','ratingSeededFromWinPctV1'];
  let cache=null;

  function normalize(key,value){
    if(key==='wins'||key==='losses'||key==='tourneyCount') return Math.max(0,Number(value||0));
    if(key==='tourneyBonus') return Number(value||0);
    if(key==='rating') return Math.max(0,Math.min(100,Number(value||0)));
    if(key==='ratingSeededFromWinPctV1') return !!value;
    return value;
  }
  function readLocal(){
    if(cache) return cache;
    try{
      const raw=localStorage.getItem(LOCAL_KEY);
      const parsed=raw?JSON.parse(raw):{};
      cache=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
    }catch(_e){ cache={}; }
    return cache;
  }
  function writeLocal(){
    try{ localStorage.setItem(LOCAL_KEY,JSON.stringify(readLocal())); return true; }
    catch(err){ console.warn('Matchup snapshot localStorage write failed',err); return false; }
  }
  function mergeRow(row){
    if(!row||!row.id) return;
    const map=readLocal();
    const prior=map[row.id];
    if(!prior||Number(row.updatedAt||0)>=Number(prior.updatedAt||0)) map[row.id]={...prior,...row};
  }
  function openDb(){
    return new Promise((resolve,reject)=>{
      let req;
      try{ req=indexedDB.open(DB_NAME,1); }catch(err){ reject(err); return; }
      let settled=false;
      const finish=(fn)=>{ if(settled) return; settled=true; clearTimeout(timer); fn(); };
      const timer=setTimeout(()=>finish(()=>reject(new Error('Matchup snapshot DB open timeout'))),1800);
      req.onupgradeneeded=()=>{ const db=req.result; if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'}); };
      req.onsuccess=()=>finish(()=>resolve(req.result));
      req.onerror=()=>finish(()=>reject(req.error||new Error('Matchup snapshot DB open failed')));
      req.onblocked=()=>finish(()=>reject(new Error('Matchup snapshot DB blocked')));
    });
  }
  async function putIdb(row){
    if(!row||!row.id) return;
    const db=await openDb();
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).put(row);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error||new Error('Matchup snapshot DB write failed'));
        tx.onabort=()=>reject(tx.error||new Error('Matchup snapshot DB write aborted'));
      });
    }finally{ try{db.close();}catch(_e){} }
  }
  async function readIdb(){
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readonly');
        const req=tx.objectStore(STORE).getAll();
        req.onsuccess=()=>resolve(Array.isArray(req.result)?req.result:[]);
        req.onerror=()=>reject(req.error||new Error('Matchup snapshot DB read failed'));
      });
    }finally{ try{db.close();}catch(_e){} }
  }
  async function deleteIdb(id){
    const db=await openDb();
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error||new Error('Matchup snapshot DB delete failed'));
      });
    }finally{ try{db.close();}catch(_e){} }
  }

  function patch(id,patchValue){
    if(!id||!patchValue) return null;
    const map=readLocal();
    const prior=map[id]&&typeof map[id]==='object'?map[id]:{id};
    const next={...prior,id};
    let changed=false;
    for(const key of STAT_KEYS){
      if(Object.prototype.hasOwnProperty.call(patchValue,key)&&patchValue[key]!==undefined){ next[key]=normalize(key,patchValue[key]); changed=true; }
    }
    if(!changed) return null;
    next.updatedAt=Date.now();
    map[id]=next;
    writeLocal();
    putIdb(next).catch(err=>console.warn('Matchup snapshot IDB write failed',err));
    return next;
  }
  function putItems(items){
    for(const item of (Array.isArray(items)?items:[items])) if(item&&item.id) patch(item.id,item);
  }
  function overlay(item){
    if(!item||!item.id) return item;
    const row=readLocal()[item.id];
    if(!row) return item;
    const next={...item};
    for(const key of STAT_KEYS) if(row[key]!==undefined) next[key]=row[key];
    return next;
  }
  function remove(id){
    if(!id) return;
    const map=readLocal();
    if(Object.prototype.hasOwnProperty.call(map,id)){ delete map[id]; writeLocal(); }
    deleteIdb(id).catch(err=>console.warn('Matchup snapshot IDB delete failed',err));
  }
  const ready=(async()=>{
    readLocal();
    try{
      const rows=await readIdb();
      for(const row of rows) mergeRow(row);
      writeLocal();
    }catch(err){ console.warn('Matchup snapshot IDB restore unavailable',err); }
  })();
  window.ComfortOtterMatchupSnapshot={patch,putItems,overlay,delete:remove,ready,rows:()=>Object.values(readLocal())};
  try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{}); }catch(_e){}
})();
