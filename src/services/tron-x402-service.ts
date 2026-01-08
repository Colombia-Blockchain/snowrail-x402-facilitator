import { TronWeb } from 'tronweb';
import type {
  VerifyRequest,
  TronVerifyResponse,
  TronPaymentToken,
  TronTransferPayload,
  TronSignature
} from '../types';

export class TronX402Service {
  private tronWeb: TronWeb;

  constructor() {
    // Initialize with a public node for verification (no private key needed)
    const fullHost = process.env.TRON_FULL_HOST || 'https://api.shasta.trongrid.io';
    this.tronWeb = new TronWeb({ fullHost });
  }

  /**
   * Decode and parse the x-payment header (Base64 encoded JSON)
   */
  parsePaymentHeader(paymentHeader: string): TronPaymentToken | null {
    try {
      const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
      return JSON.parse(decoded) as TronPaymentToken;
    } catch {
      return null;
    }
  }

  /**
   * Verify a TRON x402 payment signature and requirements
   */
  async verify(request: VerifyRequest): Promise<TronVerifyResponse> {
    const { paymentHeader, paymentRequirements } = request;

    // Parse the payment header
    const paymentToken = this.parsePaymentHeader(paymentHeader);
    if (!paymentToken) {
      return {
        isValid: false,
        invalidReason: 'Invalid payment header format - unable to decode',
      };
    }

    // Verify scheme matches
    if (paymentToken.scheme !== paymentRequirements.scheme) {
      return {
        isValid: false,
        invalidReason: `Scheme mismatch: expected ${paymentRequirements.scheme}, got ${paymentToken.scheme}`,
      };
    }

    // Verify network matches
    if (paymentToken.network !== paymentRequirements.network) {
      return {
        isValid: false,
        invalidReason: `Network mismatch: expected ${paymentRequirements.network}, got ${paymentToken.network}`,
      };
    }

    const payload = paymentToken.payload;
    const signature = paymentToken.signature;

    // For tron-transfer scheme, verify the signature
    if (paymentToken.scheme === 'tron-transfer') {
      const signatureValid = await this.verifyTronSignature(payload, signature);

      if (!signatureValid.valid) {
        return {
          isValid: false,
          invalidReason: signatureValid.reason,
        };
      }
    }

    // Verify amount meets requirements
    const paymentAmount = BigInt(payload.value);
    const requiredAmount = BigInt(paymentRequirements.maxAmountRequired);

    if (paymentAmount < requiredAmount) {
      return {
        isValid: false,
        invalidReason: `Insufficient payment: required ${requiredAmount}, got ${paymentAmount}`,
      };
    }

    // Verify recipient matches (handle both base58 and hex formats)
    const normalizedPayloadTo = this.normalizeAddress(payload.to);
    const normalizedRequiredTo = this.normalizeAddress(paymentRequirements.payTo);

    if (normalizedPayloadTo !== normalizedRequiredTo) {
      return {
        isValid: false,
        invalidReason: `Recipient mismatch: expected ${paymentRequirements.payTo}, got ${payload.to}`,
      };
    }

    // Verify timing constraints
    const now = Math.floor(Date.now() / 1000);
    const validAfter = parseInt(payload.validAfter, 10);
    const validBefore = parseInt(payload.validBefore, 10);

    if (now < validAfter) {
      return {
        isValid: false,
        invalidReason: `Payment not yet valid: validAfter ${validAfter}, current time ${now}`,
      };
    }

    if (now >= validBefore) {
      return {
        isValid: false,
        invalidReason: `Payment expired: validBefore ${validBefore}, current time ${now}`,
      };
    }

    // All checks passed
    return {
      isValid: true,
      payer: payload.from,
      paymentToken,
    };
  }

  /**
   * Verify TRON transfer authorization signature
   */
  private async verifyTronSignature(
    payload: TronTransferPayload,
    signature: TronSignature
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      // Build the message that was signed
      const message = this.buildSignatureMessage(payload);
      const messageHex = this.tronWeb.toHex(message);

      // Verify signature
      const recoveredAddress = await this.tronWeb.trx.verifyMessage(
        messageHex,
        signature.signature
      );

      const normalizedRecovered = this.normalizeAddress(String(recoveredAddress));
      const normalizedFrom = this.normalizeAddress(payload.from);

      if (normalizedRecovered !== normalizedFrom) {
        return {
          valid: false,
          reason: `Signature verification failed: recovered ${recoveredAddress}, expected ${payload.from}`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: `Signature verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Build the message to be signed for transfer authorization
   */
  private buildSignatureMessage(payload: TronTransferPayload): string {
    // Message format: from|to|value|validAfter|validBefore|nonce|tokenAddress
    const parts = [
      payload.from,
      payload.to,
      payload.value,
      payload.validAfter,
      payload.validBefore,
      payload.nonce,
    ];

    if (payload.tokenAddress) {
      parts.push(payload.tokenAddress);
    }

    return parts.join('|');
  }

  /**
   * Normalize TRON address to hex format for comparison
   */
  private normalizeAddress(address: string): string {
    try {
      // If it's a base58 address, convert to hex
      if (address.startsWith('T')) {
        return this.tronWeb.address.toHex(address).toLowerCase();
      }
      // If it's already hex (with or without 0x/41 prefix)
      return address.toLowerCase();
    } catch {
      return address.toLowerCase();
    }
  }

  /**
   * Create a payment header for testing/debugging
   */
  encodePaymentHeader(paymentToken: TronPaymentToken): string {
    return Buffer.from(JSON.stringify(paymentToken)).toString('base64');
  }
}

// Singleton instance
let tronX402ServiceInstance: TronX402Service | null = null;

export function getTronX402Service(): TronX402Service {
  if (!tronX402ServiceInstance) {
    tronX402ServiceInstance = new TronX402Service();
  }
  return tronX402ServiceInstance;
}
