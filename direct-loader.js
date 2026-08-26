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
    fetchText('stable-auto-hd-shell.html?v=20260826-v6'),
    fetchText('stable-index-shell.html?v=20260826-v6')
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

  // The tournament-index layer changes idbGetAll before the durable patch runs.
  // Replace the old byte-for-byte matcher with a function-boundary matcher so
  // both the tournament index refresh and durable stat overlay are preserved.
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

  // patchItem has also drifted across the rating/index layers. Replace the
  // original exact three-line matcher with a scoped edit inside patchItem only.
  // This keeps non-stat metadata writes intact while routing stat changes to the
  // synchronous durable journal + lightweight stats DB.
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

  // This source is inserted into the Auto-HD loader's template literal. Double
  // backslashes so one level survives into the generated core loader.
  const durablePatchText=durablePatchRaw.replace(/\\/g,'\\\\');

  const durableMarker="      if(!html.includes('const [matchupLeftHd, setMatchupLeftHd] = useState(true);') ||";
  if(autoHdShell.split(durableMarker).length-1!==1){
    throw new Error('Auto-HD durable insertion point not found exactly once.');
  }

  const cloudPatch=[
    "      if(!html.includes('firestore-sync.js')){",
    "        const cloudTag='<script type=\"module\" src=\"firestore-sync.js?v=20260826-v6\"><'+'/script>';",
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

  // Keep every historical GitHub/CDN source request bounded. A failed source
  // can fall through to its alternate instead of freezing startup forever.
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
    target.textContent='ComfortOtter could not finish loading.\n\n'+(error&&error.message?error.message:error)+'\n\nDirect loader build v6';
  }
});
