-- Editors publish on their own: nobody has to approve their content first.
-- CONTENT_PUBLISH covers publishing, scheduling, archiving and editing what is already live; deleting stays with administrators (CONTENT_DELETE).
-- A super administrator can still take the permission away again under Users & roles (the role then goes back to "submit for review").
-- V2 is not edited: Flyway checks its checksum on databases that already ran it.
insert into role_permissions (role_id, permission_code)
select r.id, 'CONTENT_PUBLISH' from roles r where r.name = 'EDITOR'
on conflict do nothing;

update roles set description = 'Creates, edits and publishes content' where name = 'EDITOR';
update roles set description = 'Manages website content, media, partners and the homepage' where name = 'ADMIN';
