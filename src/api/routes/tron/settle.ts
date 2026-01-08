import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getTronSettlementService } from '../../../services/tron-settlement-service';
import { isTronWalletServiceAvailable } from '../../../services/tron-wallet-service';
import type { ApiResponse, SettleRequest, SettleResponse, SettleSchema } from '../../../types';

// JSON Schema for TRON settlement request
const TRON_SETTLE_REQUEST_SCHEMA: SettleSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'TRON x402 Settle Request',
  description: 'Request schema for executing TRON x402 payment settlement on-chain',
  type: 'object',
  properties: {
    paymentHeader: {
      type: 'string',
      description: 'Base64-encoded x-payment header containing the TRON payment token with signature',
    },
    paymentRequirements: {
      type: 'object',
      description: 'Original payment requirements for validation',
      properties: {
        scheme: {
          type: 'string',
          description: 'Payment scheme (e.g., "tron-transfer")',
        },
        network: {
          type: 'string',
          description: 'Network identifier (e.g., "tron-mainnet", "tron-shasta")',
        },
        maxAmountRequired: {
          type: 'string',
          description: 'Maximum amount required in smallest unit (sun for TRX)',
        },
        resource: {
          type: 'string',
          description: 'Resource URL or identifier being paid for',
        },
        payTo: {
          type: 'string',
          description: 'Recipient TRON address',
        },
      },
      required: ['scheme', 'network', 'maxAmountRequired', 'payTo'],
    },
  },
  required: ['paymentHeader', 'paymentRequirements'],
};

export const tronSettleRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /tron/settle - Get TRON settlement request schema
  server.get<{ Reply: ApiResponse<SettleSchema> }>('/tron/settle', async () => {
    const walletAvailable = isTronWalletServiceAvailable();

    const response: ApiResponse<SettleSchema> = {
      status: 'success',
      code: 'TRON_SETTLE_SCHEMA',
      message: 'Schema for TRON settlement requests',
      data: TRON_SETTLE_REQUEST_SCHEMA,
      details: {
        settlementEnabled: walletAvailable,
        note: walletAvailable
          ? 'TRON settlement service is ready to execute payments'
          : 'TRON settlement unavailable - facilitator wallet not configured',
      },
    };
    return response;
  });

  // POST /tron/settle - Execute TRON payment on-chain
  server.post<{ Body: SettleRequest; Reply: ApiResponse<SettleResponse> }>(
    '/tron/settle',
    async (request, reply) => {
      const { paymentHeader, paymentRequirements } = request.body;

      // Validate required fields
      if (!paymentHeader) {
        return reply.code(400).send({
          status: 'error',
          code: 'MISSING_PAYMENT_HEADER',
          message: 'paymentHeader is required',
        });
      }

      if (!paymentRequirements) {
        return reply.code(400).send({
          status: 'error',
          code: 'MISSING_REQUIREMENTS',
          message: 'paymentRequirements is required',
        });
      }

      if (!paymentRequirements.scheme || !paymentRequirements.network || !paymentRequirements.payTo) {
        return reply.code(400).send({
          status: 'error',
          code: 'INVALID_REQUIREMENTS',
          message: 'scheme, network, and payTo are required in paymentRequirements',
        });
      }

      // Validate TRON network
      if (!paymentRequirements.network.startsWith('tron-')) {
        return reply.code(400).send({
          status: 'error',
          code: 'INVALID_NETWORK',
          message: 'This endpoint only supports TRON networks (tron-mainnet, tron-shasta, tron-nile)',
        });
      }

      // Check if TRON settlement is available
      if (!isTronWalletServiceAvailable()) {
        return reply.code(503).send({
          status: 'error',
          code: 'TRON_SETTLEMENT_UNAVAILABLE',
          message: 'TRON settlement service is not available - facilitator wallet not configured',
        });
      }

      try {
        server.log.info(
          {
            scheme: paymentRequirements.scheme,
            network: paymentRequirements.network,
            payTo: paymentRequirements.payTo,
          },
          '[TronSettle] Processing TRON settlement request'
        );

        const tronSettlementService = getTronSettlementService();
        const result = await tronSettlementService.settle({ paymentHeader, paymentRequirements });

        if (result.success) {
          server.log.info(
            { txHash: result.transactionHash },
            '[TronSettle] TRON settlement executed successfully'
          );

          return {
            status: 'success',
            code: 'TRON_SETTLEMENT_EXECUTED',
            message: 'TRON payment settled successfully on-chain',
            data: result,
          };
        } else {
          server.log.warn({ error: result.error }, '[TronSettle] TRON settlement failed');

          return reply.code(400).send({
            status: 'error',
            code: 'TRON_SETTLEMENT_FAILED',
            message: result.error || 'TRON settlement execution failed',
            data: result,
          });
        }
      } catch (error) {
        server.log.error({ error }, '[TronSettle] TRON settlement error');
        return reply.code(500).send({
          status: 'error',
          code: 'TRON_SETTLEMENT_ERROR',
          message: error instanceof Error ? error.message : 'Unknown settlement error',
        });
      }
    }
  );
};
