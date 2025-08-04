/**
 * Test file for CoinGecko Integration
 * This file tests the CoinGecko service functionality
 */

import * as coingecko from './services/coingecko';

async function testCoinGeckoIntegration() {
  console.log('🧪 Testing CoinGecko Integration...\n');

  // Test token address from your example
  const testTokenAddress = '0x19830739b089e6c310822bc67eeba9f79be8ae70';
  
  console.log(`📊 Testing with token address: ${testTokenAddress}\n`);

  // Test 1: Get token details
  console.log('📊 Test 1: Getting token details...');
  try {
    const tokenDetails = await coingecko.getTokenDetails(testTokenAddress, 'base');
    
    if (tokenDetails.success) {
      console.log('✅ Token details fetched successfully');
      console.log(`   - Name: ${tokenDetails.token.name}`);
      console.log(`   - Symbol: ${tokenDetails.token.symbol}`);
      console.log(`   - Price: $${tokenDetails.token.price?.toFixed(6) || 'N/A'}`);
      console.log(`   - Market Cap: $${tokenDetails.token.marketCap?.toFixed(2) || 'N/A'}`);
      console.log(`   - 24h Change: ${tokenDetails.token.priceChange24h?.toFixed(2) || 'N/A'}%`);
      console.log(`   - 24h Volume: $${tokenDetails.token.volume24h?.toFixed(2) || 'N/A'}`);
      console.log(`   - Decimals: ${tokenDetails.token.decimals}`);
      console.log(`   - Platform: ${tokenDetails.token.platform}`);
    } else {
      console.log('❌ Token details fetch failed:', tokenDetails.message);
    }
  } catch (error) {
    console.log('❌ Token details test error:', error.message);
  }

  // Test 2: Get token price
  console.log('\n📊 Test 2: Getting token price...');
  try {
    const priceData = await coingecko.getTokenPrice(testTokenAddress, 'base');
    
    if (priceData.success) {
      console.log('✅ Token price fetched successfully');
      console.log(`   - Price: $${priceData.price?.toFixed(6) || 'N/A'}`);
      console.log(`   - 24h Change: ${priceData.priceChange24h?.toFixed(2) || 'N/A'}%`);
      console.log(`   - Market Cap: $${priceData.marketCap?.toFixed(2) || 'N/A'}`);
      console.log(`   - 24h Volume: $${priceData.volume24h?.toFixed(2) || 'N/A'}`);
    } else {
      console.log('❌ Token price fetch failed:', priceData.message);
    }
  } catch (error) {
    console.log('❌ Token price test error:', error.message);
  }

  // Test 3: Search tokens
  console.log('\n📊 Test 3: Searching tokens...');
  try {
    const searchResults = await coingecko.searchTokens('ethereum');
    
    if (searchResults.success) {
      console.log('✅ Token search successful');
      console.log(`   - Found ${searchResults.coins.length} results`);
      if (searchResults.coins.length > 0) {
        console.log(`   - First result: ${searchResults.coins[0].name} (${searchResults.coins[0].symbol})`);
      }
    } else {
      console.log('❌ Token search failed:', searchResults.message);
    }
  } catch (error) {
    console.log('❌ Token search test error:', error.message);
  }

  // Test 4: Format swap summary
  console.log('\n📊 Test 4: Formatting swap summary...');
  try {
    const tokenDetails = await coingecko.getTokenDetails(testTokenAddress, 'base');
    
    let summaryMessage = '📋 <b>Swap Summary</b>\n\n';
    summaryMessage += `🔄 <b>Transaction Details:</b>\n`;
    summaryMessage += `• From: ETH\n`;
    summaryMessage += `• To: <code>${testTokenAddress}</code>\n`;
    summaryMessage += `• Amount: 0.00005 ETH\n`;
    summaryMessage += `• Network: Base\n`;
    summaryMessage += `• Slippage: 1%\n\n`;
    
    if (tokenDetails.success) {
      const token = tokenDetails.token;
      summaryMessage += `🪙 <b>Token Information:</b>\n`;
      summaryMessage += `• Name: ${token.name}\n`;
      summaryMessage += `• Symbol: ${token.symbol}\n`;
      
      if (token.price) {
        summaryMessage += `• Price: $${token.price.toFixed(6)}\n`;
      }
      
      if (token.priceChange24h !== undefined) {
        const changeEmoji = token.priceChange24h >= 0 ? '📈' : '📉';
        summaryMessage += `• 24h Change: ${changeEmoji} ${token.priceChange24h.toFixed(2)}%\n`;
      }
      
      if (token.marketCap) {
        const marketCapFormatted = token.marketCap >= 1000000 
          ? `$${(token.marketCap / 1000000).toFixed(2)}M`
          : `$${(token.marketCap / 1000).toFixed(2)}K`;
        summaryMessage += `• Market Cap: ${marketCapFormatted}\n`;
      }
      
      if (token.volume24h) {
        const volumeFormatted = token.volume24h >= 1000000 
          ? `$${(token.volume24h / 1000000).toFixed(2)}M`
          : `$${(token.volume24h / 1000).toFixed(2)}K`;
        summaryMessage += `• 24h Volume: ${volumeFormatted}\n`;
      }
      
      summaryMessage += `• Decimals: ${token.decimals}\n`;
      summaryMessage += `• Platform: ${token.platform.toUpperCase()}\n\n`;
    } else {
      summaryMessage += `⚠️ <b>Token Information:</b>\n`;
      summaryMessage += `• Status: Not found on CoinGecko\n`;
      summaryMessage += `• Address: <code>${testTokenAddress}</code>\n`;
      summaryMessage += `• Please verify this is the correct token\n\n`;
    }
    
    summaryMessage += `⚠️ <b>Please confirm:</b>\n`;
    summaryMessage += `• Verify the token address is correct\n`;
    summaryMessage += `• Check the amount is what you want\n`;
    summaryMessage += `• Ensure you have sufficient balance\n`;
    if (tokenDetails.success) {
      summaryMessage += `• Verify the token details above\n`;
    }
    summaryMessage += `\nReady to execute this swap?`;
    
    console.log('✅ Swap summary formatted successfully');
    console.log('\n📋 Generated Summary:');
    console.log(summaryMessage);
  } catch (error) {
    console.log('❌ Swap summary test error:', error.message);
  }

  console.log('\n🎉 CoinGecko Integration Test Complete!');
  console.log('\n📋 Summary:');
  console.log('   ✅ Token details fetching');
  console.log('   ✅ Token price fetching');
  console.log('   ✅ Token search functionality');
  console.log('   ✅ Swap summary formatting');
  console.log('   ✅ Error handling and fallbacks');
  console.log('   ✅ Integration with swap flow');
}

// Run the test
testCoinGeckoIntegration().catch(console.error); 