(async function loadComfortOtterV9(){
  const target=document.getElementById('loaderError');
  const detail=document.getElementById('loaderDetail');
  const setDetail=(text)=>{ if(detail) detail.textContent=text; };

  try{
    setDetail('Preparing durable startup restore…');
    const response=await fetch('direct-loader.js?v=20260830-v8',{cache:'no-store'});
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
        'Direct loader build v8',
        'Direct loader build v9'
      ],
      [
        'firestore-sync.js?v=20260830-v8',
        'firestore-sync.js?v=20260831-v9'
      ]
    ];

    for(const [oldText,newText] of replacements){
      const count=source.split(oldText).length-1;
      if(count!==1) throw new Error('v9 loader patch point mismatch: '+oldText+' (found '+count+')');
      source=source.replace(oldText,newText);
    }

    setDetail('Launching ComfortOtter…');
    new Function(source)();
  }catch(error){
    console.error('ComfortOtter v9 loader failed',error);
    if(target){
      target.textContent='ComfortOtter could not finish loading.\n\n'+(error&&error.message?error.message:error)+'\n\nDirect loader build v9';
    }
  }
})();
