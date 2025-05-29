#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import pngToIco from 'png-to-ico';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateFavicons() {
  const iconPath = path.join(__dirname, '..', 'icon.png');
  const publicDir = path.join(__dirname, '..', 'public');
  const distDir = path.join(__dirname, '..', 'dist');
  
  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  try {
    console.log('🎨 Generating favicons from icon.png...');
    
    // Generate favicon.ico (standard sizes: 16x16, 32x32, 48x48)
    const icoBuffer = await pngToIco(iconPath);
    
    // Save to public directory
    const faviconPath = path.join(publicDir, 'favicon.ico');
    fs.writeFileSync(faviconPath, icoBuffer);
    console.log('✅ Generated public/favicon.ico');
    
    // Also save to dist directory if it exists
    if (fs.existsSync(distDir)) {
      const distFaviconPath = path.join(distDir, 'favicon.ico');
      fs.writeFileSync(distFaviconPath, icoBuffer);
      console.log('✅ Generated dist/favicon.ico');
    }

    // Copy the original PNG as favicon.png for modern browsers
    const pngFaviconPath = path.join(publicDir, 'favicon.png');
    fs.copyFileSync(iconPath, pngFaviconPath);
    console.log('✅ Copied public/favicon.png');
    
    if (fs.existsSync(distDir)) {
      const distPngFaviconPath = path.join(distDir, 'favicon.png');
      fs.copyFileSync(iconPath, distPngFaviconPath);
      console.log('✅ Copied dist/favicon.png');
    }

    // Generate apple-touch-icon (typically 180x180, but we'll use the original)
    const appleTouchIconPath = path.join(publicDir, 'apple-touch-icon.png');
    fs.copyFileSync(iconPath, appleTouchIconPath);
    console.log('✅ Generated public/apple-touch-icon.png');
    
    if (fs.existsSync(distDir)) {
      const distAppleTouchIconPath = path.join(distDir, 'apple-touch-icon.png');
      fs.copyFileSync(iconPath, distAppleTouchIconPath);
      console.log('✅ Generated dist/apple-touch-icon.png');
    }

    console.log('🎉 All favicons generated successfully!');
    console.log('Files created in public/:');
    console.log('  - favicon.ico');
    console.log('  - favicon.png');
    console.log('  - apple-touch-icon.png');
    
    if (fs.existsSync(distDir)) {
      console.log('Files also copied to dist/ for production');
    }
    
  } catch (error) {
    console.error('❌ Error generating favicons:', error);
    process.exit(1);
  }
}

generateFavicons();
