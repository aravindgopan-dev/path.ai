# Path.AI Agents Workflow Documentation

## Agent Module Overview

The agents module in `/agents/app/agents/` contains 12 specialized agents that work together in a coordinated workflow to guide users through project planning, skill assessment, and code generation.

---

## AGENTS IN WORKFLOW ORDER

### PHASE 1: PROJECT PLANNING & ANALYSIS

#### 1. **Architect Agent** (`architect_agent.py`)
- **Purpose**: Analyzes raw project ideas and generates structured project analysis
- **Input**:
  - `project_idea` (str): Raw user project description
- **Output**:
  - `project_summary` (str): Structured project summary
  - `suggested_features` (list): Array of feature objects with `{id, name, description}`
  - `recommended_tech_stack` (list): Array of recommended technologies
- **LLM Temperature**: 0.3 (deterministic)
- **Triggered By**: **Architect Page** (Frontend Route: `/architect`)
  - API Endpoint: `POST /architect`
  - Triggered when user submits project idea
- **Graph**: `architect_graph`

---

### PHASE 2: PROJECT BLUEPRINT GENERATION

#### 2. **Blueprint Builder Agent** (`blueprint_builder.py`)
- **Purpose**: Generates detailed project blueprint from selected features
- **Input**:
  - `project_summary` (str): Summary from Architect
  - `selected_features` (list): User-selected features
  - `recommended_tech_stack` (list): Tech stack from Architect
  - `user_level` (str): "beginner" | "intermediate" | "pro"
- **Output**:
  - `blueprint` (dict): Comprehensive blueprint containing:
    - `project_id` (str)
    - `name` (str)
    - `description` (str)
    - `difficulty_target` (str)
    - `tech_stack` (list)
    - `features` (list)
    - `entities` (list): Data models with fields
    - `api_contract` (list): API routes with method/path/description
    - `file_structure_plan` (list): Planned file structure
    - `learning_objectives` (list)
    - `non_functional_requirements` (dict)
- **LLM Temperature**: 0.2 (very deterministic)
- **Triggered By**: **Architect Page** (Frontend Route: `/architect`)
  - API Endpoint: `POST /blueprint`
  - Triggered when user confirms feature selection
- **Graph**: `blueprint_graph`

---

### PHASE 3: SKILL ASSESSMENT

#### 3. **Skill Agent** (`skill_agent.py`)
- **Purpose**: Assesses required conceptual skills for the project
- **Input**:
  - `blueprint` (dict): Blueprint from Blueprint Builder
  - `user_level` (str): User's selected skill level
- **Output**:
  - `suggested_skills` (list): Array of skill objects with `{id, name, description}`
- **LLM Temperature**: 0.3
- **Triggered By**: **Skill Level Page** (Frontend Route: `/skill-level`)
  - API Endpoint: `POST /skills`
  - Triggered when user selects skill level
- **Graph**: `skill_graph`

---

### PHASE 4: ROADMAP GENERATION

#### 4. **Roadmap Agent** (`roadmap_agent.py`)
- **Purpose**: Builds progressive, level-based learning roadmap with file tree
- **Input**:
  - `blueprint` (dict): Blueprint from Blueprint Builder
  - `user_level` (str): User's skill level
  - `suggested_skills` (list): Skills from Skill Agent
- **Output**:
  - `roadmap` (list): Array of roadmap nodes with:
    - `id`, `title`, `type` (coding|learning|setup), `description`
    - `dependencies`, `order_index`, `completed`, `locked`
  - `file_tree` (list): Project file structure with:
    - `path`, `type` (file|folder), `children`, `linked_nodes`
- **LLM Temperature**: 0.3
- **Triggered By**: **Skill Level Page** (Frontend Route: `/skill-level`)
  - API Endpoint: `POST /roadmap`
  - Triggered when user selects skills and confirms
- **Graph**: `roadmap_graph`

---

### PHASE 5: NODE-SPECIFIC SUPPORT

#### 5. **Expected Spec Agent** (`expected_spec_agent.py`)
- **Purpose**: Generates structural spec for validation (not full code)
- **Input**:
  - `blueprint` (dict): Project blueprint
  - `node` (dict): Current roadmap node
  - `user_level` (str): User's skill level
  - `context` (str): Optional additional context
- **Output**:
  - `expected_spec` (dict): Structural specification containing:
    - `required_routes` (list)
    - `required_functions` (list)
    - `required_imports` (list)
    - `expected_files` (list)
    - `validation_rules` (list)
- **LLM Temperature**: 0.2 (deterministic, strict)
- **Triggered By**: **Pair Programmer Page** (Frontend Route: `/pair-programmer`)
  - API Endpoint: `POST /node/{node_id}/regenerate-spec`
  - Called on-demand when user needs validation spec
- **Used For**: Validation against user code

---

#### 6. **Skeleton Agent** (`skeleton_agent.py`)
- **Purpose**: Generates file scaffolds or help guidance
- **Input**:
  - `blueprint` (dict): Project blueprint
  - `node` (dict): Current roadmap node
  - `user_level` (str): User's skill level
  - `mode` (str): "free" | "help"
    - "free": Minimal file creation only
    - "help": 50% code scaffold with TODO markers
  - `user_code` (str): Existing user code (optional)
- **Output**:
  - `skeleton` (dict): Scaffold containing:
    - `files` (list): Array of `{filename, content}`
    - `explanation` (str)
    - `next_steps` (list)
- **LLM Temperature**: 0.3
- **Triggered By**: **Pair Programmer Page** (Frontend Route: `/pair-programmer`)
  - API Endpoints:
    - `POST /node/{node_id}/skeleton` (mode="free")
    - `POST /node/{node_id}/help` (mode="help")
  - User requests skeleton or help
- **Caching**: Results cached at node level to avoid regeneration

---

#### 7. **Documentation Agent** (`documentation_agent.py`)
- **Purpose**: Generates algorithmic explanations and learning documentation
- **Input**:
  - `blueprint` (dict): Project blueprint
  - `node` (dict): Current roadmap node
  - `user_level` (str): User's skill level
  - `context` (str): Optional additional context
- **Output**:
  - `documentation` (dict): Comprehensive documentation containing:
    - `title` (str)
    - `explanation` (str): Main concept explanation
    - `objective` (str): Node objective
    - `algorithm_steps` (list): Step-by-step algorithm
    - `setup_commands` (list): For setup nodes
    - `constraints` (list): Limitations/considerations
    - `learning_focus` (list): Key learning outcomes
    - `common_mistakes` (list): Common pitfalls
    - `implementation_strategy` (list): How to approach
    - `files_involved` (list): Related files
- **LLM Temperature**: 0.3
- **Triggered By**: 
  - **Learn Page** (Frontend Route: `/learn`)
    - API Endpoint: `GET /node/{node_id}/documentation`
  - **Setup Page** (Frontend Route: `/setup`)
    - API Endpoint (same): `GET /node/{node_id}/documentation`
  - Both use same Documentation Agent for learning/setup nodes

---

#### 8. **Validator Agent** (`validator_agent.py`)
- **Purpose**: AI-driven structural and logical validation of user code
- **Input**:
  - `blueprint` (dict): Project blueprint
  - `node` (dict): Current roadmap node
  - `user_files` (list): User-submitted files `[{filename, content}]`
  - `expected_spec` (dict): Expected spec from Expected Spec Agent
  - `node_objective` (str): Node's specific goal
- **Output**:
  - `validation_result` (dict): Validation containing:
    - `status` (str): "pass" | "fail"
    - `missing_items` (list): Missing implementations
    - `notes` (list): Validation notes
    - `score` (int): Validation score
- **LLM Temperature**: 0.1 (very strict grading)
- **Triggered By**: **Pair Programmer Page** (Frontend Route: `/pair-programmer`)
  - API Endpoint: `POST /node/{node_id}/validate`
  - User submits code for validation
- **Dependencies**: Uses output from Expected Spec Agent

---

#### 9. **Feedback Agent** (`feedback_agent.py`)
- **Purpose**: Converts validation results into human-friendly feedback
- **Input**:
  - `validation_result` (dict): Output from Validator Agent
  - `user_code_summary` (str): Summary of user's code
  - `expected_spec` (dict): Expected specification
  - `node_objective` (str): Node's specific goal
- **Output**:
  - `feedback` (dict): Human-friendly feedback containing:
    - `summary` (str): Overall feedback summary
    - `strengths` (list): What user did well
    - `improvements` (list): Areas for improvement
    - `resources` (list): Learning resources
    - `next_steps` (list): Recommended next actions
- **LLM Temperature**: 0.4 (balanced, encouraging tone)
- **Triggered By**: **Pair Programmer Page** (Frontend Route: `/pair-programmer`)
  - Called automatically after validation
  - Displayed in validation results panel
- **Dependencies**: Uses output from Validator Agent

---

#### 10. **Chat Agent** (`chat_agent.py`)
- **Purpose**: Node-scoped conversational assistant for current node only
- **Input**:
  - `blueprint_summary` (str): Blueprint context (truncated to 2000 chars)
  - `node_objective` (str): Current node's objective
  - `user_code` (str): User's code context (truncated to 3000 chars)
  - `history` (list): Chat history (last 5 messages)
    - Format: `[{role: "user"|"assistant", content: str}]`
  - `message` (str): User's chat message
- **Output**:
  - `response` (dict): Chat response containing:
    - `response` (str): Assistant's response message
- **LLM Temperature**: 0.5 (balanced, conversational)
- **Triggered By**: **Pair Programmer Page** (Frontend Route: `/pair-programmer`)
  - API Endpoint: `POST /node/{node_id}/chat`
  - User sends chat messages in chat panel
- **Scope**: Limited to current node context only

---

### PHASE 6: SUPPORTING AGENTS (Optional)

#### 11. **File Tree Agent** (`file_tree_agent.py`)
- **Purpose**: Generates project file tree linked to roadmap nodes
- **Input**:
  - `blueprint` (dict): Project blueprint
  - `levels` (list): Roadmap levels with nodes
- **Output**:
  - `file_tree` (list): File tree structure with:
    - `path`, `type` (file|folder), `children`, `linked_nodes`
- **LLM Temperature**: 0.2 (deterministic)
- **Usage**: Internal - used during Roadmap Agent execution
- **Note**: Output is now integrated into Roadmap Agent output

---

#### 12. **Instruction/Node Documentation**
- **Handled By**: Documentation Agent
- **Note**: Generic documentation generation for all node types

---

## AGENT DEPENDENCY GRAPH

```
User Input (Project Idea)
         ↓
    [1] Architect Agent → project_summary, features, tech_stack
         ↓
    [2] Blueprint Builder → blueprint
    ↙         ↓         ↘
[3] Skill Agent  [4] Roadmap Agent ← [File Tree integration]
    ↓                    ↓
  skills         roadmap + file_tree
    ↑                    ↓
    └──────────────────→ Database Storage & UI Display
                        ↓
            User navigates Roadmap (RoadmapPage)
                        ↓
Upon selecting node:  ↙  ↓  ↘
    [7] Documentation   [5] Expected Spec   [6] Skeleton
         ↓                    ↓                  ↓
    (Learn/Setup)    (Validation basis)  (Code scaffold)
                           ↓
                    [8] Validator Agent
                           ↓
                    [9] Feedback Agent
                
    [10] Chat Agent (anytime, scoped to node)
```

---

## FRONTEND ROUTES & AGENT TRIGGERING

### Route Mapping

| Frontend Route | Page Component | Agents Triggered | Purpose |
|---|---|---|---|
| `/` | Dashboard | None | Shows active projects, project list |
| `/architect` | Architect | 1. Architect<br>2. Blueprint Builder | Project idea analysis and blueprint generation |
| `/skill-level` | Skill Level | 3. Skill Agent<br>4. Roadmap Agent | Level selection, skill assessment, roadmap generation |
| `/roadmap` | Roadmap | None (displays data) | Visual roadmap display, node selection |
| `/pair-programmer` | Pair Programmer | 5. Expected Spec<br>6. Skeleton<br>8. Validator<br>9. Feedback<br>10. Chat | Interactive coding with assistance |
| `/learn?id={nodeId}` | Learn | 7. Documentation Agent | Learning module display |
| `/setup?id={nodeId}` | Setup | 7. Documentation Agent | Setup instructions with terminal |
| `/designer` | Designer | None (WebSocket to sandbox) | File tree visualization, sandbox project creation |
| `/tutor` | Tutor | (Stub) | Placeholder for future tutor feature |

---

## API ENDPOINTS & AGENT ROUTING

### Backend Routes (Backend: `agents/app/routers/`)

#### Architect Router (`/routers/architect.py`)
| Endpoint | Method | Agent(s) | Input | Output |
|---|---|---|---|---|
| `/architect` | POST | Architect Agent | `{idea: str}` | `{project_summary, features, tech_stack}` |

#### Blueprint Router (`/routers/blueprint.py`)
| Endpoint | Method | Agent(s) | Input | Output |
|---|---|---|---|---|
| `/blueprint` | POST | Blueprint Builder | `{project_summary, selected_features, tech_stack, user_level}` | `{blueprint}` |

#### Skills Router (`/routers/skills.py`)
| Endpoint | Method | Agent(s) | Input | Output |
|---|---|---|---|---|
| `/skills` | POST | Skill Agent | `{blueprint, user_level}` | `{skills}` |

#### Roadmap Router (`/routers/roadmap.py`)
| Endpoint | Method | Agent(s) | Input | Output |
|---|---|---|---|---|
| `/roadmap` | POST | Roadmap Agent | `{blueprint, user_level, suggested_skills}` | `{roadmap, project_id, file_tree}` |
| `/project/{projectId}/roadmap-levels` | GET | None | Query param | `{levels, project_id}` |
| `/project/{projectId}/file-tree` | GET | None | Query param | `{file_tree, progress}` |
| `/node/{nodeId}/complete` | POST | None | Body: `{}` | `{completed, node_id, level_completed}` |

#### Coding Router (`/routers/coding.py`)
| Endpoint | Method | Agent(s) | Input | Output |
|---|---|---|---|---|
| `/node/{nodeId}/instruction` | POST | Documentation | `{user_level}` | `{instruction}` |
| `/node/{nodeId}/skeleton` | POST | Skeleton (free mode) | `{user_level, mode}` | `{skeleton}` |
| `/node/{nodeId}/help` | POST | Skeleton (help mode) | `{user_level, files}` | `{skeleton}` |
| `/node/{nodeId}/validate` | POST | Validator → Feedback | `{files}` | `{validation, feedback}` |
| `/node/{nodeId}/chat` | POST | Chat Agent | `{message, history, user_code}` | `{response}` |
| `/node/{nodeId}/regenerate-spec` | POST | Expected Spec | `{user_level}` | `{expected_spec}` |
| `/node/{nodeId}/documentation` | GET | Documentation | Query param | `{documentation}` |

---

## FRONTEND API CLIENT FUNCTIONS

All API calls are abstracted in `/client/lib/agents-api.ts`:

```typescript
// Phase 1-2: Planning
analyseIdea(idea, token) → ArchitectResult
generateBlueprint(params, token) → {blueprint}

// Phase 3-4: Assessment & Roadmap
assessSkills(params, token) → {skills}
generateRoadmap(params, token) → {roadmap, project_id, file_tree}
getFlatRoadmap(projectId, token) → {roadmap, project_id}
getRoadmapLevels(projectId, token) → {levels, project_id}
getFileTree(projectId, token) → {file_tree, progress}

// Phase 5: Node Operations
getInstruction(nodeId, userLevel, token) → {instruction}
getSkeleton(nodeId, userLevel, mode, token) → {skeleton}
getHelp(nodeId, files, userLevel, token) → {skeleton}
validateNode(nodeId, files, token) → {validation, feedback}
chatNode(nodeId, message, history, userCode, token) → {response}
regenerateSpec(nodeId, userLevel, token) → {expected_spec}
getDocumentation(nodeId, token) → {documentation}
completeNode(nodeId, token) → {completed}
```

---

## DATA FLOW THROUGH STATE

The `ProjectState` (in `app/state.py`) maintains:

```python
{
    # From Architect
    "project_idea": str,
    "project_summary": str,
    "suggested_features": list,
    "recommended_tech_stack": list,
    
    # Selected by User
    "selected_features": list,
    "user_level": str,  # "beginner" | "intermediate" | "pro"
    
    # From Blueprint
    "blueprint": dict,
    
    # From Skills
    "suggested_skills": list,
    
    # From Roadmap
    "roadmap": list,
    "file_tree": list,
}
```

---

## CACHING STRATEGY

- **Instruction Cache**: Cached per node at DB level
- **Skeleton Cache**: Cached per node at DB level
- **Validation Results**: Not cached (generated on-demand)
- **Documentation**: Cached per node at DB level

---

## SUMMARY: WORKFLOW SEQUENCE

1. **Architect Page** (`/architect`)
   - User inputs project idea
   - Architect Agent analyzes → features + tech stack
   - Blueprint Builder generates project blueprint
   - User confirms feature selection

2. **Skill Level Page** (`/skill-level`)
   - User selects skill level
   - Skill Agent determines required skills
   - Roadmap Agent builds progressive learning path

3. **Roadmap Page** (`/roadmap`)
   - Displays interactive roadmap with levels/nodes
   - User selects node to work on

4. **Learn Page** (`/learn?id={nodeId}`)
   - Documentation Agent generates learning material
   - User reviews concepts and marks complete

5. **Setup Page** (`/setup?id={nodeId}`)
   - Documentation Agent provides setup commands
   - User runs terminal commands to set up environment

6. **Pair Programmer Page** (`/pair-programmer`)
   - Show instruction (Documentation Agent)
   - User writes code
   - User requests skeleton (Skeleton Agent)
   - User submits for validation (Validator → Feedback Agents)
   - User chats with assistant (Chat Agent)

7. **Designer Page** (`/designer`)
   - File tree visualization
   - WebSocket communication with sandbox
   - Project structure preview

---

## NOTES

- All agents use async/await with LangChain's structured output
- Temperatures are carefully tuned: 0.1 (strict) to 0.5 (creative)
- All API endpoints require authentication (Bearer token)
- Database persistence for projects, nodes, and cached results
- File-specific JSON schemas for structured LLM outputs (via Pydantic)
