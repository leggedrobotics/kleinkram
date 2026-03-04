# AI Agent Instructions

This document provides a quick reference for AI agents working on the Kleinkram project. For detailed information, always refer to the official documentation in the `../docs/` directory.

## 🚀 Quick Start (Launch)

To launch the full application stack:

```bash
docker compose up --build --watch -d
```

**Access Points:**

- **API Server**: [http://localhost:3000](http://localhost:3000)
- **Frontend**: [http://localhost:8003](http://localhost:8003)
- **SeaweedFS Dashboard**: [http://localhost:9333](http://localhost:9333)
- **Documentation**: [http://localhost:4000](http://localhost:4000)

> [!NOTE]
> See [../docs/development/getting-started.md](../docs/development/getting-started.md) for detailed setup instructions.

## 🛠️ Development Workflow

### API Interaction

**IMPORTANT**: All API calls to the backend must include the `kleinkram-client-version` header matching the current app version (e.g., `0.56.0`).

```typescript
headers: {
    'kleinkram-client-version': '0.58.0', // Replace with actual version from package.json
    ...
}
```

**Exception:** The `/api/health` endpoint does not require this header.

### Formatting & Linting

Run these commands before submitting changes:

```bash
# Format Python code
black .

# Format TypeScript/JavaScript/JSON/Markdown
pnpm run prettier

# Run Linting
pnpm run eslint-full:quiet
```

### Testing

**Backend Tests:**

```bash
# Run all tests
pnpm test

# Run specific test file
npx jest tests/actions/action-file-events.test.ts --runInBand --detectOpenHandles --forceExit
```

**CLI/Python Tests:**

```bash
# Run pytest (ensure virtualenv is active)
pytest
```

> [!NOTE]
> See [../docs/development/testing/getting-started.md](../docs/development/testing/getting-started.md) for detailed testing guide.

## 📚 Documentation Reference

- **General Setup**: [../docs/development/getting-started.md](../docs/development/getting-started.md)
- **Testing**: [../docs/development/testing/getting-started.md](../docs/development/testing/getting-started.md)
- **Python/CLI**: [../docs/development/python/getting-started.md](../docs/development/python/getting-started.md)

## 🧪 Test Naming Conventions

To ensure consistency and readability, please adhere to the following naming conventions for test files and test cases:

### File Naming

- **Format**: `kebab-case.test.ts`
- **Location**: `tests/<component>/` or `tests/functional/`
- **Examples**:
    - `user-authentication.test.ts`
    - `file-upload.test.ts`
    - `action-execution.test.ts`

### Test Suite Naming (`describe`)

- **Format**: Title Case or Sentence case describing the component or feature under test.
- **Examples**:
    - `describe('User Authentication', ...)`
    - `describe('File Upload Service', ...)`

### Test Case Naming (`test` / `it`)

- **Format**: Should start with a verb (e.g., "should", "if") and describe the expected behavior or scenario.
- **Style**:
    - **"should" style**: `test('should return 200 OK when valid credentials are provided', ...)`
    - **"if" style**: `test('if a user can view details of a submitted action', ...)`
- **Clarity**: Be specific about the condition and the expected result.

### General Rules

- Keep tests focused on a single behavior.
- Use descriptive variable names within tests.
- Clean up resources in `afterEach` or `afterAll` to prevent state leakage.
