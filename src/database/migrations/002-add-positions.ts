import { Schema } from 'mongoose';

/**
 * Migration: Add Position model
 * This migration adds the Position schema to track user trading positions
 */
export const up = async (db: any): Promise<void> => {
  try {
    // Create Position schema
    const PositionSchema = new Schema(
      {
        telegramId: {
          type: String,
          required: true,
          ref: "User",
        },
        tokenAddress: {
          type: String,
          required: true,
        },
        tokenSymbol: {
          type: String,
          required: true,
        },
        tokenName: {
          type: String,
        },
        initialAmount: {
          type: Number,
          required: true,
        },
        initialUsdValue: {
          type: Number,
          required: true,
        },
        currentAmount: {
          type: Number,
          required: true,
        },
        currentUsdValue: {
          type: Number,
          required: true,
        },
        entryPrice: {
          type: Number,
          required: true,
        },
        currentPrice: {
          type: Number,
          required: true,
        },
        pnlPercentage: {
          type: Number,
          default: 0,
        },
        pnlUsd: {
          type: Number,
          default: 0,
        },
        status: {
          type: String,
          enum: ["open", "closed"],
          default: "open",
        },
        entryTime: {
          type: Date,
          default: Date.now,
        },
        closeTime: {
          type: Date,
        },
        duration: {
          type: String,
        },
        txHash: {
          type: String,
        },
        network: {
          type: String,
          required: true,
          default: "base",
        },
        dexToolsUrl: {
          type: String,
        },
        tonviewerUrl: {
          type: String,
        },
        swapUrl: {
          type: String,
        },
        // Additional fields for swap tracking
        swapType: {
          type: String,
          enum: ["buy", "sell"],
          required: true,
        },
        fromToken: {
          type: String,
        },
        toToken: {
          type: String,
        },
        fromAmount: {
          type: String,
        },
        toAmount: {
          type: String,
        },
        slippage: {
          type: Number,
        },
        gasUsed: {
          type: String,
        },
        gasPrice: {
          type: String,
        },
      },
      { timestamps: true }
    );

    // Create indexes for better performance
    PositionSchema.index({ telegramId: 1, status: 1 });
    PositionSchema.index({ telegramId: 1, entryTime: -1 });
    PositionSchema.index({ tokenAddress: 1, network: 1 });
    PositionSchema.index({ status: 1, entryTime: -1 });

    // Create the Position model
    const Position = db.model("Position", PositionSchema);

    console.log("✅ Position model created successfully");
  } catch (error) {
    console.error("❌ Error creating Position model:", error);
    throw error;
  }
};

export const down = async (db: any): Promise<void> => {
  try {
    // Drop the Position collection
    await db.collection('positions').drop();
    console.log("✅ Position collection dropped successfully");
  } catch (error) {
    console.error("❌ Error dropping Position collection:", error);
    throw error;
  }
}; 