/**
 * Shorten a model identifier for display.
 * "anthropic/claude-sonnet-4-5-20250929" → "claude-sonnet-4-5"
 */
function shortenModelName(model) {
  if (!model) return "";
  // Strip provider prefix
  const name = model.includes("/") ? model.split("/").pop() : model;
  // Strip date suffix
  return name.replace(/-\d{8}$/, "");
}

/**
 * Convert an agent object to a React Flow node.
 *
 * @param {object} agent - Agent from the boxes array
 * @param {object} options - { workflowSteps, allAgents }
 * @returns {object} React Flow node
 */
export function agentToNode(agent, options = {}) {
  const { workflowSteps = [], allAgents = [] } = options;

  const step = workflowSteps.find((s) => s.id === agent.id);
  const status = step?.status || "idle";
  const result = step?.result ?? null;
  const error = step?.error ?? null;
  const duration = step?.duration ?? null;

  const categoryToType = {
    Base: "baseNode",
    Parallel: "parallelNode",
    Sequential: "sequentialNode",
    Loop: "loopNode",
    Router: "routerNode",
  };

  const nodeType = categoryToType[agent.category] || "baseNode";

  // Resolve sub-agent IDs → labels
  const subAgentLabels = {};
  if (agent.subAgents) {
    for (const subId of agent.subAgents) {
      const sub = allAgents.find((a) => a.id === subId);
      subAgentLabels[subId] = sub?.label || subId;
    }
  }

  return {
    id: agent.id,
    type: nodeType,
    position: { x: 0, y: 0 },
    data: {
      label: agent.label,
      agentId: agent.id,
      category: agent.category,
      subAgents: agent.subAgents || [],
      subAgentLabels,
      status,
      result,
      error,
      duration,
      hasOutputSchema: !!agent.output_schema,
      issues: agent.issues || [],
      modelShort: shortenModelName(agent.agent_model),
      toolsCount: (agent.agent_tools || []).length,
      description: agent.agent_description || "",
      memoryEnabled: agent.memory_enabled || false,
      loopMaxIterations: agent.loop_max_iterations || null,
      loopExitInstruction: agent.loop_exit_instruction || null,
      superagentTemplateId: agent.superagent_template_id || null,
    },
  };
}

/**
 * Generate edges from canvas agent order and agent data.
 *
 * @param {string[]} canvasAgentIds - Ordered agent IDs on canvas
 * @param {Map|Array} agents - Agent collection (Map or array)
 * @param {object[]} workflowSteps - Step statuses
 * @returns {object[]} React Flow edges
 */
export function generateEdges(canvasAgentIds, agents, workflowSteps = []) {
  const edges = [];
  const getAgent = (id) => {
    if (agents instanceof Map) return agents.get(id);
    return agents.find?.((a) => a.id === id);
  };

  const stepStatusMap = new Map(workflowSteps.map((s) => [s.id, s.status]));

  // Main flow: canvasOrder[i] -> canvasOrder[i+1]
  // Skip direct edge for orchestrators with sub-agents (they use fork/join edges instead)
  const orchestratorTypes = new Set(["Parallel", "Sequential", "Loop", "Router"]);
  for (let i = 0; i < canvasAgentIds.length - 1; i++) {
    const sourceId = canvasAgentIds[i];
    const targetId = canvasAgentIds[i + 1];
    const sourceAgent = getAgent(sourceId);
    const status = stepStatusMap.get(sourceId) || "idle";

    // Don't create a direct edge if the source is an orchestrator with sub-agents
    // (the sub-agent edges handle the connection to the next node)
    if (
      sourceAgent &&
      orchestratorTypes.has(sourceAgent.category) &&
      sourceAgent.subAgents?.length > 0
    ) {
      continue;
    }

    edges.push({
      id: `e-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      type: "animatedEdge",
      data: { status },
    });
  }

  // Sub-agent edges for each canvas agent
  for (const agentId of canvasAgentIds) {
    const agent = getAgent(agentId);
    if (!agent || !agent.subAgents || agent.subAgents.length === 0) continue;

    const nextIndex = canvasAgentIds.indexOf(agentId) + 1;
    const nextAgentId = canvasAgentIds[nextIndex];
    const parentStatus = stepStatusMap.get(agentId) || "idle";

    if (agent.category === "Parallel") {
      // Fork: parent -> each sub-agent
      for (const subId of agent.subAgents) {
        edges.push({
          id: `e-fork-${agentId}-${subId}`,
          source: agentId,
          target: subId,
          type: "animatedEdge",
          data: { status: parentStatus },
        });
        // Join: each sub-agent -> next canvas node
        if (nextAgentId) {
          edges.push({
            id: `e-join-${subId}-${nextAgentId}`,
            source: subId,
            target: nextAgentId,
            type: "animatedEdge",
            data: { status: stepStatusMap.get(subId) || "idle" },
          });
        }
      }
    } else if (agent.category === "Sequential") {
      // Chain: parent -> first sub, sub[i] -> sub[i+1], last sub -> next canvas
      if (agent.subAgents.length > 0) {
        edges.push({
          id: `e-seq-${agentId}-${agent.subAgents[0]}`,
          source: agentId,
          target: agent.subAgents[0],
          type: "animatedEdge",
          data: { status: parentStatus },
        });
        for (let i = 0; i < agent.subAgents.length - 1; i++) {
          edges.push({
            id: `e-seq-${agent.subAgents[i]}-${agent.subAgents[i + 1]}`,
            source: agent.subAgents[i],
            target: agent.subAgents[i + 1],
            type: "animatedEdge",
            data: { status: stepStatusMap.get(agent.subAgents[i]) || "idle" },
          });
        }
        if (nextAgentId) {
          const lastSub = agent.subAgents[agent.subAgents.length - 1];
          edges.push({
            id: `e-seq-${lastSub}-${nextAgentId}`,
            source: lastSub,
            target: nextAgentId,
            type: "animatedEdge",
            data: { status: stepStatusMap.get(lastSub) || "idle" },
          });
        }
      }
    } else if (agent.category === "Loop") {
      // Loop: parent -> first sub, chain subs, last sub -> first sub (loop-back)
      if (agent.subAgents.length > 0) {
        edges.push({
          id: `e-loop-start-${agentId}-${agent.subAgents[0]}`,
          source: agentId,
          target: agent.subAgents[0],
          type: "animatedEdge",
          data: { status: parentStatus },
        });
        for (let i = 0; i < agent.subAgents.length - 1; i++) {
          edges.push({
            id: `e-loop-${agent.subAgents[i]}-${agent.subAgents[i + 1]}`,
            source: agent.subAgents[i],
            target: agent.subAgents[i + 1],
            type: "animatedEdge",
            data: { status: stepStatusMap.get(agent.subAgents[i]) || "idle" },
          });
        }
        // Loop-back edge
        const lastSub = agent.subAgents[agent.subAgents.length - 1];
        edges.push({
          id: `e-loop-back-${lastSub}-${agent.subAgents[0]}`,
          source: lastSub,
          target: agent.subAgents[0],
          type: "animatedEdge",
          animated: true,
          style: { strokeDasharray: "5 5" },
          data: { status: "idle", isLoopBack: true },
        });
        // Loop exit: last sub -> next canvas node
        if (nextAgentId) {
          edges.push({
            id: `e-loop-exit-${lastSub}-${nextAgentId}`,
            source: lastSub,
            target: nextAgentId,
            type: "animatedEdge",
            data: { status: stepStatusMap.get(lastSub) || "idle" },
          });
        }
      }
    } else if (agent.category === "Router") {
      // Router: parent -> each sub-agent (dashed), each sub -> next canvas node
      for (const subId of agent.subAgents) {
        edges.push({
          id: `e-route-${agentId}-${subId}`,
          source: agentId,
          target: subId,
          type: "animatedEdge",
          style: { strokeDasharray: "8 4" },
          data: { status: parentStatus, isRoute: true },
        });
        if (nextAgentId) {
          edges.push({
            id: `e-route-join-${subId}-${nextAgentId}`,
            source: subId,
            target: nextAgentId,
            type: "animatedEdge",
            style: { strokeDasharray: "8 4" },
            data: { status: stepStatusMap.get(subId) || "idle", isRoute: true },
          });
        }
      }
    }
  }

  return edges;
}
