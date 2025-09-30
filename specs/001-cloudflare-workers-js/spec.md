# Feature Specification: URL Shortener Service

**Feature Branch**: `001-cloudflare-workers-js`
**Created**: 2025-10-01
**Status**: Draft
**Input**: User description: "Build a URL shortener service using Cloudflare Workers (JS) + D1 (SQLite) + KV (cache) for single domain & single administrator, inspired by Kutt's core features but without multi-user/multi-domain support, no complex backend, only admin API."

## Execution Flow (main)
```
1. Parse user description from Input
   → ✓ Feature description provided: Single-domain URL shortener service
2. Extract key concepts from description
   → Actors: Administrator, End users (link visitors)
   → Actions: Create short links, redirect users, track usage, manage links
   → Data: Short links, visit statistics, expiration metadata
   → Constraints: Single domain, single administrator, no multi-user system
3. For each unclear aspect:
   → Marked with [NEEDS CLARIFICATION] where applicable
4. Fill User Scenarios & Testing section
   → ✓ Clear user flows identified for both admin and visitors
5. Generate Functional Requirements
   → ✓ Each requirement is testable
6. Identify Key Entities (if data involved)
   → ✓ Links and Visit Events identified
7. Run Review Checklist
   → ⚠ WARN: Some technical implementation details provided but abstracted to focus on capabilities
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-10-01
- Q: What is the expected maximum number of active (non-expired) short links the system should support? → A: Up to 1,000 links (personal/small project scale)
- Q: What is the acceptable time window for cache updates to propagate after a link is modified or deleted? → A: Short delay (5-30 seconds) - brief inconsistency acceptable
- Q: What are the maximum allowed lengths for target URLs and custom aliases (slugs)? → A: URL: 2,048 chars, Alias: 32 chars
- Q: Should the admin web interface support mobile phone screens, or is desktop/tablet support sufficient? → A: Full mobile support required (screens ≥320px)
- Q: How frequently should the system run automatic cleanup of expired links? → A: Every 24 hours (daily) - minimal overhead

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a **content creator or marketer**, I want to create short, memorable links from long URLs so that I can share them easily on social media, track their usage, and manage them over time through a web-based admin interface. As an **end user**, I want shortened links to redirect me quickly and reliably to the intended destination.

### Acceptance Scenarios

#### Administrator Scenarios
1. **Given** I navigate to the admin page, **When** I enter my credentials, **Then** I gain access to the link management interface
2. **Given** I am logged into the admin page and have a long URL, **When** I create a short link with a custom alias through the web interface, **Then** the system generates a short link using my specified alias and the configured domain
3. **Given** I am logged into the admin page and have a long URL, **When** I create a short link without specifying an alias through the web interface, **Then** the system generates a random, unique alias for the short link
4. **Given** I am logged into the admin page and have created a short link, **When** I set an expiration date through the web interface, **Then** the link automatically becomes invalid after that date
5. **Given** I am logged into the admin page, **When** I view the links list, **Then** I see all my links displayed with their visit counts and metadata in a readable format
6. **Given** I am logged into the admin page and want to modify a short link, **When** I update its target URL or expiration date through the web interface, **Then** the changes take effect immediately
7. **Given** I am logged into the admin page and no longer need a short link, **When** I delete it through the web interface, **Then** the link is removed and visitors see an error message when attempting to access it
8. **Given** I am logged into the admin page, **When** I view link statistics through the web interface, **Then** I see recent visit counts, geographic distribution, and referrer information presented visually
9. **Given** I am logged into the admin page, **When** I copy a short link, **Then** the full short URL (including domain) is copied to my clipboard for easy sharing

#### End User Scenarios
10. **Given** I receive a short link (e.g., yourdomain.com/abc123), **When** I click or visit it, **Then** I am redirected to the target URL quickly
11. **Given** I visit a short link that has expired, **When** I attempt to access it, **Then** I see an error message indicating the link is no longer valid
12. **Given** I visit a short link that doesn't exist, **When** I attempt to access it, **Then** I see an error message indicating the link was not found

### Edge Cases
- What happens when an administrator tries to create a custom alias that already exists through the web interface? The interface must display a clear error message and allow retry with a different alias.
- What happens when a link receives thousands of concurrent visits? System must maintain fast redirect performance and accurately record visit statistics without blocking.
- What happens when a link is updated while visitors are actively using it? System must serve the updated target URL with minimal delay.
- What happens when a link expires in the middle of high traffic? System must immediately return error responses for new requests.
- What happens when the administrator creates a link with an invalid target URL format through the web interface? The interface must validate and show an error before submission.
- What happens when the admin page loses connection to the API? The interface should display appropriate error messages and allow retry.
- What happens when an administrator's session expires while using the web interface? The system should prompt for re-authentication without losing unsaved work.
- What happens during the cache consistency window after link updates? Updates propagate within 5-30 seconds; visitors may see old target URLs during this brief window.

## Requirements *(mandatory)*

### Functional Requirements

#### Link Creation & Management
- **FR-001**: System MUST allow the administrator to create short links with custom aliases (slug)
- **FR-002**: System MUST allow the administrator to create short links with randomly generated aliases when no custom alias is provided
- **FR-003**: System MUST validate that target URLs use HTTP or HTTPS protocols only
- **FR-004**: System MUST ensure all aliases (slugs) are unique within the domain
- **FR-005**: System MUST allow the administrator to set optional expiration dates for short links (specified as Unix timestamps)
- **FR-006**: System MUST allow the administrator to specify redirect type (301 permanent, 302 temporary, 307 temporary with method preservation, or 308 permanent with method preservation), with 302 as default
- **FR-007**: System MUST allow the administrator to update existing links (target URL, expiration date, redirect type)
- **FR-008**: System MUST allow the administrator to delete existing links
- **FR-009**: System MUST allow the administrator to list all created links with their visit counts

#### Redirection
- **FR-010**: System MUST redirect visitors from short links to their target URLs using the specified redirect status code
- **FR-011**: System MUST serve redirects with low latency (target: sub-100ms at 99th percentile for cached requests)
- **FR-012**: System MUST return a 404 error when visitors access non-existent short links
- **FR-013**: System MUST return a 404 error when visitors access expired short links (after expiration timestamp)

#### Expiration & Cleanup
- **FR-014**: System MUST automatically mark links as invalid immediately upon reaching their expiration time
- **FR-015**: System MUST remove expired links and their associated data every 24 hours (daily cleanup schedule)
- **FR-016**: System MUST remove both primary storage and cache data for expired links during cleanup operations

#### Statistics & Analytics
- **FR-017**: System MUST record visit events for each short link access, including timestamp
- **FR-018**: System MUST track the number of visits per link (visit count)
- **FR-019**: System MUST record visitor geographic information (country/region) for analytics
- **FR-020**: System MUST record referrer information when available
- **FR-021**: System MUST record visitor client information (user agent) for analytics
- **FR-022**: System MUST aggregate visit data for reporting within recent time windows (e.g., last 24 hours)
- **FR-023**: System MUST provide analytics aggregated by country/region
- **FR-024**: System MUST provide analytics aggregated by referrer source
- **FR-025**: System MUST record visit events without blocking or slowing down redirect responses

#### Security & Access Control
- **FR-026**: System MUST authenticate the administrator before allowing access to management operations
- **FR-027**: System MUST protect all link creation, update, and deletion operations with authentication
- **FR-028**: System MUST allow unauthenticated public access to redirect functionality (visiting short links)
- **FR-029**: System MUST store authentication credentials securely separate from application code

#### Performance & Caching
- **FR-030**: System MUST cache frequently accessed links to maintain low redirect latency
- **FR-031**: System MUST invalidate cached link data when links are updated or deleted
- **FR-032**: System MUST propagate cache updates within 5-30 seconds after link modifications (brief inconsistency acceptable during this window)

#### System Health
- **FR-033**: System MUST provide a health check endpoint to verify service availability
- **FR-034**: System MUST enforce maximum length limits: target URLs up to 2,048 characters, custom aliases up to 32 characters

#### Admin Web Interface
- **FR-035**: System MUST provide a static web-based admin interface accessible via a dedicated route
- **FR-036**: Admin interface MUST present a login form requiring credentials before accessing management features
- **FR-037**: Admin interface MUST display a list of all short links with their key metadata (alias, target URL, visit count, creation date, expiration date)
- **FR-038**: Admin interface MUST provide a form to create new short links with fields for target URL, optional custom alias, optional expiration date, and optional redirect type
- **FR-039**: Admin interface MUST allow editing existing links inline or through a modal/form
- **FR-040**: Admin interface MUST provide a delete action for each link with confirmation to prevent accidental deletion
- **FR-041**: Admin interface MUST display visit statistics for links including total visits, recent activity (last 24h), geographic breakdown, and top referrers
- **FR-042**: Admin interface MUST provide a "copy to clipboard" function for generated short URLs
- **FR-043**: Admin interface MUST display clear error messages when API operations fail (validation errors, network errors, authentication errors)
- **FR-044**: Admin interface MUST validate user input client-side before submitting to the API (URL format, required fields)
- **FR-045**: Admin interface MUST work as a single-page application without requiring page reloads for management operations
- **FR-046**: Admin interface MUST be responsive and usable across all device sizes including mobile phones (minimum screen width: 320px)
- **FR-047**: Admin interface MUST communicate with the backend exclusively through the Admin API endpoints
- **FR-048**: Admin interface MUST handle authentication state and prompt for re-login when credentials expire or are invalid
- **FR-049**: Admin interface MUST be served as static files (HTML/CSS/JavaScript) without server-side rendering requirements

### Key Entities *(include if feature involves data)*

- **Short Link**: Represents a mapping from a short alias (slug) to a target URL. Key attributes include:
  - Unique identifier
  - Custom or random alias (slug, maximum 32 characters)
  - Target URL (must be HTTP/HTTPS, maximum 2,048 characters)
  - Redirect status code (301/302/307/308)
  - Optional expiration timestamp
  - Visit count (for quick listing performance)
  - Creation timestamp
  - Last update timestamp
  - **Scale constraint**: System designed to support up to 1,000 active (non-expired) links

- **Visit Event**: Represents a single visit to a short link. Key attributes include:
  - Associated short link (reference)
  - Timestamp of visit
  - Visitor geographic location (country/region)
  - Referrer source (if available)
  - Client/user agent information
  - Data center location serving the request

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs) - Note: User input included technical details, but spec focuses on capabilities
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain - ⚠ Three clarifications needed (cache staleness, size limits, mobile support)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded (single domain, single admin, no multi-user, static admin interface)
- [x] Dependencies and assumptions identified (edge network infrastructure, authentication mechanism, static file hosting)

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed (initial + admin interface addition)
- [x] Key concepts extracted
- [x] Ambiguities marked (3 clarifications needed)
- [x] User scenarios defined (12 scenarios including admin web interface flows)
- [x] Requirements generated (49 functional requirements including 15 admin interface requirements)
- [x] Entities identified (Short Link, Visit Event)
- [ ] Review checklist passed (pending clarifications)

---
