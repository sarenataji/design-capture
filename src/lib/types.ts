export type Target =
  | "auto"
  | "react"
  | "react-native"
  | "tailwind"
  | "html";

/** How the agent should use the capture. This is the quality lever. */
export type Direction =
  | "rebuild"
  | "restyle"
  | "system"
  | "translate"
  | "motion";

export type OutputKind =
  | "prompt"
  | "design-md"
  | "skill-md"
  | "css"
  | "tailwind";

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

export type CaptureResult = {
  url: string;
  title: string;
  capturedAt: string;
  viewport: { width: number; height: number };
  selector: string;
  node: NodeCapture;
  html: string;
  motion: MotionCapture;
  tokens: TokenCapture;
  assets: AssetCapture[];
  contrast: ContrastPair[];
  intent: string;
  target: Target;
  direction: Direction;
};
