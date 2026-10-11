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
  if(data.holidays===undefined)data.holidays=[];
  if(!Array.isArray(data.holidays)||data.holidays.some(date=>!validDate(date)))throw new Error('休みの設定を読み込めません。');
  if(data.exemptions===undefined)data.exemptions={};
  if(!data.exemptions||typeof data.exemptions!=='object'||Array.isArray(data.exemptions))throw new Error('個別の提出不要設定を読み込めません。');
  for(const [date,flags] of Object.entries(data.exemptions)) {
    if(!validDate(date)||!Array.isArray(flags)||flags.length!==30||flags.some(flag=>typeof flag!=='boolean'))throw new Error('個別の提出不要設定を読み込めません。');
  }
  return data;
}
let exemptions=Array(30).fill(false);
let data={version:1,days:{},holidays:[],exemptions:{}}, baseline=null, rows=blank(), selectedDate=dateKey(), dirty=false, blocked=false, holiday=false;
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
function isExempt(date,studentIndex) { return data.holidays.includes(date)||!!data.exemptions[date]?.[studentIndex]; }
function totalsFor(studentIndex) {
  const totals=[0,0,0];
  for(const [date,dayRows] of Object.entries(data.days)) {
    if(isExempt(date,studentIndex))continue;
    dayRows[studentIndex].forEach((submitted,index)=>{if(submitted)totals[index]++;});
  }
  return totals;
}
function streaksFor(studentIndex) {
  const current=[0,0,0], best=[0,0,0];
  for(const date of Object.keys(data.days).sort()) {
    if(isExempt(date,studentIndex)||!data.days[date].some((row,index)=>!isExempt(date,index)&&row.some(Boolean))) continue;
    data.days[date][studentIndex].forEach((submitted,index)=>{
      current[index]=submitted?current[index]+1:0;
      best[index]=Math.max(best[index],current[index]);
    });
  }
  return {current,best};
}
function renderTrophies(studentIndex) {
  const totals=totalsFor(studentIndex), streaks=streaksFor(studentIndex);
  const titles={total:['はじめの一歩','こつこつ名人','積み重ねの達人'],streak:['連続チャレンジャー','継続名人','継続の達人']};
  $('#trophy-subjects').replaceChildren();
  SUBJECTS.forEach((subject,index)=>{
    const section=document.createElement('section');section.className='trophy-subject';
    const heading=document.createElement('h4');heading.textContent=`${index+1} ${subject}`;
    const progress=document.createElement('p');progress.className='trophy-progress';progress.textContent=`累計 ${totals[index]}回 ／ 現在の連続 ${streaks.current[index]}回 ／ 最長連続 ${streaks.best[index]}回`;
    const grid=document.createElement('ul');grid.className='trophy-grid';
    for(const kind of ['total','streak']) [10,30,50].forEach((threshold,tier)=>{
      const earned=(kind==='total'?totals[index]:streaks.best[index])>=threshold;
      const badge=document.createElement('li');badge.className=`trophy-badge ${earned?'earned':'locked'}`;badge.dataset.subject=index;badge.dataset.kind=kind;badge.dataset.threshold=threshold;
      const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 64 64');icon.setAttribute('aria-hidden','true');icon.classList.add('trophy-icon');
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M18 8h28v5h12v8c0 10-6 16-17 17a16 16 0 0 1-6 4v10h11v6H18v-6h11V42a16 16 0 0 1-6-4C12 37 6 31 6 21v-8h12V8zm0 11h-6v2c0 5 3 9 8 10-1-4-2-8-2-12zm28 0c0 4-1 8-2 12 5-1 8-5 8-10v-2h-6z');icon.append(path);
      const condition=document.createElement('strong');condition.className='trophy-condition';condition.textContent=`${kind==='total'?'累計':'連続'}${threshold}回`;
      const title=document.createElement('span');title.className='trophy-title';title.textContent=titles[kind][tier];
      const status=document.createElement('span');status.className='trophy-status';status.textContent=earned?'獲得！':'未達成';
      badge.append(icon,condition,title,status);grid.append(badge);
    });
    section.append(heading,progress,grid);$('#trophy-subjects').append(section);
  });
}
function updateTotals() {
  document.querySelectorAll('[data-total-student]').forEach(element=>{
    element.textContent=`累計 ${totalsFor(Number(element.dataset.totalStudent))[Number(element.dataset.totalSubject)]}回`;
  });
}
function updateState() {
  updateTotals();
  $('#save-state').textContent=dirty?'未保存の変更あり':'保存済みの内容';
  $('#show').disabled=blocked||dirty;
  $('#save').disabled=blocked||!dirty;
  $('#holiday').checked=holiday;
  $('#holiday').disabled=blocked;
  $('#holiday-note').hidden=!holiday;
  $('#summary').textContent=holiday?'提出不要の日：累計・連続回数・トロフィー判定には含めません。':SUBJECTS.map((s,i)=>`${s}：${rows.filter((r,index)=>!exemptions[index]&&r[i]).length}/${30-exemptions.filter(Boolean).length} 提出済み`).join('　');
}
function render() {
  $('#rows').replaceChildren();
  const bulk=document.createElement('tr');const heading=document.createElement('th');heading.textContent='一括入力';bulk.append(heading);const exemptCell=document.createElement('td');exemptCell.textContent='児童ごとに設定';exemptCell.className='exempt-hint';bulk.append(exemptCell);
  SUBJECTS.forEach((subject,index)=>{const td=document.createElement('td');for(const [value,label] of [[true,'全員提出済み'],[false,'全員未確認']]){const button=document.createElement('button');button.textContent=label;button.disabled=blocked||holiday;button.setAttribute('aria-label',`${subject} ${label}`);button.onclick=()=>{
    if(!value&&!confirm(`${subject}を全員「未確認」に戻しますか？`))return;
    rows.forEach((row,studentIndex)=>{if(!exemptions[studentIndex])row[index]=value;});dirty=true;render();notify('一括入力しました。「提出状況を保存」を押してください。');
  };td.append(button);}bulk.append(td);});$('#rows').append(bulk);
  rows.forEach((row,index)=>{const tr=document.createElement('tr');const th=document.createElement('th');th.scope='row';th.textContent=`${index+1}番`;tr.append(th);const exemptCell=document.createElement('td');const exemptCheck=document.createElement('input');exemptCheck.type='checkbox';exemptCheck.className='exempt-check';exemptCheck.checked=exemptions[index];exemptCheck.disabled=blocked||holiday;exemptCheck.setAttribute('aria-label',`${index+1}番 提出不要（欠席など）`);exemptCheck.onchange=()=>{exemptions[index]=exemptCheck.checked;dirty=true;render();notify('個別の提出不要を変更しました。「提出状況を保存」を押してください。');};exemptCell.append(exemptCheck);tr.append(exemptCell);tr.className=exemptions[index]?'exempt-row':'';row.forEach((value,subject)=>{const td=document.createElement('td');const check=document.createElement('input');check.type='checkbox';check.className='submission-check';check.checked=value;check.disabled=blocked||holiday||exemptions[index];check.setAttribute('aria-label',`${index+1}番 ${SUBJECTS[subject]} 提出済み`);check.onchange=()=>{rows[index][subject]=check.checked;dirty=true;updateState();notify('未保存の変更があります。保存してから児童に見せてください。');};const total=document.createElement('small');total.className='total';total.dataset.totalStudent=index;total.dataset.totalSubject=subject;td.append(check,total);tr.append(td);});$('#rows').append(tr);});updateState();
}
function loadDate() { rows=(data.days[selectedDate]||blank()).map(r=>[...r]);holiday=data.holidays.includes(selectedDate);exemptions=[...(data.exemptions[selectedDate]||Array(30).fill(false))];dirty=false;render(); }
$('#holiday').onchange=()=>{holiday=$('#holiday').checked;dirty=true;render();notify('休みの設定を変更しました。「提出状況を保存」を押すと集計に反映されます。');};
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
    const holidays=data.holidays.filter(date=>date!==selectedDate);
    if(holiday)holidays.push(selectedDate);
    const next={version:1,days:{...data.days,[selectedDate]:rows.map(r=>[...r])},holidays:holidays.sort(),exemptions:{...data.exemptions,[selectedDate]:[...exemptions]}};
    const serialized=JSON.stringify(next);localStorage.setItem(KEY,serialized);
    if(localStorage.getItem(KEY)!==serialized)throw new Error('Storage failed');
    baseline=serialized;data=next;dirty=false;render();notify('この端末に保存しました。児童に見せられます。');
  } catch {notify('保存できませんでした。変更はまだ保存されていません。ブラウザの保存設定を確認してください。');}
};
$('#show').onclick=()=>{
  if(dirty||blocked)return;
  const id=Number($('#student').value);const saved=(data.days[selectedDate]||blank())[id-1];
  $('#viewer-heading').textContent=`${id}番の提出状況`;
  const isHoliday=isExempt(selectedDate,id-1);
  $('#viewer-date').textContent=`${selectedDate} の提出記録${isHoliday?'（宿題の提出が不要な日）':''}`;
  $('#mascot-message').textContent=isHoliday?'今日は提出しなくて大丈夫だよ。':saved.every(Boolean)?'ぜんぶ提出できたね！すごい！':saved.some(Boolean)?'「できた！」がふえているね！':'ひとつずつ、いっしょに進もう！';
  $('#viewer-items').replaceChildren();
  saved.forEach((value,index)=>{const li=document.createElement('li');const name=document.createElement('strong');name.textContent=`${index+1} ${SUBJECTS[index]}`;const status=document.createElement('span');status.textContent=isHoliday?'提出不要':value?'✓ 提出済み':'未確認';status.className=!isHoliday&&value?'submitted':'pending';const details=document.createElement('div');details.className='viewer-result';const total=document.createElement('small');total.className='viewer-total';total.textContent=`累計 ${totalsFor(id-1)[index]}回`;details.append(status,total);li.append(name,details);$('#viewer-items').append(li);});
  renderTrophies(id-1);
  document.body.classList.add('pupil-view');
  $('#teacher').hidden=true;$('#viewer').hidden=false;notify('');$('#viewer-heading').tabIndex=-1;$('#viewer-heading').focus();window.scrollTo(0,0);
};
$('#back').onclick=()=>{document.body.classList.remove('pupil-view');$('#viewer').hidden=true;$('#teacher').hidden=false;$('#show').focus();};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('storage',event=>{if(event.key!==KEY&&event.key!==null)return;blocked=true;document.body.classList.remove('pupil-view');$('#viewer').hidden=true;$('#teacher').hidden=false;render();notify('別のタブで保存内容が変更されました。画面を再読み込みしてください。');});
loadDate();
if('serviceWorker' in navigator && location.protocol!=='file:'){
  navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('#offline-status').textContent='オフライン用の画面を準備しました。通信を切って再度開けるか確認してください。';}).catch(()=>{$('#offline-status').textContent='オフライン用の準備ができませんでした。記録はこのブラウザに保存します。';});
}
