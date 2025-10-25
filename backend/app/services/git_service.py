from git import Repo, InvalidGitRepositoryError
from pathlib import Path
from typing import Dict


class GitService:
    """Service for interacting with Git repositories."""

    def __init__(self, repo_path: str):
        """
        Initialize Git service.

        Args:
            repo_path: Path to local Git repository

        Raises:
            InvalidGitRepositoryError: If path is not a valid Git repo
        """
        self.repo_path = Path(repo_path).expanduser().resolve()
        try:
            self.repo = Repo(self.repo_path)
        except InvalidGitRepositoryError:
            raise ValueError(f"Not a valid Git repository: {repo_path}")

    def get_repo_metadata(self) -> Dict[str, str]:
        """
        Extract repository metadata.

        Returns:
            Dictionary with:
                - name: Repository name
                - repo_url: Remote origin URL
                - branch: Current branch name
                - commit_sha: Current commit SHA
        """
        # Get repository name from directory
        name = self.repo_path.name

        # Get remote URL (if exists)
        try:
            repo_url = self.repo.remotes.origin.url
        except AttributeError:
            repo_url = None

        # Get current branch
        try:
            branch = self.repo.active_branch.name
        except TypeError:
            # Detached HEAD state
            branch = "detached"

        # Get current commit SHA
        commit_sha = self.repo.head.commit.hexsha

        return {
            "name": name,
            "repo_url": repo_url,
            "branch": branch,
            "commit_sha": commit_sha
        }

    def get_commit_message(self, commit_sha: str | None = None) -> str:
        """Get commit message for a specific commit."""
        if commit_sha:
            commit = self.repo.commit(commit_sha)
        else:
            commit = self.repo.head.commit

        return commit.message.strip()

    def is_dirty(self) -> bool:
        """Check if repository has uncommitted changes."""
        return self.repo.is_dirty()
