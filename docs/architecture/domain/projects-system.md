## Projects System

This document explains what projects are, why they exist, and what they actually do.

---

## What a Project Is

A project is just a named container. It groups chat sessions together so a user can organize their work — separate projects for different clients, campaigns, or content verticals.

There's nothing technically complex here. A project is a name, an optional description, and a `userId`. Every chat session has a required `projectId` foreign key — you can't create a session without putting it in a project.

---

## Why All Chat Sessions Require a Project

Requiring a project enforces organization from the start instead of letting users accumulate a pile of ungrouped sessions they'll never find again. There's no "inbox" or "uncategorized" — everything belongs somewhere.

The tradeoff is that users have to create a project before chatting. In practice, this is one extra step on first use.

---

## How the Project Name Gets Into the AI

The project name isn't just organizational metadata — it's included in the AI's system prompt for every chat message in that session. The context that gets built for each AI request starts with `"Project: <project.name>"`, followed by any reel references or active draft context.

This means the AI understands what you're working toward. "Project: Fitness Supplement Brand Launch Q2" gives the AI meaningful context that shapes its suggestions without the user having to explain it every time.

---

## The Content Hierarchy

Projects sit at the top of a hierarchy that spans most of the app's data:

```
project
  └── chatSession (many)
        └── chatMessage (many)
              └── generatedContent (optional)
```

Generated content links back up through this chain. The queue item for a piece of content can show which chat session (and therefore which project) it came from.

---

## Deleting Projects

You can't delete a project that still has chat sessions — the API returns a 409 conflict. Sessions must be cleaned up first. This prevents accidentally orphaning content that's still in the production pipeline.
