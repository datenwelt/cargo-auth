DELETE FROM GroupPermissions;
DELETE FROM GroupRoles;
DELETE FROM Groups;
DELETE FROM Origins;
DELETE FROM PasswordResets;
DELETE FROM PermissionBitmaps;
DELETE FROM Permissions;
DELETE FROM RolePermissions;
DELETE FROM Roles;
DELETE FROM Sessions;
DELETE FROM UserActivations;
DELETE FROM UserGroups;
DELETE FROM UserOrigins;
DELETE FROM UserPermissions;
DELETE FROM UserRoles;
DELETE FROM Users;

INSERT INTO Permissions VALUES('SystemReboot', NULL);
INSERT INTO Permissions VALUES('ListOrgCustomers', NULL);
INSERT INTO Permissions VALUES('ListOwnCustomers', NULL);
INSERT INTO Permissions VALUES('InviteUsers', NULL);
INSERT INTO Permissions VALUES('ManageUsers', NULL);

INSERT INTO Roles (id, name) VALUES('admin', 'Administrator');
INSERT INTO Roles (id, name) VALUES('auth-system', 'Authorization System');
INSERT INTO Roles (id, name) VALUES('guest', 'Guest');
INSERT INTO Roles (id, name) VALUES('service', 'Service Staff');

INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 10, 'admin', 'SystemReboot');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 20, 'admin', 'ListOrgCustomers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 30, 'admin', 'ListOwnCustomers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 40, 'admin', 'InviteUsers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 50, 'admin', 'ManageUsers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 10, 'auth-system', 'SystemReboot');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 20, 'auth-system', 'ListOrgCustomers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 30, 'auth-system', 'ListOwnCustomers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 40, 'auth-system', 'InviteUsers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 50, 'auth-system', 'ManageUsers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 10, 'guest', 'SystemReboot');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 20, 'guest', 'ListOrgCustomers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 30, 'guest', 'ListOwnCustomers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 40, 'guest', 'InviteUsers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 50, 'guest', 'ManageUsers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 10, 'service', 'SystemReboot');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 20, 'service', 'ListOrgCustomers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 30, 'service', 'ListOwnCustomers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('allowed', 40, 'service', 'InviteUsers');
INSERT INTO RolePermissions (mode, prio, roleId, permissionName) VALUES('denied', 50, 'service', 'ManageUsers');

INSERT INTO Origins (Hostname) VALUES('localhost');
INSERT INTO Origins (Hostname) VALUES('test.cargohub.io');

INSERT INTO Groups (Id, Name, OriginHostname) VALUES(1, 'Service Admin Group', 'localhost');
INSERT INTO GroupRoles (Prio, GroupId, RoleId) VALUES(10, 1, 'service');
INSERT INTO GroupPermissions (Mode, Prio, GroupId, PermissionName) VALUES('allowed', 10, 1, 'SystemReboot');

INSERT INTO Users (Id, Username, Password, Email, Active) VALUES(1, 'testman', '{SHA1}fb15a1bc444e13e2c58a0a502c74a54106b5a0dc', 'test@testman.de', 1);
INSERT INTO UserOrigins (Id, UserId, OriginHostname) VALUES('1@localhost', 1, 'localhost');
INSERT INTO UserOrigins (Id, UserId, OriginHostname) VALUES('1@test.cargohub.io', 1, 'test.cargohub.io');
INSERT INTO UserGroups (Prio, GroupId, UserOriginId) VALUES(10, 1, '1@localhost');
INSERT INTO UserRoles (Prio, UserOriginId, RoleId) VALUES(10, '1@localhost', 'admin');
INSERT INTO UserPermissions (Mode, Prio, UserOriginId, PermissionName) VALUES('allowed', 10, '1@localhost', 'ListOrgCustomers');

INSERT INTO Users (Id, Username, Password, Email, Active) VALUES(2, 'testman-inactive', '{SHA1}fb15a1bc444e13e2c58a0a502c74a54106b5a0dc', 'test@testman.de', 0);
