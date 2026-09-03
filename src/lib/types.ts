export type Target =
  | "auto"
  | "react"
  | "react-native"
  | "tailwind"
  | "html";

/** Five canned jobs. The button writes the job sentence. */
export type Job =
  | "rebuild"
  | "restyle"
  | "system"
  | "translate"
  | "motion";

/** @deprecated use Job */
export type Direction = Job;

export type OutputKind =
  | "photocopy"
  | "prompt"
  | "design-md"
  | "skill-md"
  | "css"
  | "tailwind";

export type MeasuredFlags = {
  hover: boolean;
  focus: boolean;
  active: boolean;
  motion: boolean;
};

export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StyleMap = Record<string, string>;

export type NodeCapture = {
  tag: string;
  id: string | null;
  className: string;
  role: string | null;
  text: string;
  selector: string;
  box: Box;
  styles: StyleMap;
  hover: StyleMap;
  focus: StyleMap;
  active: StyleMap;
  children: NodeCapture[];
};

export type MotionCapture = {
  transitions: string[];
  animations: string[];
  keyframes: { name: string; css: string }[];
  /** Normalized, per-element motion specs (selected node and visible descendants). */
  effects: MotionEffectCapture[];
  /** Motion/graphics libraries detected on the page. Presence is evidence, not attribution. */
  libraries: DetectedLib[];
};

export type MotionEffectCapture = {
  type: "transition" | "css-animation" | "web-animation";
  target: string;
  trigger: "hover" | "focus" | "active" | "scroll" | "load/auto" | "runtime/unknown";
  properties: string[];
  duration: string;
  delay: string;
  easing: string;
  iterations: string;
  direction: string;
  fill: string;
  playState?: string;
  timeline?: string;
  keyframes?: Record<string, string | number | null>[];
};

export type TokenCapture = {
  colors: { value: string; count: number; roles: string[] }[];
  /** Colors sampled from rendered pixels; includes canvas, WebGL, images, and video. */
  visualColors?: ScanColor[];
  fonts: { family: string; weights: string[]; sizes: string[] }[];
  spacing: string[];
  radii: string[];
  shadows: string[];
  cssVariables: { name: string; value: string }[];
};

export type AssetCapture = {
  kind: "img" | "svg" | "video" | "icon";
  src?: string;
  alt?: string;
  markup?: string;
  width?: number;
  height?: number;
};

export type ContrastPair = {
  fg: string;
  bg: string;
  ratio: number;
  aa: boolean;
  aaa: boolean;
};

export type ColorRole = "bg" | "text" | "accent" | "border" | "visual";

export type ScanColor = {
  value: string;
  role: ColorRole;
  count: number;
};

export type ScanTypeface = {
  family: string;
  weights: string[];
  sizes: string[];
};

export type DetectedKind =
  | "framework"
  | "ui"
  | "styling"
  | "motion"
  | "3d"
  | "cms"
  | "analytics"
  | "media"
  | "maps"
  | "fonts"
  | "bundler"
  | "hosting"
  | "payments"
  | "auth";

export type DetectedVia =
  | "script"
  | "dom"
  | "css"
  | "class"
  | "global"
  | "url"
  | "meta";

export type DetectedLib = {
  name: string;
  kind: DetectedKind;
  via: DetectedVia;
};

export type PageScan = {
  url: string;
  title: string;
  scannedAt: string;
  viewport: { width: number; height: number };
  /** Visible elements measured. Caps out at the walker limit on large pages. */
  elements: number;
  colors: ScanColor[];
  /** Palette sampled from the rendered viewport rather than CSS declarations. */
  visualColors?: ScanColor[];
  fonts: ScanTypeface[];
  spacing: string[];
  radii: string[];
  shadows: string[];
  cssVariables: { name: string; value: string }[];
  detected: DetectedLib[];
};

export type CaptureOptions = {
  intent?: string;
  target?: Target;
  job?: Job;
  /** Computed styles while the pointer was over the node (may include :hover). */
  liveStyles?: StyleMap;
  /** A same-page scan can contribute stronger library detection (including globals). */
  detected?: DetectedLib[];
};

export type CaptureResult = {
  url: string;
  title: string;
  capturedAt: string;
  viewport: { width: number; height: number };
  selector: string;
  node: NodeCapture;
  html: string;
  motion: MotionCapture;
  measured: MeasuredFlags;
  /** Tokens from the selected component only. */
  tokens: TokenCapture;
  /** Page-level tokens. Secondary — for Prompt / System, not a button photocopy. */
  pageTokens: TokenCapture;
  assets: AssetCapture[];
  contrast: ContrastPair[];
  intent: string;
  target: Target;
  job: Job;
  /** @deprecated use job */
  direction: Job;
};
