# Frontend Translations Migration

File: `frontend/src/translations/en.json`

This is the single source of truth for all user-facing strings. 1218 keys total. This document lists every key that needs updating or removal, organized by category.

---

## Keys to DELETE (Calculator-specific, no ReelStudio equivalent)

These keys are for features that no longer exist. Remove them entirely.

```
account_tabs_calculator
account_tabs_calculator_short
about_calculator_expertise
about_calculator_expertise_description_1
about_calculator_expertise_description_2
about_calculator_expertise_description_3
about_financial_experts
about_financial_experts_description
support_calculators_title
support_calculators_desc
api_endpoint_calculate
api_endpoint_types
home_features_mortgage_title
home_features_mortgage_description
home_features_investment_title
home_features_investment_description
home_features_loan_title
home_features_loan_description
home_features_retirement_title
home_features_retirement_description
```

---

## Keys to UPDATE (CalcPro → ReelStudio)

### Brand/App Name Keys

| Key | Current Value | New Value |
|-----|--------------|-----------|
| `home_hero_badge` | (check current) | `"AI-Powered Content Intelligence"` |
| `home_hero_description` | description of calculator | `"Discover viral reels in any niche, decode exactly why they perform, and generate content that gets results."` |
| `common_financial_calculators` | `"Financial Calculators"` | `"Viral Reel Studio"` → OR RENAME KEY to `common_hero_title` |
| `common_built_for_professionals` | `"Built for Professionals"` | `"Built for Creators"` → OR RENAME KEY |
| `common_why_professionals_choose_calcpro` | `"Why Professionals Choose CalcPro"` | `"Why Creators Choose ReelStudio"` |
| `home_cta_description` | Calculator CTA | `"Join thousands of creators using ReelStudio to build data-driven content strategies."` |

### About Page Keys

| Key | Current Value | New Value |
|-----|--------------|-----------|
| `about_join_thousands` | "Join thousands of professionals..." | `"Join thousands of creators who grow faster with data"` |
| `about_mission_title` | (check) | `"Our Mission"` |
| `about_mission_description` | (check) | `"We believe every creator deserves to know why content goes viral — not just that it did."` |
| `about_team_title` | (check) | `"Built by creators, for creators"` |

### Support Page Keys

| Key | Current Value | New Value |
|-----|--------------|-----------|
| `support_calculators_title` | DELETE | — |
| `support_calculators_desc` | DELETE | — |
| ADD: `support_studio_title` | — | `"Reel Studio"` |
| ADD: `support_studio_desc` | — | `"Learn how to scan niches, analyze reels, and generate content"` |
| ADD: `support_generation_title` | — | `"Content Generation"` |
| ADD: `support_generation_desc` | — | `"Hooks, captions, scripts — understand the generation tools"` |

### API Documentation Keys

| Key | Current Value | New Value |
|-----|--------------|-----------|
| `api_calculators_title` | `"Calculator API"` | `"Reels API"` |
| `api_endpoint_calculate` | DELETE | — |
| `api_endpoint_types` | DELETE | — |
| `api_endpoint_history` | `"History"` | Keep but update description |
| `api_endpoint_export` | `"Export"` | Replace with `"Generate"` |
| `api_endpoint_usage` | `"Usage"` | Keep |
| ADD: `api_endpoint_analyze` | — | `"Analyze"` |
| ADD: `api_endpoint_reels` | — | `"Reels"` |

### Account Page Keys

| Key | Current Value | New Value |
|-----|--------------|-----------|
| `account_tabs_calculator` | `"Calculator"` | REMOVE (tab being removed) |
| `account_tabs_calculator_short` | SHORT version | REMOVE |
| ADD: `account_tabs_overview` | — | `"Overview"` |
| ADD: `account_overview_reels_analyzed` | — | `"Reels Analyzed"` |
| ADD: `account_overview_content_generated` | — | `"Content Generated"` |
| ADD: `account_overview_queue_items` | — | `"Queue Items"` |
| ADD: `account_overview_go_to_studio` | — | `"Open Studio"` |

### Footer Keys

| Key | Current Value | New Value |
|-----|--------------|-----------|
| `shared_footer_company_tagline` | (check — likely CalcPro tagline) | `"Turn viral reels into your content strategy"` |
| `shared_footer_calculators` | `"Calculators"` | RENAME to `shared_footer_studio`, value: `"Studio"` |
| `shared_footer_contact_email` | `"support@calcpro.com"` | `"support@reelstudio.ai"` |

### Pricing Page Keys

| Key | Current Value | New Value |
|-----|--------------|-----------|
| `pricing_feature_mortgage` | (likely exists) | DELETE |
| `pricing_feature_loan` | (likely exists) | DELETE |
| `pricing_feature_investment` | (likely exists) | DELETE |
| `pricing_feature_retirement` | (likely exists) | DELETE |
| `pricing_feature_export_pdf` | (likely exists) | DELETE or repurpose |
| ADD: `pricing_feature_reel_scans` | — | `"Reel Scans per day"` |
| ADD: `pricing_feature_ai_analysis` | — | `"AI Analysis per day"` |
| ADD: `pricing_feature_content_generation` | — | `"Content Generation per day"` |
| ADD: `pricing_feature_queue_size` | — | `"Queue Size"` |
| ADD: `pricing_feature_publishing` | — | `"Instagram Publishing"` |
| ADD: `pricing_feature_analytics` | — | `"Advanced Analytics"` |
| ADD: `pricing_feature_api_access` | — | `"API Access"` |
| ADD: `pricing_feature_team` | — | `"Team Workspace"` |

### Homepage Feature Keys (DELETE ALL — Section is being rewritten)

```
home_features_mortgage_title
home_features_mortgage_description
home_features_investment_title
home_features_investment_description
home_features_loan_title
home_features_loan_description
home_features_retirement_title
home_features_retirement_description
```

Replace with:

| ADD Key | Value |
|---------|-------|
| `home_features_discovery_title` | `"Viral Reel Discovery"` |
| `home_features_discovery_description` | `"Scan any niche and surface the top-performing reels by engagement rate and view count."` |
| `home_features_analysis_title` | `"AI Hook Analysis"` |
| `home_features_analysis_description` | `"Decode exactly why a reel went viral: hook pattern, emotional trigger, format, and CTA type."` |
| `home_features_generation_title` | `"Content Generation"` |
| `home_features_generation_description` | `"Generate hooks, captions, and full scripts from any viral reel with one click."` |
| `home_features_queue_title` | `"Content Queue"` |
| `home_features_queue_description` | `"Organize, schedule, and publish your generated content directly to Instagram."` |

### Social Proof / Stats Keys

| Key | Current Value | New Value |
|-----|--------------|-----------|
| `home_stats_users` or similar | `"10,000 Active Users"` | `"50K+ Reels Analyzed"` |
| `home_stats_uptime` or similar | `"99.9% Uptime"` | `"2.3x Avg Engagement Lift"` |
| `home_stats_security` or similar | `"Bank-Level Security"` | `"500+ Active Creators"` |
| `home_stats_support` or similar | `"24/7 Support"` | `"AI-Powered Hooks"` |

### Why Choose Section Keys

| Key | Current Value | New Value |
|-----|--------------|-----------|
| `common_why_professionals_choose_calcpro` | "Why Professionals Choose CalcPro" | `"Why Creators Choose ReelStudio"` |
| `home_why_benefit_1_title` | "Accurate Calculations" | `"Data-Driven Strategy"` |
| `home_why_benefit_1_desc` | "Accurate to the cent..." | `"Stop guessing. Know exactly what hooks, formats, and triggers drive views."` |
| `home_why_benefit_2_title` | "Export Results" | `"10x Faster Content"` |
| `home_why_benefit_2_desc` | "Download PDF/CSV..." | `"Go from scroll to publish-ready script in seconds, not hours."` |
| `home_why_benefit_3_title` | "Secure Data" | `"Niche Intelligence"` |
| `home_why_benefit_3_desc` | "Bank-level encryption..." | `"Deep-dive into any niche: finance, fitness, business, lifestyle, and more."` |

### FAQ Keys (ALL NEED REPLACEMENT)

The FAQ was stubbed to return empty. Need to add actual ReelStudio FAQ content.

Categories and questions to ADD:

**Getting Started**
- `faq_gs_q1` — `"What is ReelStudio?"`
- `faq_gs_a1` — Answer
- `faq_gs_q2` — `"How do I scan a niche for viral reels?"`
- `faq_gs_a2` — Answer
- `faq_gs_q3` — `"How does the AI analysis work?"`
- `faq_gs_a3` — Answer

**Content Generation**
- `faq_gen_q1` — `"How are hooks generated?"`
- `faq_gen_a1` — Answer
- `faq_gen_q2` — `"What output formats does the generator support?"`
- `faq_gen_a2` — Answer
- `faq_gen_q3` — `"How many pieces of content can I generate per day?"`
- `faq_gen_a3` — Answer

**Billing**
- `faq_billing_q1` — `"What's included in the free tier?"`
- `faq_billing_a1` — Answer
- `faq_billing_q2` — `"How does Pro differ from Basic?"`
- `faq_billing_a2` — Answer
- `faq_billing_q3` — `"Can I cancel anytime?"`
- `faq_billing_a3` — Answer

**Technical**
- `faq_tech_q1` — `"What niches are supported?"`
- `faq_tech_a1` — Answer
- `faq_tech_q2` — `"How current is the reel data?"`
- `faq_tech_a2` — Answer

---

## Keys That Are Already Correct ✅

These studio-specific keys were added during the previous migration and are correct:

```
studio_tabs_discover
studio_tabs_generate
studio_tabs_queue
studio_sidebar_sourceReels
studio_sidebar_aiTools
studio_sidebar_noReels
studio_tools_hookWriter
studio_tools_captionAI
studio_tools_remix
studio_tools_voiceOver
studio_tools_scheduler
studio_canvas_noReel
studio_canvas_noReelSub
studio_toolbar_prev
studio_toolbar_next
studio_toolbar_trim
studio_toolbar_audio
studio_toolbar_caption
studio_toolbar_generateRemix
studio_panel_selectReel
studio_panel_analysis
studio_panel_generate
studio_panel_history
studio_panel_metrics
studio_panel_views
studio_panel_likes
studio_panel_comments
studio_panel_engagement
studio_panel_hook
studio_panel_caption
studio_panel_audio
studio_panel_aiAnalysis
studio_panel_runAnalysis
studio_panel_analyzing
studio_panel_remixSuggestion
studio_panel_engagementRate
studio_panel_totalViews
studio_panel_posted
studio_generate_label
studio_generate_placeholder
studio_generate_button
studio_generate_generating
studio_generate_generated
studio_generate_error
studio_queue_add
studio_history_empty
studio_history_emptySub
studio_history_noHook
studio_search_placeholder
studio_search_scan
studio_badge
studio_meta_description
faq_badge
faq_metadata_title
faq_metadata_description
faq_still_have_questions
faq_cant_find
```

---

## Keys Needing Verification (May or May Not Exist)

These keys are referenced in code but need to be verified to exist in en.json:

```
account_tabs_overview (NEW - to add)
account_overview_reels_analyzed (NEW - to add)
account_overview_content_generated (NEW - to add)
account_overview_queue_items (NEW - to add)
navigation_home
navigation_account
common_contact_support
common_mon_fri_9am_5pm_est
common_visit_our_faq_page
common_get_in_touch
common_send_us_a_message
common_loading
common_frequently_asked_questions
features_ready_to_start
```
