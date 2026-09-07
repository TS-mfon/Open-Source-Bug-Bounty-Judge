# Release and Deployment Runbook

## Required checks

Run `npm run check`, `npm run contract:lint`, and
`npm run contract:test` before a release. Review the generated OpenAPI document,
deployment manifest, contract schemas, and environment variable diff.

## Promotion order

1. Run application and direct contract checks locally.
2. Deploy and smoke-test contracts on localnet.
3. Deploy the release candidate to StudioNet.
4. Read deployed code and schemas from the StudioNet explorer.
5. Run profile, organization, campaign, API-key, duplicate-review, and public
   GitHub evidence smoke tests.
6. Update Vercel contract variables only after the contract smoke test passes.
7. Deploy Vercel and verify `/api/v1/health`, `/api/v1/openapi`, the landing
   page, the docs page, and one read-only review result.

## Rollback

Vercel can be rolled back to the previous deployment. Contract state is never
deleted or rewritten. A failed contract release is marked superseded in the
deployment manifest and the active directory continues pointing at the last
known-good version.
