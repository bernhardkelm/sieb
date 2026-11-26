.PHONY: help release

help:
	@echo "Available targets:"
	@echo "  make release <x.x.x|major|minor|patch> \"message\"   - Bump the version, tag and publish a GitHub release"
	@echo "  make release <x.x.x|major|minor|patch> NOTES=file.md"

# words after `release` are goals too, the match-anything no-op rule exists only for `release`,
# so a mistyped target still fails; VERSION=/MESSAGE= is the safe form for messages with $ or #
release_args := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
RELEASE_VERSION := $(or $(word 1,$(release_args)),$(VERSION))
RELEASE_MESSAGE := $(or $(wordlist 2,$(words $(release_args)),$(release_args)),$(MESSAGE))
ifeq ($(firstword $(MAKECMDGOALS)),release)
%:
	@:
endif

release:
	@bash scripts/create-release.sh "$(RELEASE_VERSION)" "$(RELEASE_MESSAGE)"
