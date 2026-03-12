DATA_DIR := .data
OPENCODE_DB := $(DATA_DIR)/opencode.dev.db
DASHBOARD_DB := $(DATA_DIR)/dashboard.dev.db

.PHONY: dev dev-db clean-dev-db test

dev: dev-db
	OPENCODE_DB_PATH="$(OPENCODE_DB)" \
	DASHBOARD_DB_PATH="$(DASHBOARD_DB)" \
	bun run dev

# dev-db always wipes both dev databases to guarantee a clean, isolated state.
# Live data must never appear in the dev environment.
dev-db:
	mkdir -p "$(DATA_DIR)"
	rm -f "$(OPENCODE_DB)" "$(OPENCODE_DB)-wal" "$(OPENCODE_DB)-shm"
	rm -f "$(DASHBOARD_DB)" "$(DASHBOARD_DB)-wal" "$(DASHBOARD_DB)-shm"
	bun run scripts/seed-dev-db.ts "$(OPENCODE_DB)"

clean-dev-db:
	rm -rf "$(DATA_DIR)"

test:
	bun test
