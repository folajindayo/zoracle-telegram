/**
 * PnL Card Test Script
 * 
 * This script tests the PnL card generation functionality
 * Run with: npx ts-node src/test-pnl-card.ts
 */

import { PnLCardService } from './services/pnlCardService';
import { PnLCardGenerator } from './utils/pnlCardGenerator';
import * as fs from 'fs';
import * as path from 'path';

async function testPnLCardGeneration() {
  console.log('🧪 Testing PnL Card Generation...\n');

  try {
    // Test 1: Basic PnL Card Generation
    console.log('1. Testing Basic PnL Card Generation:');
    const pnlService = new PnLCardService();
    
    // Test with mock winning position
    const winningPosition = PnLCardService.getMockPosition();
    console.log(`   Generating card for winning position: ${winningPosition.symbol}`);
    
    const result = await pnlService.generatePnLCard({
      userId: 'test_user',
      position: winningPosition,
      options: {
        style: 'simple',
        showPepe: true,
        pepeSize: 'medium',
        calculationType: 'ROE'
      }
    });
    
    if (result.success && result.filePath) {
      console.log(`   ✅ Card generated successfully: ${result.filePath}`);
      console.log(`   📁 File size: ${fs.statSync(result.filePath).size} bytes`);
    } else {
      console.log(`   ❌ Failed to generate card: ${result.error}`);
    }
    console.log('');

    // Test 2: Losing Position
    console.log('2. Testing Losing Position Card:');
    const losingPosition = PnLCardService.getMockLosingPosition();
    console.log(`   Generating card for losing position: ${losingPosition.symbol}`);
    
    const losingResult = await pnlService.generatePnLCard({
      userId: 'test_user',
      position: losingPosition,
      options: {
        style: 'simple',
        showPepe: true,
        pepeSize: 'large',
        calculationType: 'ROI'
      }
    });
    
    if (losingResult.success && losingResult.filePath) {
      console.log(`   ✅ Losing card generated successfully: ${losingResult.filePath}`);
      console.log(`   📁 File size: ${fs.statSync(losingResult.filePath).size} bytes`);
    } else {
      console.log(`   ❌ Failed to generate losing card: ${losingResult.error}`);
    }
    console.log('');

    // Test 3: PnL Data Calculation
    console.log('3. Testing PnL Data Calculation:');
    const pnlData = PnLCardGenerator.calculatePnLData(winningPosition);
    console.log(`   Symbol: ${pnlData.symbol}`);
    console.log(`   Side: ${pnlData.side}`);
    console.log(`   Entry Price: $${pnlData.entryPrice}`);
    console.log(`   Current Price: $${pnlData.currentPrice}`);
    console.log(`   Position Size: ${pnlData.positionSize}`);
    console.log(`   Leverage: ${pnlData.leverage}x`);
    console.log(`   Unrealized PnL: $${pnlData.unrealizedPnl.toFixed(2)}`);
    console.log(`   PnL Percentage: ${pnlData.pnlPercentage.toFixed(2)}%`);
    console.log('');

    // Test 4: Multiple Cards Generation
    console.log('4. Testing Multiple Cards Generation:');
    const positions = [winningPosition, losingPosition];
    const multipleResult = await pnlService.generateMultiplePnLCards('test_user', positions);
    
    if (multipleResult.success && multipleResult.filePaths) {
      console.log(`   ✅ Generated ${multipleResult.filePaths.length} cards:`);
      multipleResult.filePaths.forEach((filePath, index) => {
        console.log(`      ${index + 1}. ${path.basename(filePath)}`);
      });
    } else {
      console.log(`   ❌ Failed to generate multiple cards: ${multipleResult.error}`);
    }
    console.log('');

    // Test 5: Cleanup Test
    console.log('5. Testing Cleanup Functionality:');
    await pnlService.cleanupOldCards(0.001); // Clean files older than ~3.6 seconds
    console.log('   ✅ Cleanup completed');
    console.log('');

    console.log('✅ PnL Card generation test completed!');
    
    // List generated files
    const outputDir = path.join(__dirname, '../temp/pnl-cards');
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      if (files.length > 0) {
        console.log('\n📁 Generated files:');
        files.forEach(file => {
          const filePath = path.join(outputDir, file);
          const stats = fs.statSync(filePath);
          console.log(`   ${file} (${stats.size} bytes)`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPnLCardGeneration().catch(console.error); 