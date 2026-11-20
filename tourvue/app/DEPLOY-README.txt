TourVue v8 working deploy package

This package is based on tourvue-pwa-v7-operational.zip, the last confirmed working static PWA.
It does not depend on a Vue/Vite build, so it will not white-screen from missing bundled assets.

Deploy instructions for voyus.app/tourvue:
1. Upload all files in this folder into the /tourvue directory.
2. Keep this structure exactly:
   /tourvue/index.html
   /tourvue/splash.html
   /tourvue/browse.html
   /tourvue/live.html
   /tourvue/guide.html
   /tourvue/wallet.html
   /tourvue/app.js
   /tourvue/styles.css
   /tourvue/manifest.json
   /tourvue/service-worker.js
   /tourvue/assets/icon.svg
3. Open /tourvue/splash.html or /tourvue/index.html.
4. If Chrome still shows a blank page, clear site storage/cache and unregister the old service worker.

Current operational front-end features:
- Splash page with TourVue logo and TourVue text under logo.
- Site-wide logo/brand header.
- Viewer browse and live room flow.
- Guide studio with camera permission and live/offline status.
- Room creation and local persistence.
- Viewer chat, guide chat overlay, tips, turn request.
- GPS update support through browser geolocation.
- Wallet showing gross, 10% marketplace fee, and 90% guide payout.
- PWA manifest and service worker.

Backend still needed for production:
- Real WebRTC signaling server.
- HLS transcoding/CDN fallback.
- Stripe Connect PaymentIntents and webhook confirmation.
- Auth/accounts.
- Database room sync.
