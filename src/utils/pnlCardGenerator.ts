/**
 * PnL Card Generator
 * 
 * Creates shareable profit/loss cards for trading positions
 * Inspired by Tealstreet's PnL cards design
 */

import { createCanvas, loadImage, registerFont } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

interface PnLCardData {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  positionSize: number;
  unrealizedPnl: number;
  pnlPercentage: number;
  leverage: number;
  timestamp: Date;
}

interface PnLCardOptions {
  style: 'simple' | 'kawaii';
  background: 'random' | 'custom';
  customBackgroundPath?: string;
  showPepe?: boolean;
  pepeSize?: 'small' | 'medium' | 'large';
  calculationType: 'ROE' | 'ROI';
}

export class PnLCardGenerator {
  private canvas: any;
  private ctx: any;
  private width = 800;
  private height = 600;

  constructor() {
    // Try to register fonts if available, but don't fail if they're not
    try {
      const fontPath = path.join(__dirname, '../assets/fonts/Roboto-Bold.ttf');
      if (fs.existsSync(fontPath)) {
        registerFont(fontPath, { family: 'Roboto-Bold' });
      }
      
      const regularFontPath = path.join(__dirname, '../assets/fonts/Roboto-Regular.ttf');
      if (fs.existsSync(regularFontPath)) {
        registerFont(regularFontPath, { family: 'Roboto-Regular' });
      }
    } catch (error) {
      console.log('Fonts not available, using system fonts');
    }
  }

  /**
   * Generate a PnL card image
   */
  async generatePnLCard(data: PnLCardData, options: PnLCardOptions = this.getDefaultOptions()): Promise<Buffer> {
    this.canvas = createCanvas(this.width, this.height);
    this.ctx = this.canvas.getContext('2d');

    // Set background
    await this.setBackground(options);

    // Draw card content
    await this.drawCardContent(data, options);

    // Add decorative elements
    if (options.style === 'kawaii') {
      await this.addKawaiiElements();
    }

    // Add pepe if enabled
    if (options.showPepe) {
      await this.addPepe(options.pepeSize || 'medium');
    }

    return this.canvas.toBuffer('image/png');
  }

  /**
   * Get default options
   */
  private getDefaultOptions(): PnLCardOptions {
    return {
      style: 'simple',
      background: 'random',
      showPepe: true,
      pepeSize: 'medium',
      calculationType: 'ROE'
    };
  }

  /**
   * Set background for the card
   */
  private async setBackground(options: PnLCardOptions): Promise<void> {
    if (options.background === 'custom' && options.customBackgroundPath) {
      try {
        const backgroundImage = await loadImage(options.customBackgroundPath);
        this.ctx.drawImage(backgroundImage, 0, 0, this.width, this.height);
      } catch (error) {
        console.error('Error loading custom background:', error);
        this.setDefaultBackground();
      }
    } else {
      this.setDefaultBackground();
    }
  }

  /**
   * Set default gradient background
   */
  private setDefaultBackground(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw main card content
   */
  private async drawCardContent(data: PnLCardData, options: PnLCardOptions): Promise<void> {
    // Draw card container
    this.drawCardContainer();

    // Draw header
    this.drawHeader(data);

    // Draw position details
    this.drawPositionDetails(data);

    // Draw PnL information
    this.drawPnLInfo(data, options);

    // Draw footer
    this.drawFooter(data);
  }

  /**
   * Draw card container with rounded corners
   */
  private drawCardContainer(): void {
    const cardWidth = this.width - 40;
    const cardHeight = this.height - 40;
    const x = 20;
    const y = 20;
    const radius = 20;

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.lineWidth = 2;

    // Draw rounded rectangle
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + cardWidth - radius, y);
    this.ctx.quadraticCurveTo(x + cardWidth, y, x + cardWidth, y + radius);
    this.ctx.lineTo(x + cardWidth, y + cardHeight - radius);
    this.ctx.quadraticCurveTo(x + cardWidth, y + cardHeight, x + cardWidth - radius, y + cardHeight);
    this.ctx.lineTo(x + radius, y + cardHeight);
    this.ctx.quadraticCurveTo(x, y + cardHeight, x, y + cardHeight - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  /**
   * Draw header with symbol and side
   */
  private drawHeader(data: PnLCardData): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 48px Arial, sans-serif';
    this.ctx.textAlign = 'center';
    
    // Draw symbol
    this.ctx.fillText(data.symbol, this.width / 2, 80);

    // Draw side indicator
    const sideColor = data.side === 'LONG' ? '#00ff88' : '#ff4757';
    this.ctx.fillStyle = sideColor;
    this.ctx.font = 'bold 24px Arial, sans-serif';
    this.ctx.fillText(data.side, this.width / 2, 120);

    // Draw side indicator background
    this.ctx.fillStyle = sideColor + '20';
    this.ctx.fillRect(this.width / 2 - 60, 100, 120, 30);
  }

  /**
   * Draw position details
   */
  private drawPositionDetails(data: PnLCardData): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px Arial, sans-serif';
    this.ctx.textAlign = 'left';

    const startY = 180;
    const lineHeight = 35;

    // Entry Price
    this.ctx.fillText(`Entry Price: $${data.entryPrice.toFixed(4)}`, 60, startY);
    
    // Current Price
    this.ctx.fillText(`Current Price: $${data.currentPrice.toFixed(4)}`, 60, startY + lineHeight);
    
    // Position Size
    this.ctx.fillText(`Position Size: ${data.positionSize.toFixed(2)}`, 60, startY + lineHeight * 2);
    
    // Leverage
    this.ctx.fillText(`Leverage: ${data.leverage}x`, 60, startY + lineHeight * 3);
  }

  /**
   * Draw PnL information
   */
  private drawPnLInfo(data: PnLCardData, options: PnLCardOptions): void {
    const isProfit = data.unrealizedPnl >= 0;
    const pnlColor = isProfit ? '#00ff88' : '#ff4757';
    const pnlPrefix = isProfit ? '+' : '';

    // Draw PnL amount
    this.ctx.fillStyle = pnlColor;
    this.ctx.font = 'bold 36px Arial, sans-serif';
    this.ctx.textAlign = 'center';
    
    const pnlText = `${pnlPrefix}$${Math.abs(data.unrealizedPnl).toFixed(2)}`;
    this.ctx.fillText(pnlText, this.width / 2, 380);

    // Draw PnL percentage
    this.ctx.font = 'bold 24px Arial, sans-serif';
    const percentageText = `${pnlPrefix}${data.pnlPercentage.toFixed(2)}%`;
    this.ctx.fillText(percentageText, this.width / 2, 420);

    // Draw calculation type
    this.ctx.fillStyle = '#888888';
    this.ctx.font = '16px Arial, sans-serif';
    this.ctx.fillText(`Based on ${options.calculationType}`, this.width / 2, 450);
  }

  /**
   * Draw footer with timestamp
   */
  private drawFooter(data: PnLCardData): void {
    this.ctx.fillStyle = '#888888';
    this.ctx.font = '14px Arial, sans-serif';
    this.ctx.textAlign = 'center';
    
    const timestamp = data.timestamp.toLocaleString();
    this.ctx.fillText(`Generated on ${timestamp}`, this.width / 2, this.height - 40);
    
    // Add Zoracle branding
    this.ctx.fillText('Powered by Zoracle Bot', this.width / 2, this.height - 20);
  }

  /**
   * Add kawaii style elements
   */
  private async addKawaiiElements(): Promise<void> {
    // Add sparkles
    this.ctx.fillStyle = '#ffd700';
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      this.drawSparkle(x, y);
    }

    // Add cute borders
    this.ctx.strokeStyle = '#ff69b4';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([10, 5]);
    this.ctx.strokeRect(30, 30, this.width - 60, this.height - 60);
    this.ctx.setLineDash([]);
  }

  /**
   * Draw a sparkle
   */
  private drawSparkle(x: number, y: number): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(Math.PI / 4);
    
    for (let i = 0; i < 4; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, -8);
      this.ctx.lineTo(0, 8);
      this.ctx.stroke();
      this.ctx.rotate(Math.PI / 2);
    }
    
    this.ctx.restore();
  }

  /**
   * Add pepe to the card
   */
  private async addPepe(size: 'small' | 'medium' | 'large'): Promise<void> {
    try {
      const sizeMap = { small: 60, medium: 80, large: 100 };
      const pepeSize = sizeMap[size];
      
      // Try to load pepe image
      const pepePath = path.join(__dirname, '../assets/images/pepe.png');
      if (fs.existsSync(pepePath)) {
        const pepeImage = await loadImage(pepePath);
        const x = this.width - pepeSize - 30;
        const y = this.height - pepeSize - 30;
        this.ctx.drawImage(pepeImage, x, y, pepeSize, pepeSize);
      } else {
        // Draw a simple pepe placeholder
        this.drawPepePlaceholder(this.width - pepeSize - 30, this.height - pepeSize - 30, pepeSize);
      }
    } catch (error) {
      console.error('Error adding pepe:', error);
      // Draw placeholder if image fails to load
      this.drawPepePlaceholder(this.width - 80 - 30, this.height - 80 - 30, 80);
    }
  }

  /**
   * Draw a simple pepe placeholder
   */
  private drawPepePlaceholder(x: number, y: number, size: number): void {
    // Draw pepe face
    this.ctx.fillStyle = '#00ff00';
    this.ctx.beginPath();
    this.ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Draw eyes
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.arc(x + size/3, y + size/3, size/12, 0, Math.PI * 2);
    this.ctx.arc(x + 2*size/3, y + size/3, size/12, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Draw mouth
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x + size/2, y + 2*size/3, size/6, 0, Math.PI);
    this.ctx.stroke();
  }

  /**
   * Calculate PnL data from position
   */
  static calculatePnLData(position: any): PnLCardData {
    const entryPrice = parseFloat(position.entryPrice);
    const currentPrice = parseFloat(position.currentPrice);
    const positionSize = parseFloat(position.size);
    const leverage = parseFloat(position.leverage || 1);
    
    const priceChange = currentPrice - entryPrice;
    const unrealizedPnl = position.side === 'LONG' ? priceChange * positionSize : -priceChange * positionSize;
    const pnlPercentage = (unrealizedPnl / (entryPrice * positionSize)) * 100 * leverage;

    return {
      symbol: position.symbol,
      side: position.side,
      entryPrice,
      currentPrice,
      positionSize,
      unrealizedPnl,
      pnlPercentage,
      leverage,
      timestamp: new Date()
    };
  }
} 