import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { ApiResponse, SupportedData, PaymentScheme, NetworkInfo, TokenInfo } from '../../types';

// Supported payment schemes for Cronos network
const CRONOS_SCHEMES: PaymentScheme[] = [
  {
    scheme: 'exact',
    network: 'cronos-testnet',
    chainId: 338,
    token: 'TCRO',
    tokenAddress: null, // Native token
    description: 'Exact amount payment with native TCRO',
  },
  {
    scheme: 'exact',
    network: 'cronos-mainnet',
    chainId: 25,
    token: 'CRO',
    tokenAddress: null,
    description: 'Exact amount payment with native CRO',
  },
  {
    scheme: 'eip-3009',
    network: 'cronos-testnet',
    chainId: 338,
    token: 'USDC',
    tokenAddress: '0x5425890298aed601595a70AB815c96711a31Bc65',
    description: 'EIP-3009 transferWithAuthorization for USDC',
  },
];

// Supported payment schemes for TRON network
const TRON_SCHEMES: PaymentScheme[] = [
  {
    scheme: 'tron-transfer',
    network: 'tron-mainnet',
    chainId: 728126428, // TRON mainnet chain ID
    token: 'TRX',
    tokenAddress: null, // Native token
    description: 'Native TRX transfer on TRON mainnet',
  },
  {
    scheme: 'tron-transfer',
    network: 'tron-shasta',
    chainId: 2494104990, // TRON Shasta testnet chain ID
    token: 'TRX',
    tokenAddress: null,
    description: 'Native TRX transfer on TRON Shasta testnet',
  },
  {
    scheme: 'tron-transfer',
    network: 'tron-nile',
    chainId: 3448148188, // TRON Nile testnet chain ID
    token: 'TRX',
    tokenAddress: null,
    description: 'Native TRX transfer on TRON Nile testnet',
  },
  {
    scheme: 'tron-transfer',
    network: 'tron-mainnet',
    chainId: 728126428,
    token: 'USDT',
    tokenAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // USDT on TRON mainnet
    description: 'TRC20 USDT transfer on TRON mainnet',
  },
  {
    scheme: 'tron-transfer',
    network: 'tron-shasta',
    chainId: 2494104990,
    token: 'USDT',
    tokenAddress: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs', // USDT on Shasta testnet
    description: 'TRC20 USDT transfer on TRON Shasta testnet',
  },
];

// Combined supported schemes
const SUPPORTED_SCHEMES: PaymentScheme[] = [...CRONOS_SCHEMES, ...TRON_SCHEMES];

// Supported networks
const SUPPORTED_NETWORKS: NetworkInfo[] = [
  // Cronos networks
  {
    name: 'Cronos Testnet',
    chainId: 338,
    rpcUrl: 'https://evm-t3.cronos.org',
    explorerUrl: 'https://explorer.cronos.org/testnet',
  },
  {
    name: 'Cronos Mainnet',
    chainId: 25,
    rpcUrl: 'https://evm.cronos.org',
    explorerUrl: 'https://explorer.cronos.org',
  },
  // TRON networks
  {
    name: 'TRON Mainnet',
    chainId: 728126428,
    rpcUrl: 'https://api.trongrid.io',
    explorerUrl: 'https://tronscan.org',
  },
  {
    name: 'TRON Shasta Testnet',
    chainId: 2494104990,
    rpcUrl: 'https://api.shasta.trongrid.io',
    explorerUrl: 'https://shasta.tronscan.org',
  },
  {
    name: 'TRON Nile Testnet',
    chainId: 3448148188,
    rpcUrl: 'https://nile.trongrid.io',
    explorerUrl: 'https://nile.tronscan.org',
  },
];

// Supported tokens
const SUPPORTED_TOKENS: TokenInfo[] = [
  // Cronos tokens
  {
    symbol: 'TCRO',
    name: 'Testnet CRO',
    address: null,
    decimals: 18,
    network: 'cronos-testnet',
  },
  {
    symbol: 'CRO',
    name: 'Cronos',
    address: null,
    decimals: 18,
    network: 'cronos-mainnet',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x5425890298aed601595a70AB815c96711a31Bc65',
    decimals: 6,
    network: 'cronos-testnet',
  },
  // TRON tokens
  {
    symbol: 'TRX',
    name: 'TRON',
    address: null,
    decimals: 6,
    network: 'tron-mainnet',
  },
  {
    symbol: 'TRX',
    name: 'TRON (Shasta)',
    address: null,
    decimals: 6,
    network: 'tron-shasta',
  },
  {
    symbol: 'TRX',
    name: 'TRON (Nile)',
    address: null,
    decimals: 6,
    network: 'tron-nile',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    decimals: 6,
    network: 'tron-mainnet',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD (Shasta)',
    address: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs',
    decimals: 6,
    network: 'tron-shasta',
  },
];

export const supportedRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /supported - List all supported payment schemes and networks
  server.get<{ Reply: ApiResponse<SupportedData> }>('/supported', async () => {
    const response: ApiResponse<SupportedData> = {
      status: 'success',
      code: 'SUPPORTED_SCHEMES',
      message: 'List of supported payment schemes and networks',
      data: {
        schemes: SUPPORTED_SCHEMES,
        networks: SUPPORTED_NETWORKS,
        tokens: SUPPORTED_TOKENS,
      },
    };
    return response;
  });
};
