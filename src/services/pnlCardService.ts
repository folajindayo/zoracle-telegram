/**
 * PnL Card Service
 * 
 * Service for generating and managing PnL cards for trading positions
 */

import { PnLCardGenerator } from '../utils/pnlCardGenerator';
import * as fs from 'fs';
import * as path from 'path';

interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage?: number;
  unrealizedPnl?: number;
  pnlPercentage?: number;
}

interface PnLCardRequest {
  userId: string;
  position: Position;
  options?: {
    style?: 'simple' | 'kawaii';
    background?: 'random' | 'custom';
    customBackgroundPath?: string;
    showPepe?: boolean;
    pepeSize?: 'small' | 'medium' | 'large';
    calculationType?: 'ROE' | 'ROI';
  };
}

export class PnLCardService {
  private generator: PnLCardGenerator;
  private outputDir: string;

  constructor() {
    this.generator = new PnLCardGenerator();
    this.outputDir = path.join(__dirname, '../../temp/pnl-cards');
    this.ensureOutputDirectory();
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate PnL card for a position
   */
  async generatePnLCard(request: PnLCardRequest): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      // Calculate PnL data
      const pnlData = PnLCardGenerator.calculatePnLData(request.position);
      
      // Set default options
      const options = {
        style: 'simple' as const,
        background: 'random' as const,
        showPepe: true,
        pepeSize: 'medium' as const,
        calculationType: 'ROE' as const,
        ...request.options
      };

      // Generate the card
      const imageBuffer = await this.generator.generatePnLCard(pnlData, options);
      
      // Save to file
      const fileName = `pnl_${request.userId}_${Date.now()}.png`;
      const filePath = path.join(this.outputDir, fileName);
      
      fs.writeFileSync(filePath, imageBuffer);
      
      return {
        success: true,
        filePath
      };
    } catch (error) {
      console.error('Error generating PnL card:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate PnL card for multiple positions
   */
  async generateMultiplePnLCards(userId: string, positions: Position[]): Promise<{ success: boolean; filePaths?: string[]; error?: string }> {
    try {
      const filePaths: string[] = [];
      
      for (const position of positions) {
        const result = await this.generatePnLCard({
          userId,
          position,
          options: {
            style: 'simple',
            showPepe: true,
            pepeSize: 'medium'
          }
        });
        
        if (result.success && result.filePath) {
          filePaths.push(result.filePath);
        }
      }
      
      return {
        success: filePaths.length > 0,
        filePaths: filePaths.length > 0 ? filePaths : undefined
      };
    } catch (error) {
      console.error('Error generating multiple PnL cards:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up old PnL card files
   */
  async cleanupOldCards(maxAgeHours: number = 24): Promise<void> {
    try {
      const files = fs.readdirSync(this.outputDir);
      const now = Date.now();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      
      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old PnL card: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old PnL cards:', error);
    }
  }

  /**
   * Get mock position data for testing
   */
  static getMockPosition(): Position {
    return {
      symbol: 'BTC/USDT',
      side: 'LONG',
      entryPrice: 45000,
      currentPrice: 46500,
      size: 0.1,
      leverage: 10
    };
  }

  /**
   * Get mock losing position data for testing
   */
  static getMockLosingPosition(): Position {
    return {
      symbol: 'ETH/USDT',
      side: 'SHORT',
      entryPrice: 3200,
      currentPrice: 3400,
      size: 0.5,
      leverage: 5
    };
  }
} 