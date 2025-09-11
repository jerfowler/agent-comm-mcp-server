/**
 * list-resources Handler
 * MCP resources/list endpoint handler
 * Following MCP 2025-06-18 specification
 */

import type { 
  ListResourcesRequest,
  ListResourcesResult 
} from '@modelcontextprotocol/sdk/types.js';
import { ResourceManager } from '../ResourceManager.js';
import { AgentCommError } from '../../types.js';

/**
 * Create handler for resources/list requests
 */
export function listResourcesHandler(resourceManager: ResourceManager) {
  return async (request: ListResourcesRequest): Promise<ListResourcesResult> => {
    // Validate request method
    if (request.method !== 'resources/list') {
      throw new AgentCommError(
        'Invalid request method',
        'METHOD_NOT_FOUND',
        { expected: 'resources/list', received: request.method }
      );
    }

    try {
      // Extract cursor from params
      const cursor = request.params?.cursor;
      
      // List resources with optional cursor
      const result = await resourceManager.listResources(cursor ? { cursor } : {});
      
      return result;
    } catch (error) {
      // Handle errors appropriately
      if (error instanceof AgentCommError) {
        throw error;
      }
      
      throw new AgentCommError(
        'Failed to list resources',
        'INTERNAL_ERROR',
        { originalError: error }
      );
    }
  };
}