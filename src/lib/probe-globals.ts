/** Runs in the page MAIN world. No imports — Chrome serializes this function. */
export function probePageGlobals(): { name: string; kind: string }[] {
  const w = window as unknown as Record<string, unknown>;
  const out: { name: string; kind: string }[] = [];
  const seen = new Set<string>();

  const has = (key: string): boolean => {
    try {
      return key in w && w[key] != null;
    } catch {
      return false;
    }
  };

  const add = (name: string, kind: string, ok: boolean) => {
    if (!ok || seen.has(name)) return;
    seen.add(name);
    out.push({ name, kind });
  };

  const obj = (key: string) => {
    try {
      return w[key] as Record<string, unknown> | undefined;
    } catch {
      return undefined;
    }
  };

  add(
    "React",
    "framework",
    has("React") || has("__REACT_DEVTOOLS_GLOBAL_HOOK__"),
  );
  add("Preact", "framework", has("preact") || has("Preact"));
  add(
    "Vue",
    "framework",
    has("Vue") || has("__VUE__") || has("__VUE_DEVTOOLS_GLOBAL_HOOK__"),
  );
  add(
    "Angular",
    "framework",
    has("ng") || has("getAllAngularRootElements") || has("ngDevMode"),
  );
  add("Svelte", "framework", has("__svelte"));
  add("Solid", "framework", has("Solid$") || has("_$HYDRATION"));
  add("Alpine.js", "framework", has("Alpine"));
  add("HTMX", "framework", has("htmx"));
  add("Livewire", "framework", has("Livewire"));
  add("Stimulus", "framework", has("Stimulus"));
  add("Turbo", "framework", has("Turbo"));
  add("Ember", "framework", has("Ember"));
  add("Backbone", "framework", has("Backbone"));
  add("Knockout", "framework", has("ko"));
  add("jQuery", "framework", has("jQuery"));
  add("lit", "framework", has("LitElement") || has("lit"));
  add("Nuxt", "framework", has("__NUXT__"));
  add(
    "Next.js",
    "framework",
    has("next") && typeof obj("next")?.version === "string",
  );

  add(
    "GSAP",
    "motion",
    has("gsap") || has("GreenSockGlobals") || has("TweenMax") || has("TweenLite"),
  );
  add("Lenis", "motion", has("Lenis"));
  add("Locomotive", "motion", has("LocomotiveScroll"));
  add("Barba", "motion", has("barba"));
  add("Anime.js", "motion", has("anime"));
  add("Lottie", "motion", has("lottie") || has("bodymovin"));
  add("AOS", "motion", has("AOS"));
  add("ScrollMagic", "motion", has("ScrollMagic"));
  add("ScrollReveal", "motion", has("ScrollReveal"));
  add("Splitting", "motion", has("Splitting"));
  add("SplitType", "motion", has("SplitType"));
  add("Typed.js", "motion", has("Typed"));
  add("Mo.js", "motion", has("mojs") || has("mojs"));

  add("Three.js", "3d", has("THREE"));
  add("Babylon.js", "3d", has("BABYLON"));
  add("PixiJS", "3d", has("PIXI"));
  add("p5.js", "3d", has("p5"));
  add("Phaser", "3d", has("Phaser"));
  add("Matter.js", "3d", has("Matter"));
  add("Cannon", "3d", has("CANNON"));
  add("OGL", "3d", has("OGL"));
  add("Konva", "3d", has("Konva"));
  add("Fabric.js", "3d", has("fabric"));
  add("Paper.js", "3d", has("paper"));

  add("Swiper", "ui", has("Swiper"));
  add("Tippy.js", "ui", has("tippy"));
  add("Popper", "ui", has("Popper"));
  add("D3", "ui", has("d3"));
  const chart = obj("Chart");
  add("Chart.js", "ui", Boolean(chart && chart.defaults));
  add("Highcharts", "ui", has("Highcharts"));
  add("ECharts", "ui", has("echarts"));
  add("Moment.js", "ui", has("moment"));
  add("Day.js", "ui", has("dayjs"));
  add("Axios", "ui", has("axios"));
  add("i18next", "ui", has("i18next"));

  add("Bootstrap", "styling", has("bootstrap"));

  add("Mapbox", "maps", has("mapboxgl"));
  const google = obj("google");
  add("Google Maps", "maps", Boolean(google && google.maps));
  const L = obj("L");
  add("Leaflet", "maps", Boolean(L && typeof L.map === "function"));

  add("Video.js", "media", has("videojs"));
  add("Plyr", "media", has("Plyr"));
  add("Hls.js", "media", has("Hls"));
  add("Howler", "media", has("Howl") || has("HowlerGlobal"));
  add("YouTube IFrame", "media", has("YT"));
  add("Vimeo", "media", has("Vimeo"));

  add("Stripe", "payments", has("Stripe"));
  add("PayPal", "payments", has("paypal"));

  add("Firebase", "auth", has("firebase"));
  add("Auth0", "auth", has("auth0"));
  add("Clerk", "auth", has("Clerk"));

  add("Shopify", "cms", has("Shopify"));
  add("Webflow", "cms", has("Webflow"));

  add(
    "Google Tag Manager",
    "analytics",
    has("google_tag_manager") || has("googletagmanager"),
  );
  add(
    "Google Analytics",
    "analytics",
    has("gtag") || has("ga") || has("dataLayer"),
  );
  const analytics = obj("analytics");
  add(
    "Segment",
    "analytics",
    Boolean(analytics && typeof analytics.track === "function"),
  );
  add("Mixpanel", "analytics", has("mixpanel"));
  add("Amplitude", "analytics", has("amplitude"));
  add("Hotjar", "analytics", has("hj"));
  add("Intercom", "analytics", has("Intercom"));
  add("Sentry", "analytics", has("Sentry") || has("__SENTRY__"));
  add("Datadog RUM", "analytics", has("DD_RUM"));
  add("New Relic", "analytics", has("newrelic"));
  add("PostHog", "analytics", has("posthog"));
  add("Plausible", "analytics", has("plausible"));
  add("Fathom", "analytics", has("fathom"));

  add("webpack", "bundler", Object.keys(w).some((k) => k.startsWith("webpackChunk")));
  add("Vite", "bundler", has("__vite_is_modern_browser"));
  add("RequireJS", "bundler", has("requirejs"));

  return out;
}
