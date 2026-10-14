// Browser canvas/video test; camera hardware is replaced with a canvas capture stream.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8010';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage();await page.goto(origin+'/student.html');
await page.evaluate(async()=>{
 window.qrExpected='HN1.'+'x'.repeat(1400);const partA=qrExpected.slice(0,1000),partB=qrExpected.slice(1000);
 const source=document.createElement('canvas');source.width=500;source.height=500;window.qrCanvas=source;document.body.append(source);
 await HomeworkQRCore.toCanvas(source,'HQ1:12345678:0:2:'+partA,{width:500,errorCorrectionLevel:'M'});
 navigator.mediaDevices.getUserMedia=async()=>{window.cameraStream=source.captureStream(10);window.cameraTicker=setInterval(()=>{const ctx=source.getContext('2d');const data=ctx.getImageData(0,0,source.width,source.height);ctx.putImageData(data,0,0);},100);return cameraStream;};
 document.querySelector('#connect-panel').open=true;
 window.qrSecond='HQ1:12345678:1:2:'+partB;
});
await page.locator('#scan-offer').click();await page.waitForFunction(()=>document.querySelector('#offer-camera').textContent.includes('1 / 2'),null,{timeout:15000});
await page.evaluate(async()=>{await HomeworkQRCore.toCanvas(qrCanvas,qrSecond,{width:500,errorCorrectionLevel:'M'});});
await page.waitForFunction(()=>document.querySelector('#teacher-offer').value===qrExpected,null,{timeout:15000});
assert.equal(await page.evaluate(()=>cameraStream.getTracks().every(t=>t.readyState==='ended')),true);await page.evaluate(()=>clearInterval(cameraTicker));
await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('denied','NotAllowedError');};});await page.locator('#scan-offer').click();await page.waitForFunction(()=>document.querySelector('#offer-camera').textContent.includes('カメラを使えません'));
await browser.close();console.log('PASS (simulated camera): real QR image decoding, multipart assembly, tracks stop on completion, denied-permission handling');})().catch(e=>{console.error(e);process.exit(1)});
