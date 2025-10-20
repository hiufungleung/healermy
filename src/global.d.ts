// Type declarations for CSS imports
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// Side-effect CSS imports (like import './globals.css')
declare module '*.css' {
  const content: Record<string, string>;
  export = content;
}
