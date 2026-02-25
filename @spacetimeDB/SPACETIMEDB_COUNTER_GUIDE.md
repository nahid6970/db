# SpacetimeDB Counter App - Simple Guide

## Prerequisites
- Install SpacetimeDB CLI: `iwr https://install.spacetimedb.com -useb | iex`
- Install Rust: `scoop install rustup`
- Add WASM target: `rustup target add wasm32-unknown-unknown`

## Option 1: Using Official Template (Easiest)

### 1. Create Project
```powershell
spacetime init --template react-ts counter-app
cd counter-app
```

### 2. Modify the Server Module
Edit `spacetimedb/src/index.ts`:

```typescript
import { schema, table, t } from 'spacetimedb/server';

const spacetimedb = schema({
  counter: table(
    { public: true },
    {
      id: t.u32(),
      value: t.i32(),
    }
  ),
});

export default spacetimedb;

export const init = spacetimedb.init(ctx => {
  ctx.db.counter.insert({ id: 0, value: 0 });
});

export const increment = spacetimedb.reducer(ctx => {
  const counter = ctx.db.counter.id.find(0);
  if (counter) {
    ctx.db.counter.id.update(0, { value: counter.value + 1 });
  }
});

export const decrement = spacetimedb.reducer(ctx => {
  const counter = ctx.db.counter.id.find(0);
  if (counter) {
    ctx.db.counter.id.update(0, { value: counter.value - 1 });
  }
});
```

### 3. Run Development Server
```powershell
spacetime dev
```

This automatically:
- Starts local SpacetimeDB server
- Publishes your module
- Generates TypeScript bindings
- Starts React dev server at http://localhost:5173

### 4. Update React Client
Edit `client/src/App.tsx` to use the counter.

## Option 2: Using Rust (More Control)

### 1. Create Project Structure
```powershell
mkdir counter-app
cd counter-app
mkdir server
```

### 2. Create Server Module

**server/Cargo.toml:**
```toml
[package]
name = "counter"
version = "0.1.0"
edition = "2021"

[dependencies]
spacetimedb = "0.11"

[lib]
crate-type = ["cdylib"]
```

**server/src/lib.rs:**
```rust
use spacetimedb::{table, reducer, ReducerContext};

#[table(public)]
pub struct Counter {
    #[primarykey]
    pub id: u32,
    pub value: i32,
}

#[reducer]
pub fn increment(ctx: &ReducerContext) {
    for mut counter in Counter::iter() {
        counter.value += 1;
        Counter::update_by_id(&counter.id, counter);
    }
}

#[reducer]
pub fn decrement(ctx: &ReducerContext) {
    for mut counter in Counter::iter() {
        counter.value -= 1;
        Counter::update_by_id(&counter.id, counter);
    }
}

#[reducer(init)]
pub fn init() {
    Counter::insert(Counter { id: 0, value: 0 });
}
```

### 3. Publish to Cloud
```powershell
cd server
spacetime publish counter --clear-database
```

Note your database URL (e.g., `counter-xxxxx`)

### 4. Generate Client Bindings
```powershell
cd ..
spacetime generate counter-xxxxx --lang typescript --out-dir ./client-bindings
```

### 5. Create React Client
```powershell
npm create vite@latest client -- --template react-ts
cd client
npm install
npm install spacetimedb
```

Copy the `client-bindings` folder into `client/src/`

### 6. Create Counter Component

**client/src/App.tsx:**
```typescript
import { useEffect, useState } from 'react';
import { DbConnection } from './client-bindings';
import './App.css';

function App() {
  const [count, setCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [conn, setConn] = useState<DbConnection | null>(null);

  useEffect(() => {
    const connection = DbConnection.builder()
      .withUri('wss://maincloud.spacetimedb.com')
      .withModuleName('counter-xxxxx') // Replace with your database name
      .onConnect((conn, identity, token) => {
        console.log('Connected!');
        setConnected(true);
        setConn(conn);
        localStorage.setItem('token', token);
      })
      .build();

    connection.db.counter.onInsert((counter) => {
      setCount(counter.value);
    });

    connection.db.counter.onUpdate((old, updated) => {
      setCount(updated.value);
    });

    return () => connection.disconnect();
  }, []);

  const increment = () => conn?.reducers.increment();
  const decrement = () => conn?.reducers.decrement();

  return (
    <div className="App">
      <h1>Counter: {count}</h1>
      <div>
        <button onClick={decrement} disabled={!connected}>-</button>
        <button onClick={increment} disabled={!connected}>+</button>
      </div>
      <p>{connected ? 'Connected ✓' : 'Connecting...'}</p>
    </div>
  );
}

export default App;
```

### 7. Run Client
```powershell
npm run dev
```

Open http://localhost:5173

## Deploy to GitHub Pages

1. Build your client:
```powershell
npm run build
```

2. Push the `dist` folder to GitHub Pages

3. Your counter app is now accessible from any device!

## Key Concepts

- **Tables**: Store data (like `Counter`)
- **Reducers**: Functions that modify data (like `increment`, `decrement`)
- **Real-time Sync**: All connected clients see changes instantly
- **Cloud Hosting**: SpacetimeDB hosts your database, you host the HTML/JS

## Troubleshooting

**"wasm32-unknown-unknown target not installed"**
```powershell
rustup target add wasm32-unknown-unknown
```

**"spacetime command not found"**
- Restart your terminal after installing SpacetimeDB CLI

**Connection errors**
- Make sure you're using the correct database name
- Check that your module is published: `spacetime list`

## Next Steps

- Add authentication
- Create more complex tables
- Add multiplayer features
- Deploy to production

## Resources

- [SpacetimeDB Docs](https://spacetimedb.com/docs)
- [TypeScript Quickstart](https://spacetimedb.com/docs/sdks/typescript/quickstart)
- [Rust Module Guide](https://spacetimedb.com/docs/modules/rust/quickstart)
