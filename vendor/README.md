# Bundled QR dependencies

The app serves these libraries locally, without contacting a CDN.

- qrcode 1.5.4 (MIT), qrcode-LICENSE.txt
- jsqr 1.4.0 (Apache-2.0), jsqr-LICENSE.txt
- dijkstrajs 1.0.3 (MIT), dijkstrajs-LICENSE.txt

The checked-in qr-core.js exposes only QRCode.toCanvas and jsQR as HomeworkQRCore.
It was bundled with esbuild from this entry:

```js
import QRCode from 'qrcode';
import jsQR from 'jsqr';
window.HomeworkQRCore={toCanvas:QRCode.toCanvas,decode:jsQR};
```

Rebuild outside the checkout using pinned dependencies and esbuild, copy the output back,
and include their licenses. There is no runtime npm dependency installation.
