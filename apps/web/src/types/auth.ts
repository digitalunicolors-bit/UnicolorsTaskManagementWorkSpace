export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
}

export interface LoginInput {
  identifier: string;
  password: string;
}