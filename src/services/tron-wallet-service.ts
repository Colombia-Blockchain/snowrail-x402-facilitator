import { TronWeb } from 'tronweb';
import { FastifyInstance } from 'fastify';

let tronWalletServiceInstance: TronWalletService | null = null;

export class TronWalletService {
  private tronWeb: TronWeb;
  private address: string;

  constructor(privateKey: string, fullHost: string) {
    this.tronWeb = new TronWeb({
      fullHost,
      privateKey,
    });
    this.address = this.tronWeb.address.fromPrivateKey(privateKey) as string;
  }

  getAddress(): string {
    return this.address;
  }

  getTronWeb(): TronWeb {
    return this.tronWeb;
  }

  /**
   * Sign a message hash
   */
  async signMessage(message: string): Promise<string> {
    return this.tronWeb.trx.sign(message);
  }

  /**
   * Verify a signature against a message and address
   */
  async verifySignature(message: string, signature: string, address: string): Promise<boolean> {
    try {
      const recoveredAddress = await this.tronWeb.trx.verifyMessage(message, signature);
      return String(recoveredAddress).toLowerCase() === address.toLowerCase();
    } catch {
      return false;
    }
  }

  /**
   * Convert hex address to base58
   */
  hexToBase58(hexAddress: string): string {
    return this.tronWeb.address.fromHex(hexAddress);
  }

  /**
   * Convert base58 address to hex
   */
  base58ToHex(base58Address: string): string {
    return this.tronWeb.address.toHex(base58Address);
  }

  /**
   * Validate a TRON address
   */
  isValidAddress(address: string): boolean {
    return this.tronWeb.isAddress(address);
  }
}

export function initializeTronWalletService(server: FastifyInstance): void {
  const privateKey = process.env.TRON_PRIVATE_KEY;
  const fullHost = process.env.TRON_FULL_HOST || 'https://api.shasta.trongrid.io';

  if (!privateKey) {
    server.log.warn('[TronWalletService] TRON_PRIVATE_KEY not configured - TRON settlement will be unavailable');
    return;
  }

  try {
    tronWalletServiceInstance = new TronWalletService(privateKey, fullHost);
    server.log.info(`[TronWalletService] Initialized with address: ${tronWalletServiceInstance.getAddress()}`);
  } catch (error) {
    server.log.error({ error }, '[TronWalletService] Failed to initialize');
    throw error;
  }
}

export function getTronWalletService(): TronWalletService {
  if (!tronWalletServiceInstance) {
    throw new Error('TronWalletService not initialized. Ensure TRON_PRIVATE_KEY is configured.');
  }
  return tronWalletServiceInstance;
}

export function isTronWalletServiceAvailable(): boolean {
  return tronWalletServiceInstance !== null;
}
