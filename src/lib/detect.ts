import type { DetectedKind, DetectedLib, DetectedVia } from "./types";

type Fingerprint = {
  name: string;
  kind: DetectedKind;
  scripts?: RegExp;
  html?: (ctx: ScanCtx) => boolean;
};

export type ScanCtx = {
  srcs: string;
  html: string;
  classes: string;
  generator: string;
};

const FINGERPRINTS: Fingerprint[] = [
  {
    name: "Next.js",
    kind: "framework",
    scripts: /\/_next\//,
    html: () =>
      Boolean(
        document.getElementById("__NEXT_DATA__") ||
          document.getElementById("__next"),
      ),
  },
  {
    name: "Nuxt",
    kind: "framework",
    scripts: /\/_nuxt\//,
    html: () =>
      Boolean(
        document.getElementById("__NUXT_DATA__") ||
          document.getElementById("__nuxt"),
      ),
  },
  {
    name: "Gatsby",
    kind: "framework",
    scripts: /gatsby/i,
    html: () => Boolean(document.getElementById("___gatsby")),
  },
  {
    name: "Remix",
    kind: "framework",
    scripts: /remix/i,
    html: () => Boolean(document.querySelector("[data-remix-run]")),
  },
  {
    name: "Astro",
    kind: "framework",
    scripts: /astro/i,
    html: () => Boolean(document.querySelector("astro-island, [data-astro-cid]")),
  },
  {
    name: "SvelteKit",
    kind: "framework",
    scripts: /sveltekit|_app\/immutable/i,
  },
  {
    name: "React",
    kind: "framework",
    scripts: /react(-dom)?[./-]/i,
    html: () =>
      Boolean(
        document.querySelector("[data-reactroot], [data-reactid]") ||
          hasReactFiber(),
      ),
  },
  {
    name: "Preact",
    kind: "framework",
    scripts: /preact/i,
  },
  {
    name: "Vue",
    kind: "framework",
    scripts: /vue([.@/]|runtime)/i,
    html: () => hasPrefixedAttr("data-v-"),
  },
  {
    name: "Angular",
    kind: "framework",
    scripts: /angular/i,
    html: () => Boolean(document.querySelector("[ng-version]")),
  },
  {
    name: "Svelte",
    kind: "framework",
    scripts: /svelte/i,
    html: (ctx) => /\bsvelte-/.test(ctx.classes),
  },
  {
    name: "Solid",
    kind: "framework",
    scripts: /solid-js|solidjs/i,
  },
  {
    name: "Qwik",
    kind: "framework",
    scripts: /qwik/i,
    html: () =>
      Boolean(document.querySelector("script[type='qwik/json']")) ||
      hasPrefixedAttr("q:"),
  },
  {
    name: "HTMX",
    kind: "framework",
    scripts: /htmx/i,
    html: () => Boolean(document.querySelector("[hx-get], [hx-post], [hx-boost]")),
  },
  {
    name: "Alpine.js",
    kind: "framework",
    scripts: /alpine/i,
    html: () => Boolean(document.querySelector("[x-data]")),
  },
  {
    name: "Livewire",
    kind: "framework",
    scripts: /livewire/i,
    html: () => hasPrefixedAttr("wire:"),
  },
  {
    name: "Stimulus",
    kind: "framework",
    scripts: /stimulus/i,
    html: () => Boolean(document.querySelector("[data-controller]")),
  },
  {
    name: "Turbo",
    kind: "framework",
    scripts: /@hotwired\/turbo|turbo\.es/i,
    html: () => Boolean(document.querySelector("turbo-frame, turbo-stream")),
  },
  {
    name: "Phoenix LiveView",
    kind: "framework",
    scripts: /phoenix_live_view|live_view/i,
    html: () => Boolean(document.querySelector("[data-phx-session]")),
  },
  {
    name: "Django",
    kind: "framework",
    scripts: /django/i,
    html: () => Boolean(document.querySelector("[name=csrfmiddlewaretoken]")),
  },
  {
    name: "Laravel",
    kind: "framework",
    html: () =>
      Boolean(
        document.querySelector("meta[name='csrf-token']") &&
          document.querySelector("[class*='laravel']"),
      ),
  },
  {
    name: "Ruby on Rails",
    kind: "framework",
    html: () =>
      Boolean(
        document.querySelector("meta[name='csrf-param'][content='authenticity_token']") ||
          document.querySelector("meta[name='csrf-token']") &&
            document.querySelector("[data-turbo-track]"),
      ),
  },
  { name: "jQuery", kind: "framework", scripts: /jquery[.-]/i },
  { name: "Backbone", kind: "framework", scripts: /backbone[.-]/i },
  { name: "Ember", kind: "framework", scripts: /ember(\.min)?\.js|ember-data/i },
  { name: "Knockout", kind: "framework", scripts: /knockout[.-]/i },
  { name: "lit", kind: "framework", scripts: /lit-element|\/npm\/lit@/i },

  {
    name: "Tailwind",
    kind: "styling",
    scripts: /tailwindcss|cdn\.tailwindcss/i,
    html: () => hasTailwind(),
  },
  {
    name: "Bootstrap",
    kind: "styling",
    scripts: /bootstrap/i,
    html: (ctx) => /\b(container-fluid|col-md-|navbar-toggler)\b/.test(ctx.classes),
  },
  { name: "Bulma", kind: "styling", scripts: /bulma/i, html: (ctx) => /\bcolumn is-/.test(ctx.classes) },
  { name: "Foundation", kind: "styling", scripts: /foundation(\.min)?\.js/i },
  { name: "UnoCSS", kind: "styling", scripts: /unocss/i },
  { name: "Windi CSS", kind: "styling", scripts: /windicss/i },
  { name: "Emotion", kind: "styling", html: () => Boolean(document.querySelector("[data-emotion]")) },
  {
    name: "styled-components",
    kind: "styling",
    html: () => Boolean(document.querySelector("style[data-styled]")),
  },
  { name: "Stitches", kind: "styling", html: () => Boolean(document.querySelector("style[data-stitches]")) },
  {
    name: "MUI",
    kind: "ui",
    scripts: /@mui\/|material-ui/i,
    html: (ctx) => /\bMui[A-Z]/.test(ctx.classes) || Boolean(document.querySelector("[class*='MuiButton']")),
  },
  {
    name: "Chakra UI",
    kind: "ui",
    scripts: /@chakra-ui/i,
    html: (ctx) => /\bchakra-/.test(ctx.classes),
  },
  {
    name: "Ant Design",
    kind: "ui",
    scripts: /antd|ant-design/i,
    html: (ctx) => /\bant-(btn|layout|row)\b/.test(ctx.classes),
  },
  {
    name: "Radix UI",
    kind: "ui",
    scripts: /@radix-ui/i,
    html: () => hasPrefixedAttr("data-radix-"),
  },
  {
    name: "Headless UI",
    kind: "ui",
    scripts: /@headlessui/i,
    html: () => Boolean(document.querySelector("[data-headlessui-state]")),
  },
  {
    name: "shadcn/ui",
    kind: "ui",
    html: () => {
      const slots = document.querySelectorAll("[data-slot]").length;
      return slots >= 4 && hasTailwind();
    },
  },
  { name: "DaisyUI", kind: "ui", scripts: /daisyui/i, html: (ctx) => /\bbtn-primary\b/.test(ctx.classes) && hasTailwind() },
  { name: "Flowbite", kind: "ui", scripts: /flowbite/i },
  { name: "NextUI", kind: "ui", scripts: /@nextui-org/i },
  { name: "Mantine", kind: "ui", scripts: /@mantine/i, html: (ctx) => /\bmantine-/.test(ctx.classes) },
  { name: "Ariakit", kind: "ui", scripts: /ariakit/i },
  { name: "Park UI", kind: "ui", scripts: /@park-ui/i },
  { name: "React Aria", kind: "ui", scripts: /react-aria/i },
  { name: "Swiper", kind: "ui", scripts: /swiper/i },
  { name: "Embla", kind: "ui", scripts: /embla-carousel/i },
  { name: "Keen Slider", kind: "ui", scripts: /keen-slider/i },
  { name: "Slick", kind: "ui", scripts: /slick[.-]carousel/i },
  { name: "Tippy.js", kind: "ui", scripts: /tippy\.js|tippyjs/i },
  { name: "Popper", kind: "ui", scripts: /popperjs|@popperjs/i },
  { name: "Floating UI", kind: "ui", scripts: /@floating-ui/i },
  { name: "D3", kind: "ui", scripts: /d3(\.min)?\.js|\/npm\/d3@/i },
  { name: "Chart.js", kind: "ui", scripts: /chart(\.umd)?(\.min)?\.js|chart\.js/i },
  { name: "Highcharts", kind: "ui", scripts: /highcharts/i },
  { name: "ECharts", kind: "ui", scripts: /echarts/i },
  { name: "Recharts", kind: "ui", scripts: /recharts/i },
  { name: "Victory", kind: "ui", scripts: /victory-chart|\/npm\/victory@/i },
  { name: "Nivo", kind: "ui", scripts: /@nivo\//i },
  { name: "TanStack Query", kind: "ui", scripts: /@tanstack\/(query|react-query)/i },
  { name: "TanStack Table", kind: "ui", scripts: /@tanstack\/(table|react-table)/i },
  { name: "Redux", kind: "framework", scripts: /redux/i },
  { name: "Zustand", kind: "framework", scripts: /zustand/i },
  { name: "Jotai", kind: "framework", scripts: /jotai/i },
  { name: "Recoil", kind: "framework", scripts: /recoil/i },
  { name: "MobX", kind: "framework", scripts: /mobx/i },
  { name: "XState", kind: "framework", scripts: /xstate/i },
  { name: "RxJS", kind: "framework", scripts: /rxjs/i },
  { name: "Axios", kind: "ui", scripts: /axios/i },
  { name: "tRPC", kind: "framework", scripts: /@trpc\//i },
  { name: "GraphQL", kind: "framework", scripts: /graphql|apollo/i },
  { name: "Apollo", kind: "framework", scripts: /apollo-client|@apollo\//i },
  { name: "Relay", kind: "framework", scripts: /relay-runtime/i },
  { name: "Prisma", kind: "framework", scripts: /prisma/i },
  { name: "Drizzle", kind: "framework", scripts: /drizzle-orm/i },
  { name: "i18next", kind: "ui", scripts: /i18next/i },
  { name: "Lodash", kind: "ui", scripts: /lodash/i },
  { name: "date-fns", kind: "ui", scripts: /date-fns/i },
  { name: "Day.js", kind: "ui", scripts: /dayjs/i },
  { name: "Moment.js", kind: "ui", scripts: /moment(\.min)?\.js|moment\.js/i },
  { name: "Zod", kind: "ui", scripts: /\/npm\/zod@|zod\/v/i },
  { name: "Immer", kind: "ui", scripts: /immer/i },

  { name: "GSAP", kind: "motion", scripts: /gsap|ScrollTrigger|SplitText|CustomEase/i },
  { name: "Lenis", kind: "motion", scripts: /lenis/i, html: (ctx) => /\blenis\b/.test(ctx.classes) },
  { name: "Locomotive", kind: "motion", scripts: /locomotive/i, html: (ctx) => /locomotive|c-scrollbar/.test(ctx.classes) },
  { name: "Barba", kind: "motion", scripts: /barba/i, html: () => Boolean(document.querySelector("[data-barba]")) },
  { name: "Swup", kind: "motion", scripts: /swup/i },
  { name: "Highway", kind: "motion", scripts: /highway\.js/i },
  { name: "Anime.js", kind: "motion", scripts: /anime(\.min)?\.js|animejs/i },
  { name: "Motion", kind: "motion", scripts: /framer-motion|motion-dom|motion\/react/i },
  { name: "AutoAnimate", kind: "motion", scripts: /@formkit\/auto-animate/i },
  { name: "Lottie", kind: "motion", scripts: /lottie|dotlottie/i, html: () => Boolean(document.querySelector("lottie-player, dotlottie-player")) },
  { name: "Rive", kind: "3d", scripts: /rive/i, html: () => Boolean(document.querySelector("canvas[data-rive], rive-canvas")) },
  { name: "AOS", kind: "motion", scripts: /aos(\.js)?/i },
  { name: "ScrollMagic", kind: "motion", scripts: /ScrollMagic/i },
  { name: "ScrollReveal", kind: "motion", scripts: /scrollreveal/i },
  { name: "Smooth-Scrollbar", kind: "motion", scripts: /smooth-scrollbar/i },
  { name: "OverlayScrollbars", kind: "motion", scripts: /overlayscrollbars/i },
  { name: "SplitType", kind: "motion", scripts: /split-type|splittype/i },
  { name: "Splitting", kind: "motion", scripts: /splitting(\.js)?/i },
  { name: "Typed.js", kind: "motion", scripts: /typed\.js/i },
  { name: "Mo.js", kind: "motion", scripts: /mojs|mo\.js/i },
  { name: "Popmotion", kind: "motion", scripts: /popmotion/i },
  { name: "Theatre.js", kind: "motion", scripts: /@theatre\//i },
  { name: "React Spring", kind: "motion", scripts: /@react-spring/i },
  { name: "React Transition Group", kind: "motion", scripts: /react-transition-group/i },

  { name: "Three.js", kind: "3d", scripts: /three(\.module|\.min)?\.js|unpkg\.com\/three|\/npm\/three@/i },
  { name: "React Three Fiber", kind: "3d", scripts: /@react-three\/fiber/i },
  { name: "Drei", kind: "3d", scripts: /@react-three\/drei/i },

  { name: "Babylon.js", kind: "3d", scripts: /babylon(\.js|\.max)/i },
  { name: "PixiJS", kind: "3d", scripts: /pixi(\.min)?\.js|pixi\.js/i },
  { name: "p5.js", kind: "3d", scripts: /p5(\.min)?\.js/i },
  { name: "Phaser", kind: "3d", scripts: /phaser/i },
  { name: "Spline", kind: "3d", scripts: /splinetool|spline-viewer/i, html: () => Boolean(document.querySelector("spline-viewer")) },
  { name: "Matter.js", kind: "3d", scripts: /matter(\.min)?\.js/i },
  { name: "Cannon", kind: "3d", scripts: /cannon(-es)?/i },
  { name: "OGL", kind: "3d", scripts: /\/npm\/ogl@/i },
  { name: "Cesium", kind: "3d", scripts: /cesium/i },
  { name: "Deck.gl", kind: "3d", scripts: /deck\.gl/i },
  { name: "Mapbox", kind: "maps", scripts: /mapbox-gl/i },
  { name: "Google Maps", kind: "maps", scripts: /maps\.googleapis\.com/i },
  { name: "Leaflet", kind: "maps", scripts: /leaflet/i },
  { name: "MapLibre", kind: "maps", scripts: /maplibre/i },

  { name: "Webflow", kind: "cms", scripts: /webflow/i, html: (ctx) => /\bw-nav\b|\bw-button\b/.test(ctx.classes) },
  { name: "Framer", kind: "cms", scripts: /framerusercontent|framer\.com\/m/i, html: () => Boolean(document.querySelector("[data-framer-name], #__framer")) },
  { name: "Shopify", kind: "cms", scripts: /cdn\.shopify|shopify/i, html: () => Boolean(document.querySelector("[data-shopify], script#__st")) },
  { name: "WordPress", kind: "cms", scripts: /wp-content|wp-includes/i },
  { name: "Squarespace", kind: "cms", scripts: /squarespace/i },
  { name: "Wix", kind: "cms", scripts: /static\.wixstatic|wix\.com/i },
  { name: "Ghost", kind: "cms", scripts: /ghost\.org|casper/i, html: () => Boolean(document.querySelector("[data-ghost]")) },
  { name: "Contentful", kind: "cms", scripts: /contentful/i },
  { name: "Sanity", kind: "cms", scripts: /cdn\.sanity\.io|sanity/i },
  { name: "Strapi", kind: "cms", scripts: /strapi/i },
  { name: "Prismic", kind: "cms", scripts: /prismic/i },
  { name: "Storyblok", kind: "cms", scripts: /storyblok/i },
  { name: "Drupal", kind: "cms", scripts: /drupal|sites\/default\/files/i },
  { name: "Webflow IX2", kind: "motion", scripts: /webflow\.js/i },
  { name: "Cargo", kind: "cms", scripts: /cargo\.site/i },
  { name: "Read.cv", kind: "cms", scripts: /read\.cv/i },
  { name: "Notion", kind: "cms", scripts: /notion\.so|notion-static/i },
  { name: "Super.so", kind: "cms", scripts: /super\.so/i },
  { name: "Carrd", kind: "cms", scripts: /carrd\.co/i },
  { name: "Typedream", kind: "cms", scripts: /typedream/i },
  { name: "Unicorn Studio", kind: "3d", scripts: /unicorn\.studio|unicornstudio/i },
  { name: "WebGL", kind: "3d", html: (ctx) => /webgl/i.test(ctx.classes) && Boolean(document.querySelector("canvas")) },

  { name: "Google Analytics", kind: "analytics", scripts: /google-analytics\.com|gtag\/js|www\.google-analytics/i },
  { name: "Google Tag Manager", kind: "analytics", scripts: /googletagmanager\.com/i },
  { name: "Segment", kind: "analytics", scripts: /cdn\.segment\.com|analytics\.js/i },
  { name: "Mixpanel", kind: "analytics", scripts: /mixpanel/i },
  { name: "Amplitude", kind: "analytics", scripts: /amplitude/i },
  { name: "Hotjar", kind: "analytics", scripts: /hotjar|static\.hotjar/i },
  { name: "FullStory", kind: "analytics", scripts: /fullstory/i },
  { name: "LogRocket", kind: "analytics", scripts: /logrocket/i },
  { name: "Sentry", kind: "analytics", scripts: /sentry|browser\.sentry-cdn/i },
  { name: "Datadog RUM", kind: "analytics", scripts: /datadoghq|datadog-rum/i },
  { name: "New Relic", kind: "analytics", scripts: /newrelic|nr-data\.net/i },
  { name: "PostHog", kind: "analytics", scripts: /posthog/i },
  { name: "Plausible", kind: "analytics", scripts: /plausible\.io/i },
  { name: "Fathom", kind: "analytics", scripts: /cdn\.usefathom/i },
  { name: "Clarity", kind: "analytics", scripts: /clarity\.ms/i },
  { name: "Intercom", kind: "analytics", scripts: /widget\.intercom/i },
  { name: "Crisp", kind: "analytics", scripts: /crisp\.chat/i },
  { name: "Drift", kind: "analytics", scripts: /drift\.com|driftt/i },
  { name: "HubSpot", kind: "analytics", scripts: /js\.hs-scripts|hubspot/i },
  { name: "Meta Pixel", kind: "analytics", scripts: /connect\.facebook\.net\/.+\/fbevents/i },
  { name: "TikTok Pixel", kind: "analytics", scripts: /analytics\.tiktok/i },
  { name: "LinkedIn Insight", kind: "analytics", scripts: /snap\.licdn/i },

  { name: "Stripe", kind: "payments", scripts: /js\.stripe\.com/i },
  { name: "PayPal", kind: "payments", scripts: /paypal\.com\/sdk/i },
  { name: "Paddle", kind: "payments", scripts: /cdn\.paddle/i },
  { name: "Lemon Squeezy", kind: "payments", scripts: /lemonsqueezy/i },
  { name: "Shopify Checkout", kind: "payments", scripts: /checkout\.shopify/i },

  { name: "Clerk", kind: "auth", scripts: /clerk(\.accounts|\.com)|@clerk/i },
  { name: "Auth0", kind: "auth", scripts: /auth0\.com|cdn\.auth0/i },
  { name: "Firebase", kind: "auth", scripts: /firebasejs|gstatic\.com\/firebasejs/i },
  { name: "Supabase", kind: "auth", scripts: /supabase/i },
  { name: "NextAuth", kind: "auth", scripts: /next-auth/i },
  { name: "WorkOS", kind: "auth", scripts: /workos/i },

  { name: "Hls.js", kind: "media", scripts: /hls\.js/i },
  { name: "Video.js", kind: "media", scripts: /video(\.min)?\.js|video\.js/i },
  { name: "Plyr", kind: "media", scripts: /plyr/i },
  { name: "Howler", kind: "media", scripts: /howler/i },
  { name: "Mux", kind: "media", scripts: /mux\.com|@mux\//i },
  { name: "Cloudinary", kind: "media", scripts: /cloudinary/i },
  { name: "imgix", kind: "media", scripts: /imgix/i },
  { name: "YouTube IFrame", kind: "media", scripts: /youtube\.com\/iframe_api/i },
  { name: "Vimeo", kind: "media", scripts: /player\.vimeo/i },

  { name: "Google Fonts", kind: "fonts", scripts: /fonts\.googleapis\.com|fonts\.gstatic\.com/i },
  { name: "Adobe Fonts", kind: "fonts", scripts: /use\.typekit\.net|typekit/i },
  { name: "Fontshare", kind: "fonts", scripts: /api\.fontshare/i },
  { name: "Bunny Fonts", kind: "fonts", scripts: /fonts\.bunny\.net/i },

  { name: "webpack", kind: "bundler", scripts: /webpack/i },
  { name: "Vite", kind: "bundler", scripts: /@vite\/client|vite\/dist/i },
  { name: "Parcel", kind: "bundler", scripts: /parcel/i },
  { name: "esbuild", kind: "bundler", scripts: /esbuild/i },
  { name: "Turbopack", kind: "bundler", scripts: /_next\/static\/chunks\/.*turbopack/i },
  { name: "Rollup", kind: "bundler", scripts: /rollup/i },

  { name: "Vercel", kind: "hosting", scripts: /vercel\.live|_vercel|va\.vercel-scripts/i },
  { name: "Netlify", kind: "hosting", scripts: /netlify\.app|netlify-identity/i },
  { name: "Cloudflare", kind: "hosting", scripts: /cloudflareinsights|cdn-cgi\/challenge|static\.cloudflareinsights/i },
  { name: "AWS CloudFront", kind: "hosting", scripts: /cloudfront\.net/i },
];

const PACKAGE_NAMES: Record<string, { name: string; kind: DetectedKind }> = {
  react: { name: "React", kind: "framework" },
  "react-dom": { name: "React", kind: "framework" },
  next: { name: "Next.js", kind: "framework" },
  vue: { name: "Vue", kind: "framework" },
  nuxt: { name: "Nuxt", kind: "framework" },
  svelte: { name: "Svelte", kind: "framework" },
  gsap: { name: "GSAP", kind: "motion" },
  lenis: { name: "Lenis", kind: "motion" },
  "@studio-freight/lenis": { name: "Lenis", kind: "motion" },
  "@darkroom.engineering/lenis": { name: "Lenis", kind: "motion" },
  "split-type": { name: "SplitType", kind: "motion" },
  "scroll-trigger": { name: "GSAP", kind: "motion" },
  "@gsap/shockingly": { name: "GSAP", kind: "motion" },
  "lottie-react": { name: "Lottie", kind: "motion" },
  "@lottiefiles/dotlottie-web": { name: "Lottie", kind: "motion" },
  three: { name: "Three.js", kind: "3d" },
  "framer-motion": { name: "Motion", kind: "motion" },
  motion: { name: "Motion", kind: "motion" },
  swiper: { name: "Swiper", kind: "ui" },
  jquery: { name: "jQuery", kind: "framework" },
  "lottie-web": { name: "Lottie", kind: "motion" },
  "three.js": { name: "Three.js", kind: "3d" },
  "@react-three/fiber": { name: "React Three Fiber", kind: "3d" },
  "@react-three/drei": { name: "Drei", kind: "3d" },
  "locomotive-scroll": { name: "Locomotive", kind: "motion" },
  barba: { name: "Barba", kind: "motion" },
  "@barba/core": { name: "Barba", kind: "motion" },
  animejs: { name: "Anime.js", kind: "motion" },
  tailwindcss: { name: "Tailwind", kind: "styling" },
  bootstrap: { name: "Bootstrap", kind: "styling" },
};

function hasPrefixedAttr(prefix: string): boolean {
  const sample = Array.from(document.body?.querySelectorAll("*") ?? []).slice(0, 80);
  return sample.some((el) =>
    Array.from(el.attributes).some((attr) => attr.name.startsWith(prefix)),
  );
}

function hasReactFiber(): boolean {
  const el =
    document.querySelector("#__next, #root, #app, [data-reactroot]") ??
    document.body?.firstElementChild;
  if (!el) return false;
  return Object.keys(el).some(
    (key) =>
      key.startsWith("__reactFiber") ||
      key.startsWith("__reactInternalInstance") ||
      key.startsWith("_reactRootContainer"),
  );
}

export function hasTailwind(): boolean {
  const root = getComputedStyle(document.documentElement);
  if (
    root.getPropertyValue("--tw-ring-offset-shadow") ||
    root.getPropertyValue("--tw-translate-x") ||
    root.getPropertyValue("--tw-bg-opacity")
  ) {
    return true;
  }
  const sample = Array.from(document.querySelectorAll("[class]")).slice(0, 80);
  let hits = 0;
  const util =
    /\b(flex|grid|hidden|items-center|justify-between|text-(xs|sm|base|lg|xl)|p-\d|px-\d|gap-\d|rounded(-[a-z0-9]+)?)\b/;
  const variant = /^(sm|md|lg|xl|2xl|hover|focus|dark):/;
  for (const el of sample) {
    for (const cls of el.classList) {
      if (variant.test(cls) || util.test(cls)) hits += 1;
    }
  }
  return hits >= 8;
}

function resourceUrls(): string[] {
  const urls: string[] = [];
  for (const el of Array.from(document.querySelectorAll("script[src], link[href]"))) {
    const url =
      (el instanceof HTMLScriptElement && el.src) ||
      (el instanceof HTMLLinkElement && el.href) ||
      "";
    if (url) urls.push(url);
  }
  try {
    for (const entry of performance.getEntriesByType("resource")) {
      if ("name" in entry && typeof entry.name === "string") urls.push(entry.name);
    }
  } catch {
    /* private / empty */
  }
  return urls;
}

function inlineScriptText(limit = 24000): string {
  let out = "";
  for (const el of Array.from(document.querySelectorAll("script:not([src])"))) {
    const text = el.textContent ?? "";
    if (!text) continue;
    out += ` ${text.slice(0, 2000)}`;
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

function importMapText(): string {
  const el = document.querySelector("script[type='importmap']");
  return el?.textContent ?? "";
}

export function collectSources(): ScanCtx {
  const urls = resourceUrls();
  const classes: string[] = [];
  for (const el of Array.from(document.querySelectorAll("[class]")).slice(0, 160)) {
    if (typeof el.className === "string") classes.push(el.className);
  }
  const generator =
    document.querySelector("meta[name='generator']")?.getAttribute("content") ??
    "";
  return {
    srcs: `${urls.join(" ")} ${importMapText()}`,
    html: `${document.documentElement.outerHTML.slice(0, 16000)} ${inlineScriptText()}`,
    classes: classes.join(" "),
    generator,
  };
}

function packagesFromUrls(srcs: string): DetectedLib[] {
  const found: DetectedLib[] = [];
  const seen = new Set<string>();
  const patterns = [
    /(?:unpkg\.com|cdn\.jsdelivr\.net\/npm|esm\.sh|cdn\.skypack\.dev)\/((?:@[^/]+\/)?[^@/?]+)/gi,
    /cdnjs\.cloudflare\.com\/ajax\/libs\/([^/]+)/gi,
    /\/npm\/((?:@[^/]+\/)?[^@/?]+)@/gi,
    /\/node_modules\/((?:@[^/]+\/)?[^/]+)/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(srcs))) {
      const pkg = match[1]?.toLowerCase();
      if (!pkg || seen.has(pkg) || /^[a-f0-9]{8,}$/.test(pkg)) continue;
      seen.add(pkg);
      const mapped = PACKAGE_NAMES[pkg];
      if (mapped) {
        found.push({ name: mapped.name, kind: mapped.kind, via: "url" });
      }
    }
  }
  return found;
}

function fromGenerator(generator: string): DetectedLib[] {
  if (!generator) return [];
  const g = generator.toLowerCase();
  if (g.includes("wordpress")) {
    const version = generator.match(/wordpress\s*([\d.]+)/i);
    return [
      {
        name: version ? `WordPress ${version[1]}` : "WordPress",
        kind: "cms",
        via: "meta",
      },
    ];
  }
  if (g.includes("webflow")) return [{ name: "Webflow", kind: "cms", via: "meta" }];
  if (g.includes("gatsby")) return [{ name: "Gatsby", kind: "framework", via: "meta" }];
  if (g.includes("hugo")) return [{ name: "Hugo", kind: "framework", via: "meta" }];
  if (g.includes("jekyll")) return [{ name: "Jekyll", kind: "framework", via: "meta" }];
  if (g.includes("ghost")) return [{ name: "Ghost", kind: "cms", via: "meta" }];
  if (g.includes("shopify")) return [{ name: "Shopify", kind: "cms", via: "meta" }];
  if (g.includes("drupal")) return [{ name: "Drupal", kind: "cms", via: "meta" }];
  if (g.includes("squarespace")) return [{ name: "Squarespace", kind: "cms", via: "meta" }];
  if (g.includes("wix")) return [{ name: "Wix", kind: "cms", via: "meta" }];
  if (g.includes("next.js") || g.includes("nextjs")) {
    return [{ name: "Next.js", kind: "framework", via: "meta" }];
  }
  return [];
}

function angularVersion(): string | null {
  const el = document.querySelector("[ng-version]");
  const v = el?.getAttribute("ng-version");
  return v ? `Angular ${v}` : null;
}

export const KIND_ORDER: DetectedKind[] = [
  "framework",
  "ui",
  "styling",
  "motion",
  "3d",
  "cms",
  "fonts",
  "media",
  "maps",
  "payments",
  "auth",
  "analytics",
  "bundler",
  "hosting",
];

export const KIND_LABEL: Record<DetectedKind, string> = {
  framework: "Framework",
  ui: "UI / libs",
  styling: "Styling",
  motion: "Motion",
  "3d": "3D / WebGL",
  cms: "Platform",
  analytics: "Analytics",
  media: "Media",
  maps: "Maps",
  fonts: "Fonts",
  bundler: "Build",
  hosting: "Hosting",
  payments: "Payments",
  auth: "Auth",
};

function merge(items: DetectedLib[]): DetectedLib[] {
  const byName = new Map<string, DetectedLib>();
  const rank: DetectedVia[] = ["global", "meta", "dom", "script", "url", "css", "class"];
  for (const item of items) {
    const key = item.name.replace(/\s+\d[\d.]*$/, "");
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, item);
      continue;
    }
    if (item.name.length > existing.name.length) existing.name = item.name;
    if (rank.indexOf(item.via) < rank.indexOf(existing.via)) existing.via = item.via;
  }
  const order = new Map(KIND_ORDER.map((k, i) => [k, i]));
  return [...byName.values()].sort(
    (a, b) => (order.get(a.kind) ?? 99) - (order.get(b.kind) ?? 99) || a.name.localeCompare(b.name),
  );
}

export function detectStack(globals: { name: string; kind: string }[] = []): DetectedLib[] {
  const ctx = collectSources();
  const found: DetectedLib[] = [];

  for (const fp of FINGERPRINTS) {
    let via: DetectedVia | null = null;
    if (fp.scripts && (fp.scripts.test(ctx.srcs) || fp.scripts.test(ctx.html))) {
      via = "script";
    }
    if (!via && fp.html?.(ctx)) via = "dom";
    if (!via) continue;
    found.push({ name: fp.name, kind: fp.kind, via });
  }

  found.push(...packagesFromUrls(ctx.srcs));
  found.push(...fromGenerator(ctx.generator));

  const ng = angularVersion();
  if (ng) found.push({ name: ng, kind: "framework", via: "dom" });

  for (const g of globals) {
    const kind = (KIND_ORDER.includes(g.kind as DetectedKind)
      ? g.kind
      : "ui") as DetectedKind;
    found.push({ name: g.name, kind, via: "global" });
  }

  const has3d = found.some((item) => item.kind === "3d");
  if (
    !has3d &&
    document.querySelector("canvas") &&
    /webgl|three|spline|rive|pixi|unicorn/i.test(`${ctx.srcs} ${ctx.classes}`)
  ) {
    found.push({ name: "WebGL", kind: "3d", via: "dom" });
  }

  return merge(found);
}
