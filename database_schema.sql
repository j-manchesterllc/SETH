-- SETH Database Schema for Supabase PostgreSQL
-- Generated from Prisma schema.prisma
-- Run this in your Supabase SQL editor to create all tables

-- Enable UUID extension (though we're using CUID strings, not UUIDs)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================
-- CORE TABLES
-- ======================

-- User table
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "email" TEXT NOT NULL UNIQUE,
    "emailVerified" TIMESTAMP,
    "name" TEXT,
    "image" TEXT,
    "password" TEXT,
    "objectives" TEXT,
    "preferences" TEXT,
    "workingStyle" TEXT,
    "apiKey" TEXT UNIQUE,
    "apiKeyHash" TEXT,
    "apiKeyPrefix" TEXT UNIQUE,
    "googleSsoDisabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL
);

-- Account table (for OAuth)
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "refresh_token_expires_in" INTEGER,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    UNIQUE ("provider", "providerAccountId")
);

-- Session table
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "sessionToken" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- VerificationToken table
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expires" TIMESTAMP NOT NULL,
    PRIMARY KEY ("identifier", "token")
);

-- Conversation table
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "decisionContext" TEXT,
    "environmentUrl" TEXT,
    "environmentThumb" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Message table
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE
);

-- Memory table
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 5,
    "tags" TEXT,
    "semanticTags" TEXT,
    "embedding" TEXT,
    "embeddingModel" TEXT,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP,
    "decayRate" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Task table
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "autonomyLevel" INTEGER NOT NULL DEFAULT 3,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" TIMESTAMP,
    "executedAt" TIMESTAMP,
    "executionResult" TEXT,
    "notifiedAt" TIMESTAMP,
    "pendingAction" TEXT,
    "pendingActionStatus" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Watch table
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "threshold" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" TIMESTAMP,
    "lastResult" TEXT,
    "lastAlerted" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- AgentLog table
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "messageId" TEXT,
    "action" TEXT NOT NULL,
    "tier" TEXT,
    "model" TEXT,
    "provider" TEXT,
    "toolName" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Agent table
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "codename" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "capabilities" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'standby',
    "avatar" TEXT,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "lastActiveAt" TIMESTAMP,
    "monitorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "monitorQuery" TEXT,
    "monitorInterval" INTEGER NOT NULL DEFAULT 60,
    "lastMonitorAt" TIMESTAMP,
    "lastMonitorResult" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL,
    "avgLatencyMs" INTEGER,
    "domainScores" TEXT,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- AgentDispatch table
CREATE TABLE "AgentDispatch" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT,
    "tier" TEXT,
    "model" TEXT,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- RoutingDecision table
CREATE TABLE "RoutingDecision" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "taskInput" TEXT NOT NULL,
    "taskDomain" TEXT,
    "selectedAgentId" TEXT,
    "candidateScores" TEXT,
    "routingMethod" TEXT NOT NULL DEFAULT 'adaptive',
    "multiAgent" BOOLEAN NOT NULL DEFAULT false,
    "teamAgentIds" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "latencyMs" INTEGER,
    "outcome" TEXT,
    "feedback" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("selectedAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL
);

-- BrandProfile table
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "tagline" TEXT,
    "mission" TEXT,
    "vision" TEXT,
    "voiceTone" TEXT,
    "targetAudience" TEXT,
    "competitors" TEXT,
    "visualIdentity" TEXT,
    "contentPillars" TEXT,
    "brandValues" TEXT,
    "positioning" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- BrandAudit table
CREATE TABLE "BrandAudit" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "brandProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "input" TEXT,
    "result" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "weightProfileVersion" TEXT,
    "sourceExclusions" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE
);

-- BrandAblation table
CREATE TABLE "BrandAblation" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "brandProfileId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "auditType" TEXT NOT NULL,
    "repsPerCondition" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "profileVersion" TEXT,
    "conditions" TEXT NOT NULL,
    "noiseFloor" TEXT,
    "verdictMatrix" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "error" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "completedAt" TIMESTAMP,
    FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE
);

-- ScheduledPost table
CREATE TABLE "ScheduledPost" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "brandProfileId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "scheduledFor" TIMESTAMP NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "publishedAt" TIMESTAMP,
    "errorMessage" TEXT,
    "hashtags" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE
);

-- BrandMention table
CREATE TABLE "BrandMention" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "brandProfileId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "content" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "reach" INTEGER,
    "detectedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE
);

-- BrowserAutomation table
CREATE TABLE "BrowserAutomation" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "taskDesc" TEXT NOT NULL,
    "targetUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actionPlan" TEXT,
    "script" TEXT,
    "result" TEXT,
    "partialResult" TEXT,
    "screenshotUrl" TEXT,
    "error" TEXT,
    "errorType" TEXT,
    "durationMs" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "executionPhase" TEXT,
    "stepsTotal" INTEGER,
    "stepsCompleted" INTEGER,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- CortexObservation table
CREATE TABLE "CortexObservation" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "metadata" TEXT,
    "outcome" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "importance" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- CortexPattern table
CREATE TABLE "CortexPattern" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "patternType" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "impactScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "evidenceIds" TEXT,
    "recommendation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- CortexReflection table
CREATE TABLE "CortexReflection" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "wins" TEXT,
    "bottlenecks" TEXT,
    "recurringThemes" TEXT,
    "optimizationSuggestions" TEXT,
    "executionScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "focusScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- CortexLearningJob table
CREATE TABLE "CortexLearningJob" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Skill table
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "tools" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- UserPreference table
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- TelemetryTrace table
CREATE TABLE "TelemetryTrace" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "userId" TEXT,
    "traceId" TEXT NOT NULL UNIQUE,
    "pipeline" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "latencyMs" INTEGER NOT NULL,
    "spans" TEXT NOT NULL,
    "metadata" TEXT,
    "authMethod" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

-- AgentMemory table
CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "sourceTask" TEXT,
    "relatedIds" TEXT,
    "expiresAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- ======================
-- INDEXES
-- ======================

-- User indexes
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_apiKey_idx" ON "User"("apiKey");
CREATE INDEX "User_apiKeyPrefix_idx" ON "User"("apiKeyPrefix");

-- Account indexes
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- Session indexes
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_sessionToken_idx" ON "Session"("sessionToken");

-- Conversation indexes
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- Message indexes
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- Memory indexes
CREATE INDEX "Memory_userId_idx" ON "Memory"("userId");
CREATE INDEX "Memory_type_idx" ON "Memory"("type");
CREATE INDEX "Memory_userId_strength_idx" ON "Memory"("userId", "strength");

-- Task indexes
CREATE INDEX "Task_userId_idx" ON "Task"("userId");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- Watch indexes
CREATE INDEX "Watch_userId_idx" ON "Watch"("userId");
CREATE INDEX "Watch_active_idx" ON "Watch"("active");

-- AgentLog indexes
CREATE INDEX "AgentLog_userId_idx" ON "AgentLog"("userId");
CREATE INDEX "AgentLog_createdAt_idx" ON "AgentLog"("createdAt");
CREATE INDEX "AgentLog_action_idx" ON "AgentLog"("action");

-- Agent indexes
CREATE INDEX "Agent_userId_idx" ON "Agent"("userId");
CREATE INDEX "Agent_codename_idx" ON "Agent"("codename");
CREATE INDEX "Agent_role_idx" ON "Agent"("role");
CREATE INDEX "Agent_userId_monitorEnabled_idx" ON "Agent"("userId", "monitorEnabled");

-- AgentDispatch indexes
CREATE INDEX "AgentDispatch_agentId_idx" ON "AgentDispatch"("agentId");
CREATE INDEX "AgentDispatch_userId_idx" ON "AgentDispatch"("userId");
CREATE INDEX "AgentDispatch_createdAt_idx" ON "AgentDispatch"("createdAt");

-- RoutingDecision indexes
CREATE INDEX "RoutingDecision_userId_idx" ON "RoutingDecision"("userId");
CREATE INDEX "RoutingDecision_taskDomain_idx" ON "RoutingDecision"("taskDomain");
CREATE INDEX "RoutingDecision_createdAt_idx" ON "RoutingDecision"("createdAt");
CREATE INDEX "RoutingDecision_selectedAgentId_idx" ON "RoutingDecision"("selectedAgentId");

-- BrandProfile indexes
CREATE INDEX "BrandProfile_userId_idx" ON "BrandProfile"("userId");

-- BrandAudit indexes
CREATE INDEX "BrandAudit_brandProfileId_idx" ON "BrandAudit"("brandProfileId");
CREATE INDEX "BrandAudit_type_idx" ON "BrandAudit"("type");
CREATE INDEX "BrandAudit_weightProfileVersion_idx" ON "BrandAudit"("weightProfileVersion");

-- BrandAblation indexes
CREATE INDEX "BrandAblation_brandProfileId_idx" ON "BrandAblation"("brandProfileId");
CREATE INDEX "BrandAblation_mode_idx" ON "BrandAblation"("mode");
CREATE INDEX "BrandAblation_auditType_idx" ON "BrandAblation"("auditType");

-- ScheduledPost indexes
CREATE INDEX "ScheduledPost_brandProfileId_idx" ON "ScheduledPost"("brandProfileId");
CREATE INDEX "ScheduledPost_status_idx" ON "ScheduledPost"("status");
CREATE INDEX "ScheduledPost_scheduledFor_idx" ON "ScheduledPost"("scheduledFor");

-- BrandMention indexes
CREATE INDEX "BrandMention_brandProfileId_idx" ON "BrandMention"("brandProfileId");
CREATE INDEX "BrandMention_sentiment_idx" ON "BrandMention"("sentiment");
CREATE INDEX "BrandMention_detectedAt_idx" ON "BrandMention"("detectedAt");

-- BrowserAutomation indexes
CREATE INDEX "BrowserAutomation_userId_idx" ON "BrowserAutomation"("userId");
CREATE INDEX "BrowserAutomation_status_idx" ON "BrowserAutomation"("status");
CREATE INDEX "BrowserAutomation_createdAt_idx" ON "BrowserAutomation"("createdAt");

-- CortexObservation indexes
CREATE INDEX "CortexObservation_userId_idx" ON "CortexObservation"("userId");
CREATE INDEX "CortexObservation_source_idx" ON "CortexObservation"("source");
CREATE INDEX "CortexObservation_category_idx" ON "CortexObservation"("category");
CREATE INDEX "CortexObservation_createdAt_idx" ON "CortexObservation"("createdAt");

-- CortexPattern indexes
CREATE INDEX "CortexPattern_userId_idx" ON "CortexPattern"("userId");
CREATE INDEX "CortexPattern_status_idx" ON "CortexPattern"("status");
CREATE INDEX "CortexPattern_patternType_idx" ON "CortexPattern"("patternType");

-- CortexReflection indexes
CREATE INDEX "CortexReflection_userId_idx" ON "CortexReflection"("userId");
CREATE INDEX "CortexReflection_timeframe_idx" ON "CortexReflection"("timeframe");
CREATE INDEX "CortexReflection_createdAt_idx" ON "CortexReflection"("createdAt");

-- CortexLearningJob indexes
CREATE INDEX "CortexLearningJob_userId_idx" ON "CortexLearningJob"("userId");
CREATE INDEX "CortexLearningJob_status_idx" ON "CortexLearningJob"("status");
CREATE INDEX "CortexLearningJob_type_idx" ON "CortexLearningJob"("type");

-- Skill indexes
CREATE INDEX "Skill_userId_idx" ON "Skill"("userId");

-- UserPreference indexes
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");

-- TelemetryTrace indexes
CREATE INDEX "TelemetryTrace_pipeline_idx" ON "TelemetryTrace"("pipeline");
CREATE INDEX "TelemetryTrace_status_idx" ON "TelemetryTrace"("status");
CREATE INDEX "TelemetryTrace_createdAt_idx" ON "TelemetryTrace"("createdAt");
CREATE INDEX "TelemetryTrace_userId_idx" ON "TelemetryTrace"("userId");

-- AgentMemory indexes
CREATE INDEX "AgentMemory_agentId_userId_idx" ON "AgentMemory"("agentId", "userId");
CREATE INDEX "AgentMemory_userId_memoryType_idx" ON "AgentMemory"("userId", "memoryType");
CREATE INDEX "AgentMemory_createdAt_idx" ON "AgentMemory"("createdAt");

-- ======================
-- TRIGGERS FOR UPDATED_AT
-- ======================

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables that have updatedAt column
DO $$ 
DECLARE
    tables TEXT[] := ARRAY[
        'User', 'Account', 'Session', 'Conversation', 'Message', 'Memory', 
        'Task', 'Watch', 'AgentLog', 'Agent', 'AgentDispatch', 'RoutingDecision',
        'BrandProfile', 'BrandAudit', 'BrandAblation', 'ScheduledPost', 'BrandMention',
        'BrowserAutomation', 'CortexObservation', 'CortexPattern', 'CortexReflection',
        'CortexLearningJob', 'Skill', 'UserPreference', 'TelemetryTrace', 'AgentMemory'
    ];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY tables LOOP
        EXECUTE format(
            'CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();',
            table_name, table_name
        );
    END LOOP;
END $$;

-- ======================
-- COMMENTS
-- ======================

COMMENT ON DATABASE IS 'SETH - Strategic Executive Technology Hub Database Schema';

COMMENT ON TABLE "User" IS 'Core user entity';
COMMENT ON COLUMN "User"."apiKey" IS 'Encrypted API key for user authentication';
COMMENT ON COLUMN "User"."apiKeyHash" IS 'Hash of API key for verification';
COMMENT ON COLUMN "User"."apiKeyPrefix" IS 'First few chars of API key for display';

COMMENT ON TABLE "Memory" IS 'User memories with decay mechanism';
COMMENT ON COLUMN "Memory"."strength" IS 'Memory strength (0-1) that decays over time';
COMMENT ON COLUMN "Memory"."decayRate" IS 'Rate at which memory strength decays per day';
COMMENT ON COLUMN "Memory"."pinned" IS 'Pinned memories do not decay';

COMMENT ON TABLE "Agent" IS 'AI agents assigned to users';
COMMENT ON COLUMN "Agent"."monitorEnabled" IS 'Whether agent autonomously monitors for triggers';
COMMENT ON COLUMN "Agent"."monitorInterval" IS 'Minutes between monitoring checks';

COMMENT ON TABLE "RoutingDecision" IS 'Logs of how requests were routed to agents';
COMMENT ON COLUMN "RoutingDecision"."routingMethod" IS 'Method used: keyword, adaptive, llm, multi-agent';
COMMENT ON COLUMN "RoutingDecision"."multiAgent" IS 'Whether multiple agents were involved';

COMMENT ON TABLE "BrandProfile" IS 'User brand identity and guidelines';
COMMENT ON TABLE "BrandAudit" IS 'Periodic brand health checks';
COMMENT ON TABLE "BrandAblation" IS 'A/B testing of brand components';

COMMENT ON TABLE "CortexObservation" IS 'Raw observations from user interactions';
COMMENT ON TABLE "CortexPattern" IS 'Discovered patterns in user behavior';
COMMENT ON TABLE "CortexReflection" IS 'Periodic self-reflections and insights';
COMMENT ON TABLE "CortexLearningJob" IS 'Background learning and optimization jobs';

COMMENT ON TABLE "TelemetryTrace" IS 'Distributed tracing for performance monitoring';
COMMENT ON COLUMN "TelemetryTrace"."traceId" IS 'Unique ID to trace request across services';
COMMENT ON COLUMN "TelemetryTrace"."pipeline" IS 'Processing pipeline: chat, tts, transcribe, memory, graph, routing, tool';

COMMENT ON TABLE "AgentMemory" IS 'Agent working memory for maintaining context';
COMMENT ON COLUMN "AgentMemory"."memoryType" IS 'Type: finding, conclusion, handoff, hypothesis, context';
COMMENT ON COLUMN "AgentMemory"."expiresAt" IS 'Optional TTL for ephemeral working memory';

-- ======================
-- END OF SCHEMA
-- ======================