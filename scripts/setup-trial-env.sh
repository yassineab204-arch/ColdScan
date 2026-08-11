#!/usr/bin/env bash
#
# Configures TRIAL_SECRET for the ColdScan trial gate.
#
#   bash scripts/setup-trial-env.sh          # generate + push to Vercel
#   bash scripts/setup-trial-env.sh --local  # generate + write .env only
#
# The secret is generated locally with a CSPRNG and piped straight into the
# Vercel CLI. It is never printed in full, never written to a tracked file, and
# never sent anywhere except Vercel. You do not need to copy or paste it.
#
# Redis credentials are NOT touched: the Upstash Marketplace integration already
# injects those into the project for every environment.

set -euo pipefail

cd "$(dirname "$0")/.."

LOCAL_ONLY=0
[[ "${1:-}" == "--local" ]] && LOCAL_ONLY=1

generate() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

mask() {
  # Show only enough to correlate with the Vercel dashboard.
  local v="$1"
  echo "${v:0:6}…${v: -4} (${#v} chars)"
}

echo "ColdScan — trial secret setup"
echo

# ---------------------------------------------------------------------------
# 1. Local .env
# ---------------------------------------------------------------------------
SECRET="$(generate)"

# Treat a real value as "already configured", but an empty placeholder
# (TRIAL_SECRET= or TRIAL_SECRET="") as unset, so a fresh clone gets a key.
current_secret() {
  [[ -f .env ]] || return 0
  sed -n 's/^TRIAL_SECRET=//p' .env | head -1 | tr -d '"'"'"' \r'
}

if [[ $(printf '%s' "$(current_secret)" | wc -c) -ge 16 ]]; then
  echo "• .env already has a TRIAL_SECRET — leaving it alone."
else
  if [[ -f .env ]]; then
    # Replace an empty placeholder, or append if the key is absent.
    if grep -q '^TRIAL_SECRET=' .env; then
      tmp="$(mktemp)"
      sed "s|^TRIAL_SECRET=.*|TRIAL_SECRET=\"$SECRET\"|" .env > "$tmp"
      mv "$tmp" .env
    else
      printf '\nTRIAL_SECRET="%s"\n' "$SECRET" >> .env
    fi
  else
    printf 'TRIAL_SECRET="%s"\n' "$SECRET" > .env
  fi
  chmod 600 .env
  echo "• wrote TRIAL_SECRET to .env  $(mask "$SECRET")"
  echo "  (.env is git-ignored)"
fi

if [[ "$LOCAL_ONLY" == "1" ]]; then
  echo
  echo "Done (local only). For production run without --local, or set it in"
  echo "Vercel → Settings → Environment Variables."
  exit 0
fi

# ---------------------------------------------------------------------------
# 2. Vercel: Production + Preview
# ---------------------------------------------------------------------------
echo
if ! npx --yes vercel whoami >/dev/null 2>&1; then
  cat <<'MSG'
• Vercel CLI is not logged in.

  Run these two commands yourself (nothing needs to be pasted to anyone):

      npx vercel login
      npx vercel link
      bash scripts/setup-trial-env.sh

  Or set TRIAL_SECRET by hand in
  Vercel → Settings → Environment Variables (Production + Preview),
  generating the value with:

      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
MSG
  exit 0
fi

echo "• logged in to Vercel as: $(npx --yes vercel whoami 2>/dev/null)"

for ENVIRONMENT in production preview; do
  # A distinct secret per environment: a leaked preview value cannot be used to
  # forge production sessions.
  ENV_SECRET="$(generate)"

  if npx --yes vercel env ls "$ENVIRONMENT" 2>/dev/null | grep -q 'TRIAL_SECRET'; then
    echo "• $ENVIRONMENT: TRIAL_SECRET already set — skipping."
    echo "    (to rotate: npx vercel env rm TRIAL_SECRET $ENVIRONMENT, then re-run)"
    continue
  fi

  printf '%s' "$ENV_SECRET" | npx --yes vercel env add TRIAL_SECRET "$ENVIRONMENT" >/dev/null
  echo "• $ENVIRONMENT: TRIAL_SECRET added  $(mask "$ENV_SECRET")"
done

cat <<'MSG'

Next:
  1. Redeploy so the functions pick up the new variables.
  2. Open /api/health and confirm:
       trial.secretConfigured : true
       trial.storeConfigured  : true
       trial.storeBinding     : "upstash" (or "vercel-kv")

Note: rotating TRIAL_SECRET invalidates every existing session cookie and email
link, which effectively grants everyone a fresh trial. Only rotate deliberately.
MSG
