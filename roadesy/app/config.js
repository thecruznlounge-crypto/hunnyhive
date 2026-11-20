/* Roadesy settings — edit these, no code changes needed */
window.RB_CONFIG = {
  /* Free key for EV charging stations (U.S. DOE / NREL): https://developer.nrel.gov/signup/
     DEMO_KEY works for testing but is limited to a few dozen lookups per hour. */
  NREL_KEY: "DEMO_KEY",

  /* Map tiles. OpenStreetMap's free tiles are fine to launch with; for heavy traffic or bigger
     offline downloads switch to a paid provider (MapTiler, Stadia, Carto) and paste its URL here. */
  TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  TILE_ATTR: "&copy; OpenStreetMap",
  TILE_MAX_OFFLINE_ZOOM: 14,   // OpenStreetMap asks apps not to bulk-download close-up tiles; raise to 16 with a paid provider
  TILE_MAX_OFFLINE: 1500,      // most tiles one "Save offline" may download

  /* Donations: paste a payment link (Stripe Payment Link, PayPal.me, Buy Me a Coffee, Cash App…) to show a
     "Keep Roadesy free" card in the Safety tab. Hidden in the Play Store app unless showInPlayStore is true. */
  DONATE: { url: "", label: "Donate", showInPlayStore: false },

  /* Use the api/*.php cache on your hosting when it's there (falls back automatically when it isn't) */
  USE_PROXY: true
};
