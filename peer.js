'use strict';
(() => {
  const LIMIT=1500000;
  const encode=value=>btoa(String.fromCharCode(...new TextEncoder().encode(value)));
  const decode=value=>new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0)));
  function encodeCode(value){return 'HN1.'+encode(JSON.stringify(value));}
  function decodeCode(value,type){
    if(typeof value!=='string'||value.length>50000||!value.trim().startsWith('HN1.'))throw new Error('接続コードが正しくありません。');
    let code;try{code=JSON.parse(decode(value.trim().slice(4)));}catch{throw new Error('接続コードを最初から最後まで貼り付けてください。');}
    if(code.type!==type||typeof code.session!=='string'||!/^[a-f0-9]{32}$/.test(code.session)||typeof code.sdp!=='string'||code.sdp.length>30000||!code.sdp.startsWith('v=0'))throw new Error('接続コードの種類が違います。');
    return code;
  }
  async function fingerprint(offer,answer){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(offer+'\n'+answer)));return Array.from(bytes.slice(0,3),b=>b.toString(16).padStart(2,'0')).join('-').toUpperCase();}
  async function gather(pc){
    if(pc.iceGatheringState==='complete'){if(!pc.localDescription?.sdp.includes('a=candidate:'))throw new Error('この端末の通信設定では直接接続の候補を取得できません。学校の管理者に端末間通信の設定を確認してください。');return;}
    await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{pc.removeEventListener('icegatheringstatechange',check);reject(new Error('接続候補を取得できませんでした。同じWi-Fiを確認してください。'));},15000);function check(){if(pc.iceGatheringState==='complete'){clearTimeout(timeout);pc.removeEventListener('icegatheringstatechange',check);resolve();}}pc.addEventListener('icegatheringstatechange',check);check();});
    if(!pc.localDescription?.sdp.includes('a=candidate:'))throw new Error('この端末の通信設定では直接接続の候補を取得できません。学校の管理者に端末間通信の設定を確認してください。');
  }
  function create({onPacket=()=>{},onState=()=>{},onControl=()=>{}}={}){
    if(!window.RTCPeerConnection||!crypto.subtle)throw new Error('SafariのHTTPSページで開いてください。この端末では直接接続を利用できません。');
    const pc=new RTCPeerConnection({iceServers:[]});let channel=null,closed=false,lastSeen=Date.now(),timer=null,incoming=null,queue=Promise.resolve();
    const id=crypto.randomUUID().replaceAll('-','');
    function fail(text){onState('error',text);}
    function attach(dc){
      if(channel){dc.close();return;}channel=dc;
      let opened=false;
      channel.onopen=()=>{if(opened)return;opened=true;lastSeen=Date.now();onState('connected');timer=setInterval(()=>{if(channel.readyState!=='open')return;if(Date.now()-lastSeen>35000){onState('disconnected','相手の応答がありません。最後に受信した記録を表示しています。');}channel.send(JSON.stringify({type:'ping'}));},10000);};
      channel.onclose=()=>{clearInterval(timer);incoming=null;if(!closed)onState('disconnected','接続が切れました。再接続にはコードの交換が必要です。');};
      channel.onerror=()=>fail('接続でエラーが起きました。同じWi-Fiと接続コードを確認してください。');
      channel.onmessage=event=>{
        try{
          if(typeof event.data!=='string'||event.data.length>20000)throw new Error('受信サイズが大きすぎます。');
          const msg=JSON.parse(event.data);lastSeen=Date.now();
          if(msg.type==='ping'){channel.send(JSON.stringify({type:'pong'}));onControl({type:'alive'});return;}
          if(msg.type==='pong'){onControl({type:'alive'});return;}
          if(msg.type==='ack'){if(Number.isSafeInteger(msg.revision)&&msg.revision>=0)onControl(msg);return;}
          if(msg.type!=='chunk'||typeof msg.id!=='string'||msg.id.length>64||!Number.isInteger(msg.total)||msg.total<1||msg.total>128||!Number.isInteger(msg.index)||msg.index<0||msg.index>=msg.total||typeof msg.data!=='string'||msg.data.length>12000)throw new Error('受信データが正しくありません。');
          if(msg.index===0)incoming={id:msg.id,total:msg.total,parts:[],size:0};
          if(!incoming||incoming.id!==msg.id||incoming.total!==msg.total||incoming.parts.length!==msg.index)throw new Error('受信の順序が正しくありません。');
          incoming.parts.push(msg.data);incoming.size+=msg.data.length;if(incoming.size>LIMIT)throw new Error('受信データが大きすぎます。');
          if(incoming.parts.length===incoming.total){const text=incoming.parts.join('');incoming=null;Promise.resolve(onPacket(JSON.parse(text))).catch(e=>fail(e.message));}
        }catch(e){incoming=null;fail(e.message);}
      };
      if(channel.readyState==='open')channel.onopen();
    }
    pc.ondatachannel=event=>attach(event.channel);
    pc.onconnectionstatechange=()=>{if(['failed','disconnected'].includes(pc.connectionState))onState('disconnected','直接接続できません。同じWi-Fi・学校の端末間通信設定を確認してください。');};
    return {
      get ready(){return channel?.readyState==='open'&&!closed;},
      async offer(){attach(pc.createDataChannel('homework',{ordered:true}));await pc.setLocalDescription(await pc.createOffer());await gather(pc);return encodeCode({type:'offer',session:id,sdp:pc.localDescription.sdp});},
      async answer(text){const offer=decodeCode(text,'offer');await pc.setRemoteDescription({type:'offer',sdp:offer.sdp});await pc.setLocalDescription(await pc.createAnswer());await gather(pc);const sdp=pc.localDescription.sdp;return {code:encodeCode({type:'answer',session:offer.session,sdp}),phrase:await fingerprint(offer.sdp,sdp)};},
      async accept(text){const answer=decodeCode(text,'answer');if(answer.session!==id)throw new Error('別の接続の返信コードです。この児童のコードを使ってください。');await pc.setRemoteDescription({type:'answer',sdp:answer.sdp});return fingerprint(pc.localDescription.sdp,answer.sdp);},
      send(packet){const task=async()=>{const text=JSON.stringify(packet);if(text.length>LIMIT)throw new Error('記録が大きすぎて送れません。');const messageId=crypto.randomUUID();const total=Math.ceil(text.length/12000);for(let index=0;index<total;index++){const started=Date.now();while(channel?.bufferedAmount>65536){if(Date.now()-started>15000||!this.ready)throw new Error('転送が止まりました。再接続してください。');await new Promise(resolve=>setTimeout(resolve,50));}if(!this.ready)throw new Error('接続が切れています。');channel.send(JSON.stringify({type:'chunk',id:messageId,index,total,data:text.slice(index*12000,(index+1)*12000)}));}};queue=queue.catch(()=>{}).then(task);return queue;},
      ack(revision){if(this.ready)channel.send(JSON.stringify({type:'ack',revision}));},
      close(){closed=true;clearInterval(timer);incoming=null;if(channel)channel.close();pc.close();onState('disconnected','接続を終了しました。');}
    };
  }
  const base64Bytes=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const bytesBase64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
  async function publicId(jwk){const canonical=JSON.stringify({crv:jwk.crv,kty:jwk.kty,x:jwk.x,y:jwk.y});return base64Bytes(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical)));}
  function validSnapshot(value){
    const arr=a=>Array.isArray(a)&&a.length===3&&a.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=10000);
    const date=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00'));
    if(!value||value.version!==1||!Number.isInteger(value.studentId)||value.studentId<1||value.studentId>30||typeof value.teacherId!=='string'||!Number.isSafeInteger(value.revision)||value.revision<0||!Number.isFinite(Date.parse(value.issuedAt))||!Array.isArray(value.records)||value.records.length>10000||!value.stats||!arr(value.stats.totals)||!arr(value.stats.current)||!arr(value.stats.best))throw new Error('本人の提出記録として読み込めません。');
    const dates=new Set();
    for(const record of value.records){if(!record||!date(record.date)||dates.has(record.date)||!Array.isArray(record.values)||record.values.length!==3||record.values.some(v=>typeof v!=='boolean')||typeof record.exempt!=='boolean')throw new Error('提出記録が正しくありません。');dates.add(record.date);}
    return value;
  }
  window.HomeworkPeer={create,publicId,base64Bytes,bytesBase64,validSnapshot};
})();
