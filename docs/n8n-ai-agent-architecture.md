# Enterprise AI Automation Platform: n8n + Custom AI Agent Architecture

## Executive Summary

This architecture combines **n8n** (integration & workflow layer) with a **custom AI Agent** (reasoning & orchestration layer) to create an enterprise-ready AI automation platform. The platform enables non-technical employees to build AI assistants while IT maintains governance and security.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         ENTERPRISE AI AUTOMATION PLATFORM                             │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐   │
│  │                              USER INTERFACE LAYER                             │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐    │   │
│  │  │ n8n Workflow   │  │ Agent Builder   │  │ Admin Dashboard            │    │   │
│  │  │ Editor (Visual)│  │ (No-Code UI)    │  │ (Governance & Monitoring) │    │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘    │   │
│  │         │                      │                        │                       │   │
│  │         └──────────────────────┼────────────────────────┘                       │   │
│  │                                ▼                                                │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                    API Gateway (Kong/AWS API GW)                       │   │   │
│  │  │                 Rate Limiting • Auth • Routing                         │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                             │
│                                         ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────┐   │
│  │                           CORE SERVICES LAYER                                 │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐    │   │
│  │  │ Agent          │  │ Governance      │  │ Audit & Analytics          │    │   │
│  │  │ Management     │  │ Service         │  │ Service                    │    │   │
│  │  │ Service        │  │ (RBAC, Approvals)│  │                            │    │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘    │   │
│  └───────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                             │
│                                         ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────┐   │
│  │                         AI AGENT LAYER (Custom)                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    Custom AI Agent (Claude Code Style)                   │ │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │ │   │
│  │  │  │ Reasoning  │  │ Tool        │  │ State      │  │ Memory          │ │ │   │
│  │  │  │ Engine     │  │ Orchestrator│  │ Manager    │  │ Manager         │ │ │   │
│  │  │  │ (LLM)      │  │             │  │            │  │                 │ │ │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │ │   │
│  │  │         │                │                │                │           │ │   │
│  │  │         └────────────────┼────────────────┼────────────────┘           │ │   │
│  │  │                          ▼                                             │ │   │
│  │  │              ┌─────────────────────────────┐                          │ │   │
│  │  │              │     Tool Interface Layer    │                          │ │   │
│  │  │              │   (Standardized Tool API)  │                          │ │   │
│  │  │              └─────────────────────────────┘                          │ │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘ │   │
│  └───────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                             │
│                                         ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────┐   │
│  │                          n8n INTEGRATION LAYER                                │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                         n8n Engine                                       │ │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │ │   │
│  │  │  │ Workflow    │  │ Node        │  │ Webhook     │  │ Queue           │ │ │   │
│  │  │  │ Executor    │  │ Registry    │  │ Handler     │  │ (Redis)         │ │ │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │ │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                         │                                     │   │
│  │                                         ▼                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐       │   │
│  │  │ Slack       │  │ Email       │  │ Database    │  │ 400+ Other      │       │   │
│  │  │ Connector   │  │ Connector   │  │ Connectors  │  │ Connectors      │       │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘       │   │
│  └───────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                             │
│                                         ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────┐   │
│  │                       ENTERPRISE INFRASTRUCTURE                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐       │   │
│  │  │ SSO/IdP     │  │ PostgreSQL  │  │ Redis       │  │ Monitoring      │       │   │
│  │  │ (Azure AD)  │  │ (Metadata) │  │ (Cache/Queue)│  │ (Prometheus)   │       │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘       │   │
│  └───────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. How the Layers Work Together

### 2.1 User Creates an Agent

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: User describes agent in natural language                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  "I want an agent that monitors our support Slack channel,                  │
│   analyzes incoming questions, and either answers common questions           │
│   or creates a Jira ticket for the IT team"                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: AI Agent generates n8n workflow config                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Custom AI Agent (Claude Code Style)                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Understand user intent                                             │   │
│  │ 2. Design workflow structure                                         │   │
│  │ 3. Select appropriate n8n nodes                                       │   │
│  │ 4. Generate workflow JSON                                            │   │
│  │ 5. Return to user for review                                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: n8n executes the workflow                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Generated n8n Workflow:                                                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐               │
│  │ Slack Trigger│────▶│ AI Agent Node│────▶│ Router      │               │
│  │ (new message)│     │ (analyze)    │     │ (conditional)│               │
│  └──────────────┘     └──────────────┘     └──────────────┘               │
│                                                    │                       │
│                           ┌─────────────────────────┼─────────────────────┐ │
│                           │                         │                     │ │
│                           ▼                         ▼                     ▼ │
│                    ┌──────────────┐         ┌──────────────┐    ┌──────────────┐
│                    │ Slack Reply │         │ Jira Create  │    │ Log/Ignore  │
│                    │ (answer)    │         │ (new ticket) │    │             │
│                    └──────────────┘         └──────────────┘    └──────────────┘
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Tool Call Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TOOL CALL EXECUTION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Custom AI Agent                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  User: "Create a Jira ticket for this issue"                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  LLM decides: Need to call jira_create_tool                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Tool Orchestrator:                                                  │   │
│  │  1. Validate tool exists in registry                                │   │
│  │  2. Check user permissions                                          │   │
│  │  3. Call n8n webhook/API                                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  n8n Workflow Execution:                                            │   │
│  │  1. Receive webhook request                                         │   │
│  │  2. Execute Jira Create node                                        │   │
│  │ 3. Return result to AI Agent                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  AI Agent: "Done! Created JIRA-123 for the issue"                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Details

### 3.1 Custom AI Agent (Your Differentiation)

This is where your enterprise-cli-v1 expertise comes in.

```python
# Core AI Agent Structure (Claude Code Style)
class EnterpriseAIAgent:
    def __init__(self):
        self.llm = LLMGateway()  # Connect to Claude/OpenAI/etc.
        self.tool_registry = ToolRegistry()
        self.state_manager = StateManager()
        self.memory = MemoryManager()
    
    async def process_request(self, user_request: str, context: dict) -> str:
        # 1. Load context (conversation history, user info)
        messages = self.memory.get_context(context)
        
        # 2. Add user request
        messages.add(user_request)
        
        # 3. Get available tools for this user/team
        tools = self.tool_registry.get_allowed_tools(
            user=context['user_id'],
            team=context['team_id']
        )
        
        # 4. Call LLM with tools
        response = await self.llm.chat(messages, tools=tools)
        
        # 5. Execute tool calls if needed
        while response.has_tool_calls():
            for tool_call in response.tool_calls:
                result = await self.execute_tool(tool_call)
                messages.add_tool_result(tool_call.id, result)
                response = await self.llm.continue_chat(messages)
        
        # 6. Log execution for audit
        await self.audit_log(context, user_request, response)
        
        return response.content
```

### 3.2 Tool Interface Layer

Standardized API between your AI Agent and n8n:

```python
# Tool Interface - Connects AI Agent to n8n
class ToolInterface:
    def __init__(self, n8n_base_url: str):
        self.n8n = n8n_base_url
    
    async def execute_tool(self, tool_name: str, params: dict) -> dict:
        """Execute tool via n8n webhook"""
        
        # Map tool name to n8n webhook
        webhook_url = self.get_webhook_url(tool_name)
        
        # Call n8n
        response = await httpx.post(
            webhook_url,
            json=params,
            headers={"Authorization": f"Bearer {self.get_token()}"}
        )
        
        return response.json()
    
    def get_webhook_url(self, tool_name: str) -> str:
        """Map AI tool names to n8n webhooks"""
        tool_mapping = {
            "send_slack_message": f"{self.n8n}/webhook/slack-message",
            "create_jira_ticket": f"{self.n8n}/webhook/jira-create",
            "query_database": f"{self.n8n}/webhook/db-query",
            "send_email": f"{self.n8n}/webhook/email-send",
            # ... more mappings
        }
        return tool_mapping.get(tool_name)
```

### 3.3 Governance Service

```python
# Governance - RBAC, Approvals, Budgets
class GovernanceService:
    async def check_permission(self, user_id: str, action: str, tool: str) -> bool:
        """Check if user can perform action with tool"""
        
        user = await self.get_user(user_id)
        team = await self.get_team(user.team_id)
        
        # Check RBAC
        if not self.has_permission(user.role, action, tool):
            return False
        
        # Check tool approval status
        tool_config = await self.get_tool_config(tool)
        if tool_config.requires_approval and not tool_config.is_approved:
            return False
        
        # Check budget
        if tool_config.has_budget_limit:
            remaining = await self.get_budget_remaining(user.team_id, tool)
            if remaining <= 0:
                return False
        
        return True
    
    async def request_approval(self, agent_config: dict) -> str:
        """Submit agent for approval"""
        approval = ApprovalRequest(
            agent_config=agent_config,
            requested_by=agent_config['owner'],
            status="pending"
        )
        return await self.save(approval)
```

---

## 4. n8n Integration Patterns

### 4.1 AI Agent Node in n8n

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    n8n AI Agent Node Configuration                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Node: AI Agent (Custom)                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Parameters:                                                          │   │
│  │  ├── Model: GPT-4o / Claude Sonnet 4                                 │   │
│  │  ├── System Prompt: "You are an enterprise assistant..."            │   │
│  │  ├── Tools:                                                           │   │
│  │  │   ├── search_knowledge_base                                        │   │
│  │  │   ├── create_jira_ticket                                           │   │
│  │  │   ├── send_slack_message                                          │   │
│  │  │   └── query_database                                               │   │
│  │  ├── Max Iterations: 10                                               │   │
│  │  ├── Temperature: 0.7                                                │   │
│  │  └── Memory: ConversationBuffer                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Webhook Patterns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      n8n Webhook Endpoints                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  POST /webhook/slack-message                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Input:                                                               │   │
│  │  {                                                                    │   │
│  │    "channel": "support",                                             │   │
│  │    "message": "Ticket #123 has been resolved"                        │   │
│  │  }                                                                    │   │
│  │                                                                         │   │
│  │  Nodes: Slack → Send Message                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  POST /webhook/jira-create                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Input:                                                               │   │
│  │  {                                                                    │   │
│  │    "project": "IT",                                                  │   │
│  │    "summary": "Server down",                                         │   │
│  │    "priority": "High"                                                │   │
│  │  }                                                                    │   │
│  │                                                                         │   │
│  │  Nodes: Jira → Create Issue                                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  POST /webhook/db-query                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Input:                                                               │   │
│  │  {                                                                    │   │
│  │    "query": "SELECT * FROM users WHERE..."                          │   │
│  │  }                                                                    │   │
│  │                                                                         │   │
│  │  Nodes: PostgreSQL → Execute Query → Format Output                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         ┌─────────────────────┐                             │
│                         │   Load Balancer     │                             │
│                         │   (AWS ALB / Kong)  │                             │
│                         └──────────┬──────────┘                             │
│                                    │                                        │
│         ┌─────────────────────────┼─────────────────────────┐             │
│         │                         │                         │             │
│         ▼                         ▼                         ▼             │
│  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐       │
│  │  API Server   │        │  API Server   │        │  API Server  │       │
│  │  (Custom AI) │        │  (Custom AI) │        │  (Custom AI) │       │
│  │               │        │               │        │               │       │
│  │  - Agent API  │        │  - Agent API  │        │  - Agent API  │       │
│  │  - Governance │        │  - Governance │        │  - Governance │       │
│  └───────┬───────┘        └───────┬───────┘        └───────┬───────┘       │
│          │                        │                        │               │
│          └────────────────────────┼────────────────────────┘               │
│                                   │                                        │
│                                   ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                        n8n Cluster                               │      │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │      │
│  │  │  n8n Worker  │  │  n8n Worker   │  │  n8n Worker  │        │      │
│  │  │  (Docker)    │  │  (Docker)    │  │  (Docker)    │        │      │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │      │
│  │         │                  │                  │                 │      │
│  │         └──────────────────┼──────────────────┘                 │      │
│  │                            ▼                                    │      │
│  │                   ┌──────────────┐                             │      │
│  │                   │  Redis Queue  │                             │      │
│  │                   └──────────────┘                             │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                   │                                        │
│                                   ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                      DATA LAYER                                   │      │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │      │
│  │  │ PostgreSQL   │  │   Redis      │  │   S3/MinIO  │         │      │
│  │  │ (Metadata)   │  │ (Cache/Queue)│  │ (Logs/Artif)│         │      │
│  │  └──────────────┘  └──────────────┘  └──────────────┘         │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         IDENTITY & ACCESS                             │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐   │   │
│  │  │ Azure AD /    │  │ RBAC          │  │ API Keys               │   │   │
│  │  │ Okta (SSO)    │  │ - Admin       │  │ - Per-team keys       │   │   │
│  │  │               │  │ - Builder     │  │ - Per-agent keys      │   │   │
│  │  │               │  │ - User        │  │ - Expiry rotation     │   │   │
│  │  └────────────────┘  └────────────────┘  └────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         TOOL ACCESS CONTROL                          │   │
│  │  ┌────────────────────────────────────────────────────────────────┐    │   │
│  │  │  Tool Registry with Approval Gates                          │    │   │
│  │  │  ┌────────────────────────────────────────────────────────┐  │    │   │
│  │  │  │ Tool          │ Risk Level │ Requires Approval │ Team  │  │    │   │
│  │  │  │───────────────│────────────│───────────────────│───────│  │    │   │
│  │  │  │ slack_message│ Low        │ No                │ All   │  │    │   │
│  │  │  │ jira_create  │ Medium     │ Yes               │ IT    │  │    │   │
│  │  │  │ db_query     │ High       │ Yes               │ Data  │  │    │   │
│  │  │  │ send_email   │ Medium     │ Yes               │ Comms │  │    │   │
│  │  │  └────────────────────────────────────────────────────────┘  │    │   │
│  │  └────────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         AUDIT & COMPLIANCE                           │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │  All tool executions logged with:                               │   │   │
│  │  │  - Who (user_id, team)                                         │   │   │
│  │  │  - What (tool name, params)                                    │   │   │
│  │  │  - When (timestamp)                                            │   │   │
│  │  │  - Result (success/failure, output summary)                   │   │   │
│  │  │  - Cost (API tokens used)                                      │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation (4-6 weeks)

| Week | Deliverable |
|------|-------------|
| 1-2 | Deploy n8n with enterprise plugins |
| 3-4 | Build custom AI Agent core (from enterprise-cli-v1) |
| 5-6 | Integrate AI Agent with n8n webhooks |

**Deliverables:**
- n8n cluster running
- Basic AI Agent that can call n8n webhooks
- 5 core tools working

### Phase 2: Agent Builder UI (4-6 weeks)

| Week | Deliverable |
|------|-------------|
| 7-8 | No-code Agent Builder UI |
| 9-10 | Workflow visualization (React Flow) |
| 11-12 | User testing with pilot team |

**Deliverables:**
- Non-technical users can create agents
- Visual workflow preview
- Basic analytics dashboard

### Phase 3: Enterprise Features (6-8 weeks)

| Week | Deliverable |
|------|-------------|
| 13-14 | RBAC and approval workflows |
| 15-16 | Audit logging and compliance reports |
| 17-18 | SSO integration (Azure AD/Okta) |

**Deliverables:**
- Full governance layer
- Compliance-ready audit logs
- Enterprise SSO

### Phase 4: Scale (Ongoing)

- Multi-region deployment
- Advanced analytics
- Custom tool builder for power users

---

## 8. Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **AI Agent** | enterprise-cli-v1 / LangChain | Reasoning & orchestration |
| **Workflow Engine** | n8n | Visual automation & 500+ connectors |
| **API Gateway** | Kong | Auth, rate limiting, routing |
| **Database** | PostgreSQL | Metadata, audit logs |
| **Cache/Queue** | Redis | Session state, job queue |
| **Storage** | S3/MinIO | Logs, artifacts |
| **Monitoring** | Prometheus + Grafana | Observability |
| **Deployment** | Kubernetes | Scaling & resilience |

---

## 9. Cost Estimation

| Component | Self-Hosted (Annual) | Managed Service |
|-----------|---------------------|------------------|
| n8n (Enterprise) | ~$10K (support) | ~$20K/year |
| AI/LLM (API costs) | $5K-50K/month | Same |
| Infrastructure | $5K-20K/month | N/A |
| Development | 2-4 engineers | Same |

---

## 10. Key Success Metrics

| Metric | Target |
|--------|--------|
| Agents created (Phase 1) | 10+ |
| Active users (Phase 2) | 50+ |
| Time to create new agent | <30 minutes |
| Tool execution success rate | >95% |
| Average response time | <3 seconds |

---

*Document Version: 1.0*
*Last Updated: April 2026*
*Related: [Enterprise CLI](https://github.com/yayalingo/enterprise-cli-v1), [n8n](https://n8n.io/), [LangGraph](https://langchain.com/langgraph/)*
