<template>
  <div class="docker-hub-instructions">
    <ol>
      <li>
        Create a <strong>personal access token</strong>: Account settings, Personal access tokens,
        Generate new token.
      </li>
      <li>
        Access permissions: <strong>Read-only</strong>. Public Repo Read-only cannot pull private
        images.
      </li>
      <li>Enter your Docker Hub username together with the token.</li>
    </ol>
  </div>
</template>

<style scoped src="@/components/access/instructions.css"></style>
