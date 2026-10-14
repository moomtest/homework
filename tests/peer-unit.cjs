// No sockets: exercise the production transport against an in-memory RTC test double.
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const pcs=new Map();let next=0;
class Channel {
  constructor(){this.readyState='connecting';this.bufferedAmount=0;}
  send(text){if(this.readyState!=='open')throw new Error('Closed');queueMicrotask(()=>this.other.onmessage?.({data:text}));}
  close(){if(this.readyState==='closed')return;this.readyState='closed';this.onclose?.();if(this.other?.readyState!=='closed')this.other?.close();}
}
class RTC extends EventTarget {
  constructor(){super();this.id=String(++next);pcs.set(this.id,this);this.iceGatheringState='complete';this.connectionState='new';}
  createDataChannel(){this.channel=new Channel();return this.channel;}
  async createOffer(){return {type:'offer',sdp:`v=0\r\na=candidate:TEST\r\na=x-peer:${this.id}\r\n`};}
  async createAnswer(){return {type:'answer',sdp:`v=0\r\na=candidate:TEST\r\na=x-peer:${this.id}\r\n`};}
  async setLocalDescription(value){this.localDescription=value;}
  async setRemoteDescription(value){this.remoteDescription=value;const id=/a=x-peer:(\d+)/.exec(value.sdp)?.[1];this.remote=pcs.get(id);if(value.type==='offer'){this.channel=new Channel();this.channel.other=this.remote.channel;this.remote.channel.other=this.channel;this.ondatachannel?.({channel:this.channel});}else{setTimeout(()=>{for(const pc of[this,this.remote]){pc.channel.readyState='open';pc.channel.onopen?.();}},0);}}
  close(){this.channel?.close();}
}
const sandbox={window:{RTCPeerConnection:RTC},RTCPeerConnection:RTC,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,atob,btoa,setTimeout,clearTimeout,setInterval,clearInterval,console};
vm.runInNewContext(readFileSync(join(__dirname,'../peer.js'),'utf8'),sandbox);
const P=sandbox.window.HomeworkPeer;
const wait=()=>new Promise(resolve=>setTimeout(resolve,20));
(async()=>{
 const received=[],controls=[],states=[];
 const teacher=P.create({onControl:message=>controls.push(message)}),student=P.create({onPacket:message=>received.push(message),onState:(state,text)=>states.push({state,text})});
 const offer=await teacher.offer();const answer=await student.answer(offer);assert.equal(await teacher.accept(answer.code),answer.phrase);await wait();assert(teacher.ready&&student.ready);
 await Promise.all([teacher.send({text:'x'.repeat(80000)+'日本語',order:1}),teacher.send({order:2})]);await wait();assert.equal(received.length,2);assert.equal(received[0].text.length,80003);assert.equal(received[1].order,2);
 student.ack(9);await wait();assert.equal(controls.some(message=>message.type==='ack'&&message.revision===9),true);
 const last=pcs.get('2');last.channel.onmessage({data:JSON.stringify({type:'chunk',id:'wrong',index:1,total:2,data:'x'})});assert.equal(states.at(-1).state,'error');assert.equal(received.length,2);
 const other=P.create();await other.offer();await assert.rejects(()=>other.accept(answer.code),/別の接続/);other.close();
 teacher.close();student.close();
 const bad=P.create();const pc=pcs.get(String(next));pc.createOffer=async()=>({type:'offer',sdp:'v=0\r\n'});await assert.rejects(()=>bad.offer(),/通信設定/);bad.close();
 console.log('PASS (in-memory RTC): manual handshake binding, matching phrase, ordered chunked delivery, acknowledgments, malformed chunk rejection, wrong-session rejection, no-ICE error');
})().catch(error=>{console.error(error);process.exitCode=1;});
