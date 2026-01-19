package driveradapters

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kweaver-ai/TelemetrySDK-Go/exporter/v2/ar_trace"
	"github.com/kweaver-ai/kweaver-go-lib/audit"
	"github.com/kweaver-ai/kweaver-go-lib/logger"
	o11y "github.com/kweaver-ai/kweaver-go-lib/observability"
	"github.com/kweaver-ai/kweaver-go-lib/rest"
	attr "go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"ontology-manager/common"
	oerrors "ontology-manager/errors"
	"ontology-manager/interfaces"
)

// CreateActionSchedule creates a new action schedule
func (r *restHandler) CreateActionSchedule(c *gin.Context) {
	logger.Debug("Handler CreateActionSchedule Start")
	ctx, span := ar_trace.Tracer.Start(rest.GetLanguageCtx(c), "创建行动计划", trace.WithSpanKind(trace.SpanKindServer))
	defer span.End()

	visitor, err := r.verifyOAuth(ctx, c)
	if err != nil {
		return
	}
	accountInfo := interfaces.AccountInfo{
		ID:   visitor.ID,
		Type: string(visitor.Type),
	}
	ctx = context.WithValue(ctx, interfaces.ACCOUNT_INFO_KEY, accountInfo)

	o11y.AddHttpAttrs4API(span, o11y.GetAttrsByGinCtx(c))

	knID := c.Param("kn_id")
	branch := c.DefaultQuery("branch", interfaces.MAIN_BRANCH)
	span.SetAttributes(attr.Key("kn_id").String(knID), attr.Key("branch").String(branch))

	// Verify KN exists
	_, exist, err := r.kns.CheckKNExistByID(ctx, knID, branch)
	if err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}
	if !exist {
		httpErr := rest.NewHTTPError(ctx, http.StatusForbidden, oerrors.OntologyManager_KnowledgeNetwork_NotFound)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	// Bind request
	var reqBody interfaces.ActionScheduleCreateRequest
	if err := c.ShouldBindJSON(&reqBody); err != nil {
		httpErr := rest.NewHTTPError(ctx, http.StatusBadRequest, oerrors.OntologyManager_ActionSchedule_InvalidParameter).
			WithErrorDetails("Binding Parameter Failed: " + err.Error())
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	o11y.Info(ctx, fmt.Sprintf("Create action schedule request: [%s,%v]", c.Request.RequestURI, reqBody))

	// Validate request
	if err := ValidateActionScheduleCreate(ctx, &reqBody); err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	// Build schedule object
	schedule := &interfaces.ActionSchedule{
		Name:             reqBody.Name,
		KNID:             knID,
		Branch:           branch,
		ActionTypeID:     reqBody.ActionTypeID,
		CronExpression:   reqBody.CronExpression,
		UniqueIdentities: reqBody.UniqueIdentities,
		DynamicParams:    reqBody.DynamicParams,
		Status:           reqBody.Status,
		Creator:          accountInfo,
		Updater:          accountInfo,
	}

	scheduleID, err := r.ass.CreateSchedule(ctx, schedule)
	if err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	audit.NewInfoLog(audit.OPERATION, audit.CREATE, audit.TransforOperator(visitor),
		interfaces.GenerateScheduleAuditObject(scheduleID, reqBody.Name), "")

	result := map[string]any{"id": scheduleID}
	logger.Debug("Handler CreateActionSchedule Success")
	o11y.AddHttpAttrs4Ok(span, http.StatusCreated)
	rest.ReplyOK(c, http.StatusCreated, result)
}

// UpdateActionSchedule updates an existing action schedule
func (r *restHandler) UpdateActionSchedule(c *gin.Context) {
	logger.Debug("Handler UpdateActionSchedule Start")
	ctx, span := ar_trace.Tracer.Start(rest.GetLanguageCtx(c), "更新行动计划", trace.WithSpanKind(trace.SpanKindServer))
	defer span.End()

	visitor, err := r.verifyOAuth(ctx, c)
	if err != nil {
		return
	}
	accountInfo := interfaces.AccountInfo{
		ID:   visitor.ID,
		Type: string(visitor.Type),
	}
	ctx = context.WithValue(ctx, interfaces.ACCOUNT_INFO_KEY, accountInfo)

	o11y.AddHttpAttrs4API(span, o11y.GetAttrsByGinCtx(c))

	knID := c.Param("kn_id")
	branch := c.DefaultQuery("branch", interfaces.MAIN_BRANCH)
	scheduleID := c.Param("schedule_id")
	span.SetAttributes(
		attr.Key("kn_id").String(knID),
		attr.Key("branch").String(branch),
		attr.Key("schedule_id").String(scheduleID),
	)

	// Verify schedule exists and belongs to this KN
	schedule, err := r.ass.GetSchedule(ctx, scheduleID)
	if err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}
	if schedule.KNID != knID || schedule.Branch != branch {
		httpErr := rest.NewHTTPError(ctx, http.StatusNotFound, oerrors.OntologyManager_ActionSchedule_NotFound)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	// Bind request
	var reqBody interfaces.ActionScheduleUpdateRequest
	if err := c.ShouldBindJSON(&reqBody); err != nil {
		httpErr := rest.NewHTTPError(ctx, http.StatusBadRequest, oerrors.OntologyManager_ActionSchedule_InvalidParameter).
			WithErrorDetails("Binding Parameter Failed: " + err.Error())
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	o11y.Info(ctx, fmt.Sprintf("Update action schedule request: [%s,%v]", c.Request.RequestURI, reqBody))

	// Validate request
	if err := ValidateActionScheduleUpdate(ctx, &reqBody); err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	if err := r.ass.UpdateSchedule(ctx, scheduleID, &reqBody); err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	audit.NewInfoLog(audit.OPERATION, audit.UPDATE, audit.TransforOperator(visitor),
		interfaces.GenerateScheduleAuditObject(scheduleID, schedule.Name), "")

	logger.Debug("Handler UpdateActionSchedule Success")
	o11y.AddHttpAttrs4Ok(span, http.StatusOK)
	rest.ReplyOK(c, http.StatusOK, nil)
}

// UpdateActionScheduleStatus updates the status of an action schedule
func (r *restHandler) UpdateActionScheduleStatus(c *gin.Context) {
	logger.Debug("Handler UpdateActionScheduleStatus Start")
	ctx, span := ar_trace.Tracer.Start(rest.GetLanguageCtx(c), "更新行动计划状态", trace.WithSpanKind(trace.SpanKindServer))
	defer span.End()

	visitor, err := r.verifyOAuth(ctx, c)
	if err != nil {
		return
	}
	accountInfo := interfaces.AccountInfo{
		ID:   visitor.ID,
		Type: string(visitor.Type),
	}
	ctx = context.WithValue(ctx, interfaces.ACCOUNT_INFO_KEY, accountInfo)

	o11y.AddHttpAttrs4API(span, o11y.GetAttrsByGinCtx(c))

	knID := c.Param("kn_id")
	branch := c.DefaultQuery("branch", interfaces.MAIN_BRANCH)
	scheduleID := c.Param("schedule_id")
	span.SetAttributes(
		attr.Key("kn_id").String(knID),
		attr.Key("schedule_id").String(scheduleID),
	)

	// Verify schedule exists
	schedule, err := r.ass.GetSchedule(ctx, scheduleID)
	if err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}
	if schedule.KNID != knID || schedule.Branch != branch {
		httpErr := rest.NewHTTPError(ctx, http.StatusNotFound, oerrors.OntologyManager_ActionSchedule_NotFound)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	// Bind request
	var reqBody interfaces.ActionScheduleStatusRequest
	if err := c.ShouldBindJSON(&reqBody); err != nil {
		httpErr := rest.NewHTTPError(ctx, http.StatusBadRequest, oerrors.OntologyManager_ActionSchedule_InvalidParameter).
			WithErrorDetails("Binding Parameter Failed: " + err.Error())
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	if err := r.ass.UpdateScheduleStatus(ctx, scheduleID, reqBody.Status); err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	audit.NewInfoLog(audit.OPERATION, audit.UPDATE, audit.TransforOperator(visitor),
		interfaces.GenerateScheduleAuditObject(scheduleID, schedule.Name), fmt.Sprintf("status: %s", reqBody.Status))

	logger.Debug("Handler UpdateActionScheduleStatus Success")
	o11y.AddHttpAttrs4Ok(span, http.StatusOK)
	rest.ReplyOK(c, http.StatusOK, nil)
}

// DeleteActionSchedules deletes action schedules
func (r *restHandler) DeleteActionSchedules(c *gin.Context) {
	logger.Debug("Handler DeleteActionSchedules Start")
	ctx, span := ar_trace.Tracer.Start(rest.GetLanguageCtx(c), "删除行动计划", trace.WithSpanKind(trace.SpanKindServer))
	defer span.End()

	visitor, err := r.verifyOAuth(ctx, c)
	if err != nil {
		return
	}
	accountInfo := interfaces.AccountInfo{
		ID:   visitor.ID,
		Type: string(visitor.Type),
	}
	ctx = context.WithValue(ctx, interfaces.ACCOUNT_INFO_KEY, accountInfo)

	o11y.AddHttpAttrs4API(span, o11y.GetAttrsByGinCtx(c))

	knID := c.Param("kn_id")
	branch := c.DefaultQuery("branch", interfaces.MAIN_BRANCH)
	scheduleIDsStr := c.Param("schedule_ids")
	span.SetAttributes(
		attr.Key("kn_id").String(knID),
		attr.Key("schedule_ids").String(scheduleIDsStr),
	)

	scheduleIDs := common.StringToStringSlice(scheduleIDsStr)

	// Get schedules for audit log
	schedules, err := r.ass.GetSchedules(ctx, scheduleIDs)
	if err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	if err := r.ass.DeleteSchedules(ctx, knID, branch, scheduleIDs); err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	for _, schedule := range schedules {
		audit.NewWarnLog(audit.OPERATION, audit.DELETE, audit.TransforOperator(visitor),
			interfaces.GenerateScheduleAuditObject(schedule.ID, schedule.Name), audit.SUCCESS, "")
	}

	logger.Debug("Handler DeleteActionSchedules Success")
	o11y.AddHttpAttrs4Ok(span, http.StatusNoContent)
	rest.ReplyOK(c, http.StatusNoContent, nil)
}

// ListActionSchedules lists action schedules
func (r *restHandler) ListActionSchedules(c *gin.Context) {
	logger.Debug("Handler ListActionSchedules Start")
	ctx, span := ar_trace.Tracer.Start(rest.GetLanguageCtx(c), "列出行动计划", trace.WithSpanKind(trace.SpanKindServer))
	defer span.End()

	visitor, err := r.verifyOAuth(ctx, c)
	if err != nil {
		return
	}
	accountInfo := interfaces.AccountInfo{
		ID:   visitor.ID,
		Type: string(visitor.Type),
	}
	ctx = context.WithValue(ctx, interfaces.ACCOUNT_INFO_KEY, accountInfo)

	o11y.AddHttpAttrs4API(span, o11y.GetAttrsByGinCtx(c))

	knID := c.Param("kn_id")
	branch := c.DefaultQuery("branch", interfaces.MAIN_BRANCH)
	span.SetAttributes(attr.Key("kn_id").String(knID))

	// Verify KN exists
	_, exist, err := r.kns.CheckKNExistByID(ctx, knID, branch)
	if err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}
	if !exist {
		httpErr := rest.NewHTTPError(ctx, http.StatusForbidden, oerrors.OntologyManager_KnowledgeNetwork_NotFound)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	// Get query params
	namePattern := c.Query("name_pattern")
	actionTypeID := c.Query("action_type_id")
	status := c.Query("status")
	offset := c.DefaultQuery("offset", interfaces.DEFAULT_OFFEST)
	limit := c.DefaultQuery("limit", interfaces.DEFAULT_LIMIT)
	sort := c.DefaultQuery("sort", "create_time")
	direction := c.DefaultQuery("direction", interfaces.DESC_DIRECTION)

	pageParam, err := validatePaginationQueryParameters(ctx, offset, limit, sort, direction, interfaces.ACTION_SCHEDULE_SORT)
	if err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	// Validate status if provided
	if status != "" && status != interfaces.ScheduleStatusActive && status != interfaces.ScheduleStatusInactive {
		httpErr := rest.NewHTTPError(ctx, http.StatusBadRequest, oerrors.OntologyManager_ActionSchedule_InvalidStatus).
			WithErrorDetails(fmt.Sprintf("Invalid status: %s", status))
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	queryParams := interfaces.ActionScheduleQueryParams{
		KNID:         knID,
		Branch:       branch,
		NamePattern:  namePattern,
		ActionTypeID: actionTypeID,
		Status:       status,
	}
	queryParams.Sort = pageParam.Sort
	queryParams.Direction = pageParam.Direction
	queryParams.Limit = pageParam.Limit
	queryParams.Offset = pageParam.Offset

	schedules, total, err := r.ass.ListSchedules(ctx, queryParams)
	if err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	result := map[string]any{
		"entries":     schedules,
		"total_count": total,
	}

	logger.Debug("Handler ListActionSchedules Success")
	o11y.AddHttpAttrs4Ok(span, http.StatusOK)
	rest.ReplyOK(c, http.StatusOK, result)
}

// GetActionSchedule gets a single action schedule
func (r *restHandler) GetActionSchedule(c *gin.Context) {
	logger.Debug("Handler GetActionSchedule Start")
	ctx, span := ar_trace.Tracer.Start(rest.GetLanguageCtx(c), "获取行动计划", trace.WithSpanKind(trace.SpanKindServer))
	defer span.End()

	visitor, err := r.verifyOAuth(ctx, c)
	if err != nil {
		return
	}
	accountInfo := interfaces.AccountInfo{
		ID:   visitor.ID,
		Type: string(visitor.Type),
	}
	ctx = context.WithValue(ctx, interfaces.ACCOUNT_INFO_KEY, accountInfo)

	o11y.AddHttpAttrs4API(span, o11y.GetAttrsByGinCtx(c))

	knID := c.Param("kn_id")
	branch := c.DefaultQuery("branch", interfaces.MAIN_BRANCH)
	scheduleID := c.Param("schedule_id")
	span.SetAttributes(
		attr.Key("kn_id").String(knID),
		attr.Key("schedule_id").String(scheduleID),
	)

	schedule, err := r.ass.GetSchedule(ctx, scheduleID)
	if err != nil {
		httpErr := err.(*rest.HTTPError)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	if schedule.KNID != knID || schedule.Branch != branch {
		httpErr := rest.NewHTTPError(ctx, http.StatusNotFound, oerrors.OntologyManager_ActionSchedule_NotFound)
		o11y.AddHttpAttrs4HttpError(span, httpErr)
		rest.ReplyError(c, httpErr)
		return
	}

	logger.Debug("Handler GetActionSchedule Success")
	o11y.AddHttpAttrs4Ok(span, http.StatusOK)
	rest.ReplyOK(c, http.StatusOK, schedule)
}
