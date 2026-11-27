<template>
  <div class="gitlab-instructions">
    <ol>
      <li>
        Create a <strong>deploy token</strong> on the group, or on a single project: Settings,
        Repository, Deploy tokens, Add token. A group token needs the Owner role, a project token
        the Maintainer role.
      </li>
      <li>
        Select the scopes <code>read_registry</code> and <code>read_repository</code>, nothing else.
      </li>
      <li>
        Copy the username GitLab shows (<code>gitlab+deploy-token-&lt;n&gt;</code> unless you set
        one) and the token. One credential covers the registry and git.
      </li>
    </ol>
    <p class="tip">
      Self-hosted GitLab: set both hosts, such as <code>registry.gitlab.example.com</code> and
      <code>gitlab.example.com</code>.
    </p>
  </div>
</template>

<style scoped src="@/components/access/instructions.css"></style>
