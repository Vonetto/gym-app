# Workout Tracking PWA — Feature Research

## Scope
Hevy-inspired gym workout tracking PWA with offline-first local storage, unlimited routines, custom exercises, multiple metrics, PRs, volume charts, rest timers, import/export JSON, Spanish + kg/m. V2 AI, V3 social, V4 macros.

## Table Stakes (must-have)
| Feature | Description | Complexity | Dependencies | Notes |
| --- | --- | --- | --- | --- |
| Onboarding + profile basics | Collect units, goals, training split preferences, locale | Low | Localization, settings storage | Fast path; skip if import exists |
| Exercise library + custom exercises | Searchable catalog; create/edit custom movements | Medium | Data model, search | Core for logging |
| Workout logging | Sets/reps/weight/notes; add/remove exercises | High | Exercise library, data model | Primary value loop |
| Multiple metrics | Support reps, weight, distance, time, RPE, bodyweight | Medium | Data model, UI forms | Needed for varied workouts |
| Routines/templates | Create, edit, reuse routines | Medium | Exercise library, workout logging | Saves time |
| History + calendar | List past workouts, filter by date | Medium | Data model, storage | Retention loop |
| PR tracking | Detect and surface personal records | Medium | History, analytics | Expected by users |
| Rest timers | Quick timers per set or exercise | Low | Workout logging | Habitual feature |
| Offline-first storage | Local-first, reliable sync-less use | High | Storage, caching | PWA requirement |
| Export/import JSON | Backup/restore, data portability | Medium | Data model, storage | Trust builder |
| Basic analytics | Volume charts by exercise/week | Medium | History, aggregation | Expected baseline |
| Localization basics | Spanish + metric units | Low | Settings, UI copy | MVP requirement |

## Differentiators (competitive advantage)
| Feature | Description | Complexity | Dependencies | Notes |
| --- | --- | --- | --- | --- |
| Intelligent progression suggestions | Auto-add weight/reps based on trend | High | Analytics, PR tracking | “Coach-like” feeling |
| Exercise substitutions | Swap alternatives with similar muscle groups | Medium | Exercise taxonomy | Great for crowded gyms |
| Auto-deload prompts | Suggest deload weeks after plateaus | High | Analytics, trend detection | Pro-level insight |
| Volume/intensity heatmaps | Muscle group heatmaps by week/month | Medium | Exercise taxonomy, analytics | Visual motivation |
| AI workout summarization (V2) | Summarize session + next steps | High | AI service, history | V2 roadmap |
| Smart rest timer | Adjusts timer based on set difficulty | Medium | RPE data, workout logging | Unique feel |
| Advanced PRs | PR types: 1RM, rep PR, volume PR | Medium | PR tracking, analytics | Depth for lifters |
| Workout flow automation | “Next set” suggestions, auto-superset | Medium | Workout logging UI | Speed logging |
| Skill-based coaching content | Short tips based on exercise | Medium | Exercise taxonomy, content CMS | Delight |

## Anti-features (avoid for now)
| Feature | Rationale | Complexity (if built) | Dependencies | Notes |
| --- | --- | --- | --- | --- |
| Social feed + likes (V3) | Adds moderation, privacy, and scope creep | High | Accounts, backend, moderation | Defer to V3 |
| In-app macro tracking (V4) | Separate domain; distracts from core | High | Nutrition DB, barcode | Defer to V4 |
| Wearable integrations | Heavy vendor APIs + ongoing maintenance | High | Backend, OAuth | Later if demand |
| Coach marketplaces | Liability, payments, legal | Very High | Payments, compliance | Out of scope |
| Paid workout plans marketplace | Operational overhead and content ops | High | Payments, content pipeline | Post-MVP |
| Real-time sync across devices | Conflicts, backend cost | High | Accounts, sync engine | Offline-first first |

## Dependencies Map (high level)
- Exercise library → workout logging → history → analytics → PRs.
- Data model + storage → import/export → offline reliability.
- Localization + settings → onboarding + units.
- Exercise taxonomy → substitutions, heatmaps, coaching content.
- Analytics pipeline → progression, deload prompts, advanced PRs.

## Notes
- Table stakes should be shipped before any differentiators to reduce churn risk.
- V2 AI features depend on reliable structured data from MVP.
