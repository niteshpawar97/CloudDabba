export interface Repository {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  updatedAt: string;
  cloneUrl: string;
  htmlUrl: string;
}

export interface Branch {
  name: string;
  sha: string;
}
