# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in chat, and the AI generates React code in a virtual file system, displaying it in real-time with hot reload. The application requires a valid Anthropic API key to function.

## Key Commands

### Setup
```bash
npm run setup          # Install dependencies, generate Prisma client, run migrations
```

### Development
```bash
npm run dev            # Start dev server with Turbopack
npm run dev:daemon     # Start dev server in background, logs to logs.txt
```

### Testing
```bash
npm test               # Run all tests with Vitest
```

### Database
```bash
npx prisma generate    # Generate Prisma client (outputs to src/generated/prisma)
npx prisma migrate dev # Run database migrations
npm run db:reset       # Reset database (force reset all migrations)
```

### Build & Deploy
```bash
npm run build          # Build for production
npm start              # Start production server
npm run lint           # Run ESLint
```

## Architecture

### Core Data Flow

1. **Chat API Route** (`src/app/api/chat/route.ts`):
   - Validates ANTHROPIC_API_KEY is present before processing
   - Receives messages and virtual file system state from client
   - Adds system prompt with AI instructions for component generation
   - Uses Vercel AI SDK's `streamText` with Claude
   - Provides two AI tools: `str_replace_editor` and `file_manager`
   - Streams responses back to client with tool calls
   - Returns error responses to client if API key is missing or API calls fail
   - Saves conversation and file state to database on completion (for authenticated users)

2. **Virtual File System** (`src/lib/file-system.ts`):
   - In-memory file system (no files written to disk during generation)
   - Implements standard FS operations: create, read, update, delete, rename
   - Supports text-editor-style commands: view, create, str_replace, insert
   - Serializes/deserializes to/from JSON for persistence and API transport
   - Root directory is `/` with normalized paths

3. **Client-Side Contexts**:
   - **FileSystemContext** (`src/lib/contexts/file-system-context.tsx`): Manages virtual FS state on client, handles tool call updates, syncs with UI
   - **ChatContext** (`src/lib/contexts/chat-context.tsx`): Manages chat state, sends messages to API, processes streaming responses, exposes errors to UI

4. **JSX Transformation & Preview** (`src/lib/transform/jsx-transformer.ts`):
   - Transforms JSX/TSX to browser-compatible JavaScript using Babel standalone
   - Creates ES Module import maps with blob URLs for each transformed file
   - Supports `@/` import alias (maps to root `/`)
   - Loads third-party packages from esm.sh
   - Generates HTML preview document with error boundaries
   - Handles CSS imports by collecting and injecting styles

### Authentication System

- JWT-based authentication (`src/lib/auth.ts`)
- Session stored in HTTP-only cookie (`auth-token`)
- 7-day session expiration
- Supports anonymous users (projects with `userId: null`)
- Anonymous usage tracking via `src/lib/anon-work-tracker.ts`

### Database Schema

Prisma with SQLite (`prisma/schema.prisma`):
- **User**: id, email, password (bcrypt hashed), timestamps
- **Project**: id, name, userId (nullable), messages (JSON), data (JSON), timestamps
- Generated Prisma client outputs to `src/generated/prisma/`

### Provider System

`src/lib/provider.ts` exports `getLanguageModel()`:
- Requires `ANTHROPIC_API_KEY` in environment
- Returns Anthropic Claude Haiku 4.5
- Throws an error if API key is not configured

### AI Tools

**str_replace_editor** (`src/lib/tools/str-replace.ts`):
- Commands: `view`, `create`, `str_replace`, `insert`
- Used by AI to manipulate files in virtual FS

**file_manager** (`src/lib/tools/file-manager.ts`):
- Commands: `rename`, `delete`
- Supports moving files (rename with different path)
- Recursively creates parent directories as needed

### App Structure

- **Next.js 15 App Router** with React 19
- Main page: `/` (home with project selection)
- Project page: `/[projectId]` (chat + code editor + preview)
- API route: `/api/chat` (streaming chat endpoint)
- Uses Tailwind CSS v4 with `@tailwindcss/postcss`

### Component Organization

- `src/components/chat/`: Chat interface, message list, markdown rendering
- `src/components/editor/`: Code editor (Monaco), file tree
- `src/components/preview/`: Live preview iframe
- `src/components/auth/`: Sign in/up forms, auth dialog
- `src/components/ui/`: Radix UI primitives (buttons, dialogs, tabs, etc.)

## Important Implementation Details

### Virtual File System

- **Entry Point**: Always `/App.jsx` (AI is instructed to create this first)
- **Import Alias**: All project imports use `@/` prefix (e.g., `@/components/Button`)
- **Path Normalization**: Paths always start with `/`, no trailing slashes except root
- **Serialization**: Directory children maps are flattened to objects for JSON transport

### Preview System

- Preview runs in iframe with sandboxed ES modules
- Babel transforms JSX with automatic React runtime
- Import map dynamically generated from all files in virtual FS
- Tailwind loaded via CDN (`https://cdn.tailwindcss.com`)
- Error boundaries catch runtime errors
- Syntax errors displayed in formatted error UI (prevents preview rendering)

### Testing

- **Framework**: Vitest with jsdom environment
- **Coverage**: File system, chat/editor components, JSX transformer
- Tests located in `__tests__/` directories alongside source

### Environment Variables

- `ANTHROPIC_API_KEY`: **Required**. Get your API key from https://console.anthropic.com/settings/keys
- `JWT_SECRET`: Defaults to `"development-secret-key"` if not set
- Database URL configured in `prisma/schema.prisma` (SQLite at `prisma/dev.db`)

## Common Patterns

### Adding a New AI Tool

1. Create tool builder in `src/lib/tools/`
2. Accept `VirtualFileSystem` instance as parameter
3. Return tool object with `parameters` (Zod schema) and `execute` function
4. Register in `src/app/api/chat/route.ts` tools object
5. Update client-side `handleToolCall` in FileSystemContext if UI sync needed

### Extending the Virtual File System

- Add new methods to `VirtualFileSystem` class
- Maintain path normalization with `normalizePath()`
- Update parent-child relationships when modifying tree structure
- Serialize/deserialize logic may need updates for new metadata

### Modifying AI Behavior

- Edit system prompt in `src/lib/prompts/generation.tsx`
- System prompt uses prompt caching (Anthropic cache control)

### Adding Server Actions

Server actions are in `src/actions/`:
- Export from `src/actions/index.ts`
- Use `"use server"` directive
- Import Prisma client from `src/lib/prisma.ts`
- Check authentication with `getSession()` from `src/lib/auth.ts`
