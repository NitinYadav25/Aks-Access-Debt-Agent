import { GraphNode, GraphEdge, RawEvidenceRecord } from '../types';

export interface GitHubMember {
  login: string;
  name: string;
  email?: string;
  role: 'admin' | 'member' | 'collaborator';
  suspended: boolean;
  two_factor_auth: boolean;
  department?: string;
}

export interface GitHubTeam {
  slug: string;
  name: string;
  description?: string;
  privacy: 'secret' | 'closed';
  parent_slug?: string;
  members: string[]; // logins
}

export interface GitHubRepository {
  name: string;
  full_name: string;
  private: boolean;
  visibility: 'public' | 'private' | 'internal';
  topics: string[];
  owner: string;
  permissions: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
  team_permissions?: Record<string, 'admin' | 'write' | 'read'>;
  direct_collaborators?: Record<string, 'admin' | 'write' | 'read'>;
}

export interface GitHubOrgExport {
  org: string;
  exported_at: string;
  members: GitHubMember[];
  teams: GitHubTeam[];
  repositories: GitHubRepository[];
}

export interface AwsIamUser {
  UserName: string;
  UserId: string;
  Arn: string;
  CreateDate: string;
  PasswordLastUsed?: string;
  Groups: string[];
  AttachedPolicies: string[];
}

export interface AwsIamRole {
  RoleName: string;
  RoleId: string;
  Arn: string;
  CreateDate: string;
  AssumeRolePolicyDocument: {
    Statement: Array<{
      Effect: 'Allow' | 'Deny';
      Principal: Record<string, string | string[]>;
      Action: string | string[];
    }>;
  };
  AttachedPolicies: string[];
  DirectResourceGrants?: Array<{
    ResourceArn: string;
    ResourceType: 's3' | 'rds' | 'kms' | 'dynamodb' | 'ecs';
    Permission: 'admin' | 'write' | 'read';
    Sensitivity: 'high' | 'medium' | 'low';
  }>;
}

export interface AwsIamExport {
  AccountId: string;
  AccountAlias: string;
  ExportedAt: string;
  Users: AwsIamUser[];
  Roles: AwsIamRole[];
}

export interface OktaUser {
  id: string;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    login: string;
    department?: string;
    userType: 'EMPLOYEE' | 'CONTRACTOR' | 'SERVICE_ACCOUNT';
    contractEndDate?: string;
  };
  status: 'ACTIVE' | 'SUSPENDED' | 'DEPROVISIONED' | 'STAGED';
  lastLogin?: string;
  created: string;
  groupIds: string[];
}

export interface OktaGroup {
  id: string;
  profile: {
    name: string;
    description?: string;
  };
}

export interface OktaExport {
  tenant: string;
  exportedAt: string;
  users: OktaUser[];
  groups: OktaGroup[];
}

export interface ConnectorParseResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  evidence: RawEvidenceRecord[];
  summary: {
    source: string;
    nodesCount: number;
    edgesCount: number;
    evidenceCount: number;
  };
}
