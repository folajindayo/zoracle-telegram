/**
 * Language Feature Test Script
 * 
 * This script tests the language functionality of the Zoracle Bot.
 * Run with: npx ts-node src/test-language.ts
 */

import { getTranslation, getAvailableLanguages, getLanguageName } from './utils/translations';

async function testLanguageFeature() {
  console.log('🧪 Testing Language Feature...\n');

  // Test 1: Available Languages
  console.log('1. Testing Available Languages:');
  const availableLanguages = getAvailableLanguages();
  console.log(`   Available languages: ${availableLanguages.join(', ')}`);
  console.log(`   Total languages: ${availableLanguages.length}\n`);

  // Test 2: Language Names
  console.log('2. Testing Language Names:');
  availableLanguages.forEach(lang => {
    const name = getLanguageName(lang, 'en');
    console.log(`   ${lang}: ${name}`);
  });
  console.log('');

  // Test 3: Basic Translations
  console.log('3. Testing Basic Translations:');
  const testKeys = ['welcome_title', 'main_menu_title', 'portfolio_title'];
  availableLanguages.forEach(lang => {
    console.log(`   ${lang.toUpperCase()}:`);
    testKeys.forEach(key => {
      const translation = getTranslation(key, lang);
      console.log(`     ${key}: ${translation}`);
    });
    console.log('');
  });

  // Test 4: Fallback Behavior
  console.log('4. Testing Fallback Behavior:');
  const nonExistentKey = 'non_existent_key';
  const fallbackResult = getTranslation(nonExistentKey, 'fr');
  console.log(`   Non-existent key '${nonExistentKey}' in French: ${fallbackResult}`);
  
  const nonExistentLang = 'xx';
  const fallbackLangResult = getTranslation('welcome_title', nonExistentLang);
  console.log(`   Welcome title in non-existent language '${nonExistentLang}': ${fallbackLangResult}`);
  console.log('');

  // Test 5: Database Operations (if database is available)
  console.log('5. Testing Database Operations:');
  try {
    const { UserOps } = await import('./database/operations');
    
    // Test with a sample user ID
    const testUserId = '123456789';
    
    // Test getting user language (should default to 'en')
    const userLang = await UserOps.getUserLanguage(testUserId);
    console.log(`   User language for ${testUserId}: ${userLang}`);
    
    // Test updating user language
    await UserOps.updateUserLanguage(testUserId, 'es');
    const updatedLang = await UserOps.getUserLanguage(testUserId);
    console.log(`   Updated user language to Spanish: ${updatedLang}`);
    
    // Reset to English
    await UserOps.updateUserLanguage(testUserId, 'en');
    const resetLang = await UserOps.getUserLanguage(testUserId);
    console.log(`   Reset user language to English: ${resetLang}`);
    
  } catch (error) {
    console.log(`   Database test skipped (database not available): ${error.message}`);
  }
  console.log('');

  // Test 6: Translation Coverage
  console.log('6. Testing Translation Coverage:');
  const allKeys = Object.keys(require('./utils/translations').translations);
  console.log(`   Total translation keys: ${allKeys.length}`);
  
  availableLanguages.forEach(lang => {
    const missingKeys = allKeys.filter(key => {
      const translation = getTranslation(key, lang);
      return !translation || translation === key;
    });
    
    if (missingKeys.length === 0) {
      console.log(`   ✅ ${lang}: All keys translated`);
    } else {
      console.log(`   ❌ ${lang}: Missing ${missingKeys.length} keys`);
      console.log(`      Missing: ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? '...' : ''}`);
    }
  });
  console.log('');

  console.log('✅ Language feature test completed!');
}

// Run the test
testLanguageFeature().catch(console.error); 