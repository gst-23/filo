/* Filo · task manager without login, deployable on GitHub Pages.
   With Supabase enabled, this is a PUBLIC shared board: never use for sensitive data.
   Local mode is provided for evaluation and backwards compatibility with Piano.
*/
const $ = (id) => document.getElementById(id);
const GLYPHS = {
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  clip: '<path d="m21 11.5-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9"/>',
  checklist: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 1.4 1.4L12 8m2 2h3M8 16h9"/>',
  edit: '<path d="m16 5 3 3M4 20l4-.5L20 7a2.1 2.1 0 0 0-3-3L4.5 16.5Z"/>',
  duplicate: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.07 0l3-3A5 5 0 0 0 13 2.93L11.3 4.6M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.7-1.67"/>',
  trash: '<path d="M4 7h16M10 3h4m-8 4 1 14h10l1-14M10 11v6m4-6v6"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'
};
const ico = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[name] || GLYPHS.check}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
function todayISO() { return localISO(new Date()); }
function localISO(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fromISO(s) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
  const [y,m,d] = s.split('-').map(Number);
  const result = new Date(y,m-1,d,12);
  return localISO(result) === s ? result : null;
}
function plusDays(iso, days) {
  const date = fromISO(iso); if(!date) return iso;
  date.setDate(date.getDate() + Math.max(0,Number(days)||0));
  return localISO(date);
}
function deltaDays(iso) {
  if(!fromISO(iso)) return null;
  const a = iso.split('-').map(Number), b = todayISO().split('-').map(Number);
  return Math.round((Date.UTC(a[0],a[1]-1,a[2]) - Date.UTC(b[0],b[1]-1,b[2])) / 86400000);
}
const absoluteDate = s => fromISO(s)?.toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'}) || 'Senza scadenza';
function shortDate(s) {
  const days=deltaDays(s);
  if(days===-1)return 'Ieri';
  if(days===0)return 'Oggi';
  if(days===1)return 'Domani';
  return fromISO(s)?.toLocaleDateString('it-IT',{day:'numeric',month:'short'}) || '—';
}
function dueState(t) {
  if(t.status==='done')return 'completed';
  if(!t.due_date)return 'none';
  const d=deltaDays(t.due_date);
  return d<0?'overdue':d===0?'today':'future';
}
function cleanTask(raw={}) {
  return {
    id: raw.id || uuid(),
    title: String(raw.title || 'Senza titolo'),
    description: String(raw.description || ''),
    due_date: fromISO(raw.due_date) ? raw.due_date : null,
    project: String(raw.project || ''),
    status: ['todo','doing','done'].includes(raw.status) ? raw.status : 'todo',
    notes: Array.isArray(raw.notes) ? raw.notes : [],
    subtasks: Array.isArray(raw.subtasks) ? raw.subtasks : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    created_at: raw.created_at || now(),
    updated_at: raw.updated_at || now()
  };
}

// Preserve locally saved tasks and file Blobs from the previous Piano prototype.
const LOCAL_TASKS_KEY = 'piano:tasks:v1';
const LOCAL_DB_NAME = 'piano:files';
let tasks = [];
let supa = null;
let cloud = false;
let working = false;
let openMenuId = null;
let expandedIds = new Set();
let completedOpen = false;
let editId = null;
let toastTimer = null;
let undoCallback = null;
let writeQueue = Promise.resolve();
let pendingWrites = 0;
let refreshInProgress = false;
let cloudReady = false;

const byDueDate = (a,b) => (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31') || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
function localRead() {
  try {
    const saved=JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || '[]');
    return Array.isArray(saved) ? saved.map(cleanTask) : [];
  } catch(e) { showToast('Impossibile leggere le attività locali: '+e.message); return []; }
}
function localWrite() { localStorage.setItem(LOCAL_TASKS_KEY,JSON.stringify(tasks)); }
function storageLabel(label) { $('storageStatus').textContent=label; }
function toastDismiss() { $('toast').classList.add('hidden'); undoCallback=null; clearTimeout(toastTimer); }
function showToast(message,undo=null) {
  const el=$('toast'); undoCallback=undo;
  el.innerHTML=`<span>${esc(message)}</span>${undo?'<button type="button" id="undoToast">Annulla</button>':''}`;
  el.classList.remove('hidden'); clearTimeout(toastTimer);
  toastTimer=setTimeout(toastDismiss,8500);
}
async function loadCloud() {
  if(!supa) return;
  if(pendingWrites) await writeQueue;
  const {data,error}=await supa.from('filo_tasks').select('*').limit(5000);
  if(error)throw error;
  tasks=(data || []).map(cleanTask);
  cloudReady=true; render();
  storageLabel('Online · modifiche salvate automaticamente');
}
async function refresh(showMessage=false) {
  if(refreshInProgress || pendingWrites) return;
  refreshInProgress=true;
  try {
    if(cloud) await loadCloud(); else {tasks=localRead();render();}
    if(showMessage) showToast('Attività aggiornate.');
  } catch(e) {
    storageLabel('Connessione al cloud non disponibile: modifiche non confermate');
    if(showMessage) showToast('Impossibile aggiornare: '+e.message);
  } finally {refreshInProgress=false;}
}
async function queueOperation(op) {
  pendingWrites++;
  if(cloud)storageLabel('Salvataggio online in corso…');
  const start=writeQueue.catch(()=>{}).then(op);
  writeQueue=start.catch(()=>{});
  try {return await start;}
  finally {
    pendingWrites--;
    if(cloud && pendingWrites===0 && cloudReady)storageLabel('Online · modifiche salvate automaticamente');
  }
}
async function saveTask(value) {
  const item=cleanTask({...value,updated_at:now()});
  const previous=tasks.find(t=>t.id===item.id) || null;
  const index=tasks.findIndex(t=>t.id===item.id);
  if(index===-1)tasks.unshift(item); else tasks[index]=item;
  render();
  try {
    await queueOperation(async()=>{
      if(cloud){const {error}=await supa.from('filo_tasks').upsert(item,{onConflict:'id'});if(error)throw error;}
      else localWrite();
    });
    return true;
  } catch(e) {
    // Roll back only if this version has not already been replaced by a newer edit.
    const current=tasks.find(t=>t.id===item.id);
    if(current?.updated_at===item.updated_at){
      tasks=tasks.filter(t=>t.id!==item.id);
      if(previous)tasks.push(previous);
      render();
    }
    if(cloud)storageLabel('Errore di salvataggio online');
    showToast('Salvataggio non riuscito: '+e.message);
    return false;
  }
}
async function deleteTask(taskId) {
  const item=tasks.find(t=>t.id===taskId);if(!item)return;
  if(!confirm(`Eliminare definitivamente "${item.title}" e i suoi allegati?`))return;
  try {
    await queueOperation(async()=>{
      if(cloud){const {error}=await supa.from('filo_tasks').delete().eq('id',item.id);if(error)throw error;}
      else {tasks=tasks.filter(t=>t.id!==item.id);localWrite();}
    });
    tasks=tasks.filter(t=>t.id!==item.id);
    expandedIds.delete(taskId);openMenuId=null;render();
    for(const a of item.attachments){try{await removeBlob(a);}catch(e){console.warn('Pulizia allegato:',e);}}
    showToast('Attività eliminata.');
  }catch(e){storageLabel('Errore durante l’eliminazione');showToast('Eliminazione non riuscita: '+e.message);}
}
async function changeDone(taskId) {
  const t=tasks.find(t=>t.id===taskId);if(!t)return;
  const done=t.status==='done';
  if(await saveTask({...t,status:done?'todo':'done'})) {
    if(!done) {expandedIds.delete(taskId);openMenuId=null;showToast('Attività completata.');}
    else {showToast('Attività riaperta.');}
    render();
  }
}
async function postpone(taskId,days) {
  const t=tasks.find(t=>t.id===taskId);
  if(!t||t.status==='done'||!Number.isInteger(days)||days<1||days>7)return;
  const before=t.due_date;
  const start=(!before||before<todayISO())?todayISO():before;
  const after=plusDays(start,days);
  if(await saveTask({...t,due_date:after})) {
    showToast(`Scadenza spostata al ${absoluteDate(after)}.`,async()=>{
      const current=tasks.find(v=>v.id===taskId);
      if(current?.due_date===after){await saveTask({...current,due_date:before});showToast('Rinvio annullato.');}
    });
  }
}

function render() {
  const open=tasks.filter(t=>t.status!=='done').sort(byDueDate);
  const complete=tasks.filter(t=>t.status==='done').sort(byDueDate);
  $('tasks').innerHTML=open.length?open.map(taskCard).join(''):
    `<div class="empty-state"><h2>${tasks.length?'Tutte le attività completate':'Una cosa alla volta.'}</h2><p>${tasks.length?'Puoi riaprire un’attività dall’elenco in basso.':'Inizia aggiungendo la tua prima attività. Scadenze, note e sotto-attività resteranno qui, in ordine cronologico.'}</p><button type="button" data-action="new">+ Nuova attività</button></div>`;
  $('completedSection').hidden=!complete.length;
  $('completedCount').textContent=complete.length;
  $('completedToggle').setAttribute('aria-expanded',String(completedOpen));
  $('completedList').hidden=!completedOpen;
  $('completedList').innerHTML=completedOpen?complete.map(taskCard).join(''):'';
}
function taskCard(t) {
  const state=dueState(t),active=expandedIds.has(t.id),menu=openMenuId===t.id;
  const due=t.due_date?shortDate(t.due_date):'Senza data';
  const full=t.due_date?absoluteDate(t.due_date):'Nessuna scadenza impostata';
  const subcount=t.subtasks.length;
  const attcount=t.attachments.length;
  const counts=`<span class="count-unit" title="${attcount} allegati">${ico('clip')}<strong>${attcount}</strong></span><span class="count-unit" title="${subcount} sotto-attività">${ico('checklist')}<strong>${subcount}</strong></span>`;
  const delay=t.status==='done'?'':`<div class="delay-control" data-task-id="${t.id}">
    <button type="button" class="delay-trigger" title="Rinvia la scadenza (fino a 7 giorni)" aria-label="Rinvia ${esc(t.title)}" data-action="slider-toggle" data-id="${t.id}">+0g</button>
    <div class="delay-panel"><span class="delay-note" data-preview="${t.id}">Trascina da 1 a 7 giorni</span>
      <input class="delay-range" type="range" min="0" max="7" step="1" value="0" style="--pct:0%" data-id="${t.id}" aria-label="Giorni da aggiungere, da zero a sette">
      <span class="delay-count" data-count="${t.id}">+0g</span>
    </div></div>`;
  return `<article class="task-card ${state}" id="task-${t.id}" data-task-id="${t.id}">
    <div class="task-row">
      <button type="button" class="check-button ${t.status==='done'?'checked':''}" data-action="done" data-id="${t.id}" aria-label="${t.status==='done'?'Riapri':'Completa'}: ${esc(t.title)}" title="${t.status==='done'?'Riapri':'Segna come completata'}">${ico('check')}</button>
      <div class="task-heading"><button type="button" class="title-button" data-action="toggle" data-id="${t.id}">${esc(t.title)}</button><div class="project-line">${esc(t.project||'Attività')}</div></div>
      <div class="due-date ${state}" title="${esc(full)}">${esc(due)}<span class="date-secondary">${state==='overdue'?'Scaduta':state==='today'?'Scade oggi':state==='completed'?'Completata':t.due_date?'Scadenza':'Da pianificare'}</span></div>
      ${delay||'<span></span>'}
      <div class="task-count">${counts}</div>
      <div class="menu-control"><button class="round-action" type="button" data-action="menu" data-id="${t.id}" aria-label="Altre opzioni per ${esc(t.title)}" aria-haspopup="menu" aria-expanded="${menu}">${ico('dots')}</button>${menu?moreMenu(t):''}</div>
      <button type="button" class="expand-action" data-action="toggle" data-id="${t.id}" aria-label="${active?'Chiudi':'Apri'} sotto-attività e note di ${esc(t.title)}" aria-expanded="${active}">${subcount?`<span class="subtask-number">${subcount}</span>`:''}${ico('chevron')}</button>
    </div>
    ${active?expandedContent(t):''}
  </article>`;
}
function moreMenu(t) {
  return `<div class="more-menu" role="menu" aria-label="Opzioni attività">
    <button type="button" role="menuitem" data-action="edit" data-id="${t.id}">${ico('edit')}Modifica</button>
    <button type="button" role="menuitem" data-action="duplicate" data-id="${t.id}">${ico('duplicate')}Duplica</button>
    <button type="button" role="menuitem" data-action="copy" data-id="${t.id}">${ico('link')}Copia link</button>
    <button type="button" role="menuitem" data-action="attach" data-id="${t.id}">${ico('clip')}Aggiungi allegato</button>
    <button type="button" role="menuitem" class="danger" data-action="delete" data-id="${t.id}">${ico('trash')}Elimina</button>
  </div>`;
}
function expandedContent(t) {
  const subtasks=t.subtasks.map(s=>`<div class="subtask-item ${s.done?'done':''}">
    <input class="subtask-check" type="checkbox" data-action="subtoggle" data-id="${t.id}" data-sub-id="${esc(s.id)}" ${s.done?'checked':''} aria-label="Completa: ${esc(s.title)}">
    <span class="subtask-label">${esc(s.title)}</span>
    <button type="button" class="light-delete" data-action="del-sub" data-id="${t.id}" data-sub-id="${esc(s.id)}" title="Elimina sotto-attività" aria-label="Elimina sotto-attività">${ico('trash')}</button>
  </div>`).join('');
  const notes=t.notes.slice().reverse().map(n=>`<div class="note-item"><span class="note-date">${esc(new Date(n.created_at||now()).toLocaleDateString('it-IT',{day:'numeric',month:'short'}))}</span><p>${esc(n.text)}</p><button type="button" class="light-delete" data-action="del-note" data-id="${t.id}" data-note-id="${esc(n.id)}" title="Elimina nota" aria-label="Elimina nota">${ico('trash')}</button></div>`).join('');
  const files=t.attachments.map(a=>`<div class="file-pill" title="${esc(a.name)}">
    <button type="button" data-action="download" data-id="${t.id}" data-file-id="${esc(a.id)}" title="Scarica allegato">${ico('clip')}</button>
    <span class="file-name">${esc(a.name)}</span><span class="file-size">${formatBytes(a.size||0)}</span>
    <button type="button" class="light-delete" data-action="del-file" data-id="${t.id}" data-file-id="${esc(a.id)}" title="Rimuovi allegato">${ico('trash')}</button>
  </div>`).join('');
  return `<div class="task-expanded">
    <div class="detail-column">
      <section class="detail-section"><div class="detail-head"><span>Sotto-attività</span><small>${t.subtasks.filter(s=>s.done).length}/${t.subtasks.length} completate</small></div>
      <div class="subtask-list">${subtasks||'<p class="detail-text">Nessuna sotto-attività.</p>'}</div>
      <form class="add-inline" data-form="sub" data-id="${t.id}"><input name="title" maxlength="180" placeholder="Aggiungi sotto-attività" required aria-label="Titolo della nuova sotto-attività"><button type="submit">+ Aggiungi</button></form>
      </section>
      ${t.description?`<section class="detail-section"><div class="detail-head">Descrizione</div><p class="detail-text">${esc(t.description)}</p></section>`:''}
    </div>
    <div class="detail-column">
      <section class="detail-section"><div class="detail-head">Note <small>${t.notes.length}</small></div><div class="notes-list">${notes||'<p class="detail-text">Nessuna nota.</p>'}</div>
      <form class="add-inline note-entry" data-form="note" data-id="${t.id}"><textarea name="text" maxlength="12000" rows="2" placeholder="Scrivi una nota..." required aria-label="Scrivi una nota"></textarea><button type="submit">+ Aggiungi</button></form></section>
      <section class="detail-section"><div class="detail-head">Allegati <small>${t.attachments.length}</small></div>
        <div class="attachment-list">${files||'<p class="detail-text">Nessun allegato.</p>'}</div>
        <label class="attach-select">+ Aggiungi file<input type="file" multiple data-upload="${t.id}" id="upload-${t.id}" aria-label="Carica allegati"></label>
      </section>
    </div>
  </div>`;
}
function formatBytes(bytes) {return bytes<1024?`${bytes} B`:bytes<1024**2?`${(bytes/1024).toFixed(0)} KB`:`${(bytes/(1024**2)).toFixed(1)} MB`;}

function openModal(taskId=null) {
  editId=taskId;
  $('taskForm').reset();
  const t=tasks.find(v=>v.id===taskId);
  $('modalTitle').textContent=t?'Modifica attività':'Nuova attività';
  const f=$('taskForm').elements;
  f.title.value=t?.title||'';
  f.due_date.value=t?.due_date||todayISO();
  f.project.value=t?.project||'';
  f.description.value=t?.description||'';
  if(t && !t.due_date)f.due_date.value='';
  $('shade').classList.remove('hidden');$('taskModal').classList.remove('hidden');
  setTimeout(()=>f.title.focus(),15);
}
function closeModal() {$('shade').classList.add('hidden');$('taskModal').classList.add('hidden');editId=null;}
async function submitTaskForm(e) {
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  const title=String(f.get('title')||'').trim();if(!title)return;
  const old=tasks.find(t=>t.id===editId);
  const item=cleanTask({...old,id:old?.id||uuid(),title,
    project:String(f.get('project')||'').trim(),
    description:String(f.get('description')||''),due_date:String(f.get('due_date')||'')||null});
  const ok=await saveTask(item);
  if(ok){closeModal();showToast(old?'Attività modificata.':'Attività creata.');}
}

async function duplicateTask(taskId) {
  const t=tasks.find(t=>t.id===taskId);if(!t)return;
  const copy=cleanTask({...t,id:uuid(),title:`${t.title} (copia)`,status:'todo',
    subtasks:t.subtasks.map(s=>({...s,id:uuid()})),
    notes:t.notes.map(n=>({...n,id:uuid()})),
    attachments:[],created_at:now()});
  if(await saveTask(copy)){expandedIds.add(copy.id);openMenuId=null;render();showToast('Attività duplicata senza allegati.');}
}
async function copyTaskLink(taskId) {
  const url=location.href.split('#')[0]+`#task=${taskId}`;
  try{await navigator.clipboard.writeText(url);showToast('Link all’attività copiato.');}
  catch(e){prompt('Copia il link:',url);}
}
function handleHash() {
  const match=location.hash.match(/^#task=([a-f0-9-]{36})$/i);
  if(match && tasks.some(t=>t.id===match[1])){
    const t=tasks.find(t=>t.id===match[1]);
    if(t?.status==='done')completedOpen=true;
    expandedIds.add(match[1]);render();
    setTimeout(()=>document.getElementById(`task-${match[1]}`)?.scrollIntoView({block:'center',behavior:'smooth'}),80);
  }
}

// Blobs use IndexedDB in local mode; Supabase Storage when cloud is configured.
let dbPromise=null;
function localDB() {
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(LOCAL_DB_NAME,1);
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains('files'))req.result.createObjectStore('files',{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}
async function putBlobLocal(fileId,blob) {
  const db=await localDB();return new Promise((resolve,reject)=>{
    const tx=db.transaction('files','readwrite');tx.objectStore('files').put({id:fileId,blob});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
async function getBlobLocal(fileId) {
  const db=await localDB();return new Promise((resolve,reject)=>{
    const tx=db.transaction('files','readonly'),req=tx.objectStore('files').get(fileId);
    req.onsuccess=()=>resolve(req.result?.blob||null);req.onerror=()=>reject(req.error);
  });
}
async function removeBlobLocal(fileId) {
  const db=await localDB();return new Promise((resolve,reject)=>{
    const tx=db.transaction('files','readwrite');tx.objectStore('files').delete(fileId);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
const MAX_SIZE=20*1024*1024;
const safeName=(s)=>String(s).replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'file';
async function storeBlob(task,blob,name) {
  if(blob.size>MAX_SIZE)throw new Error('Dimensione massima di ogni allegato: 20 MB.');
  const blobId=uuid();let path=null;
  if(cloud) {
    path=`${task.id}/${blobId}-${safeName(name)}`;
    const {error}=await supa.storage.from('filo-files').upload(path,blob,{contentType:blob.type||'application/octet-stream',upsert:false});
    if(error)throw error;
  }else await putBlobLocal(blobId,blob);
  return {id:blobId,name,size:blob.size,type:blob.type||'application/octet-stream',path,created_at:now()};
}
async function loadBlob(meta) {
  if(cloud) {
    if(!meta.path)throw new Error('Allegato locale non disponibile sul cloud. Reimporta un backup con il file.');
    const {data,error}=await supa.storage.from('filo-files').download(meta.path);
    if(error)throw error;
    return data;
  }
  const blob=await getBlobLocal(meta.id);
  if(!blob)throw new Error('File non trovato in questo browser. Importa un backup per recuperarlo.');
  return blob;
}
async function removeBlob(meta) {
  if(cloud) {
    if(!meta.path)return;
    const {error}=await supa.storage.from('filo-files').remove([meta.path]);
    if(error)throw error;
  } else await removeBlobLocal(meta.id);
}
async function uploadFiles(taskId, files) {
  if(working)return;
  working=true;let count=0;
  try{
    for(const file of files) {
      const task=tasks.find(t=>t.id===taskId);if(!task)break;
      showToast(`Caricamento di ${file.name}...`);
      const meta=await storeBlob(task,file,file.name);
      const ok=await saveTask({...task,attachments:[...task.attachments,meta]});
      if(!ok){await removeBlob(meta).catch(console.warn);break;}
      count++;
    }
    if(count)showToast(`${count} allegat${count===1?'o aggiunto':'i aggiunti'}.`);
  }catch(e){showToast('Errore allegato: '+e.message);}
  finally{working=false;}
}
async function downloadFile(taskId,fileId) {
  const a=tasks.find(t=>t.id===taskId)?.attachments.find(a=>a.id===fileId);
  if(!a)return;
  try {
    const blob=await loadBlob(a);const url=URL.createObjectURL(blob);const el=document.createElement('a');
    el.href=url;el.download=a.name;document.body.appendChild(el);el.click();el.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){showToast('Download non riuscito: '+e.message);}
}
async function deleteFile(taskId,fileId) {
  const t=tasks.find(t=>t.id===taskId),a=t?.attachments.find(a=>a.id===fileId);
  if(!a||!confirm(`Eliminare l’allegato "${a.name}"?`))return;
  const ok=await saveTask({...t,attachments:t.attachments.filter(v=>v.id!==fileId)});
  if(ok){try{await removeBlob(a);}catch(e){showToast('Allegato tolto dalla lista, ma il file non è stato rimosso dallo storage: '+e.message);}}
}
const blobToDataUrl=(blob)=>new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
});
function dataUrlToBlob(data) {
  if(typeof data!=='string'||!/^data:[^,]*;base64,[A-Za-z0-9+/=\s]+$/.test(data))throw new Error('Formato allegato nel backup non valido.');
  const [head,body]=data.split(',',2);
  const mime=(head.match(/^data:([^;]*)/)||[])[1]||'application/octet-stream';
  const bytes=atob(body.replace(/\s/g,''));const buffer=new Uint8Array(bytes.length);
  for(let i=0;i<bytes.length;i++)buffer[i]=bytes.charCodeAt(i);
  return new Blob([buffer],{type:mime});
}
async function exportBackup() {
  if(working)return;working=true;
  try{
    showToast('Preparazione backup (incluse copie degli allegati)...');
    const files={};
    for(const t of tasks)for(const a of t.attachments){
      try{files[a.id]=await blobToDataUrl(await loadBlob(a));}
      catch(e){if(!confirm(`Non riesco a leggere "${a.name}". Procedere senza questo file?`))throw e;}
    }
    const backup={app:'filo',version:2,exported_at:now(),tasks,files};
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`filo-backup-${todayISO()}.json`;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    showToast('Backup esportato. Conserva il file in un posto sicuro.');
  }catch(e){showToast('Backup non riuscito: '+e.message);}
  finally{working=false;}
}
async function importBackup(file) {
  if(working)return;working=true;let count=0;
  try{
    if(file.size>200*1024*1024)throw new Error('Backup troppo grande (massimo 200 MB).');
    const backup=JSON.parse(await file.text());
    if(!(['piano','filo'].includes(backup.app))||![1,2].includes(backup.version)||!Array.isArray(backup.tasks))throw new Error('Formato di backup non riconosciuto.');
    if(backup.tasks.length>5000)throw new Error('Troppi elementi nel backup.');
    if(!confirm(`Importare ${backup.tasks.length} attività? Saranno aggiunte, senza sostituire quelle esistenti.`))return;
    for(const original of backup.tasks){
      if(!original||typeof original!=='object')continue;
      const t=cleanTask({...original,id:uuid(),attachments:[]});
      if(!await saveTask(t))throw new Error('Impossibile salvare l’attività importata.');
      for(const oldMeta of Array.isArray(original.attachments)?original.attachments:[]){
        const data=backup.files?.[oldMeta.id];if(!data)continue;
        const blob=dataUrlToBlob(data);
        const current=tasks.find(v=>v.id===t.id),meta=await storeBlob(current,blob,oldMeta.name||'allegato');
        if(!await saveTask({...current,attachments:[...current.attachments,meta]}))throw new Error('Impossibile salvare un allegato importato.');
      }
      count++;
    }
    showToast(`${count} attività importate.`);
  }catch(e){showToast(`Importazione interrotta (${count} attività importate): ${e.message}`);}
  finally{working=false;$('importFile').value='';}
}

async function handleAction(action,taskId,button) {
  const t=tasks.find(t=>t.id===taskId);
  if(action==='new')return openModal();
  if(!t)return;
  if(action==='done')return changeDone(taskId);
  if(action==='toggle'){
    if(expandedIds.has(taskId))expandedIds.delete(taskId);else expandedIds.add(taskId);
    openMenuId=null;render();return;
  }
  if(action==='slider-toggle'){
    const el=button.closest('.delay-control');
    document.querySelectorAll('.delay-control.is-open').forEach(n=>{if(n!==el)n.classList.remove('is-open');});
    el?.classList.toggle('is-open');
    el?.querySelector('.delay-range')?.focus();return;
  }
  if(action==='menu') {openMenuId=openMenuId===taskId?null:taskId;render();return;}
  if(action==='edit'){openMenuId=null;render();return openModal(taskId);}
  if(action==='duplicate')return duplicateTask(taskId);
  if(action==='copy'){openMenuId=null;render();return copyTaskLink(taskId);}
  if(action==='attach'){
    expandedIds.add(taskId);openMenuId=null;render();
    $('upload-'+taskId)?.click();return;
  }
  if(action==='delete')return deleteTask(taskId);
  if(action==='download')return downloadFile(taskId,button.dataset.fileId);
  if(action==='del-file')return deleteFile(taskId,button.dataset.fileId);
  if(action==='del-sub'){
    return saveTask({...t,subtasks:t.subtasks.filter(s=>s.id!==button.dataset.subId)});
  }
  if(action==='del-note'){
    if(confirm('Eliminare questa nota?'))return saveTask({...t,notes:t.notes.filter(n=>n.id!==button.dataset.noteId)});
  }
}
function updatingForm() {
  const el=document.activeElement;
  return !!(el?.matches('input:not([type=range]),textarea') || !$('taskModal').classList.contains('hidden'));
}
function wireEvents() {
  $('newTask').addEventListener('click',()=>openModal());
  $('closeModal').addEventListener('click',closeModal);
  $('cancelModal').addEventListener('click',closeModal);
  $('shade').addEventListener('click',closeModal);
  $('taskForm').addEventListener('submit',submitTaskForm);
  $('exportBackup').addEventListener('click',exportBackup);
  $('importBackup').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',e=>{if(e.target.files?.length)importBackup(e.target.files[0]);});
  $('refreshTasks').addEventListener('click',()=>refresh(true));
  $('completedToggle').addEventListener('click',()=>{completedOpen=!completedOpen;render();});
  $('toast').addEventListener('click',async e=>{
    if(e.target.id==='undoToast'&&undoCallback){const fn=undoCallback;toastDismiss();await fn();}
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeModal();openMenuId=null;document.querySelectorAll('.delay-control.is-open').forEach(n=>n.classList.remove('is-open'));render();}
    if((e.key==='n'||e.key==='N')&&!e.altKey&&!e.metaKey&&!e.ctrlKey&&!updatingForm()&&!document.activeElement?.closest('button')){e.preventDefault();openModal();}
  });
  for(const root of [$('tasks'),$('completedList')]) {
    root.addEventListener('click',async e=>{
      const btn=e.target.closest('button[data-action]');if(!btn)return;
      e.preventDefault();e.stopPropagation();
      await handleAction(btn.dataset.action,btn.dataset.id,btn);
    });
    root.addEventListener('submit',async e=>{
      const form=e.target.closest('form[data-form]');if(!form)return;
      e.preventDefault();
      const taskId=form.dataset.id,t=tasks.find(t=>t.id===taskId),f=new FormData(form);
      if(!t)return;
      if(form.dataset.form==='sub'){
        const title=String(f.get('title')||'').trim();if(!title)return;
        await saveTask({...t,subtasks:[...t.subtasks,{id:uuid(),title,done:false}]});
      }else if(form.dataset.form==='note'){
        const text=String(f.get('text')||'').trim();if(!text)return;
        await saveTask({...t,notes:[...t.notes,{id:uuid(),text,created_at:now()}]});
      }
    });
    root.addEventListener('change',async e=>{
      const target=e.target;
      if(target.matches('input[data-action="subtoggle"]')){
        const t=tasks.find(t=>t.id===target.dataset.id);if(!t)return;
        await saveTask({...t,subtasks:t.subtasks.map(s=>s.id===target.dataset.subId?{...s,done:target.checked}:s)});
      }
      if(target.matches('input[data-upload]')){
        const files=Array.from(target.files||[]);if(files.length)await uploadFiles(target.dataset.upload,files);
      }
      if(target.matches('.delay-range')){
        const days=Number(target.value);
        if(days>0)await postpone(target.dataset.id,days);
      }
    });
    root.addEventListener('input',e=>{
      const target=e.target;if(!target.matches('.delay-range'))return;
      const days=Number(target.value),root=target.closest('.delay-control');
      const t=tasks.find(t=>t.id===target.dataset.id);
      const start=(!t?.due_date||t.due_date<todayISO())?todayISO():t.due_date;
      const next=days?plusDays(start,days):start;
      target.style.setProperty('--pct',`${(days/7)*100}%`);
      root.querySelector('.delay-count').textContent=`+${days}g`;
      root.querySelector('.delay-trigger').textContent=`+${days}g`;
      root.querySelector('.delay-note').textContent=days?`Nuova data: ${shortDate(next)}`:'Trascina da 1 a 7 giorni';
    });
  }
  document.addEventListener('click',e=>{
    if(openMenuId && !e.target.closest('.menu-control')){openMenuId=null;render();}
    if(!e.target.closest('.delay-control'))document.querySelectorAll('.delay-control.is-open').forEach(n=>n.classList.remove('is-open'));
  });
  window.addEventListener('hashchange',handleHash);
  window.addEventListener('storage',e=>{if(!cloud && e.key===LOCAL_TASKS_KEY){tasks=localRead();render();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && cloud && !updatingForm() && !pendingWrites)refresh();});
  setInterval(()=>{
    if(document.hidden||updatingForm()||pendingWrites)return;
    if(cloud)refresh();else render();
  },30000);
}
async function init() {
  wireEvents();
  const c=window.FILO_CONFIG||{};
  cloud=!!(c.supabaseUrl && c.supabasePublishableKey);
  if(!cloud){tasks=localRead();render();handleHash();return;}
  storageLabel('Connessione al cloud…');
  try{
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supa=createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    await loadCloud();handleHash();
  }catch(e){storageLabel('Cloud non disponibile · verifica la configurazione Supabase');showToast('Impossibile caricare le attività online: '+e.message);}
}
init();
