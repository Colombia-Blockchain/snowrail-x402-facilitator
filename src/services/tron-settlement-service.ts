import { getTronWalletService, isTronWalletServiceAvailable } from './tron-wallet-service';
import { getTronX402Service } from './tron-x402-service';
import type { SettleRequest, SettleResponse, TronPaymentToken, TronTransferPayload } from '../types';

// TRC20 USDT Contract ABI (minimal interface for transfer)
const TRC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
];

export class TronSettlementService {
  private logger: Console;

  constructor() {
    this.logger = console;
  }

  /**
   * Execute payment settlement on TRON network
   */
  async settle(request: SettleRequest): Promise<SettleResponse> {
    const { paymentHeader, paymentRequirements } = request;

    // Check if TRON wallet service is available
    if (!isTronWalletServiceAvailable()) {
      return {
        success: false,
        network: paymentRequirements.network,
        error: 'TRON settlement service unavailable - wallet not configured',
      };
    }

    // Parse payment header
    const tronX402Service = getTronX402Service();
    const paymentToken = tronX402Service.parsePaymentHeader(paymentHeader);

    if (!paymentToken) {
      return {
        success: false,
        network: paymentRequirements.network,
        error: 'Invalid payment header format',
      };
    }

    // Verify the payment first
    const verification = await tronX402Service.verify(request);
    if (!verification.isValid) {
      return {
        success: false,
        network: paymentRequirements.network,
        error: `Verification failed: ${verification.invalidReason}`,
      };
    }

    try {
      // Execute based on scheme
      if (paymentToken.scheme === 'tron-transfer') {
        const payload = paymentToken.payload as TronTransferPayload;

        if (payload.tokenAddress) {
          // TRC20 token transfer (e.g., USDT)
          return await this.executeTRC20Settlement(paymentToken, paymentRequirements.network);
        } else {
          // Native TRX transfer
          return await this.executeTRXSettlement(paymentToken, paymentRequirements.network);
        }
      } else {
        return {
          success: false,
          network: paymentRequirements.network,
          error: `Unsupported TRON payment scheme: ${paymentToken.scheme}`,
        };
      }
    } catch (error) {
      this.logger.error('[TronSettlementService] Settlement execution failed:', error);
      return {
        success: false,
        network: paymentRequirements.network,
        error: error instanceof Error ? error.message : 'Unknown settlement error',
      };
    }
  }

  /**
   * Execute TRC20 token transfer (e.g., USDT)
   */
  private async executeTRC20Settlement(
    paymentToken: TronPaymentToken,
    network: string
  ): Promise<SettleResponse> {
    const tronWalletService = getTronWalletService();
    const tronWeb = tronWalletService.getTronWeb();
    const payload = paymentToken.payload;

    if (!payload.tokenAddress) {
      return {
        success: false,
        network,
        error: 'TRC20 token address not specified',
      };
    }

    this.logger.log('[TronSettlementService] Executing TRC20 transfer...');

    try {
      // Get the contract instance
      const contract = await tronWeb.contract(TRC20_ABI, payload.tokenAddress);

      // Execute the transfer
      const tx = await contract.methods.transfer(payload.to, payload.value).send({
        feeLimit: 100_000_000, // 100 TRX fee limit
        callValue: 0,
      });

      this.logger.log(`[TronSettlementService] Transaction submitted: ${tx}`);

      // Wait for confirmation
      let confirmed = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!confirmed && attempts < maxAttempts) {
        await this.delay(2000);
        const txInfo = await tronWeb.trx.getTransactionInfo(tx);

        if (txInfo && txInfo.receipt) {
          confirmed = txInfo.receipt.result === 'SUCCESS';
          if (!confirmed && txInfo.receipt.result) {
            return {
              success: false,
              network,
              transactionHash: tx,
              error: `Transaction failed: ${txInfo.receipt.result}`,
            };
          }
          break;
        }
        attempts++;
      }

      if (!confirmed) {
        return {
          success: false,
          network,
          transactionHash: tx,
          error: 'Transaction confirmation timeout',
        };
      }

      this.logger.log(`[TronSettlementService] Transaction confirmed: ${tx}`);

      return {
        success: true,
        network,
        transactionHash: tx,
        settledAmount: payload.value,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute native TRX transfer
   */
  private async executeTRXSettlement(
    paymentToken: TronPaymentToken,
    network: string
  ): Promise<SettleResponse> {
    const tronWalletService = getTronWalletService();
    const tronWeb = tronWalletService.getTronWeb();
    const payload = paymentToken.payload;

    this.logger.log('[TronSettlementService] Executing TRX transfer...');

    try {
      // Build and send the transaction
      const tx = await tronWeb.trx.sendTransaction(
        payload.to,
        parseInt(payload.value, 10)
      );

      if (!tx.result) {
        return {
          success: false,
          network,
          error: 'Transaction creation failed',
        };
      }

      const txId = tx.txid || tx.transaction?.txID;
      this.logger.log(`[TronSettlementService] Transaction submitted: ${txId}`);

      // Wait for confirmation
      let confirmed = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!confirmed && attempts < maxAttempts) {
        await this.delay(2000);
        const txInfo = await tronWeb.trx.getTransactionInfo(txId);

        if (txInfo && Object.keys(txInfo).length > 0) {
          confirmed = true;
          break;
        }
        attempts++;
      }

      if (!confirmed) {
        return {
          success: false,
          network,
          transactionHash: txId,
          error: 'Transaction confirmation timeout',
        };
      }

      this.logger.log(`[TronSettlementService] Transaction confirmed: ${txId}`);

      return {
        success: true,
        network,
        transactionHash: txId,
        settledAmount: payload.value,
      };
    } catch (error) {
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let tronSettlementServiceInstance: TronSettlementService | null = null;

export function getTronSettlementService(): TronSettlementService {
  if (!tronSettlementServiceInstance) {
    tronSettlementServiceInstance = new TronSettlementService();
  }
  return tronSettlementServiceInstance;
}
