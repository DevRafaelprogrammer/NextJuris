#!/bin/bash
# NextJuris API Test Runner
# Usage: bash docs/insomnia/test-runner.sh [base_url]

BASE="${1:-http://localhost:3000}"
API="$BASE/api"
PASS=0
FAIL=0
TOTAL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

assert() {
  TOTAL=$((TOTAL + 1))
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo -e "  ${GREEN}✓${NC} $name"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $name (expected=$expected got=$actual)"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  TOTAL=$((TOTAL + 1))
  local name="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo -e "  ${GREEN}✓${NC} $name"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $name (missing: $needle)"
    FAIL=$((FAIL + 1))
  fi
}

echo -e "${CYAN}━━━ NextJuris API Test Suite ━━━${NC}"
echo -e "${YELLOW}Base: $BASE${NC}\n"

# ─── HEALTH ─────────────────────────────
echo -e "${CYAN}[Health]${NC}"
assert "GET /health" "200" "$(curl -s -o /dev/null -w '%{http_code}' $API/health)"
assert "GET /health/ready" "200" "$(curl -s -o /dev/null -w '%{http_code}' $API/health/ready)" 2>/dev/null || assert "GET /health/ready" "503" "$(curl -s -o /dev/null -w '%{http_code}' $API/health/ready)"
assert "GET /health/supabase" "200" "$(curl -s -o /dev/null -w '%{http_code}' $API/health/supabase)"

# ─── AUTH PUBLIC ────────────────────────
echo -e "\n${CYAN}[Auth Public]${NC}"
assert "GET /auth/register/areas" "200" "$(curl -s -o /dev/null -w '%{http_code}' $API/auth/register/areas)"
assert "POST /auth/register/validate/field" "200" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/register/validate/field -H 'Content-Type: application/json' -d '{"field":"email","value":"test@test.com"}')"

# ─── LOGIN ──────────────────────────────
echo -e "\n${CYAN}[Auth Login]${NC}"
LOGIN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"rafael@nextjuris.com.br","password":"Senha@123"}')
assert_contains "Login success" '"success":true' "$LOGIN"
assert_contains "Has accessToken" '"accessToken"' "$LOGIN"
assert_contains "Has permissions" '"permissions"' "$LOGIN"

TOKEN=$(echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
REFRESH=$(echo "$LOGIN" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
H="Authorization: Bearer $TOKEN"

LOGIN_COOKIES=$(curl -s -D- -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"mariana@nextjuris.com.br","password":"Senha@123"}' 2>&1 | grep -i 'set-cookie')
assert_contains "Sets nj_access cookie" "nj_access" "$LOGIN_COOKIES"
assert_contains "Sets nj_refresh cookie" "nj_refresh" "$LOGIN_COOKIES"
assert_contains "Sets nj_user cookie" "nj_user" "$LOGIN_COOKIES"

# ─── AUTH PROTECTED ─────────────────────
echo -e "\n${CYAN}[Auth Protected]${NC}"
assert "GET /auth/me" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/auth/me)"
ME=$(curl -s -H "$H" $API/auth/me)
assert_contains "/me has permissions" '"permissions"' "$ME"
assert_contains "/me has role" '"role":"admin"' "$ME"
assert "GET /auth/sessions" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/auth/sessions)"
assert "GET /auth/login-history" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/auth/login-history)"

# ─── ERROR CODES ────────────────────────
echo -e "\n${CYAN}[Error Codes]${NC}"
assert "401 No auth" "401" "$(curl -s -o /dev/null -w '%{http_code}' $API/reports)"
assert "401 Bad token" "401" "$(curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer bad' $API/auth/me)"
assert "401 Wrong password" "401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"rafael@nextjuris.com.br","password":"Wrong@123"}')"
WRONG=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"rafael@nextjuris.com.br","password":"Wrong@123"}')
assert_contains "Wrong pw has INVALID_CREDENTIALS" "INVALID_CREDENTIALS" "$WRONG"
assert "404 User not found" "404" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/users/00000000-0000-0000-0000-000000000000)"
assert "409 Duplicate email" "409" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/register -H 'Content-Type: application/json' -d '{"fullName":"Dup","email":"rafael@nextjuris.com.br","password":"Senha@123","confirmPassword":"Senha@123"}')"
assert "422 Validation" "422" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/register -H 'Content-Type: application/json' -d '{"fullName":"A","email":"x","password":"1","confirmPassword":"2"}')"

# ─── CRUD ENDPOINTS ─────────────────────
echo -e "\n${CYAN}[CRUD Endpoints]${NC}"
assert "GET /reports" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/reports)"
assert "GET /reports/stats" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/reports/stats)"
assert "GET /cases" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/cases)"
assert "GET /cases/stats" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/cases/stats)"
assert "GET /clients" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/clients)"
assert "GET /clients/stats" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/clients/stats)"
assert "GET /documents" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/documents)"
assert "GET /documents/stats" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/documents/stats)"
assert "GET /calendar" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/calendar)"
assert "GET /calendar/upcoming" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/calendar/upcoming)"
assert "GET /calendar/overdue" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/calendar/overdue)"
assert "GET /users" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/users)"
assert "GET /users/stats" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/users/stats)"

# ─── DASHBOARD ──────────────────────────
echo -e "\n${CYAN}[Dashboard]${NC}"
DASH=$(curl -s -H "$H" $API/dashboard)
assert_contains "Dashboard has overview" '"totalReports"' "$DASH"
assert_contains "Dashboard has cases" '"byPhase"' "$DASH"
assert "GET /dashboard/activity" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/dashboard/activity)"

# ─── SEARCH ─────────────────────────────
echo -e "\n${CYAN}[Search]${NC}"
SEARCH=$(curl -s -H "$H" "$API/search?q=silva")
assert_contains "Search returns results" '"results"' "$SEARCH"
assert_contains "Search has total" '"total"' "$SEARCH"

# ─── ADMIN ──────────────────────────────
echo -e "\n${CYAN}[Admin]${NC}"
assert "GET /admin/overview" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/admin/overview)"
assert "GET /admin/users" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/admin/users)"
assert "GET /admin/audit" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/admin/audit)"
assert "GET /admin/system" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $API/admin/system)"

# Admin blocked for non-admin
TOKEN2=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"ana.ferreira@nextjuris.com.br","password":"Senha@123"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
assert "Admin blocked for estagiario" "403" "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN2" $API/admin/overview)"

# ─── SECURITY ───────────────────────────
echo -e "\n${CYAN}[Security]${NC}"
assert "Page guard redirect" "302" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/)"
assert "Auth redirect if logged" "302" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" $BASE/auth)"
assert "SQL injection blocked" "400" "$(curl -s -o /dev/null -w '%{http_code}' -H "$H" "$API/users?search=1;drop+table+users--")"
assert "Error catalog public" "200" "$(curl -s -o /dev/null -w '%{http_code}' $API/errors/catalog)"

# ─── GENERATE REPORT ────────────────────
echo -e "\n${CYAN}[Report Generation]${NC}"
GEN=$(curl -s -X POST -H "$H" -H 'Content-Type: application/json' $API/reports/generate -d '{"type":"parecer","area":"Direito civil","context":"Teste de geracao via script","tone":"tecnico"}')
assert_contains "Generate success" '"success":true' "$GEN"
assert_contains "Generated by IA" '"generated_by":"ia"' "$GEN"

# ─── RESULTS ────────────────────────────
echo -e "\n${CYAN}━━━ Results ━━━${NC}"
echo -e "  Total: $TOTAL"
echo -e "  ${GREEN}Passed: $PASS${NC}"
if [ $FAIL -gt 0 ]; then
  echo -e "  ${RED}Failed: $FAIL${NC}"
  exit 1
else
  echo -e "  ${RED}Failed: $FAIL${NC}"
  echo -e "\n${GREEN}All tests passed!${NC}"
fi
