from pathlib import Path
import re

path = Path("index.html")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 exact match, found {count}")
    text = text.replace(old, new, 1)


def replace_n(old: str, new: str, expected: int, label: str) -> None:
    global text
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"{label}: expected {expected} exact matches, found {count}")
    text = text.replace(old, new)


def regex_once(pattern: str, replacement: str, label: str, flags: int = 0) -> None:
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 regex match, found {count}")


replace_once(
    """function slimItemForState(it){
  if(!it) return it;
  const hasThumb = !!(it.thumbnail || it.thumbDataUrl);
  return {
    ...it,
    hasThumb,
    thumbnail: null,
    thumbDataUrl: null,
    dataUrl: null
  };
}

// 1. Fetch a SINGLE full item (High Res) from DB (you already have this)
""",
    """function slimItemForState(it){
  if(!it) return it;
  const hasThumb = !!(it.thumbnail || it.thumbDataUrl);
  const { _ratingNeedsMigration, ...rest } = it;
  return {
    ...rest,
    hasThumb,
    thumbnail: null,
    thumbDataUrl: null,
    dataUrl: null
  };
}

function clampRating(value){
  const numeric = Number(value);
  if(!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

// 1. Fetch a SINGLE full item (High Res) from DB (you already have this)
""",
    "add rating helper",
)

replace_once(
    """    wins: Number(v.wins || 0),
    losses: Number(v.losses || 0),
    tourneyBonus: Number(v.tourneyBonus || 0),
    tourneyCount: Number(v.tourneyCount || 0),

    addedAt: v.addedAt || nowStamp(),
""",
    """    wins: Number(v.wins || 0),
    losses: Number(v.losses || 0),
    tourneyBonus: Number(v.tourneyBonus || 0),
    tourneyCount: Number(v.tourneyCount || 0),
    rating: clampRating(v.rating),
    _ratingNeedsMigration: v.rating == null,

    addedAt: v.addedAt || nowStamp(),
""",
    "normalize DB rating",
)

replace_once(
    """      wins: Number(it.wins || 0),
      losses: Number(it.losses || 0),
      tourneyBonus: Number(it.tourneyBonus || 0),
      tourneyCount: Number(it.tourneyCount || 0),
      addedAt: it.addedAt || nowStamp(),
      hasBeenExported: !!it.hasBeenExported,
""",
    """      wins: Number(it.wins || 0),
      losses: Number(it.losses || 0),
      tourneyBonus: Number(it.tourneyBonus || 0),
      tourneyCount: Number(it.tourneyCount || 0),
      rating: clampRating(it.rating),
      addedAt: it.addedAt || nowStamp(),
      hasBeenExported: !!it.hasBeenExported,
""",
    "normalize thumbnail reload rating",
)

replace_once(
    """      } else if (sort.field === 'matchups') {
        return (matchupsCount(b) - matchupsCount(a)) * dir;
      } else if (sort.field === 'random') {
""",
    """      } else if (sort.field === 'matchups') {
        return (matchupsCount(b) - matchupsCount(a)) * dir;
      } else if (sort.field === 'rating') {
        return (clampRating(b.rating) - clampRating(a.rating)) * dir;
      } else if (sort.field === 'random') {
""",
    "sort by rating",
)

replace_once(
    """      const [editedTourneyCount, setEditedTourneyCount] = useState(String(item.tourneyCount ?? 0));
      const [editedTourneyWins, setEditedTourneyWins] = useState(String(tourneyWinsFromBonus(item.tourneyBonus || 0)));
      const [editedAddedAt, setEditedAddedAt] = useState(toDateTimeLocalValue(item.addedAt));
""",
    """      const [editedTourneyCount, setEditedTourneyCount] = useState(String(item.tourneyCount ?? 0));
      const [editedTourneyWins, setEditedTourneyWins] = useState(String(tourneyWinsFromBonus(item.tourneyBonus || 0)));
      const [editedRating, setEditedRating] = useState(String(clampRating(item.rating)));
      const [editedAddedAt, setEditedAddedAt] = useState(toDateTimeLocalValue(item.addedAt));
""",
    "modal rating state",
)

replace_once(
    """          tourneyCount: Number(editedTourneyCount || 0),
          tourneyBonus: Number(editedTourneyWins || 0) * 5,
          addedAt: editedAddedAt ? fromDateTimeLocalValue(editedAddedAt) : item.addedAt
""",
    """          tourneyCount: Number(editedTourneyCount || 0),
          tourneyBonus: Number(editedTourneyWins || 0) * 5,
          rating: clampRating(editedRating),
          addedAt: editedAddedAt ? fromDateTimeLocalValue(editedAddedAt) : item.addedAt
""",
    "modal save rating",
)

replace_once(
    """                </select>
                <input
                  type="number"
                  min="0"
                  value={editedWins}
""",
    """                </select>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={editedRating}
                  onChange={e=>setEditedRating(e.target.value)}
                  className="input"
                  placeholder="Rating (0-100)"
                />
                <input
                  type="number"
                  min="0"
                  value={editedWins}
""",
    "modal rating input",
)

replace_once(
    """      const [previewTourneyCount,setPreviewTourneyCount] = useState('');
      const [previewTourneyWins,setPreviewTourneyWins] = useState('');
      const [previewAddedAt,setPreviewAddedAt] = useState('');
""",
    """      const [previewTourneyCount,setPreviewTourneyCount] = useState('');
      const [previewTourneyWins,setPreviewTourneyWins] = useState('');
      const [previewRating,setPreviewRating] = useState('');
      const [previewAddedAt,setPreviewAddedAt] = useState('');
""",
    "preview rating state",
)

replace_once(
    """  (async()=>{
    const normalizeItem = (it)=>({
      item: slimItemForState({
        ...it,
        title: it.title || '',
        generator: it.generator || '',
        collections: normalizeCollections(it.collections || it.collectionsRaw || ''),
        wins: Number(it.wins || 0),
        losses: Number(it.losses || 0),
        tourneyBonus: Number(it.tourneyBonus || 0),
        tourneyCount: Number(it.tourneyCount || 0),
        hasBeenExported: it.hasBeenExported === undefined ? true : !!it.hasBeenExported,
        lastExportedAt: it.lastExportedAt || null,
        fullUrl: it.fullUrl || null
      })
    });

    let collectionsUpdated = false;
""",
    """  (async()=>{
    let ratingsUpdated = false;
    const normalizeItem = (it)=>{
      const needsRatingMigration = it.rating == null || it._ratingNeedsMigration === true;
      if(needsRatingMigration) ratingsUpdated = true;
      const { _ratingNeedsMigration, ...cleanItem } = it;
      return {
        item: slimItemForState({
          ...cleanItem,
          title: it.title || '',
          generator: it.generator || '',
          collections: normalizeCollections(it.collections || it.collectionsRaw || ''),
          wins: Number(it.wins || 0),
          losses: Number(it.losses || 0),
          tourneyBonus: Number(it.tourneyBonus || 0),
          tourneyCount: Number(it.tourneyCount || 0),
          rating: clampRating(it.rating),
          hasBeenExported: it.hasBeenExported === undefined ? true : !!it.hasBeenExported,
          lastExportedAt: it.lastExportedAt || null,
          fullUrl: it.fullUrl || null
        })
      };
    };

    let collectionsUpdated = false;
""",
    "startup rating migration",
)

replace_once(
    """    if (changed || collectionsUpdated) {
      await idbBulkPutMerged(updated);
    }
""",
    """    if (changed || collectionsUpdated || ratingsUpdated) {
      await idbBulkPutMerged(updated);
    }
""",
    "persist rating migration",
)

replace_once(
    """          setPreviewTourneyCount('');
          setPreviewTourneyWins('');
          setPreviewAddedAt('');
""",
    """          setPreviewTourneyCount('');
          setPreviewTourneyWins('');
          setPreviewRating('');
          setPreviewAddedAt('');
""",
    "clear preview rating",
)

replace_once(
    """        setPreviewTourneyCount(it ? String(it.tourneyCount ?? 0) : '');
        setPreviewTourneyWins(it ? String(tourneyWinsFromBonus(it.tourneyBonus || 0)) : '');
        setPreviewAddedAt(it ? toDateTimeLocalValue(it.addedAt) : '');
""",
    """        setPreviewTourneyCount(it ? String(it.tourneyCount ?? 0) : '');
        setPreviewTourneyWins(it ? String(tourneyWinsFromBonus(it.tourneyBonus || 0)) : '');
        setPreviewRating(it ? String(clampRating(it.rating)) : '');
        setPreviewAddedAt(it ? toDateTimeLocalValue(it.addedAt) : '');
""",
    "sync preview rating",
)

replace_once(
    """      async function patchItem(id,patch){
        setItems(prev=>{
          const next = prev.map(it=>{
            if(it.id!==id) return it;
            const updated = {...it,...patch};
            idbPutMerged(updated);
            return slimItemForState(updated);
          });
          return next;
        });
      }
""",
    """      async function patchItem(id,patch){
        const normalizedPatch = patch && Object.prototype.hasOwnProperty.call(patch,'rating')
          ? {...patch, rating: clampRating(patch.rating)}
          : patch;
        setItems(prev=>{
          const next = prev.map(it=>{
            if(it.id!==id) return it;
            const updated = {...it,...normalizedPatch};
            idbPutMerged(updated);
            return slimItemForState(updated);
          });
          return next;
        });
      }
""",
    "clamp rating patches",
)

replace_once(
    """          ...item,
          title: trimTitle(item.title || ''),
          imageNumber: nextNumber + index
""",
    """          ...item,
          title: trimTitle(item.title || ''),
          rating: clampRating(item.rating),
          imageNumber: nextNumber + index
""",
    "normalize new item rating",
)

replace_once(
    """      tourneyBonus: 0,
      tourneyCount: 0,
      dataUrl,
""",
    """      tourneyBonus: 0,
      tourneyCount: 0,
      rating: 0,
      dataUrl,
""",
    "new uploads default rating",
)

replace_once(
    """        tourneyBonus: sourceItem.tourneyBonus || 0,
        tourneyCount: sourceItem.tourneyCount || 0,
        points: computePoints(sourceItem.wins,sourceItem.losses,sourceItem.tourneyBonus||0),
""",
    """        tourneyBonus: sourceItem.tourneyBonus || 0,
        tourneyCount: sourceItem.tourneyCount || 0,
        rating: clampRating(sourceItem.rating),
        points: computePoints(sourceItem.wins,sourceItem.losses,sourceItem.tourneyBonus||0),
""",
    "metadata export rating",
)

replace_once("version: 6,\n      type: 'metadata-only',", "version: 7,\n      type: 'metadata-only',", "metadata version")

replace_once(
    """          wins: Number(it.wins || 0),
          losses: Number(it.losses || 0),
          tourneyBonus: Number(it.tourneyBonus || 0),
          tourneyCount: Number(it.tourneyCount || 0),

          addedAt: it.addedAt || nowStamp(),
""",
    """          wins: Number(it.wins || 0),
          losses: Number(it.losses || 0),
          tourneyBonus: Number(it.tourneyBonus || 0),
          tourneyCount: Number(it.tourneyCount || 0),
          rating: clampRating(it.rating),

          addedAt: it.addedAt || nowStamp(),
""",
    "full import rating",
)

replace_once(
    """          tourneyCount: incoming.tourneyCount != null
            ? Number(incoming.tourneyCount)
            : Number(existing.tourneyCount || 0),

          // Keep image blobs as-is
""",
    """          tourneyCount: incoming.tourneyCount != null
            ? Number(incoming.tourneyCount)
            : Number(existing.tourneyCount || 0),

          rating: incoming.rating != null
            ? clampRating(incoming.rating)
            : clampRating(existing.rating),

          // Keep image blobs as-is
""",
    "metadata DB import rating",
)

replace_once(
    """          tourneyCount: incoming.tourneyCount != null
            ? Number(incoming.tourneyCount)
            : Number(existing.tourneyCount || 0)
        };
""",
    """          tourneyCount: incoming.tourneyCount != null
            ? Number(incoming.tourneyCount)
            : Number(existing.tourneyCount || 0),

          rating: incoming.rating != null
            ? clampRating(incoming.rating)
            : clampRating(existing.rating)
        };
""",
    "metadata state import rating",
)

replace_once(
    """    points: computePoints(it.wins,it.losses,it.tourneyBonus||0),
    tourneyCount: Number(it.tourneyCount || 0),
    tourneyWins: tourneyWinsFromBonus(it.tourneyBonus || 0)
""",
    """    points: computePoints(it.wins,it.losses,it.tourneyBonus||0),
    tourneyCount: Number(it.tourneyCount || 0),
    tourneyWins: tourneyWinsFromBonus(it.tourneyBonus || 0),
    rating: clampRating(it.rating)
""",
    "stats row rating",
)

replace_once(
    """    }else if(f==='tourneyWins'){
      return (a.tourneyWins-b.tourneyWins)*dir;
    }else if(f==='wins' || f==='losses' || f==='points'){
""",
    """    }else if(f==='tourneyWins'){
      return (a.tourneyWins-b.tourneyWins)*dir;
    }else if(f==='rating'){
      return (a.rating-b.rating)*dir;
    }else if(f==='wins' || f==='losses' || f==='points'){
""",
    "stats sort rating",
)

replace_n(
    """                        <option value="points">Points</option>
""",
    """                        <option value="points">Points</option>
                        <option value="rating">Rating</option>
""",
    2,
    "rating sort options",
)

replace_once(
    """                        </div>
<div className="statLine">
""",
    """                        </div>
                        <div className="fieldRow">
                          <label>Rating (0-100)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={clampRating(it.rating)}
                            onChange={e=>patchItem(it.id,{rating:e.target.value})}
                          />
                        </div>
<div className="statLine">
""",
    "library card rating field",
)

replace_once(
    """  <span>T {it.tourneyCount || 0}</span> {/* NEW */}
</div>
""",
    """  <span>T {it.tourneyCount || 0}</span> {/* NEW */}
  <span>R {clampRating(it.rating)}</span>
</div>
""",
    "library card rating stat",
)

replace_once(
    """                            {generatorSelectOptions.map(opt=>(
                              <option key={opt.label} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="statLine">
                          <span>W: {it.wins}</span>
""",
    """                            {generatorSelectOptions.map(opt=>(
                              <option key={opt.label} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="fieldRow">
                          <label>Rating (0-100)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={clampRating(it.rating)}
                            onChange={e=>patchItem(it.id,{rating:e.target.value})}
                          />
                        </div>
                        <div className="statLine">
                          <span>W: {it.wins}</span>
""",
    "collection card rating field",
)

replace_once(
    """                          <span>Pts: {computePoints(it.wins,it.losses,it.tourneyBonus||0)}</span>
                          <span>M: {matchupsCount(it)}</span>
                        </div>
""",
    """                          <span>Pts: {computePoints(it.wins,it.losses,it.tourneyBonus||0)}</span>
                          <span>M: {matchupsCount(it)}</span>
                          <span>Rating: {clampRating(it.rating)}</span>
                        </div>
""",
    "collection card rating stat",
)

replace_once(
    """                  <div>
                    <div>Stats (editable)</div>
                    <div className="statEditGrid">
""",
    """                  <div>
                    <div>Rating (0-100)</div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={previewRating}
                      onChange={e=>{
                        const next = e.target.value;
                        setPreviewRating(next);
                        patchItem(previewItem.id,{rating:next});
                      }}
                    />
                  </div>
                  <div>
                    <div>Stats (editable)</div>
                    <div className="statEditGrid">
""",
    "preview rating field",
)

replace_once(
    """                      Win% {pct(previewItem.wins,previewItem.losses).toFixed(3)} • Points {computePoints(previewItem.wins,previewItem.losses,previewItem.tourneyBonus||0)}<br/>
""",
    """                      Win% {pct(previewItem.wins,previewItem.losses).toFixed(3)} • Points {computePoints(previewItem.wins,previewItem.losses,previewItem.tourneyBonus||0)} • Rating {clampRating(previewItem.rating)}<br/>
""",
    "preview rating summary",
)

replace_once(
    """    <th className="sortable" onClick={()=>changeStatsSort('points')}>
      Points{sortIndicator(statsSort.field==='points',statsSort.dir)}
    </th>
""",
    """    <th className="sortable" onClick={()=>changeStatsSort('points')}>
      Points{sortIndicator(statsSort.field==='points',statsSort.dir)}
    </th>
    <th className="sortable" onClick={()=>changeStatsSort('rating')}>
      Rating{sortIndicator(statsSort.field==='rating',statsSort.dir)}
    </th>
""",
    "stats rating header",
)

replace_once(
    """      <td>{x.pct.toFixed(3)}</td>
      <td>{x.points}</td>
    </tr>
""",
    """      <td>{x.pct.toFixed(3)}</td>
      <td>{x.points}</td>
      <td>{x.rating}</td>
    </tr>
""",
    "stats rating cell",
)

# Validate that the user-facing field and all persistence paths exist.
required_snippets = [
    "function clampRating(value)",
    "rating: clampRating(v.rating)",
    "rating: 0,",
    "Rating (0-100)",
    "rating: clampRating(sourceItem.rating)",
    "rating: incoming.rating != null",
    "changeStatsSort('rating')",
]
for snippet in required_snippets:
    if snippet not in text:
        raise RuntimeError(f"validation failed: missing {snippet!r}")

path.write_text(text, encoding="utf-8")
print("Applied 0-100 image rating field to index.html")
