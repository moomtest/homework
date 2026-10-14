'use strict';
(() => {
  let stopCamera=()=>{};
  async function display(text,container){
    container.replaceChildren();if(!text)return;
    const partSize=1000,id=crypto.randomUUID().slice(0,8),parts=[];
    for(let i=0;i<text.length;i+=partSize)parts.push(text.slice(i,i+partSize));
    const canvas=document.createElement('canvas'),label=document.createElement('p'),prev=document.createElement('button'),next=document.createElement('button');
    prev.type=next.type='button';prev.textContent='前のQR';next.textContent='次のQR';let index=0;
    container.append(canvas,label);if(parts.length>1)container.append(prev,next);
    async function draw(){const value=`HQ1:${id}:${index}:${parts.length}:${parts[index]}`;await window.HomeworkQRCore.toCanvas(canvas,value,{errorCorrectionLevel:'M',width:400,margin:4});label.textContent=`接続用QR ${index+1} / ${parts.length}（提出記録は含みません）`;prev.disabled=index===0;next.disabled=index===parts.length-1;}
    prev.onclick=()=>{index--;draw().catch(()=>label.textContent='QRを表示できません。文字コードを使ってください。');};next.onclick=()=>{index++;draw().catch(()=>label.textContent='QRを表示できません。文字コードを使ってください。');};await draw();
  }
  async function scan(target,container){
    stopCamera();container.replaceChildren();
    const message=document.createElement('p'),video=document.createElement('video'),stop=document.createElement('button');stop.type='button';stop.textContent='カメラを停止';video.autoplay=true;video.muted=true;video.playsInline=true;container.append(message,video,stop);
    let stream,active=true,frame=0,group=null;const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
    function end(){active=false;cancelAnimationFrame(frame);stream?.getTracks().forEach(track=>track.stop());video.srcObject=null;video.remove();stop.remove();}
    stopCamera=end;stop.onclick=()=>{end();message.textContent='読み取りを停止しました。';};
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('このブラウザではカメラを使えません。SafariのHTTPSページで開いてください。');
      stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280}}});
      if(!active){stream.getTracks().forEach(track=>track.stop());return;}
      video.srcObject=stream;await video.play();message.textContent='相手のQRにカメラを向けてください。複数ある場合は順番に読み取ります。';
      function tick(){
        if(!active)return;
        if(video.readyState>=2&&video.videoWidth){
          const scale=Math.min(1,800/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);context.drawImage(video,0,0,canvas.width,canvas.height);
          const image=context.getImageData(0,0,canvas.width,canvas.height);const result=window.HomeworkQRCore.decode(image.data,canvas.width,canvas.height,{inversionAttempts:'dontInvert'});
          if(result){const match=/^HQ1:([a-f0-9-]{8}):(\d+):(\d+):([\s\S]+)$/.exec(result.data);if(match){const [,id,partText,totalText,data]=match;const part=Number(partText),total=Number(totalText);if(total>=1&&total<=50&&part>=0&&part<total&&data.length<=1000){if(!group)group={id,total,parts:new Map()};if(group.id===id&&group.total===total){group.parts.set(part,data);message.textContent=`${group.parts.size} / ${total} 個を読み取りました。`;if(group.parts.size===total){const text=Array.from({length:total},(_,i)=>group.parts.get(i)).join('');if(text.startsWith('HN1.')){target.value=text;target.dispatchEvent(new Event('input',{bubbles:true}));end();message.textContent='コードを読み取りました。次の操作ボタンを押してください。';return;}}}}}}
        }
        frame=requestAnimationFrame(tick);
      }
      frame=requestAnimationFrame(tick);
    }catch(e){end();message.textContent='カメラを使えませんでした。'+e.message+' カメラの許可を確認するか、コードを貼り付けてください。';}
  }
  window.addEventListener('pagehide',()=>stopCamera());document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});
  window.HomeworkQR={display,scan};
})();
