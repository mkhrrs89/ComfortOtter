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
      ],
      [
        `const cloudTag='<script type=\\"module\\" src=\\"firestore-sync.js?v=20260831-v10\\"><'+'/script>';`,
        `const cloudTag='<script src=\\"record-journal.js?v=20260831-v10\\"><'+'/script><script type=\\"module\\" src=\\"firestore-sync.js?v=20260831-v10\\"><'+'/script>';`
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
