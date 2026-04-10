#!/usr/bin/env node
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { join } from 'node:path';

const app = new Hono();

app.use('*', serveStatic({ root: join(import.meta.dirname, 'dist/') }));

serve(
  {
    fetch: app.fetch,
    port: process.env.VIS_PORT || 3000,
  },
  (info) => {
    console.log(`Listening on http://localhost:${info.port}`);
  },
);
