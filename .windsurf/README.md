# Windsurf Configuration

This directory contains Windsurf-specific configurations to enhance your AI IDE and development experience.

## Directory Structure

```
.windsurf/
├── workflows/           # Automated workflows for common tasks
│   ├── setup.md        # New feature setup workflow
│   ├── deploy.md       # Deployment workflow
│   ├── test.md         # Comprehensive testing workflow
│   └── migrate.md      # Database migration workflow
└── agents/             # Specialized AI agents
    ├── testing-agent.md      # Testing specialist
    ├── migration-agent.md    # Database migration specialist
    ├── performance-agent.md  # Performance optimization specialist
    ├── security-agent.md     # Security specialist
    └── documentation-agent.md # Documentation specialist
```

## Workflows

### Available Workflows

- **`/setup`** - Bootstrap new features with proper structure
- **`/deploy`** - Deploy application with comprehensive checks
- **`/test`** - Run comprehensive testing workflows
- **`/migrate`** - Handle database migrations safely

### Using Workflows

In your IDE, simply type the workflow command (e.g., `/setup`) and Windsurf will execute the corresponding workflow with AI guidance.

## Agents

### Specialized Agents

- **Testing Agent** - Comprehensive testing workflows and test writing
- **Migration Agent** - Database migration planning and execution
- **Performance Agent** - Performance optimization and monitoring
- **Security Agent** - Security audits and vulnerability management
- **Documentation Agent** - Documentation creation and maintenance

### Agent Triggers

Agents are automatically triggered based on keywords in your requests:
- "test", "testing", "spec", "coverage", "e2e" → Testing Agent
- "migration", "migrate", "database", "schema", "drizzle" → Migration Agent
- "performance", "optimize", "slow", "memory", "bundle", "load" → Performance Agent
- "security", "vulnerability", "auth", "audit" → Security Agent
- "documentation", "docs", "readme", "guide", "api docs" → Documentation Agent

## Enhanced Features

### Claude Settings

Enhanced `.claude/settings.local.json` with:
- Expanded permissions for filesystem, git, browser, memory, and sequential thinking tools
- Workflow automation settings
- Parallel execution enabled
- AI feature toggles for code generation, refactoring, documentation, testing, and debugging

### VS Code Integration

Complete VS Code setup with:
- Auto-format on save with Prettier
- ESLint integration with auto-fix
- TypeScript import organization
- Tailwind CSS support
- Debug configurations for frontend and backend
- Task configurations for common development commands
- Extension recommendations for optimal development experience

### Git Hooks

Automated quality checks:
- **Pre-commit hook**: Linting, formatting, TypeScript compilation, and basic tests
- **Pre-push hook**: Comprehensive test suites, security audits, build verification

## Getting Started

1. **Install VS Code extensions** from `.vscode/extensions.json`
2. **Enable Git hooks** (already configured and executable)
3. **Use workflows** by typing `/setup`, `/deploy`, `/test`, or `/migrate`
4. **Interact with agents** by using trigger keywords in your requests

## Benefits

- **Faster development** with automated workflows
- **Better code quality** with automated checks
- **Specialized assistance** from domain-specific agents
- **Consistent patterns** across the codebase
- **Enhanced productivity** with AI-powered automation

## Customization

You can:
- Add new workflows in `.windsurf/workflows/`
- Create custom agents in `.windsurf/agents/`
- Modify Claude settings for your preferences
- Adjust VS Code settings for your workflow
- Customize git hooks for your quality standards

For more information, refer to the individual workflow and agent documentation files.