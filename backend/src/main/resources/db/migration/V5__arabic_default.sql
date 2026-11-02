-- Arabic is the site's default language: new users start with it, and the public setting says so.
-- Existing users keep the language they have (change it under Users).
alter table users alter column preferred_locale set default 'ar';
update website_settings set value = '"ar"'::jsonb where setting_key = 'locales.default';
