-- ANAGEM CMS schema. All timestamps are timestamptz (stored UTC).
-- Translatable content uses one "<entity>_translations" table keyed by (entity_id, locale).

-- ---------- Access control ----------
create table permissions (
    code        varchar(64) primary key,
    description varchar(255)
);

create table roles (
    id          bigint generated always as identity primary key,
    name        varchar(64) not null unique,
    description varchar(255),
    system_role boolean not null default false
);

create table role_permissions (
    role_id         bigint      not null references roles (id) on delete cascade,
    permission_code varchar(64) not null references permissions (code) on delete cascade,
    primary key (role_id, permission_code)
);

create table users (
    id                    bigint generated always as identity primary key,
    email                 varchar(255) not null,
    password_hash         varchar(100) not null,
    full_name             varchar(150) not null,
    role_id               bigint       not null references roles (id),
    enabled               boolean      not null default true,
    preferred_locale      varchar(8)   not null default 'fr',
    last_login_at         timestamptz,
    failed_login_attempts int          not null default 0,
    locked_until          timestamptz,
    created_at            timestamptz  not null default now(),
    updated_at            timestamptz  not null default now()
);
create unique index ux_users_email on users (lower(email));

create table revoked_tokens (
    jti        varchar(64) primary key,
    expires_at timestamptz not null
);
create index ix_revoked_tokens_expires on revoked_tokens (expires_at);

-- ---------- Media ----------
create table media_files (
    id              uuid primary key default gen_random_uuid(),
    storage_key     varchar(255) not null unique,
    thumbnail_key   varchar(255),
    original_name   varchar(255) not null,
    content_type    varchar(100) not null,
    kind            varchar(20)  not null check (kind in ('IMAGE', 'PDF')),
    size_bytes      bigint       not null check (size_bytes >= 0),
    width           int,
    height          int,
    checksum_sha256 varchar(64),
    uploaded_by     bigint references users (id) on delete set null,
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz  not null default now()
);
create index ix_media_created on media_files (created_at desc);
create index ix_media_name on media_files (lower(original_name));

create table media_file_translations (
    media_id    uuid        not null references media_files (id) on delete cascade,
    locale      varchar(8)  not null,
    alt_text    varchar(500),
    description varchar(1000),
    primary key (media_id, locale)
);

-- ---------- Categories (news / publication / event / resource) ----------
create table categories (
    id         bigint generated always as identity primary key,
    type       varchar(20)  not null check (type in ('NEWS', 'PUBLICATION', 'EVENT', 'RESOURCE')),
    slug       varchar(120) not null,
    sort_order int          not null default 0,
    active     boolean      not null default true,
    created_at timestamptz  not null default now(),
    updated_at timestamptz  not null default now(),
    unique (type, slug)
);

create table category_translations (
    category_id bigint       not null references categories (id) on delete cascade,
    locale      varchar(8)   not null,
    name        varchar(150) not null,
    description varchar(500),
    primary key (category_id, locale)
);

-- ---------- News ----------
create table news (
    id                bigint generated always as identity primary key,
    slug              varchar(180) not null unique,
    status            varchar(20)  not null default 'DRAFT'
        check (status in ('DRAFT', 'PENDING_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
    published_at      timestamptz,
    featured          boolean      not null default false,
    category_id       bigint references categories (id) on delete set null,
    featured_image_id uuid references media_files (id) on delete set null,
    author_id         bigint references users (id) on delete set null,
    version           bigint       not null default 0,
    created_at        timestamptz  not null default now(),
    updated_at        timestamptz  not null default now()
);
create index ix_news_visibility on news (status, published_at desc);
create index ix_news_category on news (category_id);

create table news_translations (
    news_id         bigint       not null references news (id) on delete cascade,
    locale          varchar(8)   not null,
    title           varchar(300) not null,
    summary         varchar(1000),
    content         text,
    seo_title       varchar(300),
    seo_description varchar(500),
    primary key (news_id, locale)
);
create index ix_news_tr_title on news_translations (lower(title));

create table news_tags (
    news_id bigint      not null references news (id) on delete cascade,
    tag     varchar(60) not null,
    primary key (news_id, tag)
);

-- ---------- Publications (journal issues, books, proceedings, reports) ----------
create table publications (
    id             bigint generated always as identity primary key,
    kind           varchar(20) not null default 'OTHER'
        check (kind in ('MAGAZINE_ISSUE', 'BOOK', 'PROCEEDINGS', 'REPORT', 'OTHER')),
    publication_year int       not null check (publication_year between 1900 and 2100),
    issue_number   varchar(30),
    status         varchar(20) not null default 'DRAFT'
        check (status in ('DRAFT', 'PENDING_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
    published_at   timestamptz,
    featured       boolean     not null default false,
    category_id    bigint references categories (id) on delete set null,
    cover_image_id uuid references media_files (id) on delete set null,
    pdf_file_id    uuid references media_files (id) on delete set null,
    author_id      bigint references users (id) on delete set null,
    version        bigint      not null default 0,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);
create index ix_publications_visibility on publications (status, publication_year desc);
create index ix_publications_kind on publications (kind);

create table publication_translations (
    publication_id bigint       not null references publications (id) on delete cascade,
    locale         varchar(8)   not null,
    title          varchar(300) not null,
    description    text,
    primary key (publication_id, locale)
);
create index ix_publication_tr_title on publication_translations (lower(title));

-- ---------- Events ----------
create table events (
    id               bigint generated always as identity primary key,
    slug             varchar(180) not null unique,
    event_type       varchar(30)  not null default 'OTHER'
        check (event_type in ('CONFERENCE', 'SEMINAR', 'WORKSHOP', 'STUDY_DAY', 'FIELD_TRIP',
                              'EXHIBITION', 'GENERAL_ASSEMBLY', 'MEETING', 'OTHER')),
    starts_at        timestamptz  not null,
    ends_at          timestamptz,
    all_day          boolean      not null default false,
    registration_url varchar(500),
    status           varchar(20)  not null default 'DRAFT'
        check (status in ('DRAFT', 'PENDING_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
    published_at     timestamptz,
    featured         boolean      not null default false,
    category_id      bigint references categories (id) on delete set null,
    image_id         uuid references media_files (id) on delete set null,
    program_file_id  uuid references media_files (id) on delete set null,
    author_id        bigint references users (id) on delete set null,
    version          bigint       not null default 0,
    created_at       timestamptz  not null default now(),
    updated_at       timestamptz  not null default now(),
    check (ends_at is null or ends_at >= starts_at)
);
create index ix_events_visibility on events (status, starts_at);

create table event_translations (
    event_id    bigint       not null references events (id) on delete cascade,
    locale      varchar(8)   not null,
    title       varchar(300) not null,
    description text,
    location    varchar(300),
    organizer   varchar(300),
    primary key (event_id, locale)
);
create index ix_event_tr_title on event_translations (lower(title));

-- ---------- Resources library ----------
create table resources (
    id           bigint generated always as identity primary key,
    kind         varchar(20) not null default 'DOCUMENT'
        check (kind in ('DOCUMENT', 'MAP', 'RESEARCH', 'REPORT', 'OFFICIAL', 'EDUCATIONAL')),
    external_url varchar(500),
    status       varchar(20) not null default 'DRAFT'
        check (status in ('DRAFT', 'PENDING_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
    published_at timestamptz,
    category_id  bigint references categories (id) on delete set null,
    file_id      uuid references media_files (id) on delete set null,
    author_id    bigint references users (id) on delete set null,
    version      bigint      not null default 0,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index ix_resources_visibility on resources (status, kind);

create table resource_translations (
    resource_id bigint       not null references resources (id) on delete cascade,
    locale      varchar(8)   not null,
    title       varchar(300) not null,
    description text,
    primary key (resource_id, locale)
);

-- ---------- Partners ----------
create table partners (
    id          bigint generated always as identity primary key,
    name        varchar(200) not null,
    website_url varchar(500),
    logo_id     uuid references media_files (id) on delete set null,
    sort_order  int          not null default 0,
    active      boolean      not null default true,
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz  not null default now()
);

create table partner_translations (
    partner_id bigint       not null references partners (id) on delete cascade,
    locale     varchar(8)   not null,
    name       varchar(200) not null,
    primary key (partner_id, locale)
);

-- ---------- Homepage + settings ----------
create table homepage_sections (
    id          bigint generated always as identity primary key,
    section_key varchar(50) not null unique,
    enabled     boolean     not null default true,
    sort_order  int         not null default 0,
    content     jsonb       not null default '{}'::jsonb,
    version     bigint      not null default 0,
    updated_by  bigint references users (id) on delete set null,
    updated_at  timestamptz not null default now()
);

create table website_settings (
    setting_key varchar(100) primary key,
    value       jsonb       not null default 'null'::jsonb,
    is_public   boolean     not null default false,
    updated_by  bigint references users (id) on delete set null,
    updated_at  timestamptz not null default now()
);

-- ---------- Audit + contact ----------
create table audit_logs (
    id            bigint generated always as identity primary key,
    occurred_at   timestamptz  not null default now(),
    actor_id      bigint references users (id) on delete set null,
    actor_email   varchar(255),
    action        varchar(40)  not null,
    resource_type varchar(40),
    resource_id   varchar(64),
    summary       varchar(500),
    ip_address    varchar(64)
);
create index ix_audit_time on audit_logs (occurred_at desc);
create index ix_audit_actor on audit_logs (actor_id);
create index ix_audit_resource on audit_logs (resource_type, resource_id);

create table contact_messages (
    id         bigint generated always as identity primary key,
    name       varchar(150) not null,
    email      varchar(255) not null,
    subject    varchar(250),
    message    text         not null,
    locale     varchar(8),
    status     varchar(20)  not null default 'NEW' check (status in ('NEW', 'READ', 'ARCHIVED')),
    ip_address varchar(64),
    handled_by bigint references users (id) on delete set null,
    handled_at timestamptz,
    created_at timestamptz  not null default now()
);
create index ix_contact_status on contact_messages (status, created_at desc);
