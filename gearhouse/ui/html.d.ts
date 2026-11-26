// A page's HTML as text (the game page mounts the builder's and the drive's own pages as screens; tools/ref/buildsite.mjs
// loads .html as text)
declare module '*.html' { const text: string; export default text; }
