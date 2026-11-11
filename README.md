# critter-hud

A Claude Code mod that gives you a little pixel critter in a transparent side pane. It acts out whatever Claude is doing, and gives every subagent its own mini critter.

## What it shows

- **The critter** reads, types, runs commands, searches, thinks, celebrates when a turn finishes, shakes when a tool fails and naps when you're away. A speech bubble says what it's doing right now ("Reading auth.ts").
- **Subagents** each get a mini critter in their model's colour (Sonnet purple, Haiku teal, Opus coral) that acts out its own tool calls, with a progress shimmer, tool count and time. You get a toast when one starts or finishes.
- **Plan progress**: a bar that follows Claude Code's to-do list and the desktop app's task list.
- **Stats strip**: context and usage-limit bars that turn amber then red, session cost, and tool calls this turn.
- **Mood across sessions**: it remembers how many tasks you've finished together.

In the desktop app it's an animated drawing in a side pane titled Critter, with no background of its own, so it floats over the app. If the app can't place the pane, it draws in the band above the prompt instead. In the terminal it's a text face above the prompt, like `(o_o) [≡]` while reading.

`/critter` hides or shows it. Closing the pane hides it too.

## Install

At the prompt of a terminal session:

```
/plugin install critter-hud --marketplace jrsnleons/claude-critter
```

From a shell:

```
claude plugin install critter-hud --marketplace jrsnleons/claude-critter
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `jrsnleons/claude-critter`, then Add plugin.

Needs Claude Code 2.1.321 or newer.
