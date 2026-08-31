(async function loadComfortOtterV11(){
  const target=document.getElementById('loaderError');
  const detail=document.getElementById('loaderDetail');
  const setDetail=(text)=>{ if(detail) detail.textContent=text; };

  try{
    setDetail('Preparing matchup record persistence…');
    if(window.ComfortOtterMatchupSnapshot?.ready){
      await Promise.race([
        window.ComfortOtterMatchupSnapshot.ready,
        new Promise(resolve=>setTimeout(resolve,1200))
      ]);
    }

    const response=await fetch('direct-loader.js?v=20260831-v11',{cache:'no-store'});
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
        "html = html.split(durableNormalizeCall).join('const normalized = normalizeItem(durableStartupOverlay(it));');",
        "html = html.split(durableNormalizeCall).join('const normalized = normalizeItem(window.ComfortOtterMatchupSnapshot ? window.ComfortOtterMatchupSnapshot.overlay(durableStartupOverlay(it)) : durableStartupOverlay(it));');"
      ],
      [
        `"        \\\"            if(hasStatPatch){ persistStatPatch(id,patch).catch(err=>console.warn('Stat persistence failed',err)); }\\\",",`,
        `"        \\\"            if(hasStatPatch){ persistStatPatch(id,patch).catch(err=>console.warn('Stat persistence failed',err)); if(window.ComfortOtterMatchupSnapshot){ window.ComfortOtterMatchupSnapshot.patch(id,patch); } }\\\",",`
      ],
      [
        `"        '        durableStatsPutItems(next);',",`,
        `"        '        durableStatsPutItems(next);',",\n"        '        if(window.ComfortOtterMatchupSnapshot){ window.ComfortOtterMatchupSnapshot.putItems(next); }',",`
      ],
      [
        `"      const deleteFastNew = deleteFastOld + durableNL + '      durableStatsDelete(id);';",`,
        `"      const deleteFastNew = deleteFastOld + durableNL + '      durableStatsDelete(id);' + durableNL + '      if(window.ComfortOtterMatchupSnapshot){ window.ComfortOtterMatchupSnapshot.delete(id); }';",`
      ],
      [
        'Direct loader build v8',
        'Direct loader build v11'
      ],
      [
        'firestore-sync.js?v=20260830-v8',
        'firestore-sync.js?v=20260831-v11'
      ]
    ];

    for(const [oldText,newText] of replacements){
      const count=source.split(oldText).length-1;
      if(count!==1) throw new Error('v11 loader patch point mismatch: '+oldText+' (found '+count+')');
      source=source.replace(oldText,newText);
    }

    setDetail('Launching ComfortOtter…');
    new Function(source)();
  }catch(error){
    console.error('ComfortOtter v11 loader failed',error);
    if(target){
      target.textContent='ComfortOtter could not finish loading.\n\n'+(error&&error.message?error.message:error)+'\n\nDirect loader build v11';
    }
  }
})();
