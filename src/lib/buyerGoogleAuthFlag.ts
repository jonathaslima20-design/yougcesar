// Temporarily off: Google login for buyers breaks ("invalid flow state") when
// opened from WhatsApp/Instagram's embedded browser, and reliably detecting
// that browser ahead of time to work around it hasn't panned out (see
// inAppBrowser.ts/inAppBrowserEscape.ts, paused in main.tsx/App.tsx). Email +
// password doesn't have this problem, so it's the only buyer login method for
// now. Flip this back to true once the in-app-browser detection is solved.
export const BUYER_GOOGLE_LOGIN_ENABLED = false;
