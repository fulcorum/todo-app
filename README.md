# todo-app

A small todo web app. No dependencies, no build step — Node's stdlib on the
server, plain HTML/CSS/JS in the browser.

```
node server.js      # http://localhost:4321
```

## Layout

```
server.js           dumb row store over db.json
db.json             the data
public/index.html   markup
public/style.css    styling
public/app.js       everything else
```

## A note on the code

This project is deliberately built the wrong way. It is a teaching artifact,
not a reference. Known and intentional:

- **All business logic is in the browser.** The urgency score, overdue rules,
  duplicate detection, validation, the stale-bump promotion, ID assignment —
  every one of them lives in `public/app.js`. The server can't answer a single
  question about a todo.
- **The storage schema is the API.** Rows go over the wire verbatim:
  `snake_case` columns, `is_done` as `0`/`1`, epoch-millisecond timestamps, and
  the internal `_rev` / `_file_offset` fields. `GET /api/todos?order_by=` takes
  a raw column name.
- **Writes are a full-table `PUT`.** The client owns the truth and replays all
  of it on every change. `DELETE` takes an array index.
- **The DOM is the state store.** The active filter is a `data-` attribute; the
  stats panel is computed by scraping the rows that were just rendered rather
  than the data behind them.
- **Rows are wired by rendered position.** `toggle(i)` / `removeAt(i)` take the
  index in the visible list, then look the id back up out of the DOM node.
- **Brittle in the small.** `PRI` is a label array indexed by priority number
  so slot 0 is a hole, IDs are `max + 1`, dates are string-sliced and divided
  by `86400000`, sorting mutates the global array, the `localStorage` cache is
  never invalidated, and a 5-second `setInterval` re-renders over whatever you
  were doing.

If you're looking for the seams to pull on, start with `urgency()` — it is the
one piece of real domain logic and it's furthest from the data.
