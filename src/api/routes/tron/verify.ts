import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getTronX402Service } from '../../../services/tron-x402-service';
import type { ApiResponse, VerifyRequest, TronVerifyResponse, VerifySchema } from '../../../types';

// JSON Schema for TRON verification request
const TRON_VERIFY_REQUEST_SCHEMA: VerifySchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'TRON x402 Verify Request',
  description: 'Request schema for verifying TRON x402 payment signatures',
  type: 'object',
  properties: {
    paymentHeader: {
      type: 'string',
      description: 'Base64-encoded x-payment header containing the TRON payment token',
    },
    paymentRequirements: {
      type: 'object',
      description: 'Payment requirements that the payment must satisfy',
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
          description: 'Maximum amount required in smallest unit (sun for TRX, or token decimals)',
        },
        resource: {
          type: 'string',
          description: 'Resource URL or identifier being paid for',
        },
        description: {
          type: 'string',
          description: 'Human-readable description of the payment',
        },
        payTo: {
          type: 'string',
          description: 'Recipient TRON address (base58 or hex format)',
        },
        maxTimeoutSeconds: {
          type: 'string',
          description: 'Maximum time in seconds for the payment to be valid',
        },
      },
      required: ['scheme', 'network', 'maxAmountRequired', 'resource', 'payTo'],
    },
  },
  required: ['paymentHeader', 'paymentRequirements'],
};

export const tronVerifyRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /tron/verify - Get TRON verification request schema
  server.get<{ Reply: ApiResponse<VerifySchema> }>('/tron/verify', async () => {
    const response: ApiResponse<VerifySchema> = {
      status: 'success',
      code: 'TRON_VERIFY_SCHEMA',
      message: 'Schema for TRON verification requests',
      data: TRON_VERIFY_REQUEST_SCHEMA,
    };
    return response;
  });

  // POST /tron/verify - Verify TRON payment signature and requirements
  server.post<{ Body: VerifyRequest; Reply: ApiResponse<TronVerifyResponse> }>(
    '/tron/verify',
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

      if (!paymentRequirements.scheme || !paymentRequirements.network) {
        return reply.code(400).send({
          status: 'error',
          code: 'INVALID_REQUIREMENTS',
          message: 'scheme and network are required in paymentRequirements',
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

      try {
        const tronX402Service = getTronX402Service();
        const result = await tronX402Service.verify({ paymentHeader, paymentRequirements });

        if (result.isValid) {
          return {
            status: 'success',
            code: 'TRON_PAYMENT_VALID',
            message: 'TRON payment signature and requirements verified successfully',
            data: result,
          };
        } else {
          return reply.code(400).send({
            status: 'error',
            code: 'TRON_PAYMENT_INVALID',
            message: result.invalidReason || 'TRON payment verification failed',
            data: result,
          });
        }
      } catch (error) {
        server.log.error({ error }, '[TronVerify] Verification error');
        return reply.code(500).send({
          status: 'error',
          code: 'TRON_VERIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown verification error',
        });
      }
    }
  );
};
