#!/usr/bin/env node

/**
 * Icon Verification Script
 * Run this to verify all favicon files are present and properly configured
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_ICONS = [
  'public/favicon.ico',
  'public/favicon-16x16.png',
  'public/favicon-32x32.png',
  'public/apple-touch-icon.png',
  'public/android-chrome-192x192.png',
  'public/android-chrome-512x512.png',
  'public/site.webmanifest',
];

const ICON_VERSION_FILES = [
  'app/layout.tsx',
  'app/manifest.ts',
];

console.log('🔍 Verifying Pachu App Icons...\n');

let allGood = true;

// Check if all required icon files exist
console.log('📁 Checking icon files in public/ folder:');
REQUIRED_ICONS.forEach(filePath => {
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${filePath}`);
  if (!exists) allGood = false;
});

console.log('\n🔢 Checking version constants:');
const versions = {};
ICON_VERSION_FILES.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/ICON_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (match) {
      versions[filePath] = match[1];
      console.log(`  ✅ ${filePath}: version "${match[1]}"`);
    } else {
      console.log(`  ❌ ${filePath}: ICON_VERSION not found`);
      allGood = false;
    }
  } catch (error) {
    console.log(`  ❌ ${filePath}: Error reading file`);
    allGood = false;
  }
});

// Check if versions match
const versionValues = Object.values(versions);
if (versionValues.length > 0) {
  const allMatch = versionValues.every(v => v === versionValues[0]);
  if (allMatch) {
    console.log(`  ✅ All versions match: "${versionValues[0]}"`);
  } else {
    console.log('  ❌ Version mismatch detected!');
    console.log('     Versions should match across all files');
    allGood = false;
  }
}

console.log('\n📋 Checking icon routes:');
const iconRoutes = [
  'app/icon.tsx',
  'app/apple-icon.tsx',
  'app/icon-192.png/route.tsx',
  'app/icon-512.png/route.tsx',
];

iconRoutes.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasDynamic = content.includes("dynamic = 'force-dynamic'") || 
                       content.includes('dynamic="force-dynamic"');
    const hasRevalidate = content.includes('revalidate = 0') || 
                          content.includes('revalidate=0');
    
    if (hasDynamic && hasRevalidate) {
      console.log(`  ✅ ${filePath}: Cache busting configured`);
    } else {
      console.log(`  ⚠️  ${filePath}: Missing cache busting config`);
    }
  } catch (error) {
    console.log(`  ❌ ${filePath}: File not found`);
    allGood = false;
  }
});

console.log('\n🎨 Icon sizes verification:');
REQUIRED_ICONS.filter(p => p.endsWith('.png')).forEach(filePath => {
  try {
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`  📏 ${path.basename(filePath)}: ${sizeKB} KB`);
    
    if (stats.size === 0) {
      console.log(`     ❌ File is empty!`);
      allGood = false;
    } else if (stats.size < 100) {
      console.log(`     ⚠️  File seems very small`);
    }
  } catch (error) {
    console.log(`  ❌ ${filePath}: Cannot read file size`);
  }
});

console.log('\n' + '='.repeat(50));
if (allGood) {
  console.log('✅ All checks passed! Icons are properly configured.');
  console.log('\n📱 To update icons on iPhone:');
  console.log('   1. Remove old app from home screen');
  console.log('   2. Clear Safari cache (Settings > Safari > Clear History)');
  console.log('   3. Visit website and add to home screen again');
  console.log('\n🚀 Deploy your changes and users can get the new icon!');
} else {
  console.log('❌ Some checks failed. Please fix the issues above.');
  process.exit(1);
}

console.log('='.repeat(50) + '\n');

