/**
 * ResourceProvider Interface
 * Base interface for all resource providers in the MCP server
 * Following MCP 2025-06-18 specification
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import debug from 'debug';


const log = debug('agent-comm:resourceprovider');

// Initialize resource provider
log('Resource provider base initialized');

/**
 * Resource content returned by providers
 */
export interface ResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: string; // Base64 encoded binary content
}

/**
 * Resource metadata for enhanced information
 */
export interface ResourceMetadata {
  uri: string;
  name: string;
  mimeType: string;
  description?: string;
  size?: number;
  lastModified?: string;
  createdAt?: string;
  [key: string]: unknown; // Allow provider-specific metadata
}

/**
 * Base interface for resource providers
 * Providers expose resources through specific URI schemes
 */
export interface ResourceProvider {
  /**
   * Get the URI scheme this provider handles (e.g., 'agent', 'server')
   */
  getScheme(): string;

  /**
   * List all resources available from this provider
   * @param options Optional filtering/pagination options
   */
  listResources(options?: {
    cursor?: string;
    limit?: number;
    filter?: string;
  }): Promise<Resource[]>;

  /**
   * Read the content of a specific resource
   * @param uri The resource URI to read
   */
  readResource(uri: string): Promise<ResourceContent>;

  /**
   * Check if this provider can handle a given URI
   * @param uri The URI to check
   */
  canHandle(uri: string): boolean;

  /**
   * Get metadata for a resource without reading its full content
   * @param uri The resource URI
   */
  getResourceMetadata?(uri: string): Promise<ResourceMetadata>;

  /**
   * Search for resources matching a query
   * @param query Search query string
   */
  searchResources?(query: string): Promise<Resource[]>;
}