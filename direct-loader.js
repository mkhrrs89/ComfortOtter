(async function loadDirectComfortOtter(){
  const detail=(text)=>{ const el=document.getElementById('loaderDetail'); if(el) el.textContent=text; };

  async function fetchText(url,timeoutMs=8000){
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=setTimeout(()=>{try{if(controller)controller.abort();}catch(_e){}},timeoutMs);
    try{
      const response=await fetch(url,{cache:'no-store',signal:controller?controller.signal:undefined});
      if(!response.ok) throw new Error(response.status+' '+response.statusText+' for '+url);
      return await response.text();
    }finally{
      clearTimeout(timer);
    }
  }

  detail('Fetching stable app layers…');
  let [autoHdShell,durableShell]=await Promise.all([
    fetchText('stable-auto-hd-shell.html?v=20260830-v8'),
    fetchText('stable-index-shell.html?v=20260830-v8')
  ]);
  detail('Stable layers loaded. Preparing app…');

  const durableStartToken='      const durablePatch = String.raw`';
  const durableStart=durableShell.indexOf(durableStartToken);
  const durableUse=durableShell.indexOf('      wrapper = wrapper.replace(marker,durablePatch',durableStart);
  const durableEnd=durableShell.lastIndexOf('\n`;',durableUse);
  if(durableStart<0||durableUse<0||durableEnd<0){
    throw new Error('Could not extract the durable-stat patch.');
  }

  let durablePatchRaw=durableShell.slice(durableStart+durableStartToken.length,durableEnd);
  if(!durablePatchRaw.includes('DURABLE_STATS_STORAGE_KEY')||!durablePatchRaw.includes('persistStatPatch')){
    throw new Error('Durable-stat patch validation failed.');
  }

  const brittleGetAll=[
    "      if(html.split(durableGetAllOld).length - 1 !== 1) throw new Error('Durable idbGetAll patch point not found exactly once.');",
    '      html = html.replace(durableGetAllOld,durableGetAllNew);'
  ].join('\n');

  const robustGetAll=[
    "      const durableGetAllStart = '    async function idbGetAll(){';",
    "      const durableGetAllBaseStart = '    async function idbGetAllBase(){';",
    '      const durableGetAllStartPos = html.indexOf(durableGetAllStart);',
    '      const durableGetAllBasePos = durableGetAllStartPos >= 0 ? html.indexOf(durableGetAllBaseStart,durableGetAllStartPos + durableGetAllStart.length) : -1;',
    "      if(durableGetAllStartPos < 0 || durableGetAllBasePos < 0) throw new Error('Durable idbGetAll function boundary not found.');",
    '      const durableCurrentGetAll = html.slice(durableGetAllStartPos,durableGetAllBasePos);',
    "      if(!durableCurrentGetAll.includes('const baseItems = await idbGetAllBase();') || !durableCurrentGetAll.includes('fastStatsGetAll()')) throw new Error('Durable idbGetAll structure validation failed.');",
    '      let durableGetAllReplacement = durableGetAllNew;',
    "      if(durableCurrentGetAll.includes('tourneyIndexReplaceAll(baseItems).catch')){",
    '        const durableTourneyRefresh = [',
    "          '      tourneyIndexReplaceAll(baseItems).catch(err=>{',",
    "          \"        console.warn('Could not refresh tournament index from library load.',err);\",",
    "          '      });'",
    '        ].join(durableNL);',
    '        durableGetAllReplacement = durableGetAllReplacement.replace(',
    "          '      const baseItems = await idbGetAllBase();',",
    "          '      const baseItems = await idbGetAllBase();' + durableNL + durableTourneyRefresh",
    '        );',
    '      }',
    '      html = html.slice(0,durableGetAllStartPos) + durableGetAllReplacement + durableNL + durableNL + html.slice(durableGetAllBasePos);'
  ].join('\n');

  if(durablePatchRaw.split(brittleGetAll).length-1!==1){
    throw new Error('Could not upgrade the durable idbGetAll patch.');
  }
  durablePatchRaw=durablePatchRaw.replace(brittleGetAll,robustGetAll);

  const patchItemSectionStart=durablePatchRaw.indexOf('      const patchItemOld = [');
  const patchItemSectionEnd=patchItemSectionStart>=0
    ? durablePatchRaw.indexOf('      const replaceAllOld = [',patchItemSectionStart)
    : -1;
  if(patchItemSectionStart<0||patchItemSectionEnd<0){
    throw new Error('Could not locate the durable patchItem patch section.');
  }

  const robustPatchItem=[
    "      const durablePatchItemStart = '      async function patchItem(id,patch){';",
    "      const durablePatchItemEnd = '      async function addNewItems(';",
    '      const durablePatchItemStartPos = html.indexOf(durablePatchItemStart);',
    '      const durablePatchItemEndPos = durablePatchItemStartPos >= 0 ? html.indexOf(durablePatchItemEnd,durablePatchItemStartPos + durablePatchItemStart.length) : -1;',
    "      if(durablePatchItemStartPos < 0 || durablePatchItemEndPos < 0) throw new Error('patchItem durable function boundary not found.');",
    '      const durableCurrentPatchItem = html.slice(durablePatchItemStartPos,durablePatchItemEndPos);',
    "      const durablePatchItemWrite = 'idbPutMerged(updated);';",
    "      if(durableCurrentPatchItem.split(durablePatchItemWrite).length - 1 !== 1) throw new Error('patchItem durable write point not found exactly once.');",
    '      const durablePatchItemWriteReplacement = [',
    "        'const patchKeys = Object.keys(patch || {});',",
    "        '            const hasStatPatch = patchKeys.some(key=>DURABLE_STATS_KEYS.includes(key));',",
    "        \"            if(hasStatPatch){ persistStatPatch(id,patch).catch(err=>console.warn('Stat persistence failed',err)); }\",",
    "        '            const hasNonStatPatch = patchKeys.some(key=>!DURABLE_STATS_KEYS.includes(key));',",
    "        \"            if(hasNonStatPatch){ idbPutMerged(updated).catch(err=>console.warn('Item metadata write failed',err)); }\"",
    '      ].join(durableNL);',
    '      const durablePatchedPatchItem = durableCurrentPatchItem.replace(durablePatchItemWrite,durablePatchItemWriteReplacement);',
    '      html = html.slice(0,durablePatchItemStartPos) + durablePatchedPatchItem + html.slice(durablePatchItemEndPos);'
  ].join('\n');

  durablePatchRaw = durablePatchRaw.slice(0,patchItemSectionStart) +
    robustPatchItem + '\n\n' +
    durablePatchRaw.slice(patchItemSectionEnd);

  const startupPersistencePatch=[
    "      const durableNormalizeToken = 'const normalizeItem = (it)=>({';",
    '      const durableNormalizePos = html.indexOf(durableNormalizeToken);',
    "      if(durableNormalizePos < 0) throw new Error('Durable startup normalizeItem function not found.');",
    '      const durableStartupPrefix = [',
    "        '    const durableStartupRows = durableStatsRows();',",
    "        '    const durableStartupById = new Map(durableStartupRows.map(row=>[row.id,row]));',",
    "        \"    if(durableStartupRows.length){ fastStatsPutItems(durableStartupRows).catch(err=>console.warn('Could not heal lightweight stats from durable journal.',err)); }\",",
    "        '    const durableStartupOverlay = (item)=>item && item.id && durableStartupById.has(item.id) ? mergeFastStatsIntoItem(item,durableStartupById.get(item.id)) : item;'",
    '      ].join(durableNL) + durableNL;',
    '      html = html.slice(0,durableNormalizePos) + durableStartupPrefix + html.slice(durableNormalizePos);',
    "      const durableNormalizeCall = 'const normalized = normalizeItem(it);';",
    '      const durableNormalizeCallCount = html.split(durableNormalizeCall).length - 1;',
    "      if(durableNormalizeCallCount < 2) throw new Error('Durable startup normalizeItem calls not found.');",
    "      html = html.split(durableNormalizeCall).join('const normalized = normalizeItem(durableStartupOverlay(it));');",
    '',
    "      const durableRecordWinStart = '      function recordWin(winnerId){';",
    "      const durableRecordWinEnd = '      function undoLast(){';",
    '      const durableRecordWinStartPos = html.indexOf(durableRecordWinStart);',
    '      const durableRecordWinEndPos = durableRecordWinStartPos >= 0 ? html.indexOf(durableRecordWinEnd,durableRecordWinStartPos + durableRecordWinStart.length) : -1;',
    "      if(durableRecordWinStartPos < 0 || durableRecordWinEndPos < 0) throw new Error('Durable recordWin function boundary not found.');",
    '      let durableRecordWinBlock = html.slice(durableRecordWinStartPos,durableRecordWinEndPos);',
    "      const durableWinnerPatchCall = '        patchItem(winnerId,{wins:wWins});';",
    "      const durableLoserPatchCall = '        patchItem(loserId,{losses:lLoss});';",
    "      if(durableRecordWinBlock.split(durableWinnerPatchCall).length - 1 !== 1 || durableRecordWinBlock.split(durableLoserPatchCall).length - 1 !== 1) throw new Error('Durable recordWin vote calls not found exactly once.');",
    "      durableRecordWinBlock = durableRecordWinBlock.replace(durableWinnerPatchCall,'        durableStatsPatch(winnerId,{wins:wWins});' + durableNL + durableWinnerPatchCall);",
    "      durableRecordWinBlock = durableRecordWinBlock.replace(durableLoserPatchCall,'        durableStatsPatch(loserId,{losses:lLoss});' + durableNL + durableLoserPatchCall);",
    '      html = html.slice(0,durableRecordWinStartPos) + durableRecordWinBlock + html.slice(durableRecordWinEndPos);',
    '',
    "      const durableUndoStart = '      function undoLast(){';",
    "      const durableUndoEnd = '      function resetAllStats(';",
    '      const durableUndoStartPos = html.indexOf(durableUndoStart);',
    '      let durableUndoEndPos = durableUndoStartPos >= 0 ? html.indexOf(durableUndoEnd,durableUndoStartPos + durableUndoStart.length) : -1;',
    "      if(durableUndoEndPos < 0 && durableUndoStartPos >= 0) durableUndoEndPos = html.indexOf('      //',durableUndoStartPos + durableUndoStart.length);",
    "      if(durableUndoStartPos < 0 || durableUndoEndPos < 0) throw new Error('Durable undo function boundary not found.');",
    '      let durableUndoBlock = html.slice(durableUndoStartPos,durableUndoEndPos);',
    "      const durableUndoWinnerCall = '          patchItem(winnerId,{wins:Math.max(0,(winner.wins||0)-1)});';",
    "      const durableUndoLoserCall = '          patchItem(loserId,{losses:Math.max(0,(loser.losses||0)-1)});';",
    "      if(durableUndoBlock.split(durableUndoWinnerCall).length - 1 === 1){ durableUndoBlock = durableUndoBlock.replace(durableUndoWinnerCall,\"          const durableUndoWins = Math.max(0,(winner.wins||0)-1);\" + durableNL + \"          durableStatsPatch(winnerId,{wins:durableUndoWins});\" + durableNL + \"          patchItem(winnerId,{wins:durableUndoWins});\"); }",
    "      if(durableUndoBlock.split(durableUndoLoserCall).length - 1 === 1){ durableUndoBlock = durableUndoBlock.replace(durableUndoLoserCall,\"          const durableUndoLosses = Math.max(0,(loser.losses||0)-1);\" + durableNL + \"          durableStatsPatch(loserId,{losses:durableUndoLosses});\" + durableNL + \"          patchItem(loserId,{losses:durableUndoLosses});\"); }",
    '      html = html.slice(0,durableUndoStartPos) + durableUndoBlock + html.slice(durableUndoEndPos);'
  ].join('\n');
  durablePatchRaw += '\n' + startupPersistencePatch;

  const durablePatchText=durablePatchRaw.replace(/\\/g,'\\\\');

  const durableMarker="      if(!html.includes('const [matchupLeftHd, setMatchupLeftHd] = useState(true);') ||";
  if(autoHdShell.split(durableMarker).length-1!==1){
    throw new Error('Auto-HD durable insertion point not found exactly once.');
  }

  const cloudPatch=[
    "      if(!html.includes('firestore-sync.js')){",
    "        const cloudTag='<script type=\"module\" src=\"firestore-sync.js?v=20260830-v8\"><'+'/script>';",
    "        html=html.replace('</body>',cloudTag+'</body>');",
    '      }'
  ].join('\n');

  autoHdShell=autoHdShell.replace(durableMarker,durablePatchText+'\n'+cloudPatch+'\n'+durableMarker);

  const autoMarker='(async function loadAutoHdComfortOtter(){';
  const autoPos=autoHdShell.indexOf(autoMarker);
  if(autoPos<0) throw new Error('Could not find the working Auto-HD loader.');
  const autoScriptOpen=autoHdShell.lastIndexOf('<script',autoPos);
  const autoScriptBody=autoHdShell.indexOf('>',autoScriptOpen)+1;
  const autoScriptClose=autoHdShell.indexOf('</script>',autoPos);
  if(autoScriptOpen<0||autoScriptBody<=0||autoScriptClose<0){
    throw new Error('Could not extract the working Auto-HD loader script.');
  }
  let loaderScript=autoHdShell.slice(autoScriptBody,autoScriptClose);

  const nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    const url=typeof input==='string'?input:(input&&input.url?input.url:'');
    if(!/(?:cdn\.jsdelivr\.net|raw\.githubusercontent\.com)/i.test(url)){
      return nativeFetch(input,init);
    }
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=setTimeout(()=>{try{if(controller)controller.abort();}catch(_e){}},6000);
    const opts={...(init||{}),cache:'no-cache'};
    if(controller) opts.signal=controller.signal;
    return nativeFetch(input,opts).finally(()=>clearTimeout(timer));
  };

  loaderScript=loaderScript.replace(
    '      const loaderPromise = fetchFirst(sources);',
    "      try{const d=document.getElementById('loaderDetail');if(d)d.textContent='Loading Auto-HD app layer…';}catch(_e){}\n      const loaderPromise = fetchFirst(sources);"
  );

  try{
    new Function(loaderScript);
  }catch(error){
    throw new Error('Generated Auto-HD loader has invalid JavaScript: '+error.message);
  }

  detail('Launching app…');
  const script=document.createElement('script');
  script.textContent=loaderScript;
  document.body.appendChild(script);
})().catch(error=>{
  console.error('ComfortOtter direct loader failed',error);
  const target=document.getElementById('loaderError');
  if(target){
    target.textContent='ComfortOtter could not finish loading.\n\n'+(error&&error.message?error.message:error)+'\n\nDirect loader build v8';
  }
});
