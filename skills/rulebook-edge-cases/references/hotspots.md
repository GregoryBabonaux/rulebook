# Where rules hide

Use these to choose `hotspots` at mapping time and to run the coverage sweep during extraction.
Always confirm on the actual repository: names below are conventions, not guarantees.

## Everywhere
- Validation of input; guards that throw, abort or return early with an error.
- Authorization checks (roles, ownership, feature flags).
- State machines, status enums and the transitions allowed between them.
- Calculations on money, dates, quantities; rounding.
- Scheduled jobs and their conditions; expiry and deadlines.
- Database constraints (unique, check, foreign keys, not null) and migrations that add them.
- Configuration values that change behaviour (limits, windows, thresholds).
- Tests: their names and assertions often state the rule more clearly than the code.

## Per stack
| Stack | Look in |
|---|---|
| Laravel | `app/Policies`, `app/Http/Requests` (`rules()`), `app/Rules`, `app/Models` (casts, scopes, observers), `app/Enums`, `database/migrations`, `config/*.php`, `app/Console/Kernel.php` / `routes/console.php` |
| Rails | `app/models` (validations, callbacks, enums), `app/policies` (Pundit), `app/services`, `db/schema.rb`, `config/initializers` |
| Django | `models.py` (constraints, `clean()`), `forms.py`, `serializers.py`, `permissions.py`, `migrations/`, `settings.py` |
| Spring | `@Valid`/`javax.validation` annotations, `@PreAuthorize`, `*Service`, `*Policy`, JPA entities (`@Column(unique)`), `application.yml`, Flyway/Liquibase |
| NestJS / Express | DTOs with `class-validator`, guards, pipes, interceptors, middleware, services, Prisma/TypeORM schema |
| .NET | FluentValidation validators, `[Authorize]` policies, domain services, EF Core configurations and migrations, `appsettings.json` |
| Go | handlers' early returns, `validate:` struct tags, middleware, domain packages, SQL migrations |

## Usually not rules
Logging, metrics, retries and timeouts of HTTP clients, caching, formatting for display,
dependency wiring. Record them only when the business would notice a change.
