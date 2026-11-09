// Shows this month's estimated AI spending against the budget.
// Run with: npm run ai:spend
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Add it to .env.local first.");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const budget = Number(process.env.CHATEAT_AI_MONTHLY_BUDGET ?? 5);

const [month] = await sql`
  select coalesce(sum(cost_usd), 0)::float as spent, count(*)::int as calls,
         coalesce(sum(input_tokens), 0)::int as input, coalesce(sum(output_tokens), 0)::int as output
  from ai_usage where created_at >= date_trunc('month', now())`;
const byModel = await sql`
  select model, count(*)::int as calls, sum(cost_usd)::float as spent
  from ai_usage where created_at >= date_trunc('month', now())
  group by model order by spent desc`;

const pct = budget > 0 ? Math.min(100, (month.spent / budget) * 100) : 100;
console.log(`AI spending this month: $${month.spent.toFixed(4)} of $${budget.toFixed(2)} budget (${pct.toFixed(1)}%)`);
console.log(`Calls: ${month.calls}   Tokens in: ${month.input.toLocaleString()}   Tokens out: ${month.output.toLocaleString()}`);
if (month.calls) console.log(`Average per call: $${(month.spent / month.calls).toFixed(4)}`);
for (const row of byModel) console.log(`  ${row.model}: ${row.calls} calls, $${row.spent.toFixed(4)}`);
console.log(month.spent >= budget ? "Status: AI is PAUSED; the site is library-only until next month." : "Status: AI is on.");
