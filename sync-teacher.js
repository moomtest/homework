'use strict';
(() => {
  const $=s=>document.querySelector(s), P=window.HomeworkPeer;
  const KEY='homework-teacher-signing-v1';
  const peers=new Map();let pending=null,identityPromise=null;
  for(let i=1;i<=30;i++){const option=document.createElement('option');option.value=i;option.textContent=`${i}番`;$('#sync-student').append(option);}
  function notice(text){$('#sync-message').textContent=text;}
  function status(peer,text){peer.status.textContent=`${peer.id}番：${text}`;}
  async function identity(){
    if(!identityPromise)identityPromise=(async()=>{
      let saved=localStorage.getItem(KEY),keys;
      if(saved)keys=JSON.parse(saved);
      else {
        const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
        keys={privateJwk:await crypto.subtle.exportKey('jwk',pair.privateKey),publicJwk:await crypto.subtle.exportKey('jwk',pair.publicKey)};
        if(localStorage.getItem(KEY)!==null)keys=JSON.parse(localStorage.getItem(KEY));
        else {saved=JSON.stringify(keys);localStorage.setItem(KEY,saved);if(localStorage.getItem(KEY)!==saved)throw new Error('先生の識別情報を保存できません。');}
      }
      const privateKey=await crypto.subtle.importKey('jwk',keys.privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
      return {privateKey,publicJwk:keys.publicJwk,id:await P.publicId(keys.publicJwk)};
    })().catch(e=>{identityPromise=null;throw e;});
    return identityPromise;
  }
  async function send(peer){
    if(!peer.approved||!peer.link.ready)return;
    try {
      const teacher=await identity();const snapshot={...window.pupilSnapshot(peer.id),teacherId:teacher.id};
      const payload=JSON.stringify(snapshot);
      const signature=P.base64Bytes(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},teacher.privateKey,new TextEncoder().encode(payload)));
      await peer.link.send({publicKey:teacher.publicJwk,payload,signature});status(peer,'送信しました。児童端末への保存確認を待っています。');
    }catch(e){status(peer,'送信できません：'+e.message);}
  }
  $('#scan-answer').onclick=()=>window.HomeworkQR.scan($('#answer-code'),$('#answer-camera'));
  $('#make-invite').onclick=async()=>{
    const button=$('#make-invite');button.disabled=true;
    try {
      const id=Number($('#sync-student').value);window.pupilSnapshot(id);await identity();
      if(pending&&!pending.approved){pending.link.close();pending.item.remove();peers.delete(pending.id);pending=null;}
      if(peers.has(id)){if(!confirm(`${id}番の現在の接続を終了して、新しい接続を作りますか？`))return;peers.get(id).link.close();peers.get(id).item.remove();peers.delete(id);}
      const item=document.createElement('li'),line=document.createElement('span'),stop=document.createElement('button');stop.textContent='接続を終了';item.append(line,stop);$('#peer-list').append(item);
      const peer={id,item,status:line,approved:false,link:null};
      peer.link=P.create({onState:(state,text)=>{if(state==='connected'){status(peer,peer.approved?'接続中':'接続確認中。本人確認して許可してください。');if(peer.approved)send(peer);}else status(peer,text||'接続準備中');},onControl:msg=>{if(msg.type==='alive'&&peer.approved){if(peer.ackRevision!==window.pupilSnapshot(id).revision)send(peer);else status(peer,'接続中・最新の保存記録を児童の端末に保存済み');}if(msg.type==='ack'&&peer.approved){const latest=window.pupilSnapshot(id).revision;peer.ackRevision=msg.revision;status(peer,msg.revision===latest?'接続中・最新の保存記録を児童の端末に保存済み':'接続中・新しい記録を反映中');}}});
      peers.set(id,peer);pending=peer;stop.onclick=()=>{peer.link.close();peer.approved=false;if(pending===peer){pending=null;$('#approve-peer').disabled=true;$('#invite-code').value='';$('#invite-qr').replaceChildren();$('#answer-code').value='';$('#pair-phrase').textContent='';}};
      $('#invite-code').value='';$('#invite-qr').replaceChildren();$('#answer-code').value='';$('#pair-phrase').textContent='';$('#approve-peer').disabled=true;
      status(peer,'接続コードを作成中…');$('#invite-code').value=await peer.link.offer();await window.HomeworkQR.display($('#invite-code').value,$('#invite-qr'));status(peer,'児童の返信コードを待っています');notice(`${id}番本人のiPadだけに接続コードを渡してください。`);
    }catch(e){if(pending&&!pending.approved){pending.link.close();status(pending,e.message);}notice(e.message);}finally{button.disabled=false;}
  };
  $('#accept-answer').onclick=async()=>{
    if(!pending){notice('先に児童を選んで接続コードを作ってください。');return;}
    const button=$('#accept-answer');button.disabled=true;
    try {const peer=pending;const phrase=await peer.link.accept($('#answer-code').value);if(pending!==peer)return;peer.phrase=phrase;$('#pair-phrase').textContent=`${peer.id}番の端末と照合する確認番号：${phrase}`;$('#approve-peer').disabled=false;notice('児童本人の画面にも同じ確認番号が表示されていることを、先生が直接確認してください。');}
    catch(e){notice(e.message);}finally{button.disabled=false;}
  };
  $('#approve-peer').onclick=async()=>{if(!pending||!pending.phrase)return;pending.approved=true;$('#approve-peer').disabled=true;notice(`${pending.id}番への送信を許可しました。接続中は保存するたびに自動反映します。`);if(pending.link.ready)await send(pending);else status(pending,'接続待ち。学校のWi-Fiで端末間通信が許可されているか確認してください。');};
  window.addEventListener('homework-saved',()=>{for(const peer of peers.values())send(peer);});
  window.addEventListener('pagehide',()=>{for(const peer of peers.values())peer.link.close();});
})();
