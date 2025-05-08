import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// Point to the worker file provided by pdfjs-dist.
// Adjust the path based on how your project copies files from node_modules.
// Often, build tools handle this automatically, but sometimes explicit copying is needed.
// A common pattern is to copy it to your public folder during build.
// For Vite, you might copy it via publicDir or vite-plugin-static-copy
// For CRA, place it in the public folder.
// Check pdfjs-dist documentation for bundler-specific integration if needed.
// Let's assume it will be available at '/pdf.worker.min.js' relative to the deployed site root.
// You might need to adjust this path!
// If using Vite, a simpler way might be:
// import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url'; // Vite specific import
// pdfjsLib.GlobalWorkerOptions.workerSrc = PdfjsWorker;
// For broader compatibility, using a public path:
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`; // Use CDN as a simpler setup