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
- **MinIO Console**: [http://localhost:9001](http://localhost:9001)
- **Documentation**: [http://localhost:4000](http://localhost:4000)

> [!NOTE]
> See [../docs/development/getting-started.md](../docs/development/getting-started.md) for detailed setup instructions.

## 🛠️ Development Workflow

### API Interaction

**IMPORTANT**: All API calls to the backend must include the `kleinkram-client-version` header matching the current app version (e.g., `0.56.0`).

```typescript
headers: {
    'kleinkram-client-version': '0.56.0', // Replace with actual version from package.json
    ...
}
```

### Formatting & Linting

Run these commands before submitting changes:

```bash
# Format Python code
black .

# Format TypeScript/JavaScript/JSON/Markdown
yarn run prettier

# Run Linting
yarn run eslint-full:quiet
```

### Testing

**Backend Tests:**

```bash
# Run all tests
yarn test

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
