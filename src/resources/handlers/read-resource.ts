/**
 * read-resource Handler
 * MCP resources/read endpoint handler
 * Following MCP 2025-06-18 specification
 */

import debug from 'debug';
import type {
ReadResourceRequest,
  ReadResourceResult 
} from '@modelcontextprotocol/sdk/types.js';
import { ResourceManager } from '../ResourceManager.js';
import { AgentCommError } from '../../types.js';

const log = debug('agent-comm:resources:handlers:readresource');

// Initialize read resource handler
log('Read resource handler ready');

/**
 * Create handler for resources/read requests
 */
export function readResourceHandler(resourceManager: ResourceManager) {
  return async (request: ReadResourceRequest): Promise<ReadResourceResult> => {
    // Validate request method
    if (request.method !== 'resources/read') {
      throw new AgentCommError(
        'Invalid request method',
        'METHOD_NOT_FOUND',
        { expected: 'resources/read', received: request.method }
      );
    }

    // Validate URI parameter
    if (!request.params?.uri) {
      throw new AgentCommError(
        'URI parameter is required',
        'INVALID_PARAMS',
        { params: request.params }
      );
    }

    try {
      // Read resource by URI
      const result = await resourceManager.readResource(request.params.uri);
      
      return result;
    } catch (error) {
      // Handle errors appropriately
      if (error instanceof AgentCommError) {
        throw error;
      }
      
      throw new AgentCommError(
        'Failed to read resource',
        'INTERNAL_ERROR',
        { uri: request.params.uri, originalError: error }
      );
    }
  };
}