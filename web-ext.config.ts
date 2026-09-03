import { defineWebExtConfig } from "wxt";

export default defineWebExtConfig({
  binaries: {
    brave: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  },
  /** Reused so logins and pinned toolbar state survive restarts. */
  chromiumProfile: ".wxt/brave-profile",
  keepProfileChanges: true,
  startUrls: ["https://stripe.com"],
});
