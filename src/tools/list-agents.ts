/**
 * List agents tool for the Agent Communication MCP Server
 */

import { ServerConfig, ListAgentsResponse } from '../types.js';
import { getAllAgents } from '../utils/task-manager.js';
import debug from 'debug';


const log = debug('agent-comm:tools:listagents');
/**
 * List all agents with task counts
 */
export async function listAgents(
  config: ServerConfig
): Promise<ListAgentsResponse> {
  log('listAgents called with config');
  const agents = await getAllAgents(config);
  
  const totalTasks = agents.reduce((sum, agent) => sum + agent.taskCount, 0);
  
  return {
    agents,
    totalAgents: agents.length,
    totalTasks
  };
}