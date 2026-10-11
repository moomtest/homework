'use strict';
const $ = selector => document.querySelector(selector);
const SUBJECTS = ['漢字', '算数', '音読・日記'];
const KEY = 'teacher-homework-local-v1';
const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(new Date(`${value}T00:00:00`)) === value; }
function blank() { return Array.from({length:30},()=>[false,false,false]); }
function validate(data) {
  if(!data || data.version!==1 || !data.days || typeof data.days!=='object' || Array.isArray(data.days)) throw new Error('保存データを読み込めません。');
  for(const [date,rows] of Object.entries(data.days)) {
    if(!validDate(date)||!Array.isArray(rows)||rows.length!==30||rows.some(r=>!Array.isArray(r)||r.length!==3||r.some(v=>typeof v!=='boolean'))) throw new Error('保存データを読み込めません。');
  }
  return data;
}
let data={version:1,days:{}}, baseline=null, rows=blank(), selectedDate=dateKey(), dirty=false, blocked=false;
function notify(text) { $('#message').textContent=text; }
try {
  baseline=localStorage.getItem(KEY);
  if(baseline!==null) data=validate(JSON.parse(baseline));
} catch {
  blocked=true;
  notify('保存データを読み込めませんでした。既存の記録を保護するため入力を停止しています。ブラウザの保存設定を確認してください。');
}
$('#date').value=selectedDate;
for(let id=1;id<=30;id++){const option=document.createElement('option');option.value=id;option.textContent=`${id}番`;$('#student').append(option);}
function updateState() {
  $('#save-state').textContent=dirty?'未保存の変更あり':'保存済みの内容';
  $('#show').disabled=blocked||dirty;
  $('#save').disabled=blocked||!dirty;
  $('#summary').textContent=SUBJECTS.map((s,i)=>`${s}：${rows.filter(r=>r[i]).length}/30 提出済み`).join('　');
}
function render() {
  $('#rows').replaceChildren();
  const bulk=document.createElement('tr');const heading=document.createElement('th');heading.textContent='一括入力';bulk.append(heading);
  SUBJECTS.forEach((subject,index)=>{const td=document.createElement('td');for(const [value,label] of [[true,'全員提出済み'],[false,'全員未確認']]){const button=document.createElement('button');button.textContent=label;button.disabled=blocked;button.setAttribute('aria-label',`${subject} ${label}`);button.onclick=()=>{
    if(!value&&!confirm(`${subject}を全員「未確認」に戻しますか？`))return;
    rows.forEach(row=>row[index]=value);dirty=true;render();notify('一括入力しました。「提出状況を保存」を押してください。');
  };td.append(button);}bulk.append(td);});$('#rows').append(bulk);
  rows.forEach((row,index)=>{const tr=document.createElement('tr');const th=document.createElement('th');th.scope='row';th.textContent=`${index+1}番`;tr.append(th);row.forEach((value,subject)=>{const td=document.createElement('td');const check=document.createElement('input');check.type='checkbox';check.checked=value;check.disabled=blocked;check.setAttribute('aria-label',`${index+1}番 ${SUBJECTS[subject]} 提出済み`);check.onchange=()=>{rows[index][subject]=check.checked;dirty=true;updateState();notify('未保存の変更があります。保存してから児童に見せてください。');};td.append(check);tr.append(td);});$('#rows').append(tr);});updateState();
}
function loadDate() { rows=(data.days[selectedDate]||blank()).map(r=>[...r]);dirty=false;render(); }
$('#date').onchange=()=>{
  const next=$('#date').value;
  if(!validDate(next)){ $('#date').value=selectedDate;notify('正しい日付を選んでください。');return; }
  if(dirty&&!confirm('未保存の変更を取り消して日付を変えますか？')){$('#date').value=selectedDate;return;}
  selectedDate=next;loadDate();notify('選んだ日付の記録を表示しました。');
};
$('#save').onclick=()=>{
  if(blocked||!dirty)return;
  try {
    if(localStorage.getItem(KEY)!==baseline){blocked=true;render();notify('別のタブで記録が変更されました。入力内容を控えてから画面を再読み込みしてください。上書きはしていません。');return;}
    const next={version:1,days:{...data.days,[selectedDate]:rows.map(r=>[...r])}};
    const serialized=JSON.stringify(next);localStorage.setItem(KEY,serialized);
    if(localStorage.getItem(KEY)!==serialized)throw new Error('Storage failed');
    baseline=serialized;data=next;dirty=false;updateState();notify('この端末に保存しました。児童に見せられます。');
  } catch {notify('保存できませんでした。変更はまだ保存されていません。ブラウザの保存設定を確認してください。');}
};
$('#show').onclick=()=>{
  if(dirty||blocked)return;
  const id=Number($('#student').value);const saved=(data.days[selectedDate]||blank())[id-1];
  $('#viewer-heading').textContent=`${id}番の提出状況`;
  $('#viewer-date').textContent=`${selectedDate} の提出記録`;
  $('#viewer-items').replaceChildren();
  saved.forEach((value,index)=>{const li=document.createElement('li');const name=document.createElement('strong');name.textContent=`${index+1} ${SUBJECTS[index]}`;const status=document.createElement('span');status.textContent=value?'✓ 提出済み':'未確認';status.className=value?'submitted':'pending';li.append(name,status);$('#viewer-items').append(li);});
  $('#teacher').hidden=true;$('#viewer').hidden=false;notify('');$('#viewer-heading').tabIndex=-1;$('#viewer-heading').focus();window.scrollTo(0,0);
};
$('#back').onclick=()=>{$('#viewer').hidden=true;$('#teacher').hidden=false;$('#show').focus();};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('storage',event=>{if(event.key!==KEY&&event.key!==null)return;blocked=true;$('#viewer').hidden=true;$('#teacher').hidden=false;render();notify('別のタブで保存内容が変更されました。画面を再読み込みしてください。');});
loadDate();
if('serviceWorker' in navigator && location.protocol!=='file:'){
  navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('#offline-status').textContent='オフライン用の画面を準備しました。通信を切って再度開けるか確認してください。';}).catch(()=>{$('#offline-status').textContent='オフライン用の準備ができませんでした。記録はこのブラウザに保存します。';});
}
