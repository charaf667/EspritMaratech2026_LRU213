#!/bin/bash
# ============================================================
# OMNIA API — Demo Script (PRD §13 path)
# ============================================================
# Prerequisites:
#   cd apps/api
#   .venv\Scripts\activate        (Windows)
#   python manage.py migrate
#   python manage.py seed_aid_types
#   python manage.py seed_demo_users
#   python manage.py seed_demo_data
#   python manage.py runserver 0.0.0.0:8000
# ============================================================

BASE=http://localhost:8000
COOKIE_JAR=demo_cookies.txt
rm -f $COOKIE_JAR

echo "=== 1. Health Check ==="
curl -s $BASE/api/health/
echo -e "\n"

echo "=== 2. Get CSRF Token ==="
curl -s -c $COOKIE_JAR $BASE/api/auth/csrf/
echo -e "\n"
CSRF=$(awk '/csrftoken/ {print $NF}' $COOKIE_JAR)
echo "CSRF token: $CSRF"
echo

echo "=== 3. Login as Agent (sara@omnia.org) ==="
curl -s -b $COOKIE_JAR -c $COOKIE_JAR \
  -X POST $BASE/api/auth/login/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"email":"sara@omnia.org","password":"dev12345"}'
echo -e "\n"

echo "=== 4. GET /api/auth/me/ ==="
curl -s -b $COOKIE_JAR $BASE/api/auth/me/
echo -e "\n"

echo "=== 5. GET /api/aid-types/ (10 active types) ==="
curl -s -b $COOKIE_JAR $BASE/api/aid-types/
echo -e "\n"

echo "=== 6. GET /api/families/ (agent RBAC: assigned + created) ==="
curl -s -b $COOKIE_JAR "$BASE/api/families/"
echo -e "\n"

echo "=== 7. GET /api/families/?priority=overdue ==="
curl -s -b $COOKIE_JAR "$BASE/api/families/?priority=overdue"
echo -e "\n"

echo "=== 8. GET /api/families/?search=Fatima ==="
curl -s -b $COOKIE_JAR "$BASE/api/families/?search=Fatima"
echo -e "\n"

# Get first family ID
FAMILY_ID=$(curl -s -b $COOKIE_JAR "$BASE/api/families/" | sed 's/.*"id":"\([^"]*\)".*/\1/' | head -1)
echo "Using family: $FAMILY_ID"

echo "=== 9. GET /api/families/{id}/ (detail) ==="
curl -s -b $COOKIE_JAR "$BASE/api/families/$FAMILY_ID/"
echo -e "\n"

echo "=== 10. GET /api/visits/?family_id={id} (visit history) ==="
curl -s -b $COOKIE_JAR "$BASE/api/visits/?family_id=$FAMILY_ID"
echo -e "\n"

echo "=== 11. POST /api/visits/ (wizard: create visit) ==="
CSRF=$(awk '/csrftoken/ {print $NF}' $COOKIE_JAR)
VISIT_RESPONSE=$(curl -s -b $COOKIE_JAR -c $COOKIE_JAR \
  -X POST $BASE/api/visits/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"family_id":"'"$FAMILY_ID"'","motive":"distribution","notes":"Demo visit from script","is_urgent":false,"aids":[{"aid_type_key":"food_parcel","qty":2},{"aid_type_key":"hygiene","qty":1}],"complaint_text":""}')
echo "$VISIT_RESPONSE"
echo -e "\n"

# Extract feeling token
FEELING_TOKEN=$(echo "$VISIT_RESPONSE" | sed 's/.*"feeling_token":"\([^"]*\)".*/\1/')
echo "Feeling token: $FEELING_TOKEN"

echo "=== 12. POST /api/feeling/redeem/ (no auth) ==="
curl -s -X POST $BASE/api/feeling/redeem/ \
  -H "Content-Type: application/json" \
  -d '{"code_short":"'"$FEELING_TOKEN"'"}'
echo -e "\n"

echo "=== 13. GET /api/feeling/card/{token}/ (no auth) ==="
curl -s "$BASE/api/feeling/card/$FEELING_TOKEN/"
echo -e "\n"

echo "=== 14. Dashboard (should FAIL for agent) ==="
curl -s -b $COOKIE_JAR $BASE/api/dashboard/
echo -e "\n"

echo "=== 15. Login as Admin ==="
CSRF=$(awk '/csrftoken/ {print $NF}' $COOKIE_JAR)
curl -s -b $COOKIE_JAR -c $COOKIE_JAR \
  -X POST $BASE/api/auth/login/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -d '{"email":"admin@omnia.org","password":"dev12345"}'
echo -e "\n"

echo "=== 16. GET /api/dashboard/ (admin only) ==="
curl -s -b $COOKIE_JAR $BASE/api/dashboard/
echo -e "\n"

echo "=== 17. GET /api/families/ (admin sees ALL) ==="
curl -s -b $COOKIE_JAR "$BASE/api/families/"
echo -e "\n"

echo "=== 18. Logout ==="
CSRF=$(awk '/csrftoken/ {print $NF}' $COOKIE_JAR)
curl -s -b $COOKIE_JAR -c $COOKIE_JAR \
  -X POST $BASE/api/auth/logout/ \
  -H "X-CSRFToken: $CSRF"
echo -e "\n"

echo "=== Demo complete ==="
rm -f $COOKIE_JAR
