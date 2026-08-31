(function installRedundantRecordJournal(){
  if(window.ComfortOtterRecordStore) return;
  const LOCAL_KEY='modelMatchupDurableStatsV1';
  const DB_NAME='modelMatchupRecordJournalDB';
  const STORE_NAME='records';
  const STAT_KEYS=['wins','losses','tourneyBonus','tourneyCount','rating','ratingSeededFromWinPctV1'];

  const normalize=(key,value)=>{
    if(key==='wins'||key==='losses'||key==='tourneyCount') return Math.max(0,Number(value||0));
    if(key==='tourneyBonus') return Number(value||0);
    if(key==='rating') return Math.max(0,Math.min(100,Number(value||0)));
    if(key==='ratingSeededFromWinPctV1') return !!value;
    return value;
  };
  const readLocal=()=>{
    try{
      const raw=localStorage.getItem(LOCAL_KEY);
      const parsed=raw?JSON.parse(raw):{};
      return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
    }catch(_e){ return {}; }
  };
  const writeLocal=(map)=>{
    try{ localStorage.setItem(LOCAL_KEY,JSON.stringify(map||{})); return true; }
    catch(err){ console.warn('Redundant record journal localStorage write failed',err); return false; }
  };
  const makeRows=(items,baseMap)=>{
    const map=baseMap||readLocal();
    const now=Date.now();
    const rows=[];
    for(const item of (Array.isArray(items)?items:[items])){
      if(!item||!item.id) continue;
      const existing=map[item.id]&&typeof map[item.id]==='object'?map[item.id]:{id:item.id};
      const next={...existing,id:item.id};
      let changed=false;
      for(const key of STAT_KEYS){
        if(Object.prototype.hasOwnProperty.call(item,key)&&item[key]!==undefined){
          next[key]=normalize(key,item[key]);
          changed=true;
        }
      }
      if(changed){ next.updatedAt=now; map[item.id]=next; rows.push(next); }
    }
    if(rows.length) writeLocal(map);
    return {map,rows};
  };
  const openDb=(timeoutMs=2500)=>new Promise((resolve,reject)=>{
    let settled=false;
    let req;
    try{ req=indexedDB.open(DB_NAME,1); }catch(err){ reject(err); return; }
    const timer=setTimeout(()=>{
      if(settled) return;
      settled=true;
      reject(new Error('Timed out opening redundant record journal.'));
    },timeoutMs);
    const finish=(fn)=>{
      if(settled) return;
      settled=true;
      clearTimeout(timer);
      fn();
    };
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME,{keyPath:'id'});
    };
    req.onsuccess=()=>finish(()=>resolve(req.result));
    req.onerror=()=>finish(()=>reject(req.error||new Error('Could not open redundant record journal.')));
    req.onblocked=()=>finish(()=>reject(new Error('Redundant record journal is blocked.'));
  });
  const putRowsIdb=async(rows)=>{
    const valid=(rows||[]).filter(row=>row&&row.id);
    if(!valid.length) return;
    const db=await openDb();
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,'readwrite');
        const store=tx.objectStore(STORE_NAME);
        for(const row of valid) store.put(row);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error||new Error('Redundant record journal write failed.'));
        tx.onabort=()=>reject(tx.error||new Error('Redundant record journal write aborted.'));
      });
    }finally{ try{db.close();}catch(_e){} }
  };
  const getRowsIdb=async()=>{
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,'readonly');
        const req=tx.objectStore(STORE_NAME).getAll();
        req.onsuccess=()=>resolve(Array.isArray(req.result)?req.result:[]);
        req.onerror=()=>reject(req.error||new Error('Redundant record journal read failed.'));
      });
    }finally{ try{db.close();}catch(_e){} }
  };
  const deleteIdb=async(id)=>{
    if(!id) return;
    const db=await openDb();
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error||new Error('Redundant record journal delete failed.'));
      });
    }finally{ try{db.close();}catch(_e){} }
  };

  function patch(id,patchValue){
    if(!id||!patchValue) return Promise.resolve(null);
    const result=makeRows([{id,...patchValue}],readLocal());
    const row=result.rows[0]||null;
    if(!row) return Promise.resolve(null);
    return putRowsIdb([row]).catch(err=>console.warn('Redundant record journal IDB write failed',err)).then(()=>row);
  }
  function recordMatch(winnerId,wins,loserId,losses){
    const result=makeRows([{id:winnerId,wins},{id:loserId,losses}],readLocal());
    if(!result.rows.length) return Promise.resolve();
    return putRowsIdb(result.rows).catch(err=>console.warn('Redundant matchup journal IDB write failed',err));
  }
  function putItems(items){
    const result=makeRows(items,readLocal());
    if(!result.rows.length) return Promise.resolve();
    return putRowsIdb(result.rows).catch(err=>console.warn('Redundant record journal bulk write failed',err));
  }
  async function rows(){
    const localMap=readLocal();
    let idbRows=[];
    try{ idbRows=await getRowsIdb(); }catch(err){ console.warn('Redundant record journal IDB read failed',err); }
    const merged=new Map();
    for(const row of idbRows){ if(row&&row.id) merged.set(row.id,row); }
    for(const row of Object.values(localMap)){
      if(!row||!row.id) continue;
      const prior=merged.get(row.id);
      if(!prior||Number(row.updatedAt||0)>=Number(prior.updatedAt||0)) merged.set(row.id,row);
    }
    const result=Array.from(merged.values());
    if(result.length){
      const healed={};
      for(const row of result) healed[row.id]=row;
      writeLocal(healed);
      putRowsIdb(result).catch(err=>console.warn('Could not heal redundant record journal',err));
    }
    return result;
  }
  function remove(id){
    if(!id) return Promise.resolve();
    const map=readLocal();
    if(Object.prototype.hasOwnProperty.call(map,id)){ delete map[id]; writeLocal(map); }
    return deleteIdb(id).catch(err=>console.warn('Redundant record journal delete failed',err));
  }

  window.ComfortOtterRecordStore={patch,recordMatch,putItems,rows,delete:remove};
  try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{}); }catch(_e){}
})();

(async function loadComfortOtterV10(){
  const target=document.getElementById('loaderError');
  const detail=document.getElementById('loaderDetail');
  const setDetail=(text)=>{ if(detail) detail.textContent=text; };

  try{
    setDetail('Preparing redundant record persistence…');
    const response=await fetch('direct-loader.js?v=20260831-v10',{cache:'no-store'});
    if(!response.ok) throw new Error(response.status+' '+response.statusText+' loading direct-loader.js');
    let source=await response.text();

    const replacements=[
      [
        "const durableNormalizeToken = 'const normalizeItem = (it)=>({';",
        "const durableNormalizeToken = '    const loadedIds = new Set();';"
      ],
      [
        "if(durableNormalizePos < 0) throw new Error('Durable startup normalizeItem function not found.');",
        "if(durableNormalizePos < 0) throw new Error('Durable startup library-load marker not found.');"
      ],
      [
        "if(durableNormalizeCallCount < 2) throw new Error('Durable startup normalizeItem calls not found.');",
        "if(durableNormalizeCallCount < 1) throw new Error('Durable startup normalizeItem calls not found.');"
      ],
      [
        `"        '    const durableStartupRows = durableStatsRows();',",`,
        `"        '    let durableStartupRows = durableStatsRows();',",\n"        '    try{ if(window.ComfortOtterRecordStore){ const durableBackupRows = await window.ComfortOtterRecordStore.rows(); const durableMergedRows = new Map(); for(const row of (durableBackupRows||[])){ if(row&&row.id) durableMergedRows.set(row.id,row); } for(const row of durableStartupRows){ if(row&&row.id){ const prior = durableMergedRows.get(row.id); if(!prior || Number(row.updatedAt||0) >= Number(prior.updatedAt||0)) durableMergedRows.set(row.id,row); } } durableStartupRows = Array.from(durableMergedRows.values()); } }catch(err){ console.warn(\\'Redundant record journal startup restore failed\\',err); }',",\n"        '    if(durableStartupRows.length){ durableStatsPutItems(durableStartupRows); }',",`
      ],
      [
        `"        \\\"            if(hasStatPatch){ persistStatPatch(id,patch).catch(err=>console.warn('Stat persistence failed',err)); }\\\",",`,
        `"        \\\"            if(hasStatPatch){ persistStatPatch(id,patch).catch(err=>console.warn('Stat persistence failed',err)); if(window.ComfortOtterRecordStore){ window.ComfortOtterRecordStore.patch(id,patch); } }\\\",",`
      ],
      [
        `"      durableRecordWinBlock = durableRecordWinBlock.replace(durableWinnerPatchCall,'        durableStatsPatch(winnerId,{wins:wWins});' + durableNL + durableWinnerPatchCall);",`,
        `"      durableRecordWinBlock = durableRecordWinBlock.replace(durableWinnerPatchCall,'        durableStatsPatch(winnerId,{wins:wWins});' + durableNL + '        if(window.ComfortOtterRecordStore){ window.ComfortOtterRecordStore.recordMatch(winnerId,wWins,loserId,lLoss); }' + durableNL + durableWinnerPatchCall);",`
      ],
      [
        'Direct loader build v8',
        'Direct loader build v10'
      ],
      [
        'firestore-sync.js?v=20260830-v8',
        'firestore-sync.js?v=20260831-v10'
      ]
    ];

    for(const [oldText,newText] of replacements){
      const count=source.split(oldText).length-1;
      if(count!==1) throw new Error('v10 loader patch point mismatch: '+oldText+' (found '+count+')');
      source=source.replace(oldText,newText);
    }

    setDetail('Launching ComfortOtter…');
    new Function(source)();
  }catch(error){
    console.error('ComfortOtter v10 loader failed',error);
    if(target){
      target.textContent='ComfortOtter could not finish loading.\n\n'+(error&&error.message?error.message:error)+'\n\nDirect loader build v10';
    }
  }
})();
