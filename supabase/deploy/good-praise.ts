// Exact entrypoint deployed to good-praise on 2026-10-27.
// Pin all business rules to the reviewed repository revision.
Deno.env.set('APP_ORIGIN', 'https://herothgf-cell.github.io');
await import('https://raw.githubusercontent.com/herothgf-cell/Good/0cefbebbe01c1da6d44faa00a260ddf4cd33ad2a/supabase/functions/family-action/index.ts');
