# Language Feature Documentation

## Overview

The Zoracle Telegram Bot now supports multiple languages, allowing users to interact with the bot in their preferred language. The bot currently supports 10 languages:

- 🇺🇸 English (en)
- 🇪🇸 Spanish (es)
- 🇫🇷 French (fr)
- 🇩🇪 German (de)
- 🇮🇹 Italian (it)
- 🇵🇹 Portuguese (pt)
- 🇷🇺 Russian (ru)
- 🇨🇳 Chinese (zh)
- 🇯🇵 Japanese (ja)
- 🇰🇷 Korean (ko)

## ✅ Implementation Status

**COMPLETED** - The language feature is fully implemented and functional:

- ✅ Database schema updated with language field
- ✅ Comprehensive translation system with 49 translation keys
- ✅ Language selection menu in bot settings
- ✅ User language preference storage and retrieval
- ✅ Fallback system for missing translations
- ✅ Test script for verification
- ✅ All bot menus and messages translated

## How to Use

### For Users

1. **Access Language Settings**: Use the `/settings` command and select "🌐 Language Settings"

2. **Select Your Language**: Choose your preferred language from the list. The current language will be marked with a ✅

3. **Language Change**: After selecting a new language, the bot will confirm the change and all subsequent messages will be displayed in the selected language

### For Developers

#### Adding New Languages

1. **Update Database Schema**: Add the new language code to the `language` field enum in `src/database/models.ts`

2. **Add Translations**: Add translations for all keys in `src/utils/translations.ts`

3. **Update Available Languages**: Add the language code to the `getAvailableLanguages()` function

#### Adding New Translation Keys

1. **Add to Translations Object**: Add the new key to the `translations` object in `src/utils/translations.ts`

2. **Provide All Language Versions**: Ensure translations are provided for all supported languages

3. **Use in Code**: Use `getTranslation(key, language)` or `getTranslatedMessage(key, userId)` to get translated text

#### Example Usage

```typescript
// Get translation for a specific language
const message = getTranslation('welcome_title', 'es');

// Get translation for user's preferred language
const userMessage = await getTranslatedMessage('welcome_title', userId);

// Get language name for display
const languageName = getLanguageName('es', 'en'); // "Spanish"
```

## Database Changes

The User model has been updated to include a `language` field:

```typescript
language: {
  type: String,
  default: 'en',
  enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko']
}
```

## Translation Keys

The bot uses 49 translation keys covering all major functionality:

### Core Messages
- `welcome_title` - Welcome message title
- `welcome_description` - Welcome message description
- `chat_id_label` - Chat ID display label

### Menu System
- `main_menu_title` - Main menu title
- `main_menu_subtitle` - Main menu subtitle
- `back_to_main` - Back to main menu button

### Trading Features
- `trading_title` - Trading menu title
- `trading_subtitle` - Trading menu subtitle
- `buy_tokens` - Buy tokens button
- `sell_tokens` - Sell tokens button
- `swap_tokens` - Swap tokens button

### Portfolio
- `portfolio_title` - Portfolio menu title
- `total_value` - Total portfolio value label
- `token_balance` - Token balance display

### Settings
- `settings_title` - Settings menu title
- `settings_subtitle` - Settings menu subtitle
- `language_settings` - Language settings button
- `notification_settings` - Notification settings button
- `trading_defaults` - Trading defaults button

### Language System
- `language_title` - Language settings title
- `language_subtitle` - Language settings subtitle
- `current_language` - Current language label
- `language_updated` - Language update confirmation
- `back_to_settings` - Back to settings button
- `error_language_update` - Language update error

### Alerts
- `alerts_title` - Alerts menu title
- `alerts_subtitle` - Alerts menu subtitle
- `new_alert` - Create new alert button
- `my_alerts` - My alerts button
- `alert_settings` - Alert settings button
- `create_alert` - Create alert confirmation
- `enter_token_address` - Token address input prompt
- `back_to_alerts` - Back to alerts button

### Language Names
- `language_en` - English language name
- `language_es` - Spanish language name
- `language_fr` - French language name
- `language_de` - German language name
- `language_it` - Italian language name
- `language_pt` - Portuguese language name
- `language_ru` - Russian language name
- `language_zh` - Chinese language name
- `language_ja` - Japanese language name
- `language_ko` - Korean language name

## Fallback Behavior

- If a translation key is not found, the key itself is returned
- If a language is not found for a key, the English translation is used as fallback
- If no English translation exists, the key is returned

## Testing

Run the language test script to verify functionality:

```bash
npx ts-node src/test-language.ts
```

The test script verifies:
- ✅ Available languages (10 languages supported)
- ✅ Language names display correctly
- ✅ Basic translations work for all languages
- ✅ Fallback behavior for missing keys/languages
- ✅ Translation coverage (all 49 keys translated)
- ⚠️ Database operations (requires database connection)

## Implementation Details

### Files Modified

1. **`src/database/models.ts`** - Added language field to User schema
2. **`src/database/operations.ts`** - Added language-related database operations
3. **`src/utils/translations.ts`** - Created comprehensive translation system
4. **`src/bot/baseBot.ts`** - Integrated language functionality into bot commands
5. **`src/test-language.ts`** - Created test script for verification

### Key Functions

- `getTranslation(key, language)` - Get translation for specific language
- `getTranslatedMessage(key, userId)` - Get translation for user's preferred language
- `getUserLanguage(telegramId)` - Get user's language preference
- `getLanguageName(languageCode, targetLanguage)` - Get language name for display
- `getAvailableLanguages()` - Get list of supported languages

### Database Operations

- `UserOps.updateUserLanguage(telegramId, language)` - Update user's language preference
- `UserOps.getUserLanguage(telegramId)` - Get user's current language

## Bot Integration

The language system is fully integrated into the bot:

1. **Settings Menu**: Language settings accessible via `/settings`
2. **Language Selection**: Interactive menu with all 10 languages
3. **Automatic Translation**: All bot messages use user's preferred language
4. **Confirmation Messages**: Language changes confirmed in new language
5. **Fallback System**: Graceful handling of missing translations

## Future Enhancements

1. **Auto-Detection**: Detect user's language from Telegram settings
2. **Regional Variants**: Support for regional language variants (e.g., pt-BR, pt-PT)
3. **Dynamic Loading**: Load translations from external sources
4. **User Feedback**: Allow users to suggest translation improvements
5. **Context-Aware**: Different translations based on user's trading experience level

## Usage Statistics

- **Total Languages**: 10
- **Total Translation Keys**: 49
- **Total Translations**: 490 (49 keys × 10 languages)
- **Coverage**: 100% (all keys translated in all languages)
- **Fallback System**: English as default fallback 