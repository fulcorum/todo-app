# todo-app

A companion repo for the video series. One small todo app, twice.

```
before/    the starting point — frozen baseline, never edited
after/     the same app, where every change in the series lands
```

Both are dependency-free: Node's stdlib on the server, plain HTML/CSS/JS in the
browser. No build step, nothing to install.

## Running them

They listen on different ports so you can keep both open side by side.

```
node before/server.js     # http://localhost:4321
node after/server.js      # http://localhost:4322
```

Each directory has its own `db.json`, so edits in one never touch the other.

## Seeing the change

`after/` starts as a byte-for-byte copy of `before/` (the port is the only
difference), which makes the diff the whole story:

```
diff -ru before after
```

## The app

Add, complete, and delete todos; filter by list; search; sort; hide or clear
completed. The sidebar shows live per-list counts, the rail shows stats and
what's due soon, and rows are ranked by a computed urgency score.

It works. It is also built the wrong way on purpose — all the domain logic sits
in the browser, the storage schema is exposed as the API, and the DOM doubles
as the state store. `before/README.md` has the full list of what's wrong and
why; that list is the series outline.
