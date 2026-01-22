package action_scheduler

import (
	"context"
	"fmt"

	"github.com/kweaver-ai/kweaver-go-lib/logger"

	"ontology-query/interfaces"
)

// ExecuteTool executes a tool-based action through agent-operator-integration
func ExecuteTool(ctx context.Context, aoAccess interfaces.AgentOperatorAccess, actionType *interfaces.ActionType, params map[string]any) (any, error) {
	source := actionType.ActionSource

	// Validate tool configuration
	if source.BoxID == "" || source.ToolID == "" {
		return nil, fmt.Errorf("tool execution requires box_id and tool_id")
	}

	// Build operator execution request
	// Parameters are passed in the body for POST requests
	execRequest := interfaces.OperatorExecutionRequest{
		Header: map[string]any{},
		Body:   params,
		Query:  map[string]any{},
		Path: map[string]any{
			"box_id":  source.BoxID,
			"tool_id": source.ToolID,
		},
		Timeout: 300, // 5 minutes timeout
	}

	logger.Debugf("Executing tool: box_id=%s, tool_id=%s", source.BoxID, source.ToolID)

	// Execute through agent-operator-integration
	// The operator ID format may vary depending on the agent-operator-integration service
	operatorID := source.ToolID
	result, err := aoAccess.ExecuteOperator(ctx, operatorID, execRequest)
	if err != nil {
		logger.Errorf("Tool execution failed: %v", err)
		return nil, fmt.Errorf("tool execution failed: %w", err)
	}

	logger.Debugf("Tool execution completed successfully")
	return result, nil
}
