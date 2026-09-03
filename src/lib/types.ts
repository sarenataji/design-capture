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
};

export type TokenCapture = {
  colors: { value: string; count: number; roles: string[] }[];
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

export type ColorRole = "bg" | "text" | "accent" | "border";

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

export type DetectedKind = "framework" | "styling" | "motion" | "3d" | "cms";

export type DetectedLib = {
  name: string;
  kind: DetectedKind;
  via: "script" | "dom" | "css" | "class";
};

export type PageScan = {
  url: string;
  title: string;
  scannedAt: string;
  viewport: { width: number; height: number };
  colors: ScanColor[];
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
