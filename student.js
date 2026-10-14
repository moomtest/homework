'use strict';
(() => {
  const $=s=>document.querySelector(s),P=window.HomeworkPeer,KEY='homework-pupil-signed-v1';
  const SUBJECTS=['漢字','算数','音読・日記'];let snapshot=null,receivedAt=null,link=null,connection='disconnected',receiving=Promise.resolve(),storageBaseline=null,storageBlocked=false,receiverGeneration=0;
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  $('#student-date').value=today();
  function notice(text){$('#student-message').textContent=text;}
  function connectionText(){
    $('#connection-state').textContent=connection==='connected'?(snapshot?'接続中：受信済みの記録を表示しています。':'接続中：先生の許可と記録の受信を待っています。'):'未接続：最後に受信・保存した記録です。最新とは限りません。';
    if(!snapshot)$('#connection-state').textContent=connection==='connected'?'接続中：先生の許可と記録の受信を待っています。':'未接続：まだ自分の記録を受信していません。';
    $('#received-time').textContent=snapshot?`最終受信：${new Date(receivedAt).toLocaleString('ja-JP')} ／ 先生の送信時刻：${new Date(snapshot.issuedAt).toLocaleString('ja-JP')}`:'先生とつないで、自分の記録を受け取りましょう。';
  }
  async function verify(envelope){
    if(!envelope||typeof envelope.payload!=='string'||envelope.payload.length>1000000||typeof envelope.signature!=='string'||envelope.signature.length>300||!envelope.publicKey||envelope.publicKey.d||envelope.publicKey.kty!=='EC'||envelope.publicKey.crv!=='P-256')throw new Error('先生の署名を確認できません。');
    const key=await crypto.subtle.importKey('jwk',envelope.publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    const verified=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,P.bytesBase64(envelope.signature),new TextEncoder().encode(envelope.payload));
    if(!verified)throw new Error('記録の署名が一致しません。前の保存記録は変更していません。');
    const value=P.validSnapshot(JSON.parse(envelope.payload));
    if(value.teacherId!==await P.publicId(envelope.publicKey))throw new Error('先生の識別情報が一致しません。');
    return value;
  }
  function render(){
    connectionText();$('#viewer').hidden=!snapshot;if(!snapshot)return;
    const record=snapshot.records.find(r=>r.date===$('#student-date').value);
    const date=$('#student-date').value;const exempt=record?.exempt===true;const values=record?.values||[false,false,false];
    $('#viewer-heading').textContent=`${snapshot.studentId}番の提出状況`;
    $('#viewer-date').textContent=`${date} の提出記録${exempt?'（宿題の提出が不要な日）':!record?'（まだ記録がありません）':''}`;
    $('#mascot-message').textContent=exempt?'今日は提出しなくて大丈夫だよ。':values.every(Boolean)?'ぜんぶ提出できたね！すごい！':values.some(Boolean)?'「できた！」がふえているね！':'ひとつずつ、いっしょに進もう！';
    $('#viewer-items').replaceChildren();
    values.forEach((value,index)=>{const li=document.createElement('li');const title=document.createElement('strong');title.textContent=`${index+1} ${SUBJECTS[index]}`;const details=document.createElement('div');details.className='viewer-result';const status=document.createElement('span');status.textContent=exempt?'提出不要':!record?'記録なし':value?'✓ 提出済み':'未確認';status.className=!exempt&&value?'submitted':'pending';const total=document.createElement('small');total.className='viewer-total';total.textContent=`累計 ${snapshot.stats.totals[index]}回`;details.append(status,total);li.append(title,details);$('#viewer-items').append(li);});
    window.renderTrophyCollection(snapshot.stats);
  }
  const loaded=(async()=>{
    try{storageBaseline=localStorage.getItem(KEY);if(storageBaseline){const saved=JSON.parse(storageBaseline);snapshot=await verify(saved.envelope);receivedAt=saved.receivedAt;if(!Number.isFinite(Date.parse(receivedAt)))throw new Error('受信時刻を確認できません。');}}
    catch(e){snapshot=null;storageBlocked=true;notice('保存した記録を安全に読み込めません。'+e.message+' 先生に確認してください。');}
    render();
  })();
  async function receive(envelope,generation){
    await loaded;if(generation!==receiverGeneration)return;if(storageBlocked)throw new Error('保存領域を確認できないため、記録は更新していません。');
    const value=await verify(envelope);if(generation!==receiverGeneration)return;
    if(snapshot&&(value.studentId!==snapshot.studentId||value.teacherId!==snapshot.teacherId))throw new Error('登録した本人・先生とは違う記録です。受け取りを拒否しました。');
    if(snapshot&&(value.revision<snapshot.revision||(value.revision===snapshot.revision&&Date.parse(value.issuedAt)<Date.parse(snapshot.issuedAt))))throw new Error('以前の記録のため、現在の記録を上書きしていません。');
    if(localStorage.getItem(KEY)!==storageBaseline)throw new Error('別のタブで記録が変わりました。画面を開き直してください。');
    const timestamp=new Date().toISOString();const saved=JSON.stringify({envelope,receivedAt:timestamp});
    try{localStorage.setItem(KEY,saved);if(localStorage.getItem(KEY)!==saved)throw new Error();}catch{throw new Error('このiPadに保存できませんでした。前に受信した記録を表示しています。');}
    storageBaseline=saved;snapshot=value;receivedAt=timestamp;
    render();link?.ack(snapshot.revision);notice('自分の記録を受信し、このiPadに保存しました。');
  }
  $('#scan-offer').onclick=()=>window.HomeworkQR.scan($('#teacher-offer'),$('#offer-camera'));
  $('#make-answer').onclick=async()=>{
    const button=$('#make-answer');button.disabled=true;
    try{
      await loaded;if(storageBlocked)throw new Error('保存した記録を確認できません。先生に相談してください。');
      if(link)link.close();$('#student-answer').value='';$('#answer-qr').replaceChildren();$('#student-phrase').textContent='';
      const generation=++receiverGeneration;
      link=P.create({onPacket:envelope=>{receiving=receiving.catch(()=>{}).then(()=>receive(envelope,generation));return receiving;},onState:(state,text)=>{connection=state==='connected'?'connected':'disconnected';connectionText();if(text)notice(text);},onControl:msg=>{if(msg.type==='alive'&&link?.ready){connection='connected';connectionText();}}});
      const answer=await link.answer($('#teacher-offer').value);$('#student-answer').value=answer.code;await window.HomeworkQR.display(answer.code,$('#answer-qr'));$('#student-phrase').textContent=`先生の端末と照合する確認番号：${answer.phrase}`;notice('返信コードを先生に渡してください。先生が確認・許可するまで記録は届きません。');
    }catch(e){link?.close();notice(e.message);}finally{button.disabled=false;}
  };
  $('#disconnect').onclick=()=>{receiverGeneration++;link?.close();connection='disconnected';connectionText();};
  $('#student-date').onchange=()=>{if(!/^\d{4}-\d{2}-\d{2}$/.test($('#student-date').value))$('#student-date').value=today();render();};
  $('#forget').onclick=async()=>{await loaded;if(!confirm('このiPadの本人の記録と登録を削除しますか？先生の記録は消えません。再び先生と接続するまで記録は表示できません。'))return;try{receiverGeneration++;link?.close();localStorage.removeItem(KEY);snapshot=null;receivedAt=null;storageBaseline=null;storageBlocked=false;$('#teacher-offer').value='';$('#student-answer').value='';$('#answer-qr').replaceChildren();$('#student-phrase').textContent='';connection='disconnected';render();notice('このiPadの児童記録を削除しました。');}catch{notice('記録を削除できませんでした。');}};
  window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){receiverGeneration++;link?.close();snapshot=null;storageBlocked=true;render();notice('別のタブで記録が変わりました。画面を開き直してください。');}});
  window.addEventListener('pagehide',()=>link?.close());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){connection='disconnected';connectionText();}else if(link?.ready){notice('接続の応答を確認中です。最後に受信した記録を表示しています。');}});
  if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{$('#offline-status').textContent='オフライン用の準備ができませんでした。';});
})();
