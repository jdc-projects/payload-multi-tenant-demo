# Local Setup

## Context

This runbook starts the initial local Payload multi-tenant demo.

## Execution

1. Install Node 24 and run `npm install`.
2. Copy `.env.example` to `.env` and replace `PAYLOAD_SECRET`.
3. Run `npm run dev:infra`.
4. Run `npm run dev` in another terminal.
5. Run `npm run seed` after the CMS is listening.

## Validation

Open `http://localhost:3001/admin`, then visit `http://localhost:3000/demo1/`, `demo2`, and `demo3`. Re-running the seed must not create duplicate tenants or home pages.
