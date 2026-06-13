import { describe, it, expect } from 'vitest';
import { Account } from '../../context/AuthContext';
import {
  createAccountHelper,
  updateAccountHelper,
  deleteAccountHelper
} from '../../context/AuthContext';

describe('User Management Helper Functions', () => {
  const initialAccounts: Account[] = [
    { email: 'super@test.com', username: 'Super User', role: 'super_admin', password: 'pw1' },
    { email: 'admin@test.com', username: 'Admin User', role: 'admin', password: 'pw2' }
  ];

  describe('createAccountHelper', () => {
    it('should successfully append a new account with default password if not provided', () => {
      const result = createAccountHelper(initialAccounts, 'New Admin', 'new@test.com', 'admin');
      expect(result.length).toBe(3);
      expect(result[2]).toEqual({
        username: 'New Admin',
        email: 'new@test.com',
        role: 'admin',
        password: 'admin123'
      });
    });

    it('should successfully append a new account with custom password', () => {
      const result = createAccountHelper(initialAccounts, 'New Super', 'new_super@test.com', 'super_admin', 'custom_pass');
      expect(result.length).toBe(3);
      expect(result[2]).toEqual({
        username: 'New Super',
        email: 'new_super@test.com',
        role: 'super_admin',
        password: 'custom_pass'
      });
    });

    it('should throw an error if the email address is already registered', () => {
      expect(() => {
        createAccountHelper(initialAccounts, 'Dup Admin', 'ADMIN@TEST.COM', 'admin');
      }).toThrow('An account with this email address already exists');
    });
  });

  describe('updateAccountHelper', () => {
    it('should successfully update account details', () => {
      const { updated, updatedAccountObj } = updateAccountHelper(
        initialAccounts,
        'admin@test.com',
        'Updated Admin Name',
        'admin@test.com',
        'admin',
        'super@test.com',
        'new_password'
      );

      expect(updated.length).toBe(2);
      expect(updatedAccountObj.username).toBe('Updated Admin Name');
      expect(updatedAccountObj.password).toBe('new_password');
      expect(updated[1].username).toBe('Updated Admin Name');
    });

    it('should allow changing email address if it does not conflict with another account', () => {
      const { updated } = updateAccountHelper(
        initialAccounts,
        'admin@test.com',
        'Admin User',
        'admin-changed@test.com',
        'admin',
        'super@test.com'
      );
      expect(updated[1].email).toBe('admin-changed@test.com');
    });

    it('should throw an error if changing email to one already registered to another user', () => {
      expect(() => {
        updateAccountHelper(
          initialAccounts,
          'admin@test.com',
          'Admin User',
          'super@test.com',
          'admin',
          'super@test.com'
        );
      }).toThrow('An account with this email address already exists');
    });

    it('should throw an error if the active Super Admin attempts to demote their own role', () => {
      expect(() => {
        updateAccountHelper(
          initialAccounts,
          'super@test.com',
          'Super User',
          'super@test.com',
          'admin',
          'super@test.com'
        );
      }).toThrow('You cannot demote your own role from Super Admin');
    });

    it('should throw an error if account to update is not found', () => {
      expect(() => {
        updateAccountHelper(
          initialAccounts,
          'unknown@test.com',
          'Unknown',
          'unknown@test.com',
          'admin',
          'super@test.com'
        );
      }).toThrow('Account not found');
    });
  });

  describe('deleteAccountHelper', () => {
    it('should successfully filter out the deleted account', () => {
      const result = deleteAccountHelper(initialAccounts, 'admin@test.com', 'super@test.com');
      expect(result.length).toBe(1);
      expect(result[0].email).toBe('super@test.com');
    });

    it('should throw an error if the active Super Admin attempts to delete themselves', () => {
      expect(() => {
        deleteAccountHelper(initialAccounts, 'super@test.com', 'super@test.com');
      }).toThrow('You cannot delete your own active Super Admin account');
    });

    it('should throw an error if the email address to delete does not exist', () => {
      expect(() => {
        deleteAccountHelper(initialAccounts, 'missing@test.com', 'super@test.com');
      }).toThrow('Account not found');
    });
  });
});
